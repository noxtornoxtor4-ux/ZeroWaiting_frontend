# Admin Entity Selects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw UUID `<Input>` fields in four admin form modals with searchable entity `<Select>` components (movies, promo codes, branches, halls with cinema→branch→hall cascade).

**Architecture:** Four specialized select components in `src/components/admin/selects/` wrap `Select.svelte`. Each encapsulates its endpoint, a debounced server-side search (`limit: 50`, 300 ms debounce), and — for cascading selects — internal cinema/branch state plus automatic child reset when parent clears. Prefill on edit uses an optional `initialEntity` prop so the currently-selected label shows instantly without an extra round-trip.

**Tech Stack:** Svelte 5 runes, SCSS scoped per component, `@tanstack/svelte-query` via Orval-generated hooks (`crmQueryApi`), `getLocalizedValue` for i18n name fields, `Select.svelte` with `showSearch` + `onSearch`.

**Verification convention:** The project has no unit-test suite for Svelte components. Each task ends with `bun run check` (TypeScript + Svelte diagnostics) and — where integration is user-visible — a manual browser walkthrough described explicitly in the task. Dev server: `bun run dev` → `http://localhost:5173`.

---

## File Structure

**New files:**

- `src/lib/hooks/use-debounced-value.svelte.ts` — reusable debounce hook.
- `src/components/admin/selects/MovieSelect.svelte` — single-select movie, search by `title`.
- `src/components/admin/selects/PromoCodeSelect.svelte` — single-select promo code, search by `code`.
- `src/components/admin/selects/BranchSelect.svelte` — cinema→branch cascade.
- `src/components/admin/selects/HallSelect.svelte` — cinema→branch→hall cascade.

**Modified files:**

- `src/routes/admin/screenings/components/ScreeningFormModal.svelte` — swap two `<Input>` for `MovieSelect` + `HallSelect`.
- `src/routes/admin/announcements/components/AnnouncementFormModal.svelte` — swap `<Input label="ID фильма">` for `MovieSelect`.
- `src/routes/admin/promotions/components/PromotionFormModal.svelte` — swap `<Input label="ID промокода">` for `PromoCodeSelect`.
- `src/routes/admin/food-items/components/FoodItemFormModal.svelte` — swap `<Input label="ID филиала">` for `BranchSelect`.

---

## Task 1: Debounce hook

**Files:**

- Create: `src/lib/hooks/use-debounced-value.svelte.ts`

- [ ] **Step 1: Create the hook**

Create `src/lib/hooks/use-debounced-value.svelte.ts`:

```ts
export const useDebouncedValue = <T>(initial: T, delayMs = 300) => {
	let value = $state(initial);
	let debounced = $state(initial);

	$effect(() => {
		const snapshot = value;
		const timer = setTimeout(() => {
			debounced = snapshot;
		}, delayMs);
		return () => clearTimeout(timer);
	});

	return {
		get value() {
			return value;
		},
		set value(next: T) {
			value = next;
		},
		get debounced() {
			return debounced;
		}
	};
};
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no new errors relating to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks/use-debounced-value.svelte.ts
git commit -m "feat(hooks): add useDebouncedValue rune-based hook"
```

---

## Task 2: MovieSelect component

**Files:**

- Create: `src/components/admin/selects/MovieSelect.svelte`

- [ ] **Step 1: Write the component**

Create `src/components/admin/selects/MovieSelect.svelte`:

