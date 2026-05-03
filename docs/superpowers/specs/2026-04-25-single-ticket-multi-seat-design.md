# Single Ticket per Booking (Multi-Seat QR) — Design

**Status:** Approved for implementation planning
**Date:** 2026-04-25
**Repositories:** `~/Desktop/ZeroWaiting_frontend` + `~/Desktop/ZeroWaiting_backend`

## Problem

Сейчас при покупке N мест на один сеанс создаётся N записей `Ticket` — по одной на каждое место — каждая со своим `qrCode`. Email содержит N QR-блоков, на входе сотрудник сканирует каждое место отдельно. Неудобно и клиенту, и сотруднику.

**Целевое поведение:** `1 Booking → 1 Ticket → 1 QR`. В QR — ссылка, ведущая на публичную страницу билета со списком мест и статусом. Сотрудник сканирует один QR и пропускает всю компанию.

## Scope

Greenfield-миграция (production-данных с живыми клиентами нет). Обратная совместимость на уровне данных не требуется. Существующие тестовые билеты подчищаются через `prisma db push`.

One-shot сканирование (весь билет целиком). Партсканирование (частичное гашение по местам) — **не в этом scope**, но модель оставляет задел.

## Data Model (Prisma)

### Изменения в `Ticket`

```prisma
model Ticket {
  id          String       @id @default(uuid())
  bookingId   String       @unique                           // NEW: 1:1 with Booking
  qrCode      String       @unique @default(uuid())
  status      TicketStatus @default(VALID)
  scannedAt   DateTime?
  scannedById String?                                        // NEW: audit
  scannedBy   User?        @relation(fields: [scannedById], references: [id])
  booking     Booking      @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  createdAt   DateTime     @default(now())

  @@index([status])
  // REMOVED: seatId, seat relation
}
```

### Остальные модели — без изменений

- `Booking`, `BookingSeat`, `Seat`, `Payment` — трогаем только места, где используются `ticket.seatId` / `ticket.seat`.
- Enum `TicketStatus` (`VALID | USED | CANCELLED | EXPIRED`) оставляем. Задел под `PARTIALLY_USED` без ломки схемы.

### Источник правды для мест

Места заказа — только `Booking.seats: BookingSeat[]`. `Ticket` их не дублирует. Это устраняет исходный дубль и упрощает рефанды/отмены.

### Миграция

Одна Prisma migration: `DROP COLUMN seatId`, `ADD UNIQUE (bookingId)`, `ADD COLUMN scannedById + FK`. Тестовые Ticket-записи с >1 на booking подчищаются вручную в dev — `prisma db push` достаточно. Production-миграция в этом scope не требуется.

## Backend: Endpoints

### Изменённые

| Path | Method | Auth | Change |
|---|---|---|---|
| `/bookings/:bookingId/ticket` | GET | Owner/STAFF+ | **Переименован** с `/tickets`. Возвращает один `TicketEntity` (было `Ticket[]`). |
| `/tickets/:qrCode/validate` | GET | STAFF+ | Response включает `booking.screening` (movie/hall/branch/startTime) и `booking.seats: BookingSeat[]` с вложенным `seat` (`rowNumber`, `seatNumber`). |
| `/tickets/:qrCode/scan` | PATCH | STAFF+ | Гасит ticket целиком одним вызовом, пишет `scannedById = req.user.id`. |

### Новый — публичная статус-страница

| Path | Method | Auth | Response |
|---|---|---|---|
| `/public/tickets/:qrCode` | GET | **public** | `PublicTicketDto` |

`PublicTicketDto` (узкий, безопасный для анонима, у которого в руках только QR):

```ts
{
  status: TicketStatus;
  scannedAt: string | null;
  movie: { title: i18nString; posterUrl: string | null; ageRating: string; duration: number };
  branch: { name: i18nString };
  hall:   { name: i18nString };
  startTime: string;         // ISO UTC
  seats: Array<{ row: number; seat: number }>;
}
```

Не возвращается: `userId`, `bookingId`, `totalPrice`, `guestEmail`, `payment.*`, `createdAt`.

### Backend service changes

