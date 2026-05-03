# Schedule Filter & UTC Date Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add date filter («Вчера» / «Сегодня» / «Завтра» + `DateRangeFilter`, default «Сегодня») to the screenings schedule on `/movies/[id]`, and bring the whole project under a single UTC date contract with two explicit types — Civil date and Instant — via a single `@/lib/utils/datetime.ts` module.

**Architecture:**

- Create `@/lib/utils/datetime.ts` as the single entrypoint for all boundary date code (both Civil date and Instant helpers, plus filter presets). Move existing Intl formatters into it and delete the old `@/lib/utils/date.ts`.
- Migrate all callers that currently send raw local strings or call `.toISOString()` directly to go through the typed helpers.
- Build a `ScheduleFilterBar.svelte` component that shares a single `dateFrom`/`dateTo` state with `DateRangeFilter`; the preset buttons light up automatically when the custom range matches.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TypeScript strict, Vitest for unit tests, `@tanstack/svelte-query` via Orval hooks, `svelte-i18n` (ru/en/ky/kz/uz).

**Reference spec:** `docs/superpowers/specs/2026-04-19-schedule-filter-and-utc-contract-design.md`

---

## File Structure

### Created

- `src/lib/utils/datetime.ts` — single entrypoint: Civil date helpers, Instant helpers, filter presets, re-exported formatters. ~180 lines, one responsibility (date/time boundary).
- `src/lib/utils/datetime.test.ts` — unit tests for all helpers. Uses `vi.useFakeTimers` / `vi.setSystemTime` to exercise presets and timezone behavior deterministically.
- `src/routes/(client)/movies/[id]/components/ScheduleFilterBar.svelte` — filter bar UI (preset buttons + `DateRangeFilter`). Owns nothing — receives `dateFrom`/`dateTo` as bindable props and emits `onchange`.

### Modified

- `src/routes/(client)/movies/[id]/+page.svelte` — add filter state, pass `dateFrom`/`dateTo` to `createGetPublicRepertoireV1`, render `ScheduleFilterBar`, show skeleton while fetching.
- `src/components/ui/DateRangeFilter.svelte` — replace inline `atStartOfDay().toISOString()` / `atEndOfDay().toISOString()` with `toBackendStartOfLocalDay` / `toBackendEndOfLocalDay`.
- `src/routes/admin/movies/components/MovieFormModal.svelte` — Civil date migration for `releaseDate`.
- `src/routes/admin/promo-codes/components/PromoCodeFormModal.svelte` — Civil date migration for `expiresAt`.
- `src/routes/admin/promotions/components/PromotionFormModal.svelte` — Civil date migration for `startDate`/`endDate`.
- `src/routes/admin/announcements/components/AnnouncementFormModal.svelte` — Civil date migration for `publishDate`/`expiryDate`.
- `src/routes/admin/screenings/components/ScreeningFormModal.svelte` — Instant migration (wrap already-correct calls in the new helpers).
- `src/routes/admin/analytics/+page.svelte` — replace raw `.toISOString()` with `toBackendInstant`.
- `src/routes/admin/dashboard/+page.svelte` — replace raw `.toISOString()` with `toBackendInstant`.
- `src/lib/i18n/locales/ru.json`, `en.json`, `ky.json`, `kz.json`, `uz.json` — add `movie.schedule.{yesterday,today,tomorrow,customRange}`.
- `CLAUDE.md` — add **Dates & Times (UTC contract)** section.

### Deleted

- `src/lib/utils/date.ts` — everything moves into `datetime.ts`; `isoToLocalDate` is dropped (incorrect for Civil date in sub-UTC zones), `isoToLocalInput` is renamed `fromBackendInstant`.

---

## Conventions

- All functions are **arrow functions** (project rule from `CLAUDE.md`).
- Never `any` — use generated types from `@/api/model`.
- Commit at the end of every task. Conventional Commits: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. Scopes: `utils`, `movies`, `admin`, `ui`, `i18n`, `docs`.
- Run `bun run check` only at the end of Task 11 — it is slow; individual tasks rely on `bun run test` to keep the inner loop fast.

---

## Task 1: Create `datetime.ts` with Civil date helpers (test-first)

**Files:**

- Create: `src/lib/utils/datetime.test.ts`
- Create: `src/lib/utils/datetime.ts`

**Goal:** Establish the new module with Civil date round-trip and formatting. This task produces 4 functions and their tests.

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/datetime.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
	toBackendCivilDate,
	fromBackendCivilDate,
	formatCivilDate,
	formatCivilDateShort
} from './datetime';

describe('toBackendCivilDate', () => {
	it('converts YYYY-MM-DD to UTC midnight ISO', () => {
		expect(toBackendCivilDate('2026-04-19')).toBe('2026-04-19T00:00:00.000Z');
	});

	it('returns empty string for malformed input', () => {
		expect(toBackendCivilDate('')).toBe('');
		expect(toBackendCivilDate('19/04/2026')).toBe('');
		expect(toBackendCivilDate('2026-4-9')).toBe('');
	});
});