```svelte
<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { MovieEntity } from '@/api/model';
	import Select, { type SelectOption } from '@/components/ui/Select.svelte';
	import { useDebouncedValue } from '@/lib/hooks/use-debounced-value.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';

	interface Props {
		label?: string;
		placeholder?: string;
		value: string;
		onChange: (id: string) => void;
		required?: boolean;
		disabled?: boolean;
		initialMovie?: MovieEntity | null;
	}

	let {
		label = 'Фильм',
		placeholder = 'Выберите фильм',
		value,
		onChange,
		required = false,
		disabled = false,
		initialMovie = null
	}: Props = $props();

	const search = useDebouncedValue('');

	const query = crmQueryApi.createGetMoviesV1(() => ({
		page: 1,
		limit: 50,
		...(search.debounced.trim() && { title: search.debounced.trim() })
	}));

	const movies = $derived(query.data?.data ?? []);

	const options = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = movies.map((m) => ({
			value: m.id,
			label: getLocalizedValue(m.title)
		}));
		if (
			value &&
			initialMovie &&
			initialMovie.id === value &&
			!base.some((o) => o.value === value)
		) {
			return [
				{
					value: initialMovie.id,
					label: getLocalizedValue(initialMovie.title)
				},
				...base
			];
		}
		return base;
	});
</script>

<Select
	{label}
	{placeholder}
	{required}
	{disabled}
	showSearch
	allowClear
	{value}
	{options}
	onSearch={(q) => (search.value = q)}
	onChange={(vals) => onChange(String(vals[0] ?? ''))}
/>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/selects/MovieSelect.svelte
git commit -m "feat(admin): add MovieSelect with debounced server search"
```

---

## Task 3: Integrate MovieSelect into AnnouncementFormModal

**Files:**

- Modify: `src/routes/admin/announcements/components/AnnouncementFormModal.svelte`

- [ ] **Step 1: Replace the ID input**

In `AnnouncementFormModal.svelte`, replace the import block at the top of `<script>` — add `MovieSelect` import after the `Select` import:

```ts
import Select from '@/components/ui/Select.svelte';
import MovieSelect from '@/components/admin/selects/MovieSelect.svelte';
```

Replace `<Input label="ID фильма" bind:value={movieId} />` (around line 114) with:

```svelte
<MovieSelect
	value={movieId}
	onChange={(id) => (movieId = id)}
	initialMovie={announcement?.movie}
/>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run: `bun run dev`
Navigate to `/admin/announcements`, then:

1. Click **Добавить** → modal opens, «Фильм» field renders as an empty Select. Type a fragment of a movie title — after ~300 ms options filter. Pick one, save — announcement created with correct `movieId`.
2. Click edit on an announcement that has `movieId` set — «Фильм» field shows the movie title (not UUID) immediately. Change to another movie, save — API receives new `movieId`.
3. Click edit on an announcement with no `movieId` — «Фильм» shows placeholder `Выберите фильм`, clear button empty.
4. Open an announcement with a movie, click the clear (×) button in the Select — `movieId` becomes empty; save — server receives `movieId: undefined`.

Expected: all four checks pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/announcements/components/AnnouncementFormModal.svelte
git commit -m "feat(admin): use MovieSelect in announcement form modal"
```

---

## Task 4: PromoCodeSelect component

**Files:**

- Create: `src/components/admin/selects/PromoCodeSelect.svelte`

- [ ] **Step 1: Write the component**

Create `src/components/admin/selects/PromoCodeSelect.svelte`:

```svelte
<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { PromoCodeEntity } from '@/api/model';
	import Select, { type SelectOption } from '@/components/ui/Select.svelte';
	import { useDebouncedValue } from '@/lib/hooks/use-debounced-value.svelte';

	interface Props {
		label?: string;
		placeholder?: string;
		value: string;
		onChange: (id: string) => void;
		required?: boolean;
		disabled?: boolean;
		initialPromoCode?: PromoCodeEntity | null;
	}

	let {
		label = 'Промокод',
		placeholder = 'Выберите промокод',
		value,
		onChange,
		required = false,
		disabled = false,
		initialPromoCode = null
	}: Props = $props();

	const search = useDebouncedValue('');

	const query = crmQueryApi.createGetPromoCodesV1(() => ({
		page: 1,
		limit: 50,
		...(search.debounced.trim() && { code: search.debounced.trim() })
	}));

	const promoCodes = $derived(query.data?.data ?? []);

	const options = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = promoCodes.map((p) => ({
			value: p.id,
			label: p.code
		}));
		if (
			value &&
			initialPromoCode &&
			initialPromoCode.id === value &&
			!base.some((o) => o.value === value)
		) {
			return [
				{ value: initialPromoCode.id, label: initialPromoCode.code },
				...base
			];
		}
		return base;
	});
</script>

<Select
	{label}
	{placeholder}
	{required}
	{disabled}
	showSearch
	allowClear
	{value}
	{options}
	onSearch={(q) => (search.value = q)}
	onChange={(vals) => onChange(String(vals[0] ?? ''))}
/>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/selects/PromoCodeSelect.svelte
git commit -m "feat(admin): add PromoCodeSelect with debounced server search"
```

