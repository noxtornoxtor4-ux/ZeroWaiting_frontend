# CLAUDE.md Slim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сократить `CLAUDE.md` с 719 до ≤100 строк, перенеся детали в 4 новых skills (`svelte`, `styling`, `dates`, `backend`) и дополнив существующие (`api`, `admin`, `i18n`, `ui`), без потери информации.

**Architecture:** Always-on контекст (CLAUDE.md) остаётся только для абсолютных правил, project identity, commands, git и skill-map. Domain-детали живут в skills, которые активируются по триггерам. Существующие skills (`admin`, `api`, `auth`, `booking`, `i18n`, `state`, `ui`) дополняются недостающими разделами из CLAUDE.md; создаются 4 новых skill под разделы, у которых ещё нет дома (`svelte`, `styling`, `dates`, `backend`).

**Tech Stack:** Markdown, YAML frontmatter, filesystem operations. Не требуется кода / тестов / билдов — это документационный рефактор. Верификация через `grep`.

**Spec:** `docs/superpowers/specs/2026-04-24-claude-md-slim-design.md`

---

## File Structure

**Create:**
- `.claude/skills/svelte/SKILL.md`
- `.claude/skills/styling/SKILL.md`
- `.claude/skills/dates/SKILL.md`
- `.claude/skills/backend/SKILL.md`

**Modify:**
- `.claude/skills/api/SKILL.md` — добавить Cache Invalidation, Optimistic Updates, isLoading vs isFetching, Error Handling, API Types rule
- `.claude/skills/admin/SKILL.md` — добавить `useTableQuery` + cascade filters + inline label maps + Modal/ViewportScale
- `.claude/skills/i18n/SKILL.md` — добавить Status & Enum Display + "never mix" warning
- `.claude/skills/ui/SKILL.md` — добавить `DatePicker` + `DateRangeFilter` в Available Components
- `CLAUDE.md` — полный перезапись до ≤100 строк

**Delete:** ничего. Старое содержимое CLAUDE.md перезаписывается, но сам файл остаётся.

**Not modified (already complete):**
- `.claude/skills/auth/SKILL.md`
- `.claude/skills/booking/SKILL.md` — seat lifecycle уже покрыт актуально (legacy SeatHold упоминание из CLAUDE.md намеренно выбрасывается, т.к. устарело)
- `.claude/skills/state/SKILL.md`

---

## Task 1: Create `svelte` skill

**Files:**
- Create: `.claude/skills/svelte/SKILL.md`

- [ ] **Step 1: Write the file**

Создай `.claude/skills/svelte/SKILL.md` с содержимым:

````markdown
---
name: svelte
description: 'Use when working with Svelte 5 runes, component patterns, or SvelteKit page state. Triggers: $app/state, $app/stores, $state, $derived, $derived.by, $effect, $props, $bindable, Snippet, runes, {@const}, .svelte.ts.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Svelte 5 Patterns

Проект использует **Svelte 5 runes** эксклюзивно.

## Page state from `$app/state`

```ts
import { page } from '$app/state';

const movieId = $derived(page.params.id);
const path = page.url.pathname;
```

**Never use `$app/stores`** — всегда `$app/state`.

## Props + Snippet

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'ghost' | 'outline';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		children?: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		children
	}: Props = $props();
</script>

{@render children?.()}
```

## State & Derived

```ts
let count = $state(0);
let selectedItems = $state<string[]>([]);

