# Фильтр расписания сеансов + единый UTC-контракт дат

**Дата:** 2026-04-19
**Статус:** спецификация

## Контекст

На странице `/movies/[id]` есть секция «Расписание сеансов» — сейчас без фильтрации по дате, показывает всё, что вернул бэкенд (по умолчанию сегодня + 7 дней). Задача — добавить фильтрацию по дате: три пресет-кнопки («Вчера» / «Сегодня» / «Завтра») и `DateRangeFilter` для произвольного диапазона, с «Сегодня» по умолчанию.

Параллельно пользователь требует сквозную гарантию того, что весь проект единообразно работает с датами на границе frontend ↔ backend: всё, что уходит на бэкенд, — в UTC; frontend отображает в локали пользователя. Без этого появление нового фильтра просто добавит ещё одно место, где правило может нарушиться.

## Цели

1. Добавить фильтр расписания на `/movies/[id]` с поведением «единый источник, всегда один активен» (см. Поведение).
2. Ввести единый контракт дат для всего проекта с двумя явно разведёнными типами — Civil date и Instant.
3. Вынести весь пограничный код дат в один модуль `@/lib/utils/datetime.ts`; удалить старый `@/lib/utils/date.ts`.
4. Мигрировать все админ-формы и фильтры, нарушающие контракт сегодня.
5. Зафиксировать правило в `CLAUDE.md` с формальными критериями «полноты миграции».

## Вне области (Non-goals)

- Модель «таймзона филиала» для `Screening.startTime`/`endTime` (zoned instant) — концептуально правильный следующий шаг для глобального деплоя, но вынесена в отдельный план. Здесь сеансы остаются на текущем поведении Instant (UTC под капотом, отображение в локали зрителя).
- Бэкенд-изменения в валидаторах DTO — правим только если Orval-сгенерированные типы несовместимы с ISO 8601 (в этом случае чинится бэкенд по правилу CLAUDE.md).

---

## Секция 1 — Контракт дат

Два семантических типа, никогда не смешиваются.

### Civil date — «календарный день»

День как сущность, одинаковый в любой зоне.

- **Отправка:** `"YYYY-MM-DD"` → `"YYYY-MM-DDT00:00:00.000Z"` (UTC-полночь фиксирует день).
- **Чтение:** UTC-компоненты (`getUTCFullYear` / `getUTCMonth` / `getUTCDate`) → `"YYYY-MM-DD"`. Никаких локальных геттеров — они сдвигают день для админов в зонах `< UTC`.
- **Отображение:** `Intl.DateTimeFormat` с явным `timeZone: 'UTC'`, чтобы день отображался одинаково везде.

**Поля:**

- `Movie.releaseDate`
- `Promotion.startDate`, `Promotion.endDate`
- `PromoCode.expiresAt`
- `Announcement.publishDate`, `Announcement.expiryDate`

### Instant — «момент во времени»

Конкретный момент; отображается в локали пользователя.

- **Отправка:** локальный момент → `toISOString()` (UTC Z).
- **Чтение (в `datetime-local` / `<DatePicker withTime>`):** локальные компоненты (`getFullYear` / `getHours` ...) → `"YYYY-MM-DDTHH:mm"`.
- **Отображение:** `Intl.DateTimeFormat` в локали пользователя (без явного `timeZone` — берёт системную).

**Поля:**

- `Screening.startTime`, `Screening.endTime` (отложено — будущий переход на zoned instant)
- `createdAt`, `updatedAt`, `publishedAt` (все сущности)
- фильтр `dateFrom` / `dateTo` (границы дня пользователя — границы Instant)
- `expiresAt` / `validFrom` JWT-токенов

---

## Секция 2 — Утилиты `@/lib/utils/datetime.ts`

Единый модуль. Разделение Civil/Instant зашито в имена — перепутать нельзя.

### Civil date

```ts
// "2026-04-19" → "2026-04-19T00:00:00.000Z"
export const toBackendCivilDate: (ymd: string) => string;

// "2026-04-19T00:00:00.000Z" → "2026-04-19"
export const fromBackendCivilDate: (iso: string | null | undefined) => string;

// "2026-04-19T00:00:00.000Z" + 'ru-RU' → "19 апреля 2026"
export const formatCivilDate: (iso: string, locale?: string) => string;

// Кратко: "19 апр"
export const formatCivilDateShort: (iso: string, locale?: string) => string;
```