---

## Task 5: Integrate PromoCodeSelect into PromotionFormModal

**Files:**

- Modify: `src/routes/admin/promotions/components/PromotionFormModal.svelte`

- [ ] **Step 1: Replace the ID input**

Add import right after the `Select` import:

```ts
import Select from '@/components/ui/Select.svelte';
import PromoCodeSelect from '@/components/admin/selects/PromoCodeSelect.svelte';
```

Replace `<Input label="ID промокода" bind:value={promoCodeId} />` (around line 112) with:

```svelte
<PromoCodeSelect
	value={promoCodeId}
	onChange={(id) => (promoCodeId = id)}
	initialPromoCode={promotion?.promoCode}
/>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run: `bun run dev`
Navigate to `/admin/promotions`:

1. Click **Добавить** → «Промокод» Select opens; type a fragment of a code — results filter after debounce. Pick one, save — API receives chosen `promoCodeId`.
2. Edit a promotion that has a promo code — the code string (not UUID) is pre-selected.
3. Clear the selection (× in Select) — save; API receives `promoCodeId: undefined`.

Expected: all three checks pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/promotions/components/PromotionFormModal.svelte
git commit -m "feat(admin): use PromoCodeSelect in promotion form modal"
```

---

## Task 6: BranchSelect component (Cinema → Branch cascade)

**Files:**

- Create: `src/components/admin/selects/BranchSelect.svelte`

- [ ] **Step 1: Write the component**

Create `src/components/admin/selects/BranchSelect.svelte`:

```svelte
<script lang="ts">
	import { untrack } from 'svelte';
	import { crmQueryApi } from '@/api/endpoints';
	import type { BranchEntity } from '@/api/model';
	import Select, { type SelectOption } from '@/components/ui/Select.svelte';
	import { useDebouncedValue } from '@/lib/hooks/use-debounced-value.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';

	interface Props {
		label?: string;
		value: string;
		onChange: (branchId: string) => void;
		required?: boolean;
		disabled?: boolean;
		initialBranch?: BranchEntity | null;
	}

	let {
		label = 'Филиал',
		value,
		onChange,
		required = false,
		disabled = false,
		initialBranch = null
	}: Props = $props();

	let cinemaId = $state(initialBranch?.cinemaId ?? '');

	$effect(() => {
		if (value && initialBranch && initialBranch.id === value) {
			untrack(() => {
				if (initialBranch.cinemaId !== cinemaId) {
					cinemaId = initialBranch.cinemaId;
				}
			});
		} else if (!value) {
			untrack(() => {
				if (cinemaId !== '') cinemaId = '';
			});
		}
	});

	const cinemaSearch = useDebouncedValue('');
	const branchSearch = useDebouncedValue('');

	const cinemasQuery = crmQueryApi.createGetCinemasV1(() => ({
		page: 1,
		limit: 50,
		...(cinemaSearch.debounced.trim() && {
			name: cinemaSearch.debounced.trim()
		})
	}));

	const branchesQuery = crmQueryApi.createGetCinemasByCinemaIdBranchesV1(
		() => cinemaId,
		() => ({
			page: 1,
			limit: 50,
			...(branchSearch.debounced.trim() && {
				search: branchSearch.debounced.trim()
			})
		}),
		() => ({ query: { enabled: !!cinemaId } })
	);

	const cinemas = $derived(cinemasQuery.data?.data ?? []);
	const branches = $derived(branchesQuery.data?.data ?? []);

	const cinemaOptions = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = cinemas.map((c) => ({
			value: c.id,
			label: getLocalizedValue(c.name)
		}));
		const fallback = initialBranch?.cinema;
		if (
			cinemaId &&
			fallback &&
			fallback.id === cinemaId &&
			!base.some((o) => o.value === cinemaId)
		) {
			return [
				{ value: fallback.id, label: getLocalizedValue(fallback.name) },
				...base
			];
		}
		return base;
	});

	const branchOptions = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = branches.map((b) => ({
			value: b.id,
			label: getLocalizedValue(b.name)
		}));
		if (
			value &&
			initialBranch &&
			initialBranch.id === value &&
			!base.some((o) => o.value === value)
		) {
			return [
				{
					value: initialBranch.id,
					label: getLocalizedValue(initialBranch.name)
				},
				...base
			];
		}
		return base;
	});

	const handleCinemaChange = (nextId: string) => {
		cinemaId = nextId;
		if (value) onChange('');
	};
</script>

<div class="branch_select">
	<Select
		label="Кинотеатр"
		placeholder="Выберите кинотеатр"
		showSearch
		allowClear
		{required}
		{disabled}
		value={cinemaId}
		options={cinemaOptions}
		onSearch={(q) => (cinemaSearch.value = q)}
		onChange={(vals) => handleCinemaChange(String(vals[0] ?? ''))}
	/>
	<Select
		{label}
		placeholder="Выберите филиал"
		showSearch
		allowClear
		{required}
		disabled={disabled || !cinemaId}
		{value}
		options={branchOptions}
		onSearch={(q) => (branchSearch.value = q)}
		onChange={(vals) => onChange(String(vals[0] ?? ''))}
	/>
</div>

<style lang="scss">
	.branch_select {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
</style>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/selects/BranchSelect.svelte
git commit -m "feat(admin): add BranchSelect with cinema→branch cascade"
```

