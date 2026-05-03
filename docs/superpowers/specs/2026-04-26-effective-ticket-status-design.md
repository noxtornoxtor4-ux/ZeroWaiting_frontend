# Effective Ticket Status — Design

**Status:** Approved
**Date:** 2026-04-26

## Problem

Билет может оставаться в БД со статусом `VALID` после окончания сеанса.
Причина — крон `expireTickets` срабатывает только `EVERY_HOUR`, поэтому
есть окно до 60 минут, когда `screening.endTime < now`, но в БД билет
всё ещё `VALID`. Это даёт два бага:

1. **Display issue:** UI (confirmation page, public master, public single
   ticket viewer, scanner pre-validation) показывает «Действителен» для
   фактически истёкшего билета.
2. **Security issue:** scanner endpoints (`scanMaster`, `scanTicket`)
   фильтруют по `where: { status: 'VALID' }` без проверки `endTime` —
   истёкший билет можно фактически прокатить через входной QR-сканер.

## Goals

- Любой read эндпойнт, отдающий `ticket.status`, возвращает effective
  status: `VALID + screening.endTime < now → 'EXPIRED'`.
- Scan endpoints отказываются обрабатывать истёкший билет (`410 Gone`).
- API contract не меняется: тот же `TicketStatus` enum (`VALID | USED |
  CANCELLED | EXPIRED`), никаких новых полей. Frontend получает «правду»
  через тот же канал, без своих изменений.
- Cron `expireTickets` остаётся как есть (`EVERY_HOUR`) — eventually
  consistent housekeeping для БД.

## Non-Goals

- Изменение крона (частоты или удаление).
- Изменение фронтенда. Effective status проявляется через тот же
  `TicketStatus` enum, который фронт уже умеет рендерить через
  `TICKET_STATUS_CONFIG` и i18n.
- Database migrations / GENERATED columns.
- `revertTicket` — staff-action поверх 60-секундного окна, не зависит
  от `screening.endTime`. Не трогаем.
- Group bookings — `group-booking.service.ts` оперирует только
  `BookingStatus`, не `TicketStatus`. Не трогаем.

## Architecture

### Pure helper

**`~/Desktop/ZeroWaiting_backend/src/ticket/utils/effective-ticket-status.ts`** (новый):

```ts
import { TicketStatus } from '@prisma/client';

/**
 * Returns 'EXPIRED' when ticket is structurally VALID but its screening
 * has already ended. Other states (USED, CANCELLED, EXPIRED) are
 * preserved — they are terminal and time cannot move them.
 */
export const effectiveTicketStatus = (
  rawStatus: TicketStatus,
  screeningEndTime: Date,
  now: Date = new Date()
): TicketStatus =>
  rawStatus === 'VALID' && screeningEndTime.getTime() < now.getTime()
    ? 'EXPIRED'
    : rawStatus;
```

**Why pure:** третий параметр `now` подменяется в тестах для детерминизма
без `vi.useFakeTimers`.

### Read endpoints — apply on egress

Везде, где сервис маппит `ticket.status` в ответ, оборачиваем в helper.
`screening.endTime` уже есть в большинстве `include`; где нет —
добавляем минимально (`screening: { select: { endTime: true } }`).

#### `ticket.service.ts`

- **`getPublicMaster`** (строки ~223–242) — `seats[].status`.
- **`getPublicTicket`** (строки ~244–269) — `status`.
- **`validateMaster`** (строки ~60–89) — `seats[].status`.
- **`validateTicket`** (строки ~140–170) — `status`.

Шаблон:
```ts
status: effectiveTicketStatus(bs.ticket!.status, booking.screening.endTime),
```

#### `booking.service.ts`

- **`findOne`** (строка ~333) — обходим `booking.seats`, для каждого
  `bs.ticket` мутируем `bs.ticket.status` через helper перед возвратом.