- `ticket.service.ts::generateTickets(bookingId, seatIds)` → `generateTicket(bookingId)`:
  ```ts
  return this.prisma.ticket.create({ data: { bookingId, qrCode: randomUUID() } });
  ```
- `ticket.service.ts::scanTicket(qrCode, scannedById)` — второй аргумент, пишется в record.
- `ticket.service.ts::getPublicByQr(qrCode)` — новый метод: `findUnique` с минимальным `include`, маппит в `PublicTicketDto`. Возвращает `404` если не найден, возвращает все статусы (страница умеет отобразить USED/CANCELLED/EXPIRED).
- `booking-paid.listener.ts` — вызов `generateTickets` → `generateTicket`, сигнатура `sendTicketEmail(to, booking, ticket)` (один ticket).
- `booking.service.ts` — при `DELETE /bookings/:id` / refund: явный `UPDATE Ticket SET status = 'CANCELLED'` для связанного ticket.

### Auth-модель

- STAFF+ роль покрывает и validate, и scan (существующий паттерн).
- Public endpoint — без auth; QR = токен доступа. Rate-limit не требуется в этом scope (можно добавить позже).

## QR Payload

Содержимое QR: **URL вида `{APP_PUBLIC_URL}/t/{qrCode}`**.

- `APP_PUBLIC_URL` — новая переменная окружения **в backend** (dev: `http://localhost:5173`, prod: `https://zerowaiting.elcho.dev`). Используется `mail.service.ts` при сборке URL для QR-кода в email. Добавляется в `.env.example` и validated через `ConfigService`.
- `qrCode` по-прежнему UUID в БД.
- Камера смартфона → открывает фронтовую публичную страницу.
- STAFF-сканер → парсит последний сегмент URL через regex `/\/t\/([a-f0-9-]+)$/` → вызывает `GET /tickets/:qrCode/validate`.

## Email Template

`mail.service.ts::sendTicketEmail` переделывается. Вместо цикла `tickets.map(...)` — **один блок**:

- Заголовок: «🎫 Ваш билет»
- Места одной строкой, сгруппированные по ряду:
  - Один ряд: «Ряд 5: места 3, 4, 5» (мн. число если >1 место)
  - Разные ряды: «Ряд 5: 3, 4 · Ряд 6: 5»
  - Группировка в утилите `formatSeats(seats: {rowNumber, seatNumber}[]): string`
- Один `<img src="cid:qr@zerowaiting">` 240×240
- Текст `ticket.qrCode` под QR (fallback, monospace)
- Подпись: «Покажите QR на входе — один код на весь заказ»

Stylistically мелочи (dark-theme, фиолетовые акценты ZeroWaiting) сохраняем. Сигнатура: `sendTicketEmail(to: string, booking: TicketEmailBooking, ticket: TicketData)`.

## Frontend: Confirmation & My Bookings

### `/booking/[bookingId]/confirmation/+page.svelte`

Убираем сетку `tickets_grid`. Один блок:

```svelte
<QrCode value={ticketUrl} size={240} />
<SeatsSummary seats={booking.seats} />
<Badge status={ticket.status} variant={statusVariant(ticket.status)} />
```

Query: `createGetBookingsByBookingIdTicketV1(bookingId)` (singular).

`ticketUrl` — собирается на клиенте из `window.location.origin + '/t/' + ticket.qrCode` (confirmation рендерится на том же домене, что и публичная страница — дополнительный env-var не нужен).

### `profile/bookings/+page.svelte`

Структура не меняется. Клик по бронированию → тот же confirmation.

### Новый компонент `src/components/booking/SeatsSummary.svelte`

- Принимает `seats: BookingSeatEntity[]`.
- Группирует по `seat.rowNumber`, сортирует seats внутри ряда по `seatNumber`.
- Рендерит через i18n ключ `ticket.rowSeats` с plural:
  - `{row=5, seats="3, 4, 5"}` → «Ряд 5: места 3, 4, 5»
  - `{row=5, seats="3"}` → «Ряд 5: место 3»
- Используется на confirmation, на `/t/[qrCode]`, и в сканере.

## Public Status Page `/t/[qrCode]`