---

## Task 7: Integrate BranchSelect into FoodItemFormModal

**Files:**

- Modify: `src/routes/admin/food-items/components/FoodItemFormModal.svelte`

- [ ] **Step 1: Replace the ID input**

Add import:

```ts
import Select from '@/components/ui/Select.svelte';
import BranchSelect from '@/components/admin/selects/BranchSelect.svelte';
```

Replace `<Input label="ID филиала" bind:value={branchId} />` (around line 120) with:

```svelte
<BranchSelect
	value={branchId}
	onChange={(id) => (branchId = id)}
	initialBranch={foodItem?.branch}
/>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run: `bun run dev`
Navigate to `/admin/food-items`:

1. Click **Добавить** → both «Кинотеатр» and «Филиал» visible; «Филиал» is disabled. Pick a cinema → «Филиал» becomes enabled and lists branches of that cinema only. Pick a branch, save — food item saved with correct `branchId`.
2. Edit a food item that has a branch — both «Кинотеатр» and «Филиал» prefill with names (not UUIDs).
3. In an edited food item, clear «Кинотеатр» → «Филиал» also clears and disables. Save — API receives `branchId: undefined`.
4. Type in «Кинотеатр» Select — cinemas filter after debounce. Same for «Филиал» after a cinema is picked.

Expected: all four checks pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/food-items/components/FoodItemFormModal.svelte
git commit -m "feat(admin): use BranchSelect in food item form modal"
```

---

## Task 8: HallSelect component (Cinema → Branch → Hall cascade)

**Files:**

- Create: `src/components/admin/selects/HallSelect.svelte`

- [ ] **Step 1: Write the component**

Create `src/components/admin/selects/HallSelect.svelte`:

