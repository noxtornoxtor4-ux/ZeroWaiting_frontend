---
name: admin
description: 'Use when working with admin panel pages, admin layout, admin routes, DataTable, admin CRUD pages, or admin sidebar. Triggers: /admin/, AdminSidebar, AdminHeader, ViewportScale, admin layout, DataTable columns, admin page pattern, admin navigation, role-based admin routes.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Admin Panel

## Admin Layout (`admin/+layout.svelte`)

CSS Grid: `grid-template-columns: auto 1fr` + `grid-template-rows: auto 1fr`. Sidebar width drives the `auto` column. Content area scrolls independently via `overflow-y: auto` on main.

## Admin Page Pattern

Admin pages use `DataTable` directly (no wrapper). Each page has its own toolbar with search/create buttons:

```svelte
<div class="page">
	<div class="toolbar">
		<!-- search + create button -->
	</div>
	<DataTable {columns} {data} {loading} {total} {page} {pageSize} ...>
		{#snippet cell({ row, column, rowIndex })}
			<!-- per-column rendering -->
		{/snippet}
	</DataTable>
</div>

<style lang="scss">
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		flex: 1;
		min-height: 0;
	}
</style>
```

## Admin Sidebar Filtering

```ts
const visibleItems = $derived(
	adminNavItems.filter((item) => hasMinRole(userRole, item.minRole))
);
```

## Admin Routes

| Route                   | Min Role    |
| ----------------------- | ----------- |
| `/admin/dashboard`      | MANAGER     |
| `/admin/movies`         | ADMIN       |
| `/admin/screenings`     | MANAGER     |
| `/admin/bookings`       | MANAGER     |
| `/admin/cinemas`        | ADMIN       |
| `/admin/branches`       | ADMIN       |
| `/admin/halls`          | ADMIN       |
| `/admin/food-items`     | MANAGER     |
| `/admin/promo-codes`    | ADMIN       |
| `/admin/announcements`  | ADMIN       |
| `/admin/promotions`     | ADMIN       |
| `/admin/group-bookings` | MANAGER     |
| `/admin/analytics`      | MANAGER     |
| `/admin/staff`          | ADMIN       |
| `/admin/audit-log`      | ADMIN       |
| `/admin/users`          | SUPER_ADMIN |

## i18n in Admin

**Russian only, hardcoded** — no `$_()` calls. No locale files for admin.


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