- **`findAll`** / `findByScreening` (строки ~431+) — те же seats. Если
  `screening` сейчас не подгружается — добавляем
  `screening: { select: { endTime: true } }`.

Шаблон:
```ts
if (booking.seats && booking.screening) {
  for (const bs of booking.seats) {
    if (bs.ticket) {
      bs.ticket.status = effectiveTicketStatus(
        bs.ticket.status,
        booking.screening.endTime
      );
    }
  }
}
```

### Scan endpoints — defense at the door

#### `scanMaster` (строки ~91–138)

Сейчас `tx.booking.findUnique` подгружает только `seats`. Добавляем
`screening: { select: { endTime: true } }` к include и перед
`tx.ticket.updateMany` — проверка `endTime < now`:

```ts
const booking = await tx.booking.findUnique({
  where: { viewerCode },
  include: {
    seats: { include: { ticket: true } },
    screening: { select: { endTime: true } }   // ← новое
  },
});
if (!booking) throw new NotFoundException('Booking not found');

const now = new Date();
if (booking.screening.endTime.getTime() < now.getTime()) {
  throw new GoneException('Screening already ended; tickets are expired');
}
// ... rest of existing scan logic
```

#### `scanTicket` (строки ~172–191)

Сейчас `scanTicket` принимает только `qrCode` и сразу делает `update`.
Расширяем: предварительный read `screening.endTime` через `findUnique`
с тонким `select`, потом тот же existing update в той же транзакции.

```ts
async scanTicket(qrCode: string, actorId: string) {
  return this.prisma.$transaction(async (tx) => {
    const found = await tx.ticket.findUnique({
      where: { qrCode },
      select: {
        bookingSeat: {
          select: { booking: { select: { screening: { select: { endTime: true } } } } },
        },
      },
    });
    if (!found) throw new NotFoundException('Ticket not found');

    const endTime = found.bookingSeat.booking.screening.endTime;
    if (endTime.getTime() < Date.now()) {
      throw new GoneException('Screening already ended; ticket is expired');
    }

    try {
      const result = await tx.ticket.update({
        where: { qrCode, status: 'VALID' },
        data: { status: 'USED', scannedAt: new Date(), scannedById: actorId },
      });
      await this.auditLog.log('TICKET_SCAN', 'Ticket', result.id, actorId, { qrCode });
      return result;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2025') {
        throw new ConflictException('Ticket cannot be scanned in current state');
      }
      throw e;
    }
  });
}
```

Один лишний read до update — допустимая цена. Транзакция гарантирует
атомарность.

### Error contract

Сканер возвращает **`410 Gone`** (`GoneException` из `@nestjs/common`)
для случая «сеанс закончился». Семантически точный код для «ресурса
больше нет в этом состоянии».

Frontend сканера сейчас обрабатывает `409 Conflict` (USED/CANCELLED).
Добавляется один branch на `410` → один i18n-ключ
`scanner.ticketExpired` (если ещё нет — добавить во все 5 локалей).

### Cron — без изменений

`expireTickets` (`EVERY_HOUR`) остаётся как есть. Его роль — поддерживать
БД в согласованном состоянии для отчётов и выборок «все истёкшие билеты
за месяц», не требуя `JOIN screening` в каждом запросе. Effective status
делает крон менее критичным, но не делает его лишним.

## Edge Cases

1. **Граница сеанса:** `endTime.getTime() < now.getTime()` — строго
   меньше. На самой секунде окончания сеанс ещё активен. Совпадает с
   текущим поведением крона (`{ lt: now }`).

2. **Часовые пояса:** `endTime` хранится как `DateTime` (UTC) в Prisma.
   `new Date()` тоже UTC под капотом. Сравнение корректно независимо от
   TZ сервера.

3. **`screening` не в include:** type-check падает, потому что
   `effectiveTicketStatus` принимает `Date`, а не `Date | undefined`.
   Защита от регрессии.