describe('fromBackendCivilDate', () => {
	it('reads UTC components (never shifts the day, even in sub-UTC zones)', () => {
		expect(fromBackendCivilDate('2026-04-19T00:00:00.000Z')).toBe('2026-04-19');
	});

	it('returns empty string for nullish input', () => {
		expect(fromBackendCivilDate(null)).toBe('');
		expect(fromBackendCivilDate(undefined)).toBe('');
		expect(fromBackendCivilDate('')).toBe('');
	});

	it('returns empty string for invalid iso', () => {
		expect(fromBackendCivilDate('not-a-date')).toBe('');
	});
});

describe('formatCivilDate', () => {
	it('formats in ru-RU by default with UTC timezone', () => {
		expect(formatCivilDate('2026-04-19T00:00:00.000Z')).toBe(
			'19 апреля 2026 г.'
		);
	});

	it('formats in en-US', () => {
		expect(formatCivilDate('2026-04-19T00:00:00.000Z', 'en-US')).toBe(
			'April 19, 2026'
		);
	});
});

describe('formatCivilDateShort', () => {
	it('returns short form in ru-RU', () => {
		expect(formatCivilDateShort('2026-04-19T00:00:00.000Z')).toBe('19 апр.');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/lib/utils/datetime.test.ts`

Expected: FAIL — module `./datetime` does not exist yet.

- [ ] **Step 3: Create the module with Civil date helpers**

Create `src/lib/utils/datetime.ts`:

```ts
const pad = (n: number): string => String(n).padStart(2, '0');

// ─────────────────────────────────────────────────────────────
// Civil date — "calendar day" (no timezone)
// ─────────────────────────────────────────────────────────────

export const toBackendCivilDate = (ymd: string): string => {
	const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return '';
	const [, y, mo, d] = m;
	const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
	if (Number.isNaN(date.getTime())) return '';
	return date.toISOString();
};

export const fromBackendCivilDate = (
	iso: string | null | undefined
): string => {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const formatCivilDate = (iso: string, locale = 'ru-RU'): string => {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(iso));
};

export const formatCivilDateShort = (iso: string, locale = 'ru-RU'): string => {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	}).format(new Date(iso));
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/lib/utils/datetime.test.ts`

Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/datetime.ts src/lib/utils/datetime.test.ts
git commit -m "feat(utils): add Civil date helpers in datetime module"
```

---

## Task 2: Add Instant helpers (test-first)

**Files:**

- Modify: `src/lib/utils/datetime.test.ts`
- Modify: `src/lib/utils/datetime.ts`

**Goal:** Add four Instant helpers: `toBackendInstant`, `toBackendStartOfLocalDay`, `toBackendEndOfLocalDay`, `fromBackendInstant`. These need to behave consistently regardless of test runner TZ, so tests assert structural properties rather than exact UTC offsets.

- [ ] **Step 1: Add failing tests**

Append to `src/lib/utils/datetime.test.ts`:

```ts
import {
	toBackendInstant,
	toBackendStartOfLocalDay,
	toBackendEndOfLocalDay,
	fromBackendInstant
} from './datetime';

describe('toBackendInstant', () => {
	it('accepts a Date and returns UTC ISO with Z', () => {
		const d = new Date('2026-04-19T14:25:00Z');
		expect(toBackendInstant(d)).toBe('2026-04-19T14:25:00.000Z');
	});

	it('accepts a string parseable by Date constructor', () => {
		expect(toBackendInstant('2026-04-19T14:25:00Z')).toBe(
			'2026-04-19T14:25:00.000Z'
		);
	});

	it('returns empty string for invalid input', () => {
		expect(toBackendInstant('nope')).toBe('');
	});
});

describe('toBackendStartOfLocalDay / toBackendEndOfLocalDay', () => {
	it('start returns ISO with Z suffix', () => {
		const out = toBackendStartOfLocalDay(new Date());
		expect(out.endsWith('Z')).toBe(true);
	});

	it('end is later than start for the same day', () => {
		const base = new Date();
		expect(
			new Date(toBackendEndOfLocalDay(base)).getTime() >
				new Date(toBackendStartOfLocalDay(base)).getTime()
		).toBe(true);
	});

	it('end minus start equals 23h 59m 59.999s', () => {
		const base = new Date();
		const diff =
			new Date(toBackendEndOfLocalDay(base)).getTime() -
			new Date(toBackendStartOfLocalDay(base)).getTime();
		expect(diff).toBe(86_399_999);
	});
});

describe('fromBackendInstant', () => {
	it('returns YYYY-MM-DDTHH:mm in local time', () => {
		const d = new Date(2026, 3, 19, 14, 25);
		const iso = d.toISOString();
		expect(fromBackendInstant(iso)).toBe('2026-04-19T14:25');
	});

	it('returns empty string for nullish / invalid input', () => {
		expect(fromBackendInstant(null)).toBe('');
		expect(fromBackendInstant(undefined)).toBe('');
		expect(fromBackendInstant('nope')).toBe('');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/utils/datetime.test.ts`

Expected: FAIL — imports missing.

- [ ] **Step 3: Add Instant helpers to `datetime.ts`**

Append to `src/lib/utils/datetime.ts`:

```ts
// ─────────────────────────────────────────────────────────────
// Instant — "moment in time"
// ─────────────────────────────────────────────────────────────

const toDate = (input: Date | string): Date =>
	typeof input === 'string' ? new Date(input) : new Date(input.getTime());

export const toBackendInstant = (local: Date | string): string => {
	const d = toDate(local);
	if (Number.isNaN(d.getTime())) return '';
	return d.toISOString();
};

export const toBackendStartOfLocalDay = (local: Date | string): string => {
	const d = toDate(local);
	if (Number.isNaN(d.getTime())) return '';
	d.setHours(0, 0, 0, 0);
	return d.toISOString();
};

export const toBackendEndOfLocalDay = (local: Date | string): string => {
	const d = toDate(local);
	if (Number.isNaN(d.getTime())) return '';
	d.setHours(23, 59, 59, 999);
	return d.toISOString();
};

export const fromBackendInstant = (iso: string | null | undefined): string => {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/lib/utils/datetime.test.ts`

Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/datetime.ts src/lib/utils/datetime.test.ts
git commit -m "feat(utils): add Instant helpers to datetime module"
```

---

## Task 3: Add filter presets (test-first)

**Files:**

- Modify: `src/lib/utils/datetime.test.ts`
- Modify: `src/lib/utils/datetime.ts`

**Goal:** Add `DatePreset` type, `presetRange`, `matchPreset`. Tests use fake timers so the results are deterministic.

- [ ] **Step 1: Add failing tests**

Append to `src/lib/utils/datetime.test.ts`:

```ts
import { vi, beforeEach, afterEach } from 'vitest';
import {
	presetRange,
	matchPreset,
	toBackendStartOfLocalDay,
	toBackendEndOfLocalDay
} from './datetime';

describe('presetRange + matchPreset', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Fix "now" to 2026-04-19 12:00 local.
		vi.setSystemTime(new Date(2026, 3, 19, 12, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('today is start→end of the local current day', () => {
		const r = presetRange('today');
		expect(r.dateFrom).toBe(toBackendStartOfLocalDay(new Date(2026, 3, 19)));
		expect(r.dateTo).toBe(toBackendEndOfLocalDay(new Date(2026, 3, 19)));
	});

	it('yesterday is one day before today', () => {
		const r = presetRange('yesterday');
		expect(r.dateFrom).toBe(toBackendStartOfLocalDay(new Date(2026, 3, 18)));
		expect(r.dateTo).toBe(toBackendEndOfLocalDay(new Date(2026, 3, 18)));
	});

	it('tomorrow is one day after today', () => {
		const r = presetRange('tomorrow');
		expect(r.dateFrom).toBe(toBackendStartOfLocalDay(new Date(2026, 3, 20)));
		expect(r.dateTo).toBe(toBackendEndOfLocalDay(new Date(2026, 3, 20)));
	});

	it('matchPreset returns the kind when range matches exactly', () => {
		const t = presetRange('today');
		expect(matchPreset(t.dateFrom, t.dateTo)).toBe('today');
		const y = presetRange('yesterday');
		expect(matchPreset(y.dateFrom, y.dateTo)).toBe('yesterday');
		const tm = presetRange('tomorrow');
		expect(matchPreset(tm.dateFrom, tm.dateTo)).toBe('tomorrow');
	});

	it('matchPreset returns null for a custom range', () => {
		const custom = {
			dateFrom: toBackendStartOfLocalDay(new Date(2026, 3, 15)),
			dateTo: toBackendEndOfLocalDay(new Date(2026, 3, 22))
		};
		expect(matchPreset(custom.dateFrom, custom.dateTo)).toBeNull();
	});

	it('matchPreset returns null when either bound is empty', () => {
		expect(matchPreset('', '')).toBeNull();
		expect(matchPreset('2026-04-19T00:00:00.000Z', '')).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/utils/datetime.test.ts`

Expected: FAIL — `presetRange`/`matchPreset` not exported.

- [ ] **Step 3: Add preset helpers to `datetime.ts`**

Append to `src/lib/utils/datetime.ts`:

```ts
// ─────────────────────────────────────────────────────────────
// Filter presets (Instant, anchored to user's local day)
// ─────────────────────────────────────────────────────────────

export type DatePreset = 'yesterday' | 'today' | 'tomorrow';

const presetBaseDate = (kind: DatePreset): Date => {
	const base = new Date();
	base.setHours(0, 0, 0, 0);
	if (kind === 'yesterday') base.setDate(base.getDate() - 1);
	else if (kind === 'tomorrow') base.setDate(base.getDate() + 1);
	return base;
};

export const presetRange = (
	kind: DatePreset
): { dateFrom: string; dateTo: string } => {
	const base = presetBaseDate(kind);
	return {
		dateFrom: toBackendStartOfLocalDay(base),
		dateTo: toBackendEndOfLocalDay(base)
	};
};

const PRESET_KINDS: readonly DatePreset[] = ['yesterday', 'today', 'tomorrow'];

export const matchPreset = (
	dateFrom: string,
	dateTo: string
): DatePreset | null => {
	if (!dateFrom || !dateTo) return null;
	for (const kind of PRESET_KINDS) {
		const expected = presetRange(kind);
		if (expected.dateFrom === dateFrom && expected.dateTo === dateTo) {
			return kind;
		}
	}
	return null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/lib/utils/datetime.test.ts`

Expected: PASS (all tests, incl. the 6 new preset tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/datetime.ts src/lib/utils/datetime.test.ts
git commit -m "feat(utils): add date filter presets (yesterday/today/tomorrow)"
```

---

## Task 4: Move formatters into `datetime.ts` and delete `date.ts`

**Files:**

- Modify: `src/lib/utils/datetime.ts` (append formatters)
- Delete: `src/lib/utils/date.ts`
- Modify (imports): `src/routes/(client)/movies/[id]/+page.svelte`, `src/routes/(client)/movies/[id]/components/ScreeningCard.svelte`, `src/routes/(client)/booking/[bookingId]/+page.svelte`, `src/routes/(client)/screenings/[id]/+page.svelte`, and **every** other file currently importing from `@/lib/utils/date`

**Goal:** Make `@/lib/utils/datetime` the single entrypoint. `date.ts` stops existing.

- [ ] **Step 1: Append display formatters to `datetime.ts`**

Append to `src/lib/utils/datetime.ts`:

```ts
// ─────────────────────────────────────────────────────────────
// Display formatters (Intl in user's locale, no timeZone override)
// ─────────────────────────────────────────────────────────────

export const formatDate = (date: string | Date, locale = 'ru-RU'): string => {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(new Date(date));
};

export const formatTime = (date: string | Date, locale = 'ru-RU'): string => {
	return new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(date));
};

export const formatDateTime = (
	date: string | Date,
	locale = 'ru-RU'
): string => {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(date));
};

export const formatShortDate = (
	date: string | Date,
	locale = 'ru-RU'
): string => {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short'
	}).format(new Date(date));
};

export const formatWeekday = (
	date: string | Date,
	locale = 'ru-RU'
): string => {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'short'
	}).format(new Date(date));
};

export const formatDuration = (minutes: number): string => {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m} мин`;
	if (m === 0) return `${h} ч`;
	return `${h} ч ${m} мин`;
};
```

- [ ] **Step 2: Rewrite every importer of `@/lib/utils/date`**

List the importers:

Run: `rg -l "from '@/lib/utils/date'" src`

For **each** file in the list:

1. Change `from '@/lib/utils/date'` → `from '@/lib/utils/datetime'`.
2. If the import list contains `isoToLocalDate`, **leave it broken for now** — those files are re-pointed in Task 6.
3. If the import list contains `isoToLocalInput`, rename it to `fromBackendInstant` in the same edit.

Example — `src/routes/(client)/movies/[id]/components/ScreeningCard.svelte:4`:

Before:

```ts
import { formatTime, formatShortDate, formatWeekday } from '@/lib/utils/date';
```

After:

```ts
import {
	formatTime,
	formatShortDate,
	formatWeekday
} from '@/lib/utils/datetime';
```

- [ ] **Step 3: Delete `src/lib/utils/date.ts`**

Run: `rm /Users/elcho/Desktop/ZeroWaiting_frontend/src/lib/utils/date.ts`

- [ ] **Step 4: Verify no broken imports from `date.ts` remain**

Run: `rg "from '@/lib/utils/date'" src`

Expected: zero matches.

Run: `bun run test src/lib/utils/datetime.test.ts`

Expected: PASS — formatter imports still resolve through the new module.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/datetime.ts src/routes src/lib
git rm src/lib/utils/date.ts
git commit -m "refactor(utils): unify date helpers in datetime module, drop date.ts"
```

---

## Task 5: Migrate `DateRangeFilter.svelte` to use helpers

**Files:**

- Modify: `src/components/ui/DateRangeFilter.svelte:193-200`

**Goal:** Replace the private `atStartOfDay/atEndOfDay + toISOString()` commit logic with `toBackendStartOfLocalDay` / `toBackendEndOfLocalDay`. Behavior identical.

- [ ] **Step 1: Add the import**

Modify `src/components/ui/DateRangeFilter.svelte`. Find the existing imports block near the top of `<script>` and add:

```ts
import {
	toBackendStartOfLocalDay,
	toBackendEndOfLocalDay
} from '@/lib/utils/datetime';
```

- [ ] **Step 2: Replace the `commit` body**

Locate (around line 193):

```ts
const commit = (start: Date, end: Date) => {
	const [a, b] = compareDays(start, end) <= 0 ? [start, end] : [end, start];
	const nextFrom = atStartOfDay(a).toISOString();
	const nextTo = atEndOfDay(b).toISOString();
	from = nextFrom;
	to = nextTo;
	onchange?.(nextFrom, nextTo);
};
```

Replace with:

```ts
const commit = (start: Date, end: Date) => {
	const [a, b] = compareDays(start, end) <= 0 ? [start, end] : [end, start];
	const nextFrom = toBackendStartOfLocalDay(a);
	const nextTo = toBackendEndOfLocalDay(b);
	from = nextFrom;
	to = nextTo;
	onchange?.(nextFrom, nextTo);
};
```

- [ ] **Step 3: Remove the now-unused local helpers**

Also in the `<script>` block, delete the two declarations (they appear near line 51-61):

```ts
const atStartOfDay = (d: Date) => {
	const n = new Date(d);
	n.setHours(0, 0, 0, 0);
	return n;
};

const atEndOfDay = (d: Date) => {
	const n = new Date(d);
	n.setHours(23, 59, 59, 999);
	return n;
};
```

- [ ] **Step 4: Smoke-check**

Run: `bun run test src/lib/utils/datetime.test.ts` (to make sure nothing drifted).

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/DateRangeFilter.svelte
git commit -m "refactor(ui): route DateRangeFilter through datetime helpers"
```

---

## Task 6: Migrate admin forms (Civil date + Instant)

**Files:**

- Modify: `src/routes/admin/movies/components/MovieFormModal.svelte`
- Modify: `src/routes/admin/promo-codes/components/PromoCodeFormModal.svelte`
- Modify: `src/routes/admin/promotions/components/PromotionFormModal.svelte`
- Modify: `src/routes/admin/announcements/components/AnnouncementFormModal.svelte`
- Modify: `src/routes/admin/screenings/components/ScreeningFormModal.svelte`
- Modify: `src/routes/admin/analytics/+page.svelte`
- Modify: `src/routes/admin/dashboard/+page.svelte`

**Goal:** Every date sent to backend goes through `toBackendCivilDate` / `toBackendInstant`. Every read into a `<DatePicker>` goes through `fromBackendCivilDate` / `fromBackendInstant`.

### 6.1 `MovieFormModal.svelte`

- [ ] **Step 1: Fix imports**

Change:

```ts
import { isoToLocalDate } from '@/lib/utils/date';
```

to:

```ts
import { fromBackendCivilDate, toBackendCivilDate } from '@/lib/utils/datetime';
```

- [ ] **Step 2: Replace the read (line 56)**

Before:

```ts
releaseDate = isoToLocalDate(movie.releaseDate);
```

After:

```ts
releaseDate = fromBackendCivilDate(movie.releaseDate);
```

- [ ] **Step 3: Replace the write (line 92)**

In the `data` object being built inside `handleSubmit`, change:

```ts
releaseDate,
```

to:

```ts
releaseDate: toBackendCivilDate(releaseDate),
```

### 6.2 `PromoCodeFormModal.svelte`

- [ ] **Step 4: Fix imports**

Change:

```ts
import { isoToLocalDate } from '@/lib/utils/date';
```

to:

```ts
import { fromBackendCivilDate, toBackendCivilDate } from '@/lib/utils/datetime';
```

- [ ] **Step 5: Replace the read (line 47)**

Before:

```ts
expiresAt = isoToLocalDate(promoCode.expiresAt);
```

After:

```ts
expiresAt = fromBackendCivilDate(promoCode.expiresAt);
```

- [ ] **Step 6: Replace the write (line 71)**

Before:

```ts
expiresAt: expiresAt || undefined;
```

After:

```ts
expiresAt: expiresAt ? toBackendCivilDate(expiresAt) : undefined;
```

### 6.3 `PromotionFormModal.svelte`

- [ ] **Step 7: Fix imports**

Change:

```ts
import { isoToLocalDate } from '@/lib/utils/date';
```

to:

```ts
import { fromBackendCivilDate, toBackendCivilDate } from '@/lib/utils/datetime';
```

- [ ] **Step 8: Replace the reads (lines 50-51)**

Before:

```ts
startDate = isoToLocalDate(promotion.startDate);
endDate = isoToLocalDate(promotion.endDate);
```

After:

```ts
startDate = fromBackendCivilDate(promotion.startDate);
endDate = fromBackendCivilDate(promotion.endDate);
```

- [ ] **Step 9: Replace the writes (lines 77-78)**

Before:

```ts
startDate,
endDate,
```

After:

```ts
startDate: toBackendCivilDate(startDate),
endDate: toBackendCivilDate(endDate),
```

### 6.4 `AnnouncementFormModal.svelte`

- [ ] **Step 10: Fix imports**

Change:

```ts
import { isoToLocalDate } from '@/lib/utils/date';
```

to:

```ts
import { fromBackendCivilDate, toBackendCivilDate } from '@/lib/utils/datetime';
```

- [ ] **Step 11: Replace the reads (lines 50-51)**

Before:

```ts
publishDate = isoToLocalDate(announcement.publishDate);
expiryDate = isoToLocalDate(announcement.expiryDate);
```

After:

```ts
publishDate = fromBackendCivilDate(announcement.publishDate);
expiryDate = fromBackendCivilDate(announcement.expiryDate);
```

- [ ] **Step 12: Replace the writes (lines 79-80)**

Before:

```ts
publishDate: publishDate || undefined,
expiryDate: expiryDate || undefined,
```

After:

```ts
publishDate: publishDate ? toBackendCivilDate(publishDate) : undefined,
expiryDate: expiryDate ? toBackendCivilDate(expiryDate) : undefined,
```

### 6.5 `ScreeningFormModal.svelte` (Instant)

- [ ] **Step 13: Fix imports**

Change:

```ts
import { isoToLocalInput } from '@/lib/utils/date';
```

to:

```ts
import { fromBackendInstant, toBackendInstant } from '@/lib/utils/datetime';
```

- [ ] **Step 14: Replace the reads (lines 46-47)**

Before:

```ts
startTime = isoToLocalInput(screening.startTime);
endTime = isoToLocalInput(screening.endTime);
```

After:

```ts
startTime = fromBackendInstant(screening.startTime);
endTime = fromBackendInstant(screening.endTime);
```

- [ ] **Step 15: Replace the writes (lines 70-71)**

Before:

```ts
startTime: new Date(startTime).toISOString(),
endTime: new Date(endTime).toISOString(),
```

After:

```ts
startTime: toBackendInstant(startTime),
endTime: toBackendInstant(endTime),
```

### 6.6 `admin/analytics/+page.svelte`

- [ ] **Step 16: Add the import**

Add to the imports block at the top of `<script>`:

```ts
import { toBackendInstant } from '@/lib/utils/datetime';
```

- [ ] **Step 17: Replace all `.toISOString()` call sites**

Run: `rg -n "\.toISOString\(\)" src/routes/admin/analytics/+page.svelte`

For each match, replace `<expr>.toISOString()` with `toBackendInstant(<expr>)`.

Example — line 90-91 is currently:

```ts
from: start.toISOString(),
to: finish.toISOString(),
```

Becomes:

```ts
from: toBackendInstant(start),
to: toBackendInstant(finish),
```

Apply the same substitution to lines 104 and 113 (four more `.toISOString()` calls).

### 6.7 `admin/dashboard/+page.svelte`

- [ ] **Step 18: Add the import**

Add to the imports block at the top of `<script>`:

```ts
import { toBackendInstant } from '@/lib/utils/datetime';
```

- [ ] **Step 19: Replace `.toISOString()` call sites**

Run: `rg -n "\.toISOString\(\)" src/routes/admin/dashboard/+page.svelte`

For each match (lines 79 and 98), apply the same `expr.toISOString() → toBackendInstant(expr)` substitution.

### Verification

- [ ] **Step 20: Verify no stale imports remain**

Run: `rg "isoToLocalDate|isoToLocalInput" src`

Expected: zero matches.

Run: `rg "\.toISOString\(\)" src --glob '!src/lib/utils/datetime*'`

Expected: zero matches.

- [ ] **Step 21: Commit**

```bash
git add src/routes
git commit -m "refactor(admin): route all form date fields through datetime helpers"
```

---

## Task 7: Add i18n keys for schedule presets

**Files:**

- Modify: `src/lib/i18n/locales/ru.json`
- Modify: `src/lib/i18n/locales/en.json`
- Modify: `src/lib/i18n/locales/ky.json`
- Modify: `src/lib/i18n/locales/kz.json`
- Modify: `src/lib/i18n/locales/uz.json`

**Goal:** Add `movie.schedule.{yesterday,today,tomorrow,customRange}` in all five locales.

- [ ] **Step 1: Patch `ru.json`**

Find the `"movie": { ... }` block (starts at line 47). Immediately before `"status": {` (line 61), insert:

```json
			"schedule": {
				"yesterday": "Вчера",
				"today": "Сегодня",
				"tomorrow": "Завтра",
				"customRange": "Выберите диапазон"
			},
```

- [ ] **Step 2: Patch `en.json`**

Same block, same position. Insert:

```json
			"schedule": {
				"yesterday": "Yesterday",
				"today": "Today",
				"tomorrow": "Tomorrow",
				"customRange": "Pick a date range"
			},
```

- [ ] **Step 3: Patch `ky.json`**

Same block. Insert:

```json
			"schedule": {
				"yesterday": "Кечээ",
				"today": "Бүгүн",
				"tomorrow": "Эртең",
				"customRange": "Күн диапазонун тандоо"
			},
```

- [ ] **Step 4: Patch `kz.json`**

Same block. Insert:

```json
			"schedule": {
				"yesterday": "Кеше",
				"today": "Бүгін",
				"tomorrow": "Ертең",
				"customRange": "Күндер ауқымын таңдаңыз"
			},
```

- [ ] **Step 5: Patch `uz.json`**

Same block. Insert:

```json
			"schedule": {
				"yesterday": "Kecha",
				"today": "Bugun",
				"tomorrow": "Ertaga",
				"customRange": "Sana oralig'ini tanlang"
			},
```

- [ ] **Step 6: Verify JSON validity**

Run: `node -e "for (const l of ['ru','en','ky','kz','uz']) JSON.parse(require('fs').readFileSync('src/lib/i18n/locales/'+l+'.json','utf8'))"`

Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/i18n/locales
git commit -m "feat(i18n): add schedule preset labels in all locales"
```

---

## Task 8: Create `ScheduleFilterBar.svelte`

**Files:**

- Create: `src/routes/(client)/movies/[id]/components/ScheduleFilterBar.svelte`

**Goal:** Self-contained filter bar: three preset buttons + `DateRangeFilter`, shares one `dateFrom`/`dateTo` state with the parent via bindable props, emits `onchange`.

- [ ] **Step 1: Create the component**

Create `src/routes/(client)/movies/[id]/components/ScheduleFilterBar.svelte`:

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import DateRangeFilter from '@/components/ui/DateRangeFilter.svelte';
	import {
		presetRange,
		matchPreset,
		type DatePreset
	} from '@/lib/utils/datetime';

	interface Props {
		dateFrom: string;
		dateTo: string;
		onchange?: (from: string, to: string) => void;
	}

	let {
		dateFrom = $bindable(''),
		dateTo = $bindable(''),
		onchange
	}: Props = $props();

	const activePreset = $derived(matchPreset(dateFrom, dateTo));

	const selectPreset = (kind: DatePreset) => {
		const r = presetRange(kind);
		dateFrom = r.dateFrom;
		dateTo = r.dateTo;
		onchange?.(r.dateFrom, r.dateTo);
	};

	const handleRangeChange = (from: string, to: string) => {
		if (!from || !to) {
			const r = presetRange('today');
			dateFrom = r.dateFrom;
			dateTo = r.dateTo;
			onchange?.(r.dateFrom, r.dateTo);
			return;
		}
		dateFrom = from;
		dateTo = to;
		onchange?.(from, to);
	};
</script>

<div class="ScheduleFilterBar">
	<div class="presets">
		<button
			type="button"
			class="preset"
			class:active={activePreset === 'yesterday'}
			onclick={() => selectPreset('yesterday')}
		>
			{$_('movie.schedule.yesterday')}
		</button>
		<button
			type="button"
			class="preset"
			class:active={activePreset === 'today'}
			onclick={() => selectPreset('today')}
		>
			{$_('movie.schedule.today')}
		</button>
		<button
			type="button"
			class="preset"
			class:active={activePreset === 'tomorrow'}
			onclick={() => selectPreset('tomorrow')}
		>
			{$_('movie.schedule.tomorrow')}
		</button>
	</div>

	<DateRangeFilter
		from={dateFrom}
		to={dateTo}
		labelFrom=""
		labelTo=""
		placeholder={$_('movie.schedule.customRange')}
		onchange={handleRangeChange}
	/>
</div>

<style lang="scss">
	.ScheduleFilterBar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-5);

		.presets {
			display: flex;
			gap: var(--space-2);
			flex-wrap: wrap;

			.preset {
				height: 38px;
				padding: 0 var(--space-4);
				background: rgba(255, 255, 255, 0.08);
				border: 1px solid rgba(139, 92, 246, 0.15);
				border-radius: 8px;
				color: rgba(255, 255, 255, 0.8);
				font-size: var(--text-sm);
				font-weight: var(--weight-medium);
				cursor: pointer;
				backdrop-filter: blur(10px);
				transition:
					background 0.15s,
					border-color 0.15s,
					color 0.15s,
					box-shadow 0.15s;

				&:hover {
					border-color: var(--primary);
					color: white;
				}

				&.active {
					background: linear-gradient(45deg, #8b5cf6, #a855f7);
					border-color: transparent;
					color: white;
					box-shadow: 0 4px 14px rgba(139, 92, 246, 0.3);
				}
			}
		}
	}

	@media (max-width: 640px) {
		.ScheduleFilterBar {
			flex-direction: column;
			align-items: stretch;

			.presets {
				overflow-x: auto;
				flex-wrap: nowrap;
				scrollbar-width: none;

				&::-webkit-scrollbar {
					display: none;
				}

				.preset {
					flex: 0 0 auto;
				}
			}
		}
	}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/(client)/movies/[id]/components/ScheduleFilterBar.svelte
git commit -m "feat(movies): add ScheduleFilterBar with presets and date range"
```

---

## Task 9: Wire filter into `/movies/[id]/+page.svelte`

**Files:**

- Modify: `src/routes/(client)/movies/[id]/+page.svelte`

**Goal:** Manage `dateFrom`/`dateTo` state, default to «Сегодня», pass through to `createGetPublicRepertoireV1`, render `ScheduleFilterBar` above the dates list. Show `Skeleton` while `isFetching`.

- [ ] **Step 1: Update imports**

At the top of `<script>` (around lines 1-18), add two imports:

```ts
import { presetRange } from '@/lib/utils/datetime';
import ScheduleFilterBar from './components/ScheduleFilterBar.svelte';
```

- [ ] **Step 2: Replace the repertoire query with filterable state**

Currently (line 27-29):

```ts
const repertoireQuery = crmQueryApi.createGetPublicRepertoireV1(() => ({
	movieId
}));
```

Replace with:

```ts
const initialPreset = presetRange('today');
let dateFrom = $state(initialPreset.dateFrom);
let dateTo = $state(initialPreset.dateTo);

const repertoireQuery = crmQueryApi.createGetPublicRepertoireV1(() => ({
	movieId,
	dateFrom,
	dateTo
}));
```

- [ ] **Step 3: Render filter bar and handle loading state in the Screenings section**

Locate the `<!-- Screenings Section -->` block (around lines 141-171):

```svelte
<section class="section">
	<div class="container">
		<SectionHeader title={$_('movie.sessions')} />
		{#if screenings.length > 0}
			...
		{:else}
			<EmptyState icon="lucide:calendar" title={$_('movie.noSessions')} />
		{/if}
	</div>
</section>
```

Replace its body with:

```svelte
<section class="section">
	<div class="container">
		<SectionHeader title={$_('movie.sessions')} />
		<ScheduleFilterBar bind:dateFrom bind:dateTo />
		{#if repertoireQuery.isFetching}
			<Skeleton height="120px" />
		{:else if screenings.length > 0}
			{#each screenings as repertoire}
				{#each repertoire.dates ?? [] as dateGroup}
					<h3 class="date_title">{dateGroup.date}</h3>
					{#each dateGroup.branches ?? [] as branch}
						<div class="branch_group">
							<span class="branch_name"
								>{getLocalizedValue(branch.name, $locale)}</span
							>
							{#each branch.halls ?? [] as hall}
								<div class="hall_group">
									<span class="hall_name">{hall.name} ({hall.type})</span>
									<div class="screenings">
										{#each hall.screenings ?? [] as screening}
											<ScreeningCard {screening} />
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/each}
				{/each}
			{/each}
		{:else}
			<EmptyState icon="lucide:calendar" title={$_('movie.noSessions')} />
		{/if}
	</div>
</section>
```

(`Skeleton` is already imported at the top of the file.)

- [ ] **Step 4: Smoke-run**

Run: `bun run dev` in a terminal.

In a browser, open `http://localhost:5173/movies/<any-movie-id>`. Expect: the page shows the filter bar with «Сегодня» active; only today's screenings are listed. Click «Завтра» — tomorrow's list loads (or `EmptyState` if empty). Open `DateRangeFilter` → pick an arbitrary 3-day range → preset buttons deselect, custom range query fires. Click × in `DateRangeFilter` → snaps back to «Сегодня».

Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 5: Commit**

```bash
git add src/routes/(client)/movies/[id]/+page.svelte
git commit -m "feat(movies): add date filter to movie schedule section"
```

---

## Task 10: Document the UTC contract in `CLAUDE.md`

**Files:**

- Modify: `CLAUDE.md`

**Goal:** Make the contract greppable and discoverable for future contributors and agents.

- [ ] **Step 1: Insert the new section**

Open `CLAUDE.md`. Find the `## Common Pitfalls` section near the end. Immediately **before** it, insert:

```md
---

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

---
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document UTC date contract and datetime helpers"
```

---

## Task 11: Final verification

**Goal:** Prove the migration is complete, no contract violations remain, `bun run check` is green, and the filter works in two timezones.

- [ ] **Step 1: Run all unit tests**

Run: `bun run test`

Expected: PASS across the repo (no regressions in `numbering.test.ts` or `datetime.test.ts`).

- [ ] **Step 2: Type check**

Run: `bun run check`

Expected: zero TypeScript or Svelte diagnostics.

If errors appear (e.g., callers that imported `isoToLocalDate` were missed in Task 6), fix them: find the file, switch the import to `fromBackendCivilDate` / `fromBackendInstant`, re-run.

- [ ] **Step 3: Greppable completeness check — no stale imports**

Run: `rg "from '@/lib/utils/date'" src`

Expected: zero matches.

Run: `rg "isoToLocalDate|isoToLocalInput" src`

Expected: zero matches.

Run: `rg "\.toISOString\(\)" src --glob '!src/lib/utils/datetime*'`

Expected: zero matches (the only legitimate `.toISOString()` calls live inside `datetime.ts`).

Run: `ls src/lib/utils/date.ts 2>&1`

Expected: `ls: ... No such file or directory`.

- [ ] **Step 4: Backend smoke test (Civil date)**

This verifies the backend accepts the new `"YYYY-MM-DDT00:00:00.000Z"` format for Civil fields. Start the dev server (`bun run dev`) in one terminal, open the admin panel, and in the Movies admin page:

1. Create a new movie with `releaseDate` = today; save. Expect: success, no validation error toast.
2. Edit that movie; re-open the form. Expect: `releaseDate` input displays today.
3. Repeat for one promo code (`expiresAt`), one promotion (`startDate`/`endDate`), one announcement (`publishDate`/`expiryDate`).

If any save fails with a validation error on the date field, the backend DTO decorator is rejecting ISO; fix at `~/Desktop/ZeroWaiting_backend` per the "Fix on backend" rule in CLAUDE.md — change the decorator to `@IsISO8601()` (from class-validator), rebuild, and retry. The fix is out of scope for this plan but must be recorded in the final commit message if applied.

- [ ] **Step 5: Two-timezone manual QA of the filter**

Stop the dev server. Relaunch under Bishkek time:

```bash
TZ=Asia/Bishkek bun run dev
```

In the browser, open `/movies/<id>`:

1. «Сегодня» active by default, only today's screenings visible.
2. Click «Вчера» → yesterday's schedule (or empty state).
3. Click «Завтра» → tomorrow's schedule.
4. Open `DateRangeFilter`, pick tomorrow for both start and end. Expect: «Завтра» button highlights.
5. Click × on `DateRangeFilter`. Expect: snaps to «Сегодня».

Stop the server. Relaunch under Los Angeles time:

```bash
TZ=America/Los_Angeles bun run dev
```

Repeat the same five checks. Additionally, open an admin form for a movie that has `releaseDate` set; the date shown in the input must equal the day shown in the public movie catalog — same day in both zones, no off-by-one shift.

Stop the server.

- [ ] **Step 6: Final commit (if anything touched during QA)**

If Steps 2-5 surfaced fixes, commit them now. Otherwise skip.

```bash
git status
git add -A
git commit -m "fix: address review comments from final QA"
```

- [ ] **Step 7: Done**

Summary in the implementation session:

- New module `@/lib/utils/datetime.ts` + `datetime.test.ts` (25+ unit tests).
- Old `@/lib/utils/date.ts` removed; every call site migrated.
- Filter bar on `/movies/[id]` with default «Сегодня», preset buttons, custom range.
- UTC contract documented in `CLAUDE.md`.
- Verified green on `bun run test`, `bun run check`, and manual QA in two timezones.