### Instant

```ts
// Date | "YYYY-MM-DDTHH:mm" (локальное без зоны) → UTC ISO Z
export const toBackendInstant: (local: Date | string) => string;

// Границы локального дня пользователя → UTC ISO
export const toBackendStartOfLocalDay: (local: Date | string) => string;
export const toBackendEndOfLocalDay: (local: Date | string) => string;

// "YYYY-MM-DDTHH:mm:ssZ" → "YYYY-MM-DDTHH:mm" (для <input type="datetime-local">)
export const fromBackendInstant: (iso: string | null | undefined) => string;
```

### Пресеты фильтра

```ts
export type DatePreset = 'yesterday' | 'today' | 'tomorrow';

// Границы «вчера/сегодня/завтра» в локали пользователя → UTC ISO
export const presetRange: (kind: DatePreset) => {
	dateFrom: string;
	dateTo: string;
};

// Обратное сопоставление: если (dateFrom, dateTo) совпадают с одним
// из пресетов в локали пользователя — вернуть его, иначе null.
export const matchPreset: (
	dateFrom: string,
	dateTo: string
) => DatePreset | null;
```

### Реэкспорт форматтеров

`datetime.ts` реэкспортирует существующие Intl-форматтеры, чтобы из проекта приходил один импорт:

```ts
export {
	formatDate,
	formatTime,
	formatDateTime,
	formatShortDate,
	formatWeekday,
	formatDuration
};
```

### Миграция старого модуля

- `src/lib/utils/date.ts` **удаляется**. Всё переносится в `datetime.ts`.
- `isoToLocalDate` — удаляется (некорректна для Civil date: локальные геттеры → сдвиг на день в зонах `< UTC`). 5 вызовов заменяются на `fromBackendCivilDate`.
- `isoToLocalInput` — переименовывается в `fromBackendInstant` (семантически корректна для Instant). 1 вызов в `ScreeningFormModal` обновляется.

---

## Секция 3 — Фильтр на `/movies/[id]`

### Состояние и инициализация

```ts
let dateFrom = $state<string>('');
let dateTo = $state<string>('');

$effect.pre(() => {
	if (!dateFrom && !dateTo) {
		const r = presetRange('today');
		dateFrom = r.dateFrom;
		dateTo = r.dateTo;
	}
});

const activePreset = $derived(matchPreset(dateFrom, dateTo));

const repertoireQuery = crmQueryApi.createGetPublicRepertoireV1(() => ({
	movieId,
	dateFrom,
	dateTo
}));
```

`dateFrom` / `dateTo` передаются всегда — иначе backend применит дефолт «today + 7 days», и первый рендер покажет не «Сегодня», а неделю.

### Поведение

- **Клик пресета** → `presetRange(kind)` выставляет диапазон `startOfLocalDay → endOfLocalDay`.
- **Выбор в `DateRangeFilter`** → замещает диапазон; если совпал с пресетом — `activePreset` автоматически подсветит кнопку.
- **× в `DateRangeFilter`** → откат на `presetRange('today')`. Фильтр никогда не пустой (правило «по умолчанию Сегодня»).

### UI

Новый компонент `src/routes/(client)/movies/[id]/components/ScheduleFilterBar.svelte`:

```svelte
<div class="ScheduleFilterBar">
  <div class="presets">
    <button class:active={activePreset === 'yesterday'} onclick={...}>{$_('movie.schedule.yesterday')}</button>
    <button class:active={activePreset === 'today'}     onclick={...}>{$_('movie.schedule.today')}</button>
    <button class:active={activePreset === 'tomorrow'}  onclick={...}>{$_('movie.schedule.tomorrow')}</button>
  </div>
  <DateRangeFilter from={dateFrom} to={dateTo} labelFrom="" labelTo=""
                   placeholder={$_('movie.schedule.customRange')}
                   onchange={handleRangeChange} />
</div>
```