Новый маршрут `src/routes/t/[qrCode]/+page.svelte` **вне** `(client)` / `admin` layouts.

- Отдельный layout `src/routes/t/+layout.svelte` — минимальный chrome (лого ZeroWaiting по центру сверху), без навигации.
- `+page.ts` load function: `fetch('/api/v1/public/tickets/' + qrCode)`, возвращает `PublicTicketDto`. 404 → дефолтная SvelteKit error page с «Билет не найден».
- Рендер:
  - Постер + название фильма
  - Зал + кинотеатр
  - Дата + время (форматируется через `@/lib/utils/datetime`)
  - `<SeatsSummary seats={...} />`
  - Большой `<Badge>` статуса с цветом:
    - `VALID` — зелёный, «Действителен»
    - `USED` — серый, «Использован {scannedAt}»
    - `CANCELLED` — красный, «Отменён»
    - `EXPIRED` — серый, «Срок действия истёк»
- i18n: `$_()` (как на клиенте).
- Read-only. Никакой интерактивности, никаких кнопок гашения.

## Scanner `/scanner` + Header integration

### Route

`src/routes/scanner/+page.svelte` с собственным `+layout.svelte` — вне клиентского/админского layouts. Минимальный chrome: лого, кнопка «назад» на `/`, full-screen camera view.

`RoleGuard` при входе — STAFF+; иначе redirect на `/` с toast. Guard — через `$app/state` + `+layout.server.ts` load function (проверка роли из сессии).

### QR detection

Библиотека: **`@zxing/browser`** (лучше на слабом свете, работает с `<video>` напрямую, ~100 KB но даёт стабильность на входе в зал).

Flow:
1. `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` → подключить к `<video>`.
2. `BrowserMultiFormatReader.decodeFromVideoDevice(...)` — callback на каждый детект.
3. Парсим URL regex'ом `/\/t\/([a-f0-9-]+)$/`. Не-URL строки → показать «Неизвестный формат QR».
4. Stop decoding, вызвать `GET /tickets/:qrCode/validate`:
   - ответ → показать карточку: фильм / зал / время / `SeatsSummary` / badge статуса.
   - если `VALID` — кнопка «Погасить» активна.
   - если `USED`/`CANCELLED`/`EXPIRED` — кнопка disabled, красный badge, сообщение «Уже использован / Отменён / Истёк».
5. По клику «Погасить» → `PATCH /tickets/:qrCode/scan` → toast успеха → auto-reset через 3 секунды (или кнопка «Следующий»).

### Header button

В `Header.svelte` (client-layout) и `AdminHeader.svelte` — новая иконка QR-сканера (svg `scan-line` из существующего набора, либо добавить один). **Видна только при `user.role >= STAFF`**. Клик → `goto('/scanner')`.

В мобильном drawer — тот же пункт с подписью.

В `admin/Sidebar.svelte` — пункт «Сканер» под общими ссылками.

### Offline handling

Если сеть упала во время `scan` — показать error toast «Нет связи, повторите». Идемпотентность `scan` на backend (повторный PATCH для уже USED ticket возвращает 400 — это нормально, в UI трактуем как «уже погашен»).

## i18n

Новые ключи (все 5 локалей: ru, en, ky, kz, uz):

```
ticket:
  yourTicket: "Ваш билет"
  seatsLabel: "Места"
  rowSeats:
    one:   "Ряд {row}: место {seats}"
    other: "Ряд {row}: места {seats}"
  showAtEntrance: "Покажите QR на входе"

publicTicket:
  statusUsedAt: "Использован {time}"

scanner:
  title: "Сканер билетов"
  scanHint: "Наведите камеру на QR-код"
  markUsed: "Погасить"
  alreadyUsed: "Уже использован"
  cancelled: "Билет отменён"
  expired: "Срок действия истёк"
  noCamera: "Нет доступа к камере"
  scanSuccess: "Билет погашен"
  unknownFormat: "Неизвестный формат QR"
  networkError: "Нет связи, повторите"
  next: "Следующий"
```