```svelte
<script lang="ts">
	import { untrack } from 'svelte';
	import { crmQueryApi } from '@/api/endpoints';
	import type { HallEntity } from '@/api/model';
	import Select, { type SelectOption } from '@/components/ui/Select.svelte';
	import { useDebouncedValue } from '@/lib/hooks/use-debounced-value.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';

	interface Props {
		label?: string;
		value: string;
		onChange: (hallId: string) => void;
		required?: boolean;
		disabled?: boolean;
		initialHall?: HallEntity | null;
	}

	let {
		label = 'Зал',
		value,
		onChange,
		required = false,
		disabled = false,
		initialHall = null
	}: Props = $props();

	let cinemaId = $state(initialHall?.branch?.cinemaId ?? '');
	let branchId = $state(initialHall?.branchId ?? '');

	$effect(() => {
		if (value && initialHall && initialHall.id === value) {
			untrack(() => {
				const nextCinemaId = initialHall.branch?.cinemaId ?? '';
				const nextBranchId = initialHall.branchId ?? '';
				if (cinemaId !== nextCinemaId) cinemaId = nextCinemaId;
				if (branchId !== nextBranchId) branchId = nextBranchId;
			});
		} else if (!value) {
			untrack(() => {
				if (cinemaId !== '') cinemaId = '';
				if (branchId !== '') branchId = '';
			});
		}
	});

	const cinemaSearch = useDebouncedValue('');
	const branchSearch = useDebouncedValue('');
	const hallSearch = useDebouncedValue('');

	const cinemasQuery = crmQueryApi.createGetCinemasV1(() => ({
		page: 1,
		limit: 50,
		...(cinemaSearch.debounced.trim() && {
			name: cinemaSearch.debounced.trim()
		})
	}));

	const branchesQuery = crmQueryApi.createGetCinemasByCinemaIdBranchesV1(
		() => cinemaId,
		() => ({
			page: 1,
			limit: 50,
			...(branchSearch.debounced.trim() && {
				search: branchSearch.debounced.trim()
			})
		}),
		() => ({ query: { enabled: !!cinemaId } })
	);

	const hallsQuery = crmQueryApi.createGetBranchesByBranchIdHallsV1(
		() => branchId,
		() => ({
			page: 1,
			limit: 50,
			...(hallSearch.debounced.trim() && {
				search: hallSearch.debounced.trim()
			})
		}),
		() => ({ query: { enabled: !!branchId } })
	);

	const cinemas = $derived(cinemasQuery.data?.data ?? []);
	const branches = $derived(branchesQuery.data?.data ?? []);
	const halls = $derived(hallsQuery.data?.data ?? []);

	const cinemaOptions = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = cinemas.map((c) => ({
			value: c.id,
			label: getLocalizedValue(c.name)
		}));
		const fallback = initialHall?.branch?.cinema;
		if (
			cinemaId &&
			fallback &&
			fallback.id === cinemaId &&
			!base.some((o) => o.value === cinemaId)
		) {
			return [
				{ value: fallback.id, label: getLocalizedValue(fallback.name) },
				...base
			];
		}
		return base;
	});

	const branchOptions = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = branches.map((b) => ({
			value: b.id,
			label: getLocalizedValue(b.name)
		}));
		const fallback = initialHall?.branch;
		if (
			branchId &&
			fallback &&
			fallback.id === branchId &&
			!base.some((o) => o.value === branchId)
		) {
			return [
				{ value: fallback.id, label: getLocalizedValue(fallback.name) },
				...base
			];
		}
		return base;
	});

	const hallOptions = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = halls.map((h) => ({
			value: h.id,
			label: h.name
		}));
		if (
			value &&
			initialHall &&
			initialHall.id === value &&
			!base.some((o) => o.value === value)
		) {
			return [{ value: initialHall.id, label: initialHall.name }, ...base];
		}
		return base;
	});

	const handleCinemaChange = (nextId: string) => {
		cinemaId = nextId;
		if (branchId) branchId = '';
		if (value) onChange('');
	};

	const handleBranchChange = (nextId: string) => {
		branchId = nextId;
		if (value) onChange('');
	};
</script>

<div class="hall_select">
	<Select
		label="Кинотеатр"
		placeholder="Выберите кинотеатр"
		showSearch
		allowClear
		{required}
		{disabled}
		value={cinemaId}
		options={cinemaOptions}
		onSearch={(q) => (cinemaSearch.value = q)}
		onChange={(vals) => handleCinemaChange(String(vals[0] ?? ''))}
	/>
	<Select
		label="Филиал"
		placeholder="Выберите филиал"
		showSearch
		allowClear
		{required}
		disabled={disabled || !cinemaId}
		value={branchId}
		options={branchOptions}
		onSearch={(q) => (branchSearch.value = q)}
		onChange={(vals) => handleBranchChange(String(vals[0] ?? ''))}
	/>
	<Select
		{label}
		placeholder="Выберите зал"
		showSearch
		allowClear
		{required}
		disabled={disabled || !branchId}
		{value}
		options={hallOptions}
		onSearch={(q) => (hallSearch.value = q)}
		onChange={(vals) => onChange(String(vals[0] ?? ''))}
	/>
</div>

<style lang="scss">
	.hall_select {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
</style>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/selects/HallSelect.svelte
git commit -m "feat(admin): add HallSelect with cinema→branch→hall cascade"
```

