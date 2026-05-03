# Partial Ticket Redemption — Design Spec

**Date:** 2026-04-26
**Status:** Approved (brainstorming → spec)
**Repos:** `ZeroWaiting_frontend` + `ZeroWaiting_backend` (cross-repo)
**Branch:** decision on whether to extend current `feat/single-ticket-multi-seat` or branch fresh off `main` is deferred to the implementation plan.

## Problem

При покупке нескольких мест создаётся **один QR-код на всю бронь**. При сканировании staff подтверждает **сразу все места**. Если часть людей опаздывает, их билеты тоже становятся `USED`, и они теряют возможность пройти позже.

## Goal

Перевести модель «один билет = вся бронь» на «один билет = одно место», добавить:

1. Частичное погашение (staff выбирает чекбоксами какие места погасить)
2. Индивидуальные QR на каждое место (Tab 2 в UI билета)
3. Общий QR-просмотрщик (Tab 1 в UI билета) — non-credential
4. Откат погашения тем же staff в окне 60 сек
5. Share-функция (`navigator.share` + clipboard fallback) для общего и индивидуального QR

## Non-Goals

- Per-seat отмена брони / рефанд (cancel — только всю бронь, как сейчас)
- Admin UI для ручного управления статусами `Ticket`
- Push-уведомления staff
- Изменения в `group-booking` (не использует `Ticket`)
- Кастомные deep-links для IG Story / WhatsApp (только `navigator.share`)
- Изменение PENDING seat-conflict логики (`BookingSeat` роль не меняется)

## Architecture

Разделяем три концепта, которые сейчас спутаны:

| Концепт | Сущность | Назначение |
|---|---|---|
| Заказ + оплата | `Booking` | money flow, статус оплаты |
| Удержание места | `BookingSeat` | seat-conflict на стадии PENDING |
| Пропуск на вход | `Ticket` | credential per seat (QR, статус, кто сканировал) |
| Просмотрщик | `Booking.viewerCode` | публичный токен для share/master-scan, **не** credential |