const isActive = $derived(count > 0);
```

Для многострочных выражений — `$derived.by(() => { ... })`. Обычный `$derived(() => ...)` вернёт функцию, а не значение.

## Bindable props

```ts
let { value = $bindable('') }: Props = $props();
```

## Effects

```ts
$effect(() => {
	if (browser) {
		document.documentElement.lang = $locale;
	}
});
```

## `{@const}` placement

`{@const}` должен быть **прямым потомком** `{#if}`, `{#each}`, `{:else}`, `{#snippet}` — **не** внутри `<div>` или других элементов. Инлайнь выражение вместо этого:

```svelte
<!-- Bad -->
<div>
	{@const cfg = CONFIG[status]}
	<Badge text={cfg?.label} />
</div>

<!-- Good -->
<div>
	<Badge text={CONFIG[status]?.label} />
</div>
```

## Reserved names

Не называй `$state`/`$derived` переменную `state` — конфликт с runes-scope в `svelte-check`. Используй `urgency`, `status`, и т.д.
````

- [ ] **Step 2: Verify file exists and frontmatter parses**

```bash
head -8 .claude/skills/svelte/SKILL.md
```

Expected: первые 8 строк показывают frontmatter с `name: svelte` и описанием.

---

## Task 2: Create `styling` skill

**Files:**
- Create: `.claude/skills/styling/SKILL.md`

- [ ] **Step 1: Write the file**

Создай `.claude/skills/styling/SKILL.md` с содержимым:

````markdown
---
name: styling
description: 'Use when working with SCSS, design tokens, colors, layout styling, brand logo, or scoped component styles. Triggers: .scss, SCSS, BEM, --primary, --background, --surface, --foreground, --muted-fg, --border-color, linear-gradient, #8b5cf6, #a855f7, #c084fc, :global, backdrop-filter, logo_icon, logo_text, postcss-pxtorem, glassmorphism, autoprefixer.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Styling Conventions

SCSS scoped per component + CSS custom properties (дизайн-токены в `src/app.scss`).

## SCSS Rules

- **No BEM** — никогда `Component__element` / `Component--modifier`.
- **Always nest selectors** mirroring the HTML DOM: `.ComponentName { .content { .title {} } }` = зеркало DOM.
- **Underscores** для многословных классов: `admin_link`, `cell_actions`, `logo_text` (не дефисы).
- `.container` — глобальный класс из `app.scss`, переиспользуется.
- Кастомизация: `.ComponentName { .container { .content {} } }`.
- `&` для модификаторов/псевдо: `&.active`, `&:hover`, `&::after`.
- State-модификаторы через Svelte `class:active={condition}`.
- **Никогда не хардкодить цвета** — только CSS custom properties.

```scss
// Good
.Header {
	.container {
		.content {
			.logo {
				.logo_icon {}
				.text {}
			}
			.nav {
				.link {
					&.active {}
				}
			}
		}
	}
}

// Bad — BEM
.Header {
	.Header__content {}
	.Header__nav {}
}
```

## Design Tokens (Dark Theme)

```css
--primary: var(--primary-500);       /* #a855f7 */
--background: var(--neutral-950);    /* #121216 */
--surface: var(--neutral-900);       /* #1a1a26 */
--foreground: var(--neutral-50);     /* #f8f8fb */
--muted-fg: var(--neutral-400);      /* #9494a5 */
--border-color: var(--neutral-700);  /* #2d2d3d */
```

## Brand Logo Pattern

Все инстансы логотипа (Header, Footer, AdminSidebar, Preloader) используют один паттерн:

```svelte
<a href="/" class="logo">
	<div class="logo_icon">
		<Icon icon="lucide:film" width={20} />
	</div>
	<span class="logo_text">ZeroWaiting</span>
</a>
```

```scss
.logo_icon {
	background: linear-gradient(45deg, #8b5cf6, #a855f7);
	border-radius: 8px;
}
.logo_text {
	background: linear-gradient(45deg, #ffffff, #c084fc);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
}
```

## Color Conventions

- **Primary purple gradient**: `linear-gradient(45deg, #8b5cf6, #a855f7)` — кнопки, active states, акценты.
- **Text gradient**: `linear-gradient(45deg, #ffffff, #c084fc)` — logo, section titles.
- **Purple borders**: `rgba(139, 92, 246, 0.1–0.2)` — subtle purple (не нейтральный серый).
- **Text colors**: `white`, `rgba(255, 255, 255, 0.8)` (secondary), `rgba(255, 255, 255, 0.7)` (muted), `rgba(255, 255, 255, 0.6)` (tertiary).
- **Glow shadows**: `rgba(139, 92, 246, 0.3)` / `rgba(168, 85, 247, 0.3)` — purple glow на hover.
- **Glass backgrounds**: `rgba(255, 255, 255, 0.08)` + `backdrop-filter: blur(10px)` — cards, inputs.

## Client Header (glassmorphism)

Контейнер: `backdrop-filter: blur(7px)`, `border-radius: 12px`, purple border `rgba(139, 92, 246, 0.15)`. Brand logo с gradient icon box + gradient text. На скролле `max-width` сужается, opacity фона растёт. Desktop: nav + actions; mobile: `BurgerToggle` + `BurgerMenu`. `LanguageSwitcher` использует `PopoverMenu` (floating-ui portal).

## PostCSS

Все `px` авто-конвертируются в `rem` (base 16px) через `postcss-pxtorem`. Vendor-префиксы — `autoprefixer`.

## `:global()` pitfalls

**Never** `:global(.dropdown)`, `:global(.item)`, `:global(.header)` — глобальный leak, конфликты стилей между компонентами. Всегда уникальные префиксы: `.user_menu`, `.phone_dropdown`, `.select-dropdown`.

## Portal + `:global()` styling

Компоненты через portal (`document.body.appendChild`) — вне Svelte-scoped CSS. Используй `:global(.unique_class)` с уникальными именами — `:global()` снимает scope-хэш, стили работают независимо от DOM-позиции.
````

- [ ] **Step 2: Verify**

```bash
head -4 .claude/skills/styling/SKILL.md
```

Expected: frontmatter с `name: styling`.

---

## Task 3: Create `dates` skill

**Files:**
- Create: `.claude/skills/dates/SKILL.md`

- [ ] **Step 1: Write the file**

Создай `.claude/skills/dates/SKILL.md`:

````markdown
---
name: dates
description: 'Use when handling dates/times — sending to API, displaying, or rendering date inputs. Triggers: @/lib/utils/datetime, toBackendCivilDate, toBackendInstant, toBackendStartOfLocalDay, toBackendEndOfLocalDay, fromBackendInstant, fromBackendCivilDate, formatCivilDate, formatDate, formatTime, formatDateTime, formatWeekday, formatShortDate, DatePicker, DateRangeFilter, releaseDate, startDate, endDate, expiresAt, createdAt, updatedAt, publishedAt, publishDate, expiryDate, startTime, endTime, dateFrom, dateTo, UTC, .toISOString(), datetime-local.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Dates & Times (UTC contract)

Все даты/времена через границу frontend↔backend — ISO-8601 в UTC (суффикс `Z`). Никаких сырых local-строк без зоны.

## Two semantic types — never mix

### Civil date — «календарный день»

Поля: `releaseDate`, `startDate` / `endDate` (promotion), `expiresAt` (promoCode), `publishDate` / `expiryDate` (announcement).

- **Send**: `toBackendCivilDate("2026-04-19")` → `"2026-04-19T00:00:00.000Z"`
- **Read**: `fromBackendCivilDate(iso)` → `"2026-04-19"`
- **Display**: `formatCivilDate(iso, locale)` (внутри `timeZone: 'UTC'`).

### Instant — «момент времени»

Поля: `createdAt`, `updatedAt`, `publishedAt`, screening `startTime` / `endTime`, filter `dateFrom` / `dateTo`, token `expiresAt`.

- **Send**: `toBackendInstant(local)` / `toBackendStartOfLocalDay` / `toBackendEndOfLocalDay`
- **Read** (в `<DatePicker withTime>` / `datetime-local`): `fromBackendInstant(iso)`
- **Display**: `formatDate` / `formatTime` / `formatDateTime` / `formatWeekday` / `formatShortDate` (локаль пользователя).

## Single entrypoint

Все утилиты — в `@/lib/utils/datetime`. **Не импортируй** из `@/lib/utils/date` (удалено). **Никогда** `.toISOString()` на датах, которые уходят на бэк — всегда через `toBackendInstant` / `toBackendCivilDate`, чтобы контракт был греппаемым.

## Date input components

**Никогда** native `<input type="date">`. В `@/components/ui`:

- **`DateRangeFilter`** — двухмесячный calendar popover для filter bars. API: `from`, `to` (ISO), `labelFrom`, `labelTo`, `placeholder`, `widthFull`, `onchange(from, to)`. `widthFull` default `false` (`inline-flex`, `width: fit-content`) — передавай только когда фильтр должен растягиваться.
- **`DatePicker`** — single-date с typeable masked input (`дд/мм/гггг`, auto `/`, cascading clamps: month ≤ 12, day ≤ 31). API: `value` (ISO `YYYY-MM-DD`), `label`, `placeholder`, `required`, `disabled`, `widthFull` (default `true`), `error`, `onchange(value)`. Для всех дат в admin form modals (movies releaseDate, promo/announcement/promotion date ranges).

Оба — calendar через Floating UI portal, двухмесячный дизайн, weekday order (Пн-Вс), display `DD/MM/YYYY`. `datetime-local` (screening startTime) остаётся native — там нужно время, не только дата.

## Future work — screening timezone

Screening `startTime`/`endTime` концептуально — **zoned instant**, привязанный к branch timezone (14:25 в Бишкеке = 14:25 Asia/Bishkek для всех зрителей, не local пользователя). Поле `timezone` на бэке и хелпер `formatInBranchTz(iso, tz)` — tracked отдельно, не в scope текущего playbook.
````

- [ ] **Step 2: Verify**

```bash
head -4 .claude/skills/dates/SKILL.md
```

Expected: frontmatter с `name: dates`.

---

## Task 4: Create `backend` skill

**Files:**
- Create: `.claude/skills/backend/SKILL.md`

- [ ] **Step 1: Write the file**

Создай `.claude/skills/backend/SKILL.md`:

````markdown
---
name: backend
description: 'Use when frontend task requires backend changes (missing API fields, new endpoints, incorrect OpenAPI types, business logic) or when working cross-repo. Triggers: ~/Desktop/ZeroWaiting_backend, ZeroWaiting_backend, generate:api, PORT=5000, @DtoEntityHidden, Prisma, NestJS, OptionalJwtAuthGuard, Swagger, OpenAPI, VITE_API_BASE_URL, cross-repo, fix backend, enrich response, MovieWithFavoriteEntity, regen API client.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Backend (cross-repo workflow)

Backend-репо: `~/Desktop/ZeroWaiting_backend` (NestJS + Prisma).

Когда frontend-задача требует изменений, которые **принадлежат бэкенду** — править **там**. Не обходить лимитации бэка на фронте.

## Fix on backend

- Missing fields в API response (nested relations, computed поля типа `averageRating`) — снять `@DtoEntityHidden` в Prisma schema или enrich в сервисе.
- Missing endpoints / query params.
- Неправильные типы в Swagger/OpenAPI — чинить entity/DTO-декораторы, чтобы Orval генерировал корректные типы.
- Бизнес-логика (валидация, авторизация, агрегация).

## Fix on frontend

- UI state, layout, styling, анимации.
- Client-side derived/computed values из уже существующих API-данных.
- Caching strategy, optimistic updates.
- i18n, formatting, user interactions.

## Cross-repo workflow

1. Редактируй backend в `~/Desktop/ZeroWaiting_backend`.
2. `npm run build` — валидация.
3. Локальный запуск: `PORT=5000 node dist/src/main.js`.
4. Regen frontend API-клиента: `VITE_API_BASE_URL=http://localhost:5000 bun run generate:api`.
5. Обнови frontend-код под новые типы/эндпоинты.
6. Останови локальный backend, когда закончил.

## API types — всегда из `@/api/model`

Всегда использовать сгенерированные типы из `@/api/model` — **никогда** ручных интерфейсов, дублирующих API-форму. Если backend возвращает данные, которых нет в типах — чинить backend (снять `@DtoEntityHidden` в Prisma schema) и регенерировать `bun run generate:api`.

## Backend-Driven State

User-specific поля (`isFavorite`, `averageRating`, `reviewCount`) приходят из API через `MovieWithFavoriteEntity`. Backend обогащает ответы через `OptionalJwtAuthGuard` — извлекает пользователя из токена если есть, возвращает базовые данные если нет. Не дублируй enrichment на фронте.
````

- [ ] **Step 2: Verify**

```bash
head -4 .claude/skills/backend/SKILL.md
```

Expected: frontmatter с `name: backend`.

---

## Task 5: Enrich `api` skill

**Files:**
- Modify: `.claude/skills/api/SKILL.md`

Текущее состояние: файл содержит Architecture, Usage Pattern, User Profile, Axios Interceptor, Regenerating API Client. **Отсутствуют:** Cache Invalidation, Optimistic Updates, isLoading vs isFetching, Error Handling, явное правило API Types.

- [ ] **Step 1: Append sections to `api/SKILL.md`**

Открой `.claude/skills/api/SKILL.md` и добавь в конец файла (после строки `bun run generate:api\n```` на строке 58) следующие секции:

````markdown

## API Types — always generated

Всегда использовать типы из `@/api/model`. **Никогда** не создавать ручные интерфейсы, дублирующие API-форму. Если backend возвращает поле, которого нет в сгенерированном типе — чинить backend (см. skill `backend`), не хардкодить интерфейс на фронте.

## Cache Invalidation — not refetch

Используй `queryClient.invalidateQueries({ queryKey: [...] })` вместо `query.refetch()`. TanStack Query рефетчит только если активный query с этим key есть на текущей странице — никаких лишних запросов.

```ts
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ['/api/v1/public/movies'] });
queryClient.invalidateQueries({ queryKey: ['/api/v1/profile/me/favorites'] });
```

## Optimistic Updates

Для toggle-действий (избранное) используй `updateMovieFavoriteCache` из `@/lib/utils/favorite` — моментальное обновление TanStack-кэша. Откат на ошибке.

```ts
import { updateMovieFavoriteCache } from '@/lib/utils/favorite';

