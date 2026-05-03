# Unified Ticket Screening Header — Design

**Status:** Approved
**Date:** 2026-04-26

## Problem

После оплаты пользователь попадает на `/booking/:bookingId/confirmation` — там
есть QR-код и список мест, но **нет информации о самом сеансе**: какой фильм,
где, когда. Та же беда на публичной странице билета `/t/m/:viewerCode` — она
показывает заголовок одной строкой, без постера и без структурной шапки.

Цель: единая визуальная шапка с информацией о сеансе на обеих страницах,
плюс свернуть booking-метаданные на confirmation в одну компактную строку.

## Goals

- Единая шапка `<TicketScreeningHeader>` для обеих страниц с одинаковым
  набором полей и идентичной вёрсткой.
- Confirmation: success-блок → шапка фильма → компактная meta-строка
  (`Итого · Статус · #ID prefix`) → `<TicketViewer>` → действия.
- Public: нейтральный заголовок «Билеты / Покажите QR-код на входе» → шапка
  фильма → `<TicketViewer>`.
- Информация в шапке: постер, название, age rating, длительность, формат
  (2D/3D/IMAX), кинотеатр + зал, дата/время начала и конца сеанса.
- Никаких новых хардкоденных строк — все тексты через `svelte-i18n` во всех
  четырёх локалях (`ru/en/ky/kz/uz`).

## Non-Goals

- Редизайн `<TicketViewer>` (master/individual tabs) — остаётся as is.
- Изменение success-блока на confirmation (✅-иконка, заголовок, subtitle) —
  остаётся as is.
- Группа покупок (`/group-bookings/...`) — выходит за scope этой задачи,
  shapes другие, отдельный спек если потребуется.

## Architecture

### Component

**`src/components/booking/TicketScreeningHeader.svelte`** — чистый
презентационный компонент. Не знает о моделях API, принимает
нормализованные props.

```ts
interface Props {
  posterUrl: string | null;
  movieTitle: string;        // уже локализован вызывающей стороной
  ageRating: string;
  duration: number;          // минуты
  branchName: string;        // уже локализован
  hallName: string;
  startTime: string;         // ISO
  format: ScreeningFormat;   // enum из @/api/model
}
```

**Стили:**
- Корневой класс: `.ticket_screening_header` (underscore_case, per CLAUDE.md).
- Контейнер: `glass-card` (используется на проекте уже).
- Лейаут: `display: grid; grid-template-columns: auto 1fr; gap: var(--space-4)`.
- Постер: `96×144` desktop, `72×108` mobile (`< 640px`).
  `border-radius: var(--radius-md)`, `object-fit: cover`.
- Если `posterUrl === null` — плейсхолдер с фоном `var(--surface)` и иконкой
  `lucide:film` 32px по центру, цвет `var(--muted-fg)`.
- Текст справа в три блока, разделённых `gap: var(--space-2)`:
  1. Title (`var(--text-xl)`, `var(--weight-bold)`),
     рядом chip с age rating (`<Badge>` компонент).
  2. Длительность · формат (mute, `--text-sm`).
  3. `lucide:building-2` + `branchName · hallName`, ниже —
     `lucide:calendar` + диапазон даты/времени (`--text-sm`).
- Иконки: `@iconify/svelte`, размер 16px рядом с текстом.

**Адаптивность:** один media-query на `< 640px` — уменьшает постер.

**Реактивность:** компонент не использует `$effect`. Все производные
значения рассчитываются снаружи через `$derived` и передаются props'ами.

### Page composition

#### `/booking/:bookingId/confirmation` (`src/routes/(client)/booking/[bookingId]/confirmation/+page.svelte`)

```
✅ icon (existing)
"Бронирование подтверждено!" (existing)
"Покажите QR-код на входе" (existing)

┌─────────────────────────────────────┐
│  <TicketScreeningHeader />           │   ← NEW
└─────────────────────────────────────┘

Итого 2760 сом · <Badge "Подтверждено" /> · #5b5b1bee   ← compact meta line (NEW, заменяет старую карточку)

┌─────────────────────────────────────┐
│  <TicketViewer />  (existing)        │
└─────────────────────────────────────┘

[Мои бронирования]  [На главную] (existing)
```

**Изменения в `<script>`:**

```ts
import { locale } from 'svelte-i18n';
import { getLocalizedValue } from '@/lib/utils/i18n-field';

const screening = $derived(booking?.screening);
const movieTitle = $derived(
  screening?.movie ? getLocalizedValue(screening.movie.title, $locale) : ''
);
const branchName = $derived(
  screening?.hall?.branch ? getLocalizedValue(screening.hall.branch.name, $locale) : ''
);
```