---

## Task 9: Integrate MovieSelect + HallSelect into ScreeningFormModal

**Files:**

- Modify: `src/routes/admin/screenings/components/ScreeningFormModal.svelte`

- [ ] **Step 1: Replace both ID inputs**

Add imports (right after the `Select` import):

```ts
import Select from '@/components/ui/Select.svelte';
import MovieSelect from '@/components/admin/selects/MovieSelect.svelte';
import HallSelect from '@/components/admin/selects/HallSelect.svelte';
```

Replace the two `<Input>` lines (around lines 96–97) — change:

```svelte
<Input label="ID фильма" bind:value={movieId} required />
<Input label="ID зала" bind:value={hallId} required />
```

to:

```svelte
<MovieSelect
	value={movieId}
	onChange={(id) => (movieId = id)}
	initialMovie={screening?.movie}
	required
/>
<HallSelect
	value={hallId}
	onChange={(id) => (hallId = id)}
	initialHall={screening?.hall}
	required
/>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run: `bun run dev`
Navigate to `/admin/screenings`:

1. Click **Добавить сеанс** → modal shows «Фильм», «Кинотеатр», «Филиал», «Зал» (+ existing datetime/price/format fields). «Филиал» and «Зал» disabled. Pick cinema → «Филиал» enabled; pick branch → «Зал» enabled; pick a hall; pick a movie. Save — screening created.
2. Edit an existing screening — **all four** selects prefill with human-readable names (movie title, cinema name, branch name, hall name), not UUIDs.
3. In an edited screening, change cinema → branch and hall auto-clear, user re-picks.
4. Type in «Фильм» — server filters after debounce. Same for «Зал» within the chosen branch.
5. Save edit — API receives correct `movieId` and `hallId` (check network tab).

Expected: all five checks pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/screenings/components/ScreeningFormModal.svelte
git commit -m "feat(admin): use MovieSelect and HallSelect in screening form modal"
```

---

## Task 10: Final sweep

**Files:** none (verification only)

- [ ] **Step 1: Confirm no raw ID inputs remain**

Run (via the Grep tool, not shell):
Search pattern: `label="ID ` in `src/routes/admin/**/*.svelte`.
Expected: no matches. (If any remain, either add a task for them or document why they're excluded — e.g., external-system IDs not backed by a selectable entity.)

- [ ] **Step 2: Final type-check**

Run: `bun run check`
Expected: zero errors and zero new warnings.

- [ ] **Step 3: Final manual smoke**

Run: `bun run dev` → walk through `/admin/screenings`, `/admin/announcements`, `/admin/promotions`, `/admin/food-items`:

- Create new entry in each: all former ID fields are now searchable selects.
- Edit existing entry in each: prefilled with human labels.

Expected: no raw UUID visible anywhere in the four modals.

- [ ] **Step 4: Commit (only if anything changed in the sweep)**

If a forgotten spot was found and fixed in this task, commit it:

```bash
git add <path>
git commit -m "fix(admin): replace remaining raw ID input with entity select"
```

If nothing needed changes, skip the commit.

---

## Post-plan notes

- If during manual verification any related entity (`announcement.movie`, `promotion.promoCode`, `foodItem.branch`, `screening.hall.branch.cinema`) does **not** arrive from the backend at runtime, stop that task and fix the backend: remove `@DtoEntityHidden` on the relation in the Prisma schema at `~/Desktop/ZeroWaiting_backend`, rebuild, re-run locally on port 5000, and regenerate the API client with `VITE_API_BASE_URL=http://localhost:5000 bun run generate:api`. Then resume the task.
- `Select.svelte` still performs a client-side filter on top of server results. This is intentional and not a bug: within the 300 ms debounce window the client keeps trimming the last-known server batch, then the new server response replaces it.