`Ticket` теперь 1:1 с `BookingSeat` (а не с `Booking`). На стадии `PENDING` билетов нет; они создаются массово при `booking.paid`. `Booking.viewerCode` — публичный UUID-токен на бронь; URL `/t/m/{viewerCode}` показывает страницу со всеми билетами и общим QR (общий QR при сканировании staff'ом открывает модалку с чекбоксами — это «список билетов», а не сам билет).

## Data Model

### Prisma diff

```prisma
model Booking {
  // existing fields ...
  viewerCode  String  @unique @default(uuid())
}

model BookingSeat {
  // existing fields ...
  ticket  Ticket?
}

enum TicketStatus {
  VALID
  USED
  CANCELLED
  EXPIRED
}

model Ticket {
  id            String        @id @default(uuid())
  bookingSeatId String        @unique          // CHANGED: was bookingId @unique
  qrCode        String        @unique @default(uuid())
  status        TicketStatus  @default(VALID)
  scannedAt     DateTime?
  scannedById   String?

  bookingSeat  BookingSeat  @relation(fields: [bookingSeatId], references: [id], onDelete: Cascade)
  scannedBy    User?        @relation("TicketScannedBy", fields: [scannedById], references: [id])

  createdAt    DateTime  @default(now())

  @@index([status])
  @@index([scannedAt])
}
```

Удаляется поле `Ticket.bookingId @unique`.

### Lifecycle

1. `BookingSeat` создаётся при `Booking.PENDING` — без `Ticket`
2. По событию `booking.paid` (`booking-paid.listener.ts`) для каждого `BookingSeat` создаётся `Ticket(status=VALID)`
3. Скан → `USED` (`scannedAt`/`scannedById` заполнены)
4. Откат: `USED → VALID` если `now() − scannedAt < 60 сек` И `scannedById === currentUser.id`
5. `Booking.CANCELLED` → каскадно все `Ticket.status = CANCELLED`
6. После `screening.endTime` (cron, раз в час) → `VALID → EXPIRED`

### Производное состояние брони (не в БД)

- `tickets.every(t => t.status === USED)` → бронь полностью использована
- `tickets.some(t => t.status === VALID)` → бронь частично активна

### Migration

⚠ Поскольку проект на стадии разработки и breaking-change приемлем, **рекомендуемый путь** — `prisma migrate reset` + reseed.

Backfill-скрипт (если данные нужно сохранить) приведён в плане имплементации; ключевой шаг — на каждый существующий `Ticket(bookingId)` сгенерировать N-1 sibling-билетов по числу `BookingSeat`, перенести `bookingSeatId`, дропнуть `bookingId`. Скрипт с детализацией — в implementation plan.

## API Contract

### Master (Booking.viewerCode) — Tab 1 / общий QR

```
GET  /api/v1/tickets/master/:viewerCode/validate          [STAFF+]
  → 200 ValidatedMasterTicketDto {
      booking: { id, screening: {...} },
      seats: [
        {
          ticketId, qrCode, seatId,
          row, seat,
          status, scannedAt, scannedById,
          canRevert: boolean
        }
      ]
    }
  → 404 viewerCode не найден

PATCH /api/v1/tickets/master/:viewerCode/scan             [STAFF+]
  body: { ticketIds: string[] }
  → 200 { redeemed: TicketDto[], skipped: TicketDto[] }
  → 400 ticketIds не принадлежат этой брони
```

### Per-seat (Ticket.qrCode) — Tab 2 / индивидуальный QR

```
GET  /api/v1/tickets/:qrCode/validate                     [STAFF+]
  → 200 ValidatedTicketDto {
      ticketId, qrCode, status, scannedAt,
      booking: { id, screening },
      seat: { row, seat },
      canRevert: boolean
    }
  → 404

PATCH /api/v1/tickets/:qrCode/scan                        [STAFF+]
  body: empty
  → 200 TicketDto (status=USED)
  → 409 уже USED/CANCELLED/EXPIRED
```

### Revert (общий)

```
PATCH /api/v1/tickets/:qrCode/revert                      [STAFF+]
  body: empty
  → 200 TicketDto (status=VALID, scannedAt=null, scannedById=null)
  → 403 scannedById !== currentUser.id
  → 410 now() - scannedAt > 60 сек
```

### Public (no auth)

```
GET  /api/v1/public/tickets/master/:viewerCode
  → 200 PublicMasterTicketDto {
      movie, branch, hall, startTime,
      seats: [{ row, seat, qrCode, status, scannedAt }]
    }

GET  /api/v1/public/tickets/:qrCode                       (существует)
  → 200 PublicTicketDto (одно место)
```

### Concurrency

`scanMaster` использует Prisma `$transaction` с `updateMany({ where: { id: { in: ticketIds }, status: 'VALID' } })` → `findMany` для returned set → разделение на `redeemed` / `skipped`. Это idempotent: повторный скан тех же `ticketIds` вернёт `redeemed: []`, `skipped: [...все...]`.

`scanTicket(qrCode)` — `update({ where: { qrCode, status: 'VALID' } })`; P2025 → 409.

`revertTicket` — `update({ where: { qrCode, status: 'USED', scannedById: actorId, scannedAt: { gte: new Date(Date.now()-60_000) } } })`; P2025 → 410 Gone (если `scannedById` не совпадает — отдельная проверка → 403).

### Audit log

Три новых события: `TICKET_SCAN`, `TICKET_SCAN_MASTER`, `TICKET_REVERT`. Поля: `actorId`, `entityType=Ticket`, `entityId`, `payload={ticketIds | qrCode, before, after}`.

## Backend Changes

### Files

- `prisma/schema.prisma` — diff выше
- `src/ticket/ticket.service.ts` — переписать (см. сигнатуры ниже)
- `src/ticket/ticket.controller.ts` — новый набор эндпоинтов
- `src/ticket/public-ticket.controller.ts` — добавить master endpoint
- `src/ticket/dto/` — `validated-master-ticket.dto.ts`, `validated-ticket.dto.ts` (refactor), `public-master-ticket.dto.ts`
- `src/booking/listeners/booking-paid.listener.ts` — `generateTicket` → `generateTicketsForBooking`
- `src/mail/mail.service.ts` — `sendTicketEmail` принимает `viewerCode` + список per-seat URLs
- `src/audit-log/...` — три новых event type
- Cron / scheduler module — добавить `expireTickets()` task (раз в час)

### Service signatures

```ts
class TicketService {
  generateTicketsForBooking(bookingId: string): Promise<Ticket[]>
  validateMaster(viewerCode: string, actorId: string): Promise<ValidatedMasterTicketDto>
  scanMaster(viewerCode: string, ticketIds: string[], actorId: string)
    : Promise<{ redeemed: Ticket[]; skipped: Ticket[] }>
  validateTicket(qrCode: string, actorId: string): Promise<ValidatedTicketDto>
  scanTicket(qrCode: string, actorId: string): Promise<Ticket>
  revertTicket(qrCode: string, actorId: string): Promise<Ticket>
  getPublicMaster(viewerCode: string): Promise<PublicMasterTicketDto>
  getPublicTicket(qrCode: string): Promise<PublicTicketDto>
}
```

## Frontend Changes

### New routes

- `src/routes/t/m/[viewerCode]/+page.svelte` — публичный viewer (Tab 1 + Tab 2)

### Modified routes

- `src/routes/(client)/booking/[bookingId]/confirmation/+page.svelte` — заменяем единый QR на `<TicketViewer>` компонент
- `src/routes/t/[qrCode]/+page.svelte` — упрощается (теперь это всегда **один билет**)
- `src/routes/scanner/+page.svelte` — расширенная state-machine (master + per-seat ветки)

### New components (under `src/components/booking/`)

- `TicketViewer.svelte` — корень: два таба, принимает `seats`, `viewerUrl`, `screening`/`movie`/`branch`/`hall`
- `TicketTabsMaster.svelte` — Tab 1: один большой QR (`<QrCode value={viewerUrl}/>`), список мест текстом, badge суммарного статуса, `<ShareButton url={viewerUrl}/>`
- `TicketTabsIndividual.svelte` — Tab 2: grid из `<SeatTicketCard>`
- `SeatTicketCard.svelte` — QR + ряд/место + badge + share-button per seat
- `ShareButton.svelte` — `navigator.share` + clipboard fallback + toast

### New components (under `src/routes/scanner/components/`)

- `MasterScanModal.svelte` — модалка с чекбоксами, кнопка «Погасить (N)»
- `SeatRedeemedView.svelte` — успешный экран per-seat с обратным таймером отката
- `RevertCountdown.svelte` — мини-таймер 60 сек с `onExpire` callback

### Removed

- `src/routes/scanner/components/ScannerResult.svelte` — заменяется двумя выше
- старая логика `markUsed()` в `scanner/+page.svelte` (переезжает в новые компоненты)
- единый QR-блок в `confirmation/+page.svelte`

### Booking response — embedding

`Ticket` встраивается в `BookingEntity` через `BookingSeat.ticket` (Prisma DTO generator). После регенерации Orval (`bun run generate:api`) типы подтянутся. На `PENDING` массив пустой, на `CONFIRMED+` — заполнен. Один запрос, один кеш-ключ TanStack Query.

### Scanner state machine

```ts
type Phase =
  | 'scanning'
  | 'masterModal'
  | 'seatRedeemed'
  | 'seatRevertable'
  | 'error'
```

**Master flow:**
1. `scan` → `validate(viewerCode)` → `phase = 'masterModal'`
2. Модалка: `VALID` чекбоксы preselected; `USED`/`CANCELLED`/`EXPIRED` задизейблены; для USED+canRevert — мини-кнопка «Отменить (45с)»
3. Staff → «Погасить (N)» → `PATCH master/scan { ticketIds }`
4. Toast: «Погашено N, осталось M»

**Per-seat flow:**
1. `scan` → `validate(qrCode)` → если VALID, **сразу** PATCH `scan` (без подтверждения)
2. `phase = 'seatRevertable'` — большая ✅, кнопка «Отменить (60)» с обратным таймером
3. Revert в окне → PATCH `revert` → toast «Откат» → `scanning`
4. Таймер истёк → кнопка прячется, остаётся «Дальше»
5. Не-VALID статус → «Уже использован» / «Отменён» / «Истёк» + «Дальше»

### URL parsing

`src/lib/utils/parse-ticket-url.ts` расширяется:

```ts
type ParsedTicketQr =
  | { kind: 'master'; token: string }
  | { kind: 'seat'; token: string }
  | null
```

Тесты обновляются (`parse-ticket-url.test.ts`).

### Email

`mail.service.ts → sendTicketEmail` сигнатура расширяется: принимает `viewerCode` для основной QR-картинки и список `qrCode` per-seat для текста письма. Картинка QR в письме генерируется под `/t/m/{viewerCode}`.

### i18n keys (новые, все 5 локалей: ru/en/ky/kz/uz)

```
ticket.tabs.master
ticket.tabs.individual
ticket.share
ticket.shareCopied
ticket.statusPartiallyUsed       ({count} {total})
ticket.entryWithThisQr

scanner.markUsedCount            ({count})
scanner.partialResult            ({redeemed} {skipped})
scanner.revertCountdown          ({seconds})
scanner.revertSuccess
scanner.errors.alreadyUsed
scanner.errors.cancelled
scanner.errors.expired
scanner.errors.revertExpired
scanner.errors.revertForbidden
scanner.errors.invalidTicket
scanner.errors.notFound
scanner.errors.network
```

### Share

`navigator.share({ url, title, text })` — на mobile открывает системный share-sheet (WhatsApp, IG, Telegram, Mail, AirDrop). На desktop fallback — `navigator.clipboard.writeText(url)` + toast «ссылка скопирована».

Расположение кнопок:
- Tab 1 (общий) — одна кнопка `Share` отдаёт `viewerCode` URL
- Tab 2 (индивидуальные) — иконка-кнопка `Share` на каждой плитке, отдаёт `qrCode` URL конкретного билета

## Error Handling Matrix

| Сценарий | HTTP | i18n key |
|---|---|---|
| `scan` уже USED | 409 | `scanner.errors.alreadyUsed` |
| `scan` CANCELLED | 409 | `scanner.errors.cancelled` |
| `scan` EXPIRED | 409 | `scanner.errors.expired` |
| `revert` окно истекло | 410 | `scanner.errors.revertExpired` |
| `revert` чужой staff | 403 | `scanner.errors.revertForbidden` |
| `master/scan` ticketIds не из этой брони | 400 | `scanner.errors.invalidTicket` |
| QR не распознан | 404 | `scanner.errors.notFound` |
| Сетевая ошибка | — | `scanner.errors.network` |

Backend бросает `BadRequestException` / `ConflictException` / `GoneException` / `ForbiddenException`. Frontend мапит через существующий `getErrorMessage` util.

## Testing

### Backend

- `src/ticket/ticket.service.spec.ts` — переписать
  - `generateTicketsForBooking` создаёт N билетов на N мест
  - `scanMaster` idempotent (повторный вызов с теми же ticketIds → пустой redeemed)
  - `scanMaster` параллельно (race) — sum(redeemed) + sum(skipped) === ticketIds.length
  - `revertTicket` — внутри 60с / >60с / чужой staff
- `src/booking/booking.service.spec.ts` — сценарий «оплата → N тикетов»

### Frontend

- `src/lib/utils/parse-ticket-url.test.ts` — обновить: master URL, per-seat URL, мусор → `null`
- Юнит-тесты `RevertCountdown.svelte`, `MasterScanModal.svelte` (selection logic)
- Manual smoke (CLAUDE.md требует ручной UI-тест для UI):
  1. Бронь с 4 местами → confirmation → Tab 1 (общий QR) → Tab 2 (4 QR'a)
  2. Сканирование общего QR → модалка с 4 чекбоксами → снять 2 → «Погасить (2)» → toast
  3. Late scenario: сканирование индивидуального QR (одного из оставшихся) → мгновенное гашение + revert-таймер
  4. Revert внутри 60с → билет снова VALID
  5. Revert >60с → 410 + toast
  6. Share Tab 1 → URL viewerCode; Share Tab 2 (одна плитка) → URL qrCode
  7. Race: два staff одновременно сканируют общий QR с пересечением — оба получают корректный partial result

## Open / Deferred

- Cron-задача `expireTickets()` — точное место (новый scheduler или существующий) уточняется в implementation plan
- Замена ветки: текущая `feat/single-ticket-multi-seat` уже содержит часть scope — решение «реюзать или начать чисто» — в implementation plan

## References

- Current scanner: `src/routes/scanner/+page.svelte`, `src/routes/scanner/components/ScannerResult.svelte`
- Current confirmation: `src/routes/(client)/booking/[bookingId]/confirmation/+page.svelte`
- Current public ticket: `src/routes/t/[qrCode]/+page.svelte`
- Current backend: `src/ticket/ticket.service.ts`, `src/booking/listeners/booking-paid.listener.ts`
- Prisma schema: `prisma/schema.prisma` lines 324-423 (Booking / BookingSeat / Ticket)