`<TicketScreeningHeader>` рендерится только при наличии `screening?.movie &&
screening?.hall?.branch`.

**Удаляется:** старая `.card .details` с тремя строками (Booking ID / Итого /
Статус) — заменяется компактной meta-строкой `<p class="booking_meta">`:

```svelte
<p class="booking_meta">
  <span>{$_('screening.total')} <strong>{formatPriceCompact(booking.totalPrice)}</strong></span>
  <span class="dot">·</span>
  <Badge text={$_(BOOKING_STATUS_CONFIG[booking.status]?.labelKey ?? booking.status)}
         color={BOOKING_STATUS_CONFIG[booking.status]?.color ?? 'var(--muted-fg)'} />
  <span class="dot">·</span>
  <span class="booking_id">#{booking.id.slice(0, 8)}</span>
</p>
```

Цвет: `var(--muted-fg)`, размер: `var(--text-sm)`. Booking ID — monospace.

**Loading skeleton:** добавить `<Skeleton height="180px" />` перед существующим
`<Skeleton height="300px" />`, чтобы место под шапку не «прыгало».

#### `/t/m/:viewerCode` (`src/routes/t/m/[viewerCode]/+page.svelte`)

```
🎫 icon (NEW)
"Билеты" (NEW, $_)
"Покажите QR-код на входе" (NEW, $_('booking.scanQr'))

┌─────────────────────────────────────┐
│  <TicketScreeningHeader />          │   ← NEW
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  <TicketViewer />  (existing)        │
└─────────────────────────────────────┘
```

**Удаляется:** текущий рукописный `<h1 class="title">` и `<p class="meta">`.

**Иконка:** `lucide:ticket`, размер 64, цвет `var(--primary)` (отличие от
зелёного ✅ на confirmation, чтобы не путать с «оплачено»).

**Маппинг:**

```ts
const movieTitle = $derived(getLocalizedValue(data.master.movie.title, $locale));
const branchName = $derived(getLocalizedValue(data.master.branch.name, $locale));
// posterUrl, ageRating, duration, hallName, startTime, format —
// напрямую из data.master.{movie,hall,format,startTime}
```

### Backend changes

**1. `ZeroWaiting_backend/src/booking/booking.service.ts:333` (`findOne`).**
Добавить `branch: true` внутрь `hall`:

```diff
 async findOne(id: string) {
   const booking = await this.prisma.booking.findUnique({
     where: { id },
     include: {
       seats: { include: { seat: true, ticket: true } },
-      screening: { include: { movie: true, hall: true } },
+      screening: {
+        include: {
+          movie: true,
+          hall: { include: { branch: true } }
+        }
+      },
       payment: true,
       user: true
     }
   });
```

**2. `ZeroWaiting_backend/src/ticket/dto/public-master-ticket.dto.ts`.**
Добавить поле `format`:

```diff
+import { ScreeningFormat } from '@prisma/client';
+
 export class PublicMasterTicketDto {
   @ApiProperty({ type: MovieDto }) movie!: MovieDto;
   @ApiProperty({ type: BranchDto }) branch!: BranchDto;
   @ApiProperty({ type: HallDto }) hall!: HallDto;
   @ApiProperty() startTime!: string;
+  @ApiProperty({ enum: ScreeningFormat }) format!: ScreeningFormat;
   @ApiProperty({ type: [PublicSeatDto] }) seats!: PublicSeatDto[];
 }
```

**3. Сервис, который собирает `PublicMasterTicketDto`** (предположительно
`src/ticket/public-ticket.service.ts` — точное имя проверить при
имплементации) — добавить `format: screening.format` в выходной payload и
включить `format` в Prisma `select` если он явно перечислен.

**4. OpenAPI re-gen на фронте:**
```bash
bun run generate:api
```
После регена в `src/api/model/hallEntity.ts` `branch?: BranchEntity` должен
быть доступен (если уже не есть), а `PublicMasterTicket200` (или как
именуется generated тип) — содержать `format: ScreeningFormat`.

### Date/time helpers

**Новый helper в `src/lib/utils/datetime.ts`:**

```ts
export const addMinutes = (iso: string, minutes: number): string =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
```

В компоненте:
- Начало: `formatDateTime(startTime)` →  `28 апр, вт · 19:30`.
- Конец: `formatTime(addMinutes(startTime, duration))` → `21:29`.
- Финальный текст: `${formatDateTime(startTime)} – ${formatTime(end)}`.

### i18n

**Новые ключи** (во все четыре локали — `ru/en/ky/kz/uz`):