Стили — в духе проекта (glass, активная кнопка на `linear-gradient(45deg, #8b5cf6, #a855f7)`, purple-tint бордеры). Десктоп — горизонтальный ряд; мобильно — вертикальный стек, пресеты с горизонтальным скроллом при переполнении.

Блок располагается между `<SectionHeader title={$_('movie.sessions')} />` и списком дат в `src/routes/(client)/movies/[id]/+page.svelte`.

### Состояния списка

- `repertoireQuery.isFetching` → `<Skeleton>` вместо списка.
- `screenings.length === 0` → `<EmptyState icon="lucide:calendar" title={$_('movie.noSessions')} />`.

### i18n

Ключи добавляются в 5 локалях (`ru/en/ky/kz/uz`):

```json
"movie": {
  "schedule": {
    "yesterday": "Вчера",
    "today": "Сегодня",
    "tomorrow": "Завтра",
    "customRange": "Выберите диапазон"
  }
}
```

### Граничные случаи

- **Полночь.** `activePreset` пересчитывается в `$derived`; при любом ререндере после полуночи подсветка обновится. Таймер на 00:00 — overkill, не добавляем.
- **`status === 'UPCOMING'` (сеансов ещё нет).** Фильтр видим, пользователь может переключиться на будущий диапазон через `DateRangeFilter`.

---

## Секция 4 — Миграция админ-форм

### 4.1 `MovieFormModal.svelte`

```ts
// Чтение
releaseDate = fromBackendCivilDate(movie.releaseDate);

// Запись
const data = {
  ...,
  releaseDate: toBackendCivilDate(releaseDate),
};
```

### 4.2 `PromoCodeFormModal.svelte`

```ts
expiresAt = fromBackendCivilDate(promoCode.expiresAt);

const data = {
  ...,
  expiresAt: expiresAt ? toBackendCivilDate(expiresAt) : undefined,
};
```

### 4.3 `PromotionFormModal.svelte`

```ts
startDate = fromBackendCivilDate(promotion.startDate);
endDate   = fromBackendCivilDate(promotion.endDate);

const data = {
  ...,
  startDate: toBackendCivilDate(startDate),
  endDate:   toBackendCivilDate(endDate),
};
```

### 4.4 `AnnouncementFormModal.svelte`

```ts
publishDate = fromBackendCivilDate(announcement.publishDate);
expiryDate  = fromBackendCivilDate(announcement.expiryDate);

const data = {
  ...,
  publishDate: publishDate ? toBackendCivilDate(publishDate) : undefined,
  expiryDate:  expiryDate  ? toBackendCivilDate(expiryDate)  : undefined,
};
```

### 4.5 `ScreeningFormModal.svelte` (Instant; замена на утилиты)

```ts
// Чтение
startTime = fromBackendInstant(screening.startTime);
endTime   = fromBackendInstant(screening.endTime);

// Запись
const data = {
  ...,
  startTime: toBackendInstant(startTime),
  endTime:   toBackendInstant(endTime),
};
```

### 4.6 Админ-страницы аналитики

`admin/analytics/+page.svelte` и `admin/dashboard/+page.svelte` — заменить `date.toISOString()` на `toBackendInstant(date)` для расчётных диапазонов (посл. 7/30 дней и т.п.). Поведение 1 в 1, вызов через контрактный хелпер.

### 4.7 `DateRangeFilter.svelte`

Внутри `commit`:

```ts
const nextFrom = toBackendStartOfLocalDay(a);
const nextTo = toBackendEndOfLocalDay(b);
```

Вместо приватных `atStartOfDay(a).toISOString()` / `atEndOfDay(b).toISOString()`.

### 4.8 `use-table-query.svelte.ts`

Без изменений. Хранит непрозрачные ISO-строки от `DateRangeFilter`; контракт уже соблюдён.

---

## Секция 5 — Правило в `CLAUDE.md`

Новый раздел (на английском, как и остальной `CLAUDE.md`):