const prev = fav;
fav = !prev;
updateMovieFavoriteCache(queryClient, movieId, fav);
try {
	await mutation.mutateAsync({ movieId });
	queryClient.invalidateQueries({ queryKey: ['/api/v1/profile/me/favorites'] });
} catch (error) {
	fav = prev;
	updateMovieFavoriteCache(queryClient, movieId, prev);
}
```

Предпочитай `queryClient.setQueriesData` для мгновенного UI-апдейта тех же данных. `invalidateQueries` — только для связанных queries, которым нужна server-truth (favorites list после toggle).

## Loading states — `isLoading`, not `isFetching`

Для initial-render skeletons и first-load UI используй `query.isLoading` — он `true` только пока нет кэша. `query.isFetching` `true` **на каждом** refetch (window focus, invalidation, background refresh) — использование его в шаблоне приводит к тому, что skeleton мигает поверх уже отрисованного контента.

```svelte
<!-- Good -->
{#if repertoireQuery.isLoading}
	<Skeleton height="120px" />
{:else if screenings.length > 0}
	...
{/if}

<!-- Bad — skeleton мигает на каждом фоновом refetch -->
{#if repertoireQuery.isFetching}
	<Skeleton height="120px" />
{/if}
```

`isFetching` резервируй под вторичные индикаторы (inline-спиннер возле «Refreshing…»), никогда под первичный skeleton/empty-state gate.

## Error Handling

Во всех catch-блоках — `getErrorMessage(error, 'fallback')` из `@/lib/utils/error` вместе с `toast.error`. Достаёт реальное message из `AxiosError.response.data.message`.

```ts
import { getErrorMessage } from '@/lib/utils/error';
import toast from 'svelte-french-toast';

try {
	await mutation.mutateAsync(payload);
} catch (error) {
	toast.error(getErrorMessage(error, 'Не удалось сохранить'));
}
```
````

- [ ] **Step 2: Verify**

```bash
grep -c "Cache Invalidation\|Optimistic Updates\|isLoading\|getErrorMessage\|API Types" .claude/skills/api/SKILL.md
```

Expected: `5` (или больше — каждая добавленная секция даёт хотя бы одно вхождение).

---

## Task 6: Enrich `admin` skill

**Files:**
- Modify: `.claude/skills/admin/SKILL.md`

Текущее состояние: Admin Layout, Admin Page Pattern, Admin Sidebar Filtering, Admin Routes, i18n note. **Отсутствуют:** `useTableQuery` паттерн, cascade filters, inline label maps, Modal + ViewportScale.

- [ ] **Step 1: Append sections to `admin/SKILL.md`**

Открой `.claude/skills/admin/SKILL.md` и добавь в конец файла (после строки `No locale files for admin.` на строке 73) следующие секции:

````markdown

## `useTableQuery` + `DataTable`

Все admin-list-страницы используют `useTableQuery` composable из `@/lib/hooks/use-table-query.svelte.ts`. Владеет `page`, `limit`, debounced `search`, `dateFrom/dateTo`, generic `filters`. Двусторонняя синхронизация с URL (`?page=2&search=...&cinemaId=...`) — страницы deep-linkable и shareable.

```ts
type FoodFilters = { category: string; cinemaId: string; branchId: string };

const table = useTableQuery<GetFoodItemsV1Params, FoodFilters>({
	filters: { category: '', cinemaId: '', branchId: '' }
});

const queryParams = $derived<GetFoodItemsV1Params>({
	...table.params,
	...(table.filters.availability && {
		isAvailable: table.filters.availability === 'true'
	})
});

const query = crmQueryApi.createGetFoodItemsV1(() => queryParams);
```

Подключай к UI: `<SearchInput bind:value={table.searchInput} />`, `<Select ... onChange={(vals) => table.setFilter('cinemaId', String(vals[0] ?? ''))}>`, `<DateRangeFilter ... onchange={table.setDateRange} />`, `<DataTable page={table.page} pageSize={table.limit} onPageChange={table.setPage} onPageSizeChange={table.setLimit} />`. Никогда не дублируй этот state вручную.

## Cascade filters (cinema → branch → hall)

Когда child-query зависит от parent-фильтра — **гейти запрос через TanStack `enabled`**, не просто прячь UI и не отправляй пустой `cinemaId`.

```ts
const branchesQuery = crmQueryApi.createGetBranchesV1(
	() => ({ page: 1, limit: 100, cinemaId: table.filters.cinemaId }),
	() => ({ query: { enabled: !!table.filters.cinemaId } })
);

$effect(() => {
	if (!table.filters.cinemaId && table.filters.branchId) {
		table.setFilter('branchId', '');
	}
});
```

Второй аргумент Orval-hook'а — реактивная factory для query-options; `enabled` передаётся туда. Обязательно пара с `$effect`, чтобы при сбросе parent'а сбрасывался и child.

## Inline Russian label maps

Admin — русский только, без i18n. Для enum-отображения — inline-map:

```ts
const BOOKING_TYPE_LABELS: Record<string, string> = {
	ONLINE: 'Онлайн',
	OFFLINE: 'Касса',
	GROUP: 'Групповая'
};
```

**Никогда не показывай raw enum-значения** (NOW_SHOWING, PENDING, PERCENTAGE) пользователю.

## Modal + ViewportScale

Admin-layout рендерит `ViewportScale` (`@/components/admin/layout`) — выставляет `html.style.fontSize = 16 * min(screen.width / 1600, 1)`. Всё в rem скейлится на узких экранах через `postcss-pxtorem`.

`Modal` специально освобождён: читает текущий root font-size и применяет `transform: scale(16 / rootFontSize)` к внутреннему `.scale_wrap` с компенсированными `max-width` / `max-height`. Модалки рендерятся в натуральном визуальном размере независимо от `ViewportScale`.

**Никогда не возвращай `html.style.fontSize` toggles внутрь Modal** — counter-scale-подход оставляет страницу за backdrop нетронутой.
````

- [ ] **Step 2: Verify**

```bash
grep -c "useTableQuery\|Cascade filters\|ViewportScale\|BOOKING_TYPE_LABELS" .claude/skills/admin/SKILL.md
```

Expected: `4` (или больше).

---

## Task 7: Enrich `i18n` skill

**Files:**
- Modify: `.claude/skills/i18n/SKILL.md`

Текущее состояние: Setup, Client Pages, Admin Panel, i18n JSON Fields. **Отсутствуют:** явное правило «never mix» и Status & Enum Display с CONFIG-объектами.

- [ ] **Step 1: Append sections to `i18n/SKILL.md`**

Открой `.claude/skills/i18n/SKILL.md` и добавь в конец файла (после последнего примера с `getLocalizedValue`) следующие секции:

````markdown

## Never mix admin and client i18n

- **Client-страницы** (`/movies`, `/booking`, `/profile`) — всегда `svelte-i18n` (`$_()`) для user-facing текста.
- **Admin-страницы** (`/admin/`) — русский только, hardcoded, без `$_()`.
- Никаких миксов: не импортируй `$_` в admin, не хардкоды русский в client.

## Status & Enum Display

**Client-страницы** (мульти-язычные) используют i18n-конфиг-объекты, маппящие enum-значения → translation-keys и цвета:

- `BOOKING_STATUS_CONFIG` — `@/lib/constants/booking-status`
- `TICKET_STATUS_CONFIG` — `@/lib/constants/ticket-status`
- `MOVIE_STATUS_CONFIG` — `@/lib/constants/movie-status`
- Прочие enums через `$_('common.bookingType.ONLINE')`, `$_('common.giftCardStatus.ACTIVE')` и т.д.

**Admin-страницы** — inline label-maps (см. skill `admin`).

**Никогда не показывай raw enum-значения** (NOW_SHOWING, PENDING, PERCENTAGE) пользователю — ни в client, ни в admin.
````

- [ ] **Step 2: Verify**

```bash
grep -c "Never mix\|BOOKING_STATUS_CONFIG\|raw enum" .claude/skills/i18n/SKILL.md
```

Expected: `3`.

---

## Task 8: Enrich `ui` skill

**Files:**
- Modify: `.claude/skills/ui/SKILL.md`

Текущее состояние: список Available Components, Icon Convention. **Отсутствуют:** `DatePicker` и `DateRangeFilter` в списке компонентов (они нужны, потому что правило «не использовать native `<input type="date">`» ссылается на них).

- [ ] **Step 1: Add DatePicker + DateRangeFilter to Available Components**

Открой `.claude/skills/ui/SKILL.md`. Найди строку описывающую `Input` (строка 16) — сразу после неё, перед `Select`, вставь два новых bullet'а:

Найди:
```
- `Input` — types: text, email, password, tel, number, date, time, datetime-local, search. Phone input with country selector + mask. Password toggle. Label, error, icon, required support
- `Select` — single + multiple/tags modes.
```

Замени на:
```
- `Input` — types: text, email, password, tel, number, date, time, datetime-local, search. Phone input with country selector + mask. Password toggle. Label, error, icon, required support. **Не используй `type="date"` — см. `DatePicker` / `DateRangeFilter` ниже.**
- `DatePicker` — single-date с typeable masked input (`дд/мм/гггг`, auto `/`, cascading clamps: month ≤ 12, day ≤ 31). Calendar через Floating UI portal. API: `value` (ISO `YYYY-MM-DD`), `label`, `placeholder`, `required`, `disabled`, `widthFull` (default `true`), `error`, `onchange(value)`. Единственный правильный выбор для date-полей в формах. См. skill `dates` для UTC-контракта.
- `DateRangeFilter` — двухмесячный calendar popover для filter bars. API: `from`, `to` (ISO), `labelFrom`, `labelTo`, `placeholder`, `widthFull` (default `false` = `inline-flex`), `onchange(from, to)`. Использовать в admin table toolbars.
- `Select` — single + multiple/tags modes.
```

- [ ] **Step 2: Verify**

```bash
grep -c "DatePicker\|DateRangeFilter" .claude/skills/ui/SKILL.md
```

Expected: `≥ 2`.

---

## Task 9: Rewrite CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (полный перезапись содержимого)

- [ ] **Step 1: Replace CLAUDE.md contents**

Полностью перезапиши `CLAUDE.md` (все 719 строк) следующим содержимым:

````markdown
# ZeroWaiting — Frontend

SaaS-платформа для сетей кинотеатров. SvelteKit 2 (Svelte 5 runes), TanStack
Svelte Query, Orval API, Firebase OAuth → JWT, svelte-i18n (ru/en/ky/kz/uz).
Backend-репозиторий: `~/Desktop/ZeroWaiting_backend`.

## Absolute Rules

Применяются **везде**, в каждом файле. Нарушение = переделка.

- **No partial changes.** «everywhere / globally / across the project / completely»
  = просканировать весь репо, собрать список всех вхождений, изменить все.
  Никаких «фикс в двух файлах для примера».
- **Arrow functions only.** Никакого `function` — ни в колбэках, ни в хэндлерах,
  ни в модульных объявлениях.
- **No `any`.** Типы — из `@/api/model` или собственный `interface`.
- **No BEM.** `underscore_case` для классов, SCSS nesting = зеркало DOM.
- **`$app/state`, never `$app/stores`.**
- **Import via `@/` alias.** Никаких относительных `../`.
- **Dates across boundary → `@/lib/utils/datetime`.** Никаких `.toISOString()`
  на исходящих датах. См. skill `dates`.
- **No native `<input type="date">`.** Всегда `DatePicker` / `DateRangeFilter`.
- **Loading UI → `isLoading`, не `isFetching`.**
- **No `:global(.generic_class)`.** Всегда уникальный префикс.
- **Admin = русский hardcoded, Client = `$_()` i18n.** Не мешать.

## Commands

```bash
bun run dev
bun run build
bun run check
bun run generate:api   # regen Orval client from OpenAPI
bun run format
```

`VITE_API_BASE_URL` (default `https://api-zerowaiting.elcho.dev`) переопределяй
для локального backend: `VITE_API_BASE_URL=http://localhost:5000 bun run dev`.

## Git commits

`<type>(<scope>): <subject>` — conventional. Типы:
`feat|fix|refactor|perf|style|docs|test|chore|ci`.
**Без футеров:** никаких `Co-Authored-By`, `Signed-off-by`, `Generated with`.

## Skill map — куда идти за деталями

Skills содержат всю глубину. **Перед работой в домене обязательно
активируй соответствующий skill.**

| Работаешь над…                   | Skill     |
| -------------------------------- | --------- |
| Admin-панель, DataTable, cascade | `admin`   |
| API / TanStack / Orval / кэш     | `api`     |
| Auth, роли, RoleGuard            | `auth`    |
| Seat selection / booking flow    | `booking` |
| Переводы, локали, enum display   | `i18n`    |
| Stores, seat state               | `state`   |
| UI-компоненты, DatePicker        | `ui`      |
| Svelte 5 runes, `{@const}`       | `svelte`  |
| SCSS, токены, цвета, `:global`   | `styling` |
| Даты/время, UTC-контракт         | `dates`   |
| Backend changes (cross-repo)     | `backend` |

## Engineering standard

SOLID, DRY, KISS. Single responsibility. Composition over inheritance.
Refactor, don't patch. Никаких TODO-плейсхолдеров и «временных» хаков.
Если запрос ведёт к плохой архитектуре — объяснить и предложить правильный
подход **до** кода.
````

- [ ] **Step 2: Verify length**

```bash
wc -l CLAUDE.md
```

Expected: число ≤ 100.

- [ ] **Step 3: Verify absolute rules present**

```bash
grep -c "No partial changes\|Arrow functions only\|No \`any\`\|No BEM\|\$app/state\|@/ alias\|@/lib/utils/datetime\|native \`<input type=\"date\">\`\|isLoading\|:global\|русский hardcoded" CLAUDE.md
```

Expected: ≥ 11 (каждое правило должно матчиться).

---

## Task 10: Verification — grep для всех ключевых терминов

Цель — гарантировать «0 потерь». Каждый ключевой термин из старого CLAUDE.md должен найтись либо в новом CLAUDE.md, либо хотя бы в одном skill.

- [ ] **Step 1: Run verification script**

```bash
cd /Users/elcho/Desktop/ZeroWaiting_frontend && for term in \
  "useTableQuery" \
  "ViewportScale" \
  "toBackendCivilDate" \
  "toBackendInstant" \
  "DtoEntityHidden" \
  "updateMovieFavoriteCache" \
  "getErrorMessage" \
  "OptionalJwtAuthGuard" \
  "MovieWithFavoriteEntity" \
  "BOOKING_STATUS_CONFIG" \
  "BOOKING_TYPE_LABELS" \
  "DateRangeFilter" \
  "DatePicker" \
  "postcss-pxtorem" \
  "backdrop-filter" \
  "logo_icon" \
  "logo_text" \
  "glassmorphism" \
  "{@const}" \
  "bindable" \
  "\$app/state" \
  "invalidateQueries" \
  "setQueriesData" \
  "isLoading" \
  "isFetching" \
  "enabled" \
  "PORT=5000" \
  "generate:api" \
  "formatCivilDate" \
  "fromBackendInstant"; do
  count=$(grep -r -l "$term" CLAUDE.md .claude/skills/ 2>/dev/null | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "MISSING: $term"
  fi
done
echo "---"
echo "Verification complete."
```

Expected output: `Verification complete.` без единой строки `MISSING:`. Если что-то `MISSING` — значит термин потерялся, возвращаемся к предыдущим task'ам и дописываем.

- [ ] **Step 2: Line-count sanity check**

```bash
cd /Users/elcho/Desktop/ZeroWaiting_frontend && echo "=== CLAUDE.md ===" && wc -l CLAUDE.md && echo "=== Skills ===" && wc -l .claude/skills/*/SKILL.md
```

Expected:
- CLAUDE.md: ≤ 100 lines
- `svelte/SKILL.md`: 40–100 lines
- `styling/SKILL.md`: 80–130 lines
- `dates/SKILL.md`: 50–90 lines
- `backend/SKILL.md`: 40–80 lines
- `api/SKILL.md`: 110–160 lines (было 58, прибавили ~70)
- `admin/SKILL.md`: 140–190 lines (было 73, прибавили ~80)
- `i18n/SKILL.md`: 55–90 lines (было 37, прибавили ~25)
- `ui/SKILL.md`: 48–60 lines (было 43, прибавили 2 строки + уточнение)
- остальные (`auth`, `booking`, `state`) не изменены

---

## Task 11: Smoke check — проект всё ещё собирается

- [ ] **Step 1: Run type-check**

```bash
cd /Users/elcho/Desktop/ZeroWaiting_frontend && bun run check
```

Expected: `0 errors and 0 warnings` (или тот же статус, что был до рефактора — skills/CLAUDE.md никак не влияют на TypeScript, но это страховка).

Если `bun run check` не проходит по причинам, не связанным с нашими изменениями — зафиксировать, что это предсуществующий issue, не блокирующий коммит.

---

## Task 12: Commit

- [ ] **Step 1: Stage all changes**

```bash
cd /Users/elcho/Desktop/ZeroWaiting_frontend && git add \
  CLAUDE.md \
  .claude/skills/svelte/SKILL.md \
  .claude/skills/styling/SKILL.md \
  .claude/skills/dates/SKILL.md \
  .claude/skills/backend/SKILL.md \
  .claude/skills/api/SKILL.md \
  .claude/skills/admin/SKILL.md \
  .claude/skills/i18n/SKILL.md \
  .claude/skills/ui/SKILL.md
```

- [ ] **Step 2: Review staged diff**

```bash
cd /Users/elcho/Desktop/ZeroWaiting_frontend && git diff --staged --stat
```

Expected: 9 files changed. CLAUDE.md — большой negative delta. Новые skills — creations. Существующие skills — дополнения.

- [ ] **Step 3: Commit**

```bash
cd /Users/elcho/Desktop/ZeroWaiting_frontend && git commit -m "docs(claude-md): slim always-on context, move details to domain skills

Cut CLAUDE.md from 719 to ~80 lines. Moved Svelte 5 runes, SCSS conventions,
UTC date contract, and backend workflow into 4 new skills (svelte, styling,
dates, backend). Moved data-flow patterns (cache invalidation, optimistic
updates, loading states, error handling), admin table patterns (useTableQuery,
cascade filters, label maps, Modal+ViewportScale), and enum-display rules
into existing skills (api, admin, i18n, ui). CLAUDE.md now holds only
absolute rules, project identity, commands, git format, and a skill map."
```

- [ ] **Step 4: Verify commit**

```bash
cd /Users/elcho/Desktop/ZeroWaiting_frontend && git log -1 --stat
```

Expected: коммит показывает 9 files changed, CLAUDE.md с большим отрицательным diff, 4 новых SKILL.md.

---

## Definition of Done

- [x] Spec approved by user (`2026-04-24-claude-md-slim-design.md`)
- [ ] 4 new skills created: `svelte`, `styling`, `dates`, `backend`
- [ ] 4 existing skills enriched: `api`, `admin`, `i18n`, `ui`
- [ ] CLAUDE.md ≤ 100 lines
- [ ] Все grep-термины найдены хотя бы в одном из файлов
- [ ] `bun run check` — no new errors
- [ ] Single atomic commit на main

---

## Notes for Executor

- **Не трогать** `auth`, `booking`, `state` skills — их содержимое уже актуально и полнее, чем в CLAUDE.md.
- **Не восстанавливать** legacy SeatHold упоминание из старого CLAUDE.md — booking skill уже описывает актуальный post-Phase-3 lifecycle.
- **Route Structure client+public tables** из старого CLAUDE.md — **намеренно удалены** (деривируемо из `src/routes/(client)/` и `src/routes/`).
- Если в ходе выполнения обнаружится ещё один раздел в старом CLAUDE.md, который не попал ни в план, ни в skills — остановиться и вернуться к spec/plan ревью, а не импровизировать на месте.
- Содержимое каждого skill в task-ах дано **полностью** — копируй 1:1, не редактируй по ходу.