| Ключ | ru | en |
|---|---|---|
| `ticket.publicHeader.title` | Билеты | Tickets |
| `ticket.header.duration` | `{n} мин` | `{n} min` |
| `ticket.header.timeRange` | `{start} – {end}` | `{start} – {end}` |

**Переиспользуем:**
- `booking.scanQr` — subtitle на public странице.
- `screening.total`, `common.status` — для compact meta-строки.
- `screening.format.{value}` — для отображения enum-значения как
  человекочитаемой строки (например `screening.format._2D` → `2D`). Если
  ключи уже есть в локалях — переиспользуем. Если нет — добавить минимальный
  набор по всем значениям `ScreeningFormat` enum во все четыре локали.
  Проверить наличие при имплементации.

## Edge Cases

1. **`posterUrl === null`** — плейсхолдер с `lucide:film`.
2. **`screening?.movie` или `screening?.hall?.branch` отсутствуют** на
   confirmation (теоретически — устаревший кэш TanStack Query) —
   `<TicketScreeningHeader>` не рендерится, success-блок и QR показываются.
   Никакого fallback к голому Booking ID.
3. **Локали:** `movieTitle` и `branchName` через `getLocalizedValue($locale)`.
   `hallName` — обычная строка. `formatDateTime` уже учитывает `$locale`.
4. **Reactivity:** компонент не использует `$effect`. Все props через
   `$derived` снаружи (per `svelte` skill).
5. **SSR:** на public странице `+page.server.ts` отдаёт `data.master` —
   шапка рендерится server-side, никакого CLS.
6. **CSS-токены:** только существующие — `--surface`, `--border-color`,
   `--muted-fg`, `--foreground`, `--primary`, `--space-*`, `--text-*`,
   `--radius-md`. Никакого хардкода цветов.

## Testing

**Frontend:**
- `bun run check` — type-check после регена API.
- `bun run build` — убедиться что SSR public страницы не сломан.
- Manual smoke:
  1. `/booking/<id>/confirmation` — оплаченный booking. Шапка с постером,
     title, ageRating, duration, format. Branch + hall в одной строке.
     Диапазон даты/времени корректный. Compact meta-строка под шапкой.
     Старая карточка исчезла. Loading skeleton без «прыжков».
  2. `/t/m/<viewerCode>` — инкогнито. Заголовок «Билеты», та же шапка,
     QR без изменений. SSR (view-source содержит movie title).
  3. Mobile (DevTools 375px) — постер уменьшается, текст не наезжает.
  4. Локали: `ru → en → ky` на public — title и branch меняются.
  5. Movie без постера — рендерится плейсхолдер `lucide:film`.

**Backend:**
- Тесты `booking.service.spec.ts` — обновить моки `findOne`, чтобы payload
  включал `screening.hall.branch`.
- Тесты `public-ticket.service` — assert на `format` в выходе.
- Manual `curl /api/v1/bookings/<id>` (с JWT) — payload содержит
  `screening.hall.branch`.
- Manual `curl /api/v1/public/tickets/master/<viewerCode>` — payload
  содержит `format`.

**Регрессии под наблюдением:**
- `/profile/bookings` (использует `getProfileMeBookingsV1`) — не сломаться
  от изменения формы `screening.hall`.
- Любой другой код, читающий `booking.screening.hall.*` — `grep` перед
  commit'ом.

## Out of Scope / Future

- Группа покупок — отдельная shape, отдельный спек.
- Шаринг/печать билета (отдельная кнопка) — уже частично есть
  (`ShareButton.svelte`), но не пересматривается в этой задаче.
- Анимация появления шапки — не делаем сейчас, можно добавить позже.

## Files Changed (Summary)

**Frontend (новые):**
- `src/components/booking/TicketScreeningHeader.svelte`

**Frontend (изменения):**
- `src/routes/(client)/booking/[bookingId]/confirmation/+page.svelte`
- `src/routes/t/m/[viewerCode]/+page.svelte`
- `src/lib/utils/datetime.ts` (добавить `addMinutes`)
- `src/lib/i18n/locales/{ru,en,ky,kz,uz}.json` (новые ключи)
- `src/api/model/**` (auto-regen после `bun run generate:api`)

**Backend:**
- `src/booking/booking.service.ts` (`findOne` include)
- `src/ticket/dto/public-master-ticket.dto.ts` (поле `format`)
- `src/ticket/public-ticket.service.ts` (либо где собирается DTO) — добавить
  `format` в payload
- `src/booking/booking.service.spec.ts` (обновить моки)
- `src/ticket/public-ticket.service.spec.ts` (новый assert) — если файл
  существует