```md
## Dates & Times (UTC contract)

All dates/times that cross the frontend↔backend boundary are ISO-8601 in UTC
(suffix `Z`). Never send or store raw local strings without a zone.

Two semantic types — never mix:

### Civil date — "calendar day"

Fields: `releaseDate`, `startDate`/`endDate` (promotion),
`expiresAt` (promoCode), `publishDate`/`expiryDate` (announcement).

- Send: `toBackendCivilDate("2026-04-19")` → `"2026-04-19T00:00:00.000Z"`
- Read: `fromBackendCivilDate(iso)` → `"2026-04-19"`
- Display: `formatCivilDate(iso, locale)` (uses `timeZone: 'UTC'` internally)

### Instant — "moment in time"

Fields: `createdAt`, `updatedAt`, `publishedAt`, screening `startTime`/`endTime`,
filter `dateFrom`/`dateTo`, token `expiresAt`.

- Send: `toBackendInstant(local)` or `toBackendStartOfLocalDay` / `toBackendEndOfLocalDay`
- Read (into `<DatePicker withTime>` / `datetime-local`): `fromBackendInstant(iso)`
- Display: `formatDate` / `formatTime` / `formatDateTime` / `formatWeekday` /
  `formatShortDate` (locale of the user)

### Single entrypoint

All utilities live in `@/lib/utils/datetime`. Do not import from
`@/lib/utils/date` (removed). Do not call `.toISOString()` on dates that
leave the frontend — always go through `toBackendInstant` /
`toBackendCivilDate` so the contract is greppable.

### Future work — screening timezone

Screening `startTime`/`endTime` is conceptually a **zoned instant** anchored
to the branch timezone (e.g. a 14:25 show in Bishkek is 14:25 Asia/Bishkek
for every viewer, not the viewer's local time). The branch `timezone` field
on the backend and a `formatInBranchTz(iso, tz)` helper are intentionally
out of scope for this playbook — tracked separately.
```

---

## Критерии готовности

1. `bun run check` зелёный.
2. Grep по всему `src/` (исключая `src/lib/utils/datetime.ts`):
   - `isoToLocalDate`, `isoToLocalInput` → **0 попаданий**;
   - `\.toISOString\(\)` → **0 попаданий**;
   - `from '@/lib/utils/date'` → **0 попаданий**.
3. Файл `src/lib/utils/date.ts` удалён.
4. Фильтр на `/movies/[id]` проверен вручную в браузере в двух таймзонах (`TZ=Asia/Bishkek`, `TZ=America/Los_Angeles`): «Сегодня» по умолчанию, переключение пресетов работает, активная кнопка подсвечивается после ручного выбора диапазона, совпадающего с пресетом.
5. В каждой админ-форме с Civil date проверен round-trip в обеих зонах — админ в LA не теряет день.
6. Все 5 локалей содержат ключ `movie.schedule.{yesterday,today,tomorrow,customRange}`.

## Проверка бэкенда

Orval-сгенерированные типы для Civil date полей (`releaseDate`, `expiresAt`, ...) — `string`. NestJS-валидаторы `@IsDateString()` / `@IsISO8601()` и Prisma `DateTime` принимают `"2026-04-19T00:00:00.000Z"` без проблем. Если где-то валидатор явно ожидает `YYYY-MM-DD` без суффикса — это правится на бэкенде в `~/Desktop/ZeroWaiting_backend` (по правилу CLAUDE.md «Fix on backend»). Проверка и возможная правка добавляются как отдельный шаг в implementation plan.

## Риски и митигации

- **Бэкенд-валидатор отклоняет ISO для Civil поля.** Митигация: проверить в первую очередь (смоук-тест `curl`/Postman на одном из PATCH endpoint), пофиксить DTO decorator на бэкенде.
- **`datetime-local` в `ScreeningFormModal` — не трогаем логику.** Замена `.toISOString()` на `toBackendInstant` — 1 в 1. Риск регрессии — ноль.
- **Админ редактирует сущность, сохранённую старой версией** (raw `"2026-04-19"`). Prisma хранит DateTime — чтение через API всегда отдаст ISO с Z; разница невидима.
- **Глобальные пользователи.** Civil date по контракту не сдвигается ни в одной зоне (UTC-компоненты при чтении, UTC-полночь при записи). Fix LA-регрессии — часть критериев готовности.