Сканер — клиентская утилита (доступна через header всем STAFF+, не только внутри admin-панели), поэтому **использует `$_()` i18n, а не hardcoded ru**. Это сознательное исключение из правила CLAUDE.md «Admin = русский hardcoded» — `/scanner` не является admin-панелью.

## Testing

### Backend (Vitest)

- `ticket.service.spec.ts`:
  - `generateTicket(bookingId)` создаёт один ticket с UUID qrCode.
  - `scanTicket(qrCode, scannedById)` пишет `scannedById`, переводит в USED, ставит `scannedAt`.
  - Повторный `scanTicket` на USED → `BadRequestException`.
  - `validateQr` возвращает ticket с booking.screening + booking.seats[].
  - `getPublicByQr` — возвращает `PublicTicketDto` без приватных полей (userId, totalPrice, etc.).
- Integration: POST payment → ровно один ticket создаётся → `GET /public/tickets/:qr` возвращает массив seats со всеми купленными местами.

### Frontend

- Smoke: confirmation page рендерит один `<QrCode>` и `SeatsSummary` со всеми местами.
- `SeatsSummary` — unit: группировка {row=5, seats=[3,4,5]} → «Ряд 5: места 3, 4, 5»; {row=5,6 смешанные} → «Ряд 5: 3, 4 · Ряд 6: 5».
- Scanner — manual E2E на реальной камере (моки камеры дают мало).

### Миграция

Greenfield — отдельные тесты миграции не нужны. Проверка вручную: `prisma db push` на dev-БД.

## Out of scope (явно)

- Партсканирование (частичное гашение по местам).
- Refund/отмена брони с авто-возвратом — `Ticket.status = CANCELLED` выставляется, но полноценный refund-флоу за скобками.
- Rate-limiting публичного `/public/tickets/:qrCode` endpoint.
- Offline-валидация (JWT в QR).
- Автоматическое выставление `EXPIRED` по cron после окончания сеанса.
- Email-шаблон для CANCELLED/refund уведомлений.

## Risks

- **Library size**: `@zxing/browser` ~100 KB — приемлемо для route-level code-split. Если критично — рассмотреть `jsqr` (~3 KB, но хуже на слабом свете).
- **Camera permissions**: браузеры в iOS Safari требуют HTTPS — dev через `localhost` работает, staging должен быть на HTTPS.
- **Layout isolation for `/scanner`**: важно убедиться, что свой layout корректно обходит `(client)` group — проверить в превью.

## Files Touched (high-level)

### Backend

- `prisma/schema.prisma` — изменение модели Ticket
- `prisma/migrations/2026xxxx_single_ticket_per_booking/migration.sql` — одна миграция
- `src/ticket/ticket.service.ts` — переписать `generateTickets` → `generateTicket`, `scanTicket` с `scannedById`, новый `getPublicByQr`
- `src/ticket/ticket.controller.ts` — переименовать endpoint в singular, новый public controller для `/public/tickets/:qrCode`
- `src/ticket/dto/public-ticket.dto.ts` — новый DTO
- `src/booking/listeners/booking-paid.listener.ts` — singular ticket flow
- `src/mail/mail.service.ts` — новый template с одним QR
- `src/booking/booking.service.ts` — CANCEL ticket при отмене booking
- `src/ticket/ticket.service.spec.ts` — обновление тестов

### Frontend

- `src/api/...` — регенерация Orval после backend deploy
- `src/routes/(client)/booking/[bookingId]/confirmation/+page.svelte` — один QR
- `src/routes/t/[qrCode]/+page.svelte` + `+page.ts` + `+layout.svelte` — публичная страница
- `src/routes/scanner/+page.svelte` + `+layout.svelte` + `+layout.server.ts` (role guard) — сканер
- `src/components/booking/SeatsSummary.svelte` — новый компонент
- `src/components/layout/Header.svelte` + `AdminHeader.svelte` — кнопка сканера для STAFF+
- `src/components/layout/admin/Sidebar.svelte` — пункт «Сканер»
- `src/lib/i18n/locales/{ru,en,ky,kz,uz}.json` — новые ключи
- `package.json` — добавить `@zxing/browser`

## Open Questions

None. Все развилки определены в брейншторме.