4. **`EXPIRED` в БД, screening сдвинут в будущее** (теоретически — admin
   правит сеанс): helper возвращает `EXPIRED` (terminal preserved).
   Корректно — билет один раз истёк, обратно не возвращается.

5. **`USED` до окончания сеанса, сейчас сеанс закончился:** helper
   возвращает `USED`. Корректно — staff отметил вход, время сеанса не
   меняет историю.

6. **Performance:** добавляется максимум один `screening: { select: {
   endTime: true } }` на запрос (где его не было). Это +1 LEFT JOIN,
   индексирован по PK. Безопасно.

## Testing

### Unit — `effective-ticket-status.spec.ts` (новый)

5 case'ов через 3-й параметр `now`:
1. `VALID` + screening не закончился → `VALID`
2. `VALID` + screening закончился → `EXPIRED`
3. `USED` + screening закончился → `USED`
4. `CANCELLED` + screening закончился → `CANCELLED`
5. `EXPIRED` + screening не закончился → `EXPIRED`

### Integration — расширения существующих spec'ов

#### `ticket.service.spec.ts`

- `getPublicMaster` — новый case: `endTime` в прошлом, ticket `VALID` →
  `seats[].status === 'EXPIRED'`.
- `getPublicTicket` — аналогично.
- `validateMaster` — аналогично.
- `validateTicket` — аналогично.
- `scanMaster` — новый case: `endTime` в прошлом → `GoneException`,
  `tx.ticket.updateMany` **не вызвано**.
- `scanTicket` — новый case: `endTime` в прошлом → `GoneException`,
  `tx.ticket.update` **не вызвано**.

#### `booking.service.spec.ts`

- `findOne` — новый case: ticket `VALID`, screening закончился →
  возвращаемый `seats[].ticket.status === 'EXPIRED'`.
- `findAll` — аналогично для одного booking в ответе.

TDD: падающий тест перед каждым изменением сервиса.

### Manual smoke

- `curl` `/api/v1/public/tickets/master/<viewerCode>` для брони с
  закончившимся сеансом — `seats[].status: "EXPIRED"`.
- В админ-сканере попытаться отсканировать QR такой брони — получить
  410 + i18n текст «Сеанс уже закончился».
- В UI public master page — статус `Истёк` (i18n из existing
  `booking.ticketStatus.EXPIRED`).

## Risks & Rollback

- **API contract:** zero breaking change. Тот же `TicketStatus` enum,
  никаких новых значений.
- **Behavioral:** клиенты, кэшировавшие `VALID` за последний час, при
  следующем запросе увидят `EXPIRED`. Это правильное поведение, не
  регрессия.
- **Rollback:** `git revert` коммитов в `~/Desktop/ZeroWaiting_backend`,
  перезапуск. Frontend не меняется.

## Files Changed

**Backend (новые):**
- `src/ticket/utils/effective-ticket-status.ts`
- `src/ticket/utils/effective-ticket-status.spec.ts`

**Backend (изменения):**
- `src/ticket/ticket.service.ts` — `getPublicMaster`, `getPublicTicket`,
  `validateMaster`, `validateTicket`, `scanMaster`, `scanTicket`.
- `src/ticket/ticket.service.spec.ts` — расширения cases.
- `src/booking/booking.service.ts` — `findOne`, `findAll`/`findByScreening`.
- `src/booking/booking.service.spec.ts` — расширения cases.

**Frontend (conditional, см. план):**
- `src/lib/i18n/locales/{ru,en,ky,kz,uz}.json` — добавить
  `scanner.ticketExpired` во все 5 локалей **только если** ключа ещё
  нет. Проверка через `grep` при имплементации.
- Сканерный обработчик ошибок (`+page.svelte` или сервис сканирования)
  — один новый `else if (status === 410)` branch с показом
  i18n-ключа выше. Применяется **только если** существующий обработчик
  не сворачивает 410 в общий fallback.

## Out of Scope / Future

- Учащение крона / удаление крона.
- Group bookings.
- `revertTicket`.
- Database migrations.
