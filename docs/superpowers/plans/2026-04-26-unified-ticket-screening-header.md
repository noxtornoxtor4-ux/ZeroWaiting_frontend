# Unified Ticket Screening Header — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified screening info header (poster + movie + venue + time + format) to both the post-purchase confirmation page and the public master ticket page, sharing one component.

**Architecture:** One presentational Svelte 5 component `<TicketScreeningHeader>` with normalized props. Each page does a tiny inline mapping from its API shape (`BookingEntity` vs `PublicMasterTicketDto`) to the props. Backend is extended in two small ways: `branch` is included in booking `findOne`, and `format` is added to `PublicMasterTicketDto` (and its projection). Frontend regenerates the API client.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TanStack Svelte Query, Orval, NestJS + Prisma backend, vitest, svelte-i18n.

**Spec:** `docs/superpowers/specs/2026-04-26-unified-ticket-screening-header-design.md`

---

## File Structure

**Backend (`~/Desktop/ZeroWaiting_backend`):**
- Modify: `src/booking/booking.service.ts` — add `branch` to `findOne` Prisma include
- Modify: `src/booking/booking.service.spec.ts` — assert include shape; update fixtures
- Modify: `src/ticket/dto/public-master-ticket.dto.ts` — add `format` field
- Modify: `src/ticket/ticket.service.ts` — add `format` to `mapPublicScreeningProjection` (so `getPublicMaster` and `getPublicTicket` both gain it)
- Modify: `src/ticket/ticket.service.spec.ts` — assert `format` in returned payload

**Frontend (`~/Desktop/ZeroWaiting_frontend`):**
- Auto-regen: `src/api/model/**` (after `bun run generate:api`)
- Modify: `src/lib/utils/datetime.ts` — add `addMinutes` helper
- Create: `src/lib/utils/datetime.test.ts` — already exists, append `addMinutes` test block
- Modify: `src/lib/i18n/locales/{ru,en,ky,kz,uz}.json` — add `ticket.publicHeader.title`, `ticket.header.duration`, `ticket.header.timeRange`, `screening.format.*`
- Create: `src/components/booking/TicketScreeningHeader.svelte`
- Modify: `src/routes/(client)/booking/[bookingId]/confirmation/+page.svelte`
- Modify: `src/routes/t/m/[viewerCode]/+page.svelte`

---

## Ordering Rationale

1. Backend changes first → 2. Regen API → 3. Frontend helpers/tests → 4. i18n → 5. Component → 6. Wire confirmation → 7. Wire public page → 8. Smoke + regression.

This order ensures the typed API client is current before any frontend code consumes it.

---

## Task 1: Backend — include `branch` in booking `findOne`

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts:333-345`
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.spec.ts:215-228`

- [ ] **Step 1: Open `booking.service.spec.ts` and inspect existing `findOne` test (lines 215-228)**

Read the existing `describe('findOne')` block. The current test calls `service.findOne('booking-1')` and verifies the resolved value. We need to add a new test that asserts the Prisma `include` shape passed to `findUnique` actually requests `screening.hall.branch`.

- [ ] **Step 2: Add a failing test that asserts `include` shape**

Add this new `it` block inside `describe('findOne', ...)` in `booking.service.spec.ts` (right after the existing tests, before the closing `});`):

```ts
it('includes screening.hall.branch in the Prisma include', async () => {
  prisma.booking.findUnique.mockResolvedValue(mockBooking);

  await service.findOne('booking-1');

  expect(prisma.booking.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'booking-1' },
      include: expect.objectContaining({
        screening: {
          include: {
            movie: true,
            hall: { include: { branch: true } },
          },
        },
      }),
    }),
  );
});
```

- [ ] **Step 3: Run the test and confirm it fails**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/booking/booking.service.spec.ts -t 'includes screening.hall.branch'
```

Expected: FAIL — current `include` is `screening: { include: { movie: true, hall: true } }`, missing `branch`.

- [ ] **Step 4: Modify `booking.service.ts:333-345` `findOne` to include branch**

Apply this edit to `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts`:

```ts
async findOne(id: string) {
  const booking = await this.prisma.booking.findUnique({
    where: { id },
    include: {
      seats: { include: { seat: true, ticket: true } },
      screening: {
        include: {
          movie: true,
          hall: { include: { branch: true } }
        }
      },
      payment: true,
      user: true
    }
  });
  if (!booking) throw new NotFoundException(`Booking ${id} not found`);
  return this.withExpiryIfPending(booking);
}
```

- [ ] **Step 5: Run the new test — should pass**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/booking/booking.service.spec.ts -t 'includes screening.hall.branch'
```

Expected: PASS.

- [ ] **Step 6: Run the full `booking.service.spec.ts` to confirm no regressions**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/booking/booking.service.spec.ts
```

Expected: All tests pass. If any other test fails because its mock fixture didn't supply `hall.branch`, update only the failing fixture to include `branch: { id: 'branch-1', name: 'Branch 1' }` (or the minimum shape the assertion needs).

- [ ] **Step 7: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend && git add src/booking/booking.service.ts src/booking/booking.service.spec.ts && git commit -m "feat(booking): include branch in findOne for unified ticket header"
```

---

## Task 2: Backend — add `format` to `PublicMasterTicketDto` + projection

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/dto/public-master-ticket.dto.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts:40-56` (`mapPublicScreeningProjection`)
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`

- [ ] **Step 1: Open `ticket.service.spec.ts` and locate `getPublicMaster` test block**

```bash
grep -n 'getPublicMaster\|describe(' ~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts | head -20
```

Identify the existing `describe('getPublicMaster', ...)` block (or `it` inside one). We'll extend the existing happy-path test to assert `format` in the returned payload.

- [ ] **Step 2: Read the existing happy-path test fully so we know its mock booking shape**

Read the relevant lines (use the line numbers from Step 1). Note what the mock booking returns from `prisma.booking.findUnique` — specifically the `screening` shape. We will need to add `format: 'TWO_D'` (or whatever value the existing mock uses) to that screening fixture.

- [ ] **Step 3: Add a failing assertion that the public master payload contains `format`**

Inside the existing happy-path `it` for `getPublicMaster`, add the format value to the mock screening (if it's missing) and add an assertion:

```ts
// in the mock booking's screening object, add:
//   format: 'TWO_D' as const,

// then after the existing assertions, add:
expect(result).toMatchObject({ format: 'TWO_D' });
```

If the existing test does not already use `toMatchObject`, add a separate `expect(result.format).toBe('TWO_D')` line.

- [ ] **Step 4: Run the test and confirm it fails**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/ticket/ticket.service.spec.ts -t 'getPublicMaster'
```

Expected: FAIL — `result.format` is `undefined` because the projection doesn't return it yet.

- [ ] **Step 5: Add `format` to `PublicMasterTicketDto`**

Edit `~/Desktop/ZeroWaiting_backend/src/ticket/dto/public-master-ticket.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ScreeningFormat, type TicketStatus } from '@prisma/client';

class MovieDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  title!: Record<string, unknown>;
  @ApiProperty({ type: 'string', nullable: true }) posterUrl!: string | null;
  @ApiProperty() ageRating!: string;
  @ApiProperty() duration!: number;
}
class BranchDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  name!: Record<string, unknown>;
}
class HallDto {
  @ApiProperty() name!: string;
}
class PublicSeatDto {
  @ApiProperty() row!: number;
  @ApiProperty() seat!: number;
  @ApiProperty() qrCode!: string;
  @ApiProperty({ enum: ['VALID', 'USED', 'CANCELLED', 'EXPIRED'] })
  status!: TicketStatus;
  @ApiProperty({ type: 'string', nullable: true }) scannedAt!: string | null;
}
export class PublicMasterTicketDto {
  @ApiProperty({ type: MovieDto }) movie!: MovieDto;
  @ApiProperty({ type: BranchDto }) branch!: BranchDto;
  @ApiProperty({ type: HallDto }) hall!: HallDto;
  @ApiProperty() startTime!: string;
  @ApiProperty({ enum: ScreeningFormat }) format!: ScreeningFormat;
  @ApiProperty({ type: [PublicSeatDto] }) seats!: PublicSeatDto[];
}
```

Note: `TicketStatus` is now imported as `type` (was already `import type`); `ScreeningFormat` is imported as a runtime value because it's used in `@ApiProperty({ enum: ... })`.

- [ ] **Step 6: Add `format` to `mapPublicScreeningProjection` in `ticket.service.ts:40-56`**

Edit the projection to include `format` in input type and output:

```ts
private mapPublicScreeningProjection(s: {
  startTime: Date;
  format: import('@prisma/client').ScreeningFormat;
  movie: { title: unknown; posterUrl: string | null; ageRating: string; duration: number };
  hall: { name: string; branch: { name: unknown } };
}) {
  return {
    movie: {
      title: s.movie.title,
      posterUrl: s.movie.posterUrl ?? null,
      ageRating: s.movie.ageRating,
      duration: s.movie.duration,
    },
    branch: { name: s.hall.branch.name },
    hall: { name: s.hall.name },
    startTime: s.startTime.toISOString(),
    format: s.format,
  };
}
```

If `ScreeningFormat` is already imported at the top of the file as a regular import, replace the inline `import('@prisma/client').ScreeningFormat` with the imported name.

- [ ] **Step 7: Verify `getPublicMaster` includes `format` in its Prisma `select`/`include`**

Read `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts:221-242`. The current code uses `include: { screening: { include: { movie: true, hall: { include: { branch: true } } } } }`. Because Prisma `include: true` (or no `select`) returns all scalar fields by default, `screening.format` is already on the returned object — no change needed here. **Verify** by re-reading the function and confirming there's no narrow `select` that omits `format`. If a `select` is used, add `format: true` to it.

- [ ] **Step 8: Run the failing test — should now pass**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/ticket/ticket.service.spec.ts -t 'getPublicMaster'
```

Expected: PASS.

- [ ] **Step 9: Run full ticket service tests for regressions**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/ticket/ticket.service.spec.ts
```

Expected: All tests pass. If `getPublicTicket` test fixtures break because they don't supply `format` on the mock screening — add `format: 'TWO_D'` to those fixtures too.

- [ ] **Step 10: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend && git add src/ticket/dto/public-master-ticket.dto.ts src/ticket/ticket.service.ts src/ticket/ticket.service.spec.ts && git commit -m "feat(ticket): expose screening format on public master ticket"
```

---

## Task 3: Frontend — regenerate API client

**Files:**
- Auto-regen: `src/api/model/**`

- [ ] **Step 1: Start backend so Orval can fetch OpenAPI**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run start:dev
```

Wait until log shows `Application is running on: http://localhost:5000`. Run in a separate terminal or background.

- [ ] **Step 2: Regenerate API client**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run generate:api
```

Expected: orval writes new files under `src/api/model/`. No errors.

- [ ] **Step 3: Verify `format` appears on `PublicMasterTicket200` (or equivalent) and `branch` on `HallEntity`**

```bash
grep -rn '"format"\|format:\s*ScreeningFormat\|branch?: BranchEntity\|branch?:' ~/Desktop/ZeroWaiting_frontend/src/api/model | head -10
```

Expected: `branch?:` references in `hallEntity.ts` (or similar), and the public master response model has a `format` field of type `ScreeningFormat`.

- [ ] **Step 4: Run typecheck — confirms regen didn't break consumers**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

Expected: 0 errors. (If pre-existing errors are present unrelated to this work, note them but do not "fix" beyond this scope.)

- [ ] **Step 5: Commit regenerated API**

```bash
cd ~/Desktop/ZeroWaiting_frontend && git add src/api/model && git commit -m "chore(api): regen client for branch include and screening format"
```

---

## Task 4: Frontend — `addMinutes` helper (TDD)

**Files:**
- Modify: `src/lib/utils/datetime.ts`
- Modify: `src/lib/utils/datetime.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `~/Desktop/ZeroWaiting_frontend/src/lib/utils/datetime.test.ts` (after existing describe blocks, before final EOF):

```ts
describe('addMinutes', () => {
  it('adds positive minutes to an ISO string and returns ISO', () => {
    expect(addMinutes('2026-04-28T19:30:00.000Z', 119)).toBe(
      '2026-04-28T21:29:00.000Z'
    );
  });

  it('handles minute crossing day boundary', () => {
    expect(addMinutes('2026-04-28T23:30:00.000Z', 60)).toBe(
      '2026-04-29T00:30:00.000Z'
    );
  });

  it('returns same instant when 0 minutes', () => {
    expect(addMinutes('2026-04-28T19:30:00.000Z', 0)).toBe(
      '2026-04-28T19:30:00.000Z'
    );
  });
});
```

Also add `addMinutes` to the existing import at the top of the file:

```ts
import {
  formatCivilDate,
  formatCivilDateShort,
  fromBackendCivilDate,
  fromBackendInstant,
  matchPreset,
  presetRange,
  toBackendCivilDate,
  toBackendEndOfLocalDay,
  toBackendInstant,
  toBackendStartOfLocalDay,
  addMinutes
} from './datetime';
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run vitest run src/lib/utils/datetime.test.ts
```

Expected: FAIL — `addMinutes` is not exported.

- [ ] **Step 3: Add `addMinutes` to `datetime.ts`**

Append at the bottom of `~/Desktop/ZeroWaiting_frontend/src/lib/utils/datetime.ts`:

```ts
export const addMinutes = (iso: string, minutes: number): string =>
	new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run vitest run src/lib/utils/datetime.test.ts
```

Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/ZeroWaiting_frontend && git add src/lib/utils/datetime.ts src/lib/utils/datetime.test.ts && git commit -m "feat(datetime): add addMinutes helper for ticket end time"
```

---

## Task 5: Frontend — i18n keys

**Files:**
- Modify: `src/lib/i18n/locales/{ru,en,ky,kz,uz}.json` (5 files)

- [ ] **Step 1: Add new keys to `ru.json`**

In `~/Desktop/ZeroWaiting_frontend/src/lib/i18n/locales/ru.json`:

Inside the existing `"screening"` block (lines ~73-88), add a `"format"` sub-object before the closing `}`:

```json
"format": {
  "TWO_D": "2D",
  "THREE_D": "3D",
  "IMAX": "IMAX",
  "DOLBY_ATMOS": "Dolby Atmos",
  "FOUR_DX": "4DX"
}
```

(Add a comma after the previous last key.)

Inside the existing `"ticket"` block (lines ~233-253), add:
- A new `"publicHeader"` sub-object:

```json
"publicHeader": {
  "title": "Билеты"
}
```

- A new `"header"` sub-object (sibling of `"tabs"`):

```json
"header": {
  "duration": "{n} мин",
  "timeRange": "{start} – {end}"
}
```

(Add commas where needed.)

- [ ] **Step 2: Add the same keys to `en.json` with English values**

```json
// inside "screening":
"format": {
  "TWO_D": "2D",
  "THREE_D": "3D",
  "IMAX": "IMAX",
  "DOLBY_ATMOS": "Dolby Atmos",
  "FOUR_DX": "4DX"
}

// inside "ticket":
"publicHeader": { "title": "Tickets" },
"header": {
  "duration": "{n} min",
  "timeRange": "{start} – {end}"
}
```

- [ ] **Step 3: Add the same keys to `ky.json`, `kz.json`, `uz.json` with localized values**

For Kyrgyz/Kazakh/Uzbek, format values stay as `"2D"`, `"3D"`, `"IMAX"`, `"Dolby Atmos"`, `"4DX"` (proper nouns / unit notation, not translated).

- `ky.json`: `publicHeader.title: "Билеттер"`, `header.duration: "{n} мүн"`, `timeRange: "{start} – {end}"`
- `kz.json`: `publicHeader.title: "Билеттер"`, `header.duration: "{n} мин"`, `timeRange: "{start} – {end}"`
- `uz.json`: `publicHeader.title: "Chiptalar"`, `header.duration: "{n} daq"`, `timeRange: "{start} – {end}"`

- [ ] **Step 4: Validate JSON syntax for all five files**

```bash
cd ~/Desktop/ZeroWaiting_frontend && for f in src/lib/i18n/locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f OK" || echo "$f FAIL"; done
```

Expected: all five files print `OK`.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/ZeroWaiting_frontend && git add src/lib/i18n/locales && git commit -m "feat(i18n): add ticket header and screening format keys (5 locales)"
```

---

## Task 6: Frontend — create `<TicketScreeningHeader>` component

**Files:**
- Create: `src/components/booking/TicketScreeningHeader.svelte`

- [ ] **Step 1: Create the component file**

Create `~/Desktop/ZeroWaiting_frontend/src/components/booking/TicketScreeningHeader.svelte` with this exact content:

```svelte
<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import Icon from '@iconify/svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import { formatDateTime, formatTime, addMinutes } from '@/lib/utils/datetime';
	import type { ScreeningFormat } from '@/api/model';

	interface Props {
		posterUrl: string | null;
		movieTitle: string;
		ageRating: string;
		duration: number;
		branchName: string;
		hallName: string;
		startTime: string;
		format: ScreeningFormat;
	}

	const {
		posterUrl,
		movieTitle,
		ageRating,
		duration,
		branchName,
		hallName,
		startTime,
		format
	}: Props = $props();

	const localeTag = $derived($locale === 'en' ? 'en-US' : 'ru-RU');
	const startLabel = $derived(formatDateTime(startTime, localeTag));
	const endLabel = $derived(formatTime(addMinutes(startTime, duration), localeTag));
	const timeRange = $derived($_('ticket.header.timeRange', { values: { start: startLabel, end: endLabel } }));
	const durationLabel = $derived($_('ticket.header.duration', { values: { n: duration } }));
	const formatLabel = $derived($_(`screening.format.${format}`));
</script>

<section class="ticket_screening_header glass-card">
	<div class="poster">
		{#if posterUrl}
			<img src={posterUrl} alt={movieTitle} loading="lazy" />
		{:else}
			<div class="poster_placeholder">
				<Icon icon="lucide:film" width={32} />
			</div>
		{/if}
	</div>

	<div class="info">
		<div class="title_row">
			<h2 class="title">{movieTitle}</h2>
			<Badge text={ageRating} color="var(--muted-fg)" />
		</div>

		<p class="meta_short">{durationLabel} · {formatLabel}</p>

		<p class="venue">
			<Icon icon="lucide:building-2" width={16} />
			<span>{branchName} · {hallName}</span>
		</p>
		<p class="time">
			<Icon icon="lucide:calendar" width={16} />
			<span>{timeRange}</span>
		</p>
	</div>
</section>

<style lang="scss">
	.ticket_screening_header {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-4);
		padding: var(--space-5);
		max-width: 640px;
		margin: 0 auto;

		.poster {
			width: 96px;
			height: 144px;
			border-radius: var(--radius-md);
			overflow: hidden;
			background: var(--surface);

			img {
				width: 100%;
				height: 100%;
				object-fit: cover;
				display: block;
			}

			.poster_placeholder {
				width: 100%;
				height: 100%;
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--muted-fg);
			}
		}

		.info {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			min-width: 0;

			.title_row {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				flex-wrap: wrap;

				.title {
					margin: 0;
					font-size: var(--text-xl);
					font-weight: var(--weight-bold);
					line-height: 1.2;
				}
			}

			.meta_short {
				margin: 0;
				color: var(--muted-fg);
				font-size: var(--text-sm);
			}

			.venue,
			.time {
				margin: 0;
				display: flex;
				align-items: center;
				gap: var(--space-2);
				color: var(--foreground);
				font-size: var(--text-sm);
			}
		}

		@media (max-width: 640px) {
			padding: var(--space-4);

			.poster {
				width: 72px;
				height: 108px;
			}

			.info .title_row .title {
				font-size: var(--text-lg);
			}
		}
	}
</style>
```

- [ ] **Step 2: Run typecheck**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

Expected: 0 errors. If `Badge` color prop API differs from `color="var(--muted-fg)"`, adjust to match the actual `Badge` interface (re-read `src/components/ui/Badge.svelte` and use what it expects).

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/ZeroWaiting_frontend && git add src/components/booking/TicketScreeningHeader.svelte && git commit -m "feat(booking): TicketScreeningHeader component"
```

---

## Task 7: Frontend — wire `<TicketScreeningHeader>` into confirmation page

**Files:**
- Modify: `src/routes/(client)/booking/[bookingId]/confirmation/+page.svelte`

- [ ] **Step 1: Replace the entire `+page.svelte` with the new structure**

Open `~/Desktop/ZeroWaiting_frontend/src/routes/(client)/booking/[bookingId]/confirmation/+page.svelte` and replace its full content with:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { _, locale } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { formatPriceCompact } from '@/lib/utils/price';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import Button from '@/components/ui/Button.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Icon from '@iconify/svelte';
	import TicketViewer from '@/components/booking/TicketViewer.svelte';
	import TicketScreeningHeader from '@/components/booking/TicketScreeningHeader.svelte';
	import { seatSelection } from '@/lib/stores/seat-selection.svelte';
	import { BOOKING_STATUS_CONFIG } from '@/lib/constants/booking-status';
	import { onDestroy } from 'svelte';

	const bookingId = $derived(page.params.bookingId);
	const bookingQuery = crmQueryApi.createGetBookingsByIdV1(() => bookingId!);

	const booking = $derived(bookingQuery.data);
	const screening = $derived(booking?.screening);
	const movie = $derived(screening?.movie);
	const hall = $derived(screening?.hall);
	const branch = $derived(hall?.branch);

	const movieTitle = $derived(movie ? getLocalizedValue(movie.title, $locale) : '');
	const branchName = $derived(branch ? getLocalizedValue(branch.name, $locale) : '');

	const showHeader = $derived(!!(screening && movie && branch));
	const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');

	onDestroy(() => {
		seatSelection.clear();
	});
</script>

<svelte:head>
	<title>{$_('booking.confirmation')} — ZeroWaiting</title>
</svelte:head>

{#if bookingQuery.isLoading}
	<div class="ConfirmationPage">
		<div class="container">
			<Skeleton height="60px" width="50%" />
			<Skeleton height="180px" />
			<Skeleton height="300px" />
		</div>
	</div>
{:else if booking}
	<div class="ConfirmationPage">
		<div class="container">
			<div class="header">
				<div class="icon">
					<Icon icon="lucide:check-circle" width={64} />
				</div>
				<h1 class="title">{$_('booking.confirmation')}</h1>
				<p class="subtitle">{$_('booking.scanQr')}</p>
			</div>

			{#if showHeader && movie && hall && branch}
				<TicketScreeningHeader
					posterUrl={movie.posterUrl ?? null}
					movieTitle={movieTitle}
					ageRating={movie.ageRating}
					duration={movie.duration}
					branchName={branchName}
					hallName={hall.name}
					startTime={screening!.startTime}
					format={screening!.format}
				/>
			{/if}

			<p class="booking_meta">
				<span>
					{$_('screening.total')}
					<strong>{formatPriceCompact(booking.totalPrice)}</strong>
				</span>
				<span class="dot">·</span>
				<Badge
					text={$_(BOOKING_STATUS_CONFIG[booking.status]?.labelKey ?? booking.status)}
					color={BOOKING_STATUS_CONFIG[booking.status]?.color ?? 'var(--muted-fg)'}
				/>
				<span class="dot">·</span>
				<span class="booking_id">#{booking.id.slice(0, 8)}</span>
			</p>

			{#if booking.viewerCode && booking.seats}
				<div class="tickets">
					<TicketViewer
						viewerUrl={`${origin}/t/m/${booking.viewerCode}`}
						{origin}
						seats={booking.seats
							.filter((bs) => bs.seat)
							.map((bs) => ({
								row: bs.seat!.rowNumber,
								seat: bs.seat!.seatNumber,
								qrCode: bs.ticket?.qrCode ?? '',
								status: bs.ticket?.status ?? 'VALID'
							}))
							.filter((s) => s.qrCode)}
					/>
				</div>
			{/if}

			<div class="actions">
				<Button href="/profile/bookings" variant="outline" icon="lucide:ticket">
					{$_('nav.myBookings')}
				</Button>
				<Button href="/" variant="primary" icon="lucide:home">
					{$_('nav.home')}
				</Button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.ConfirmationPage {
		padding: var(--space-8) 0 var(--space-16);

		.header {
			text-align: center;
			margin-bottom: var(--space-6);

			.icon {
				color: var(--success);
				margin-bottom: var(--space-3);
			}

			.title {
				font-size: var(--text-3xl);
				font-weight: var(--weight-bold);
			}

			.subtitle {
				font-size: var(--text-base);
				color: var(--muted-fg);
				margin-top: var(--space-2);
			}
		}

		.booking_meta {
			max-width: 640px;
			margin: var(--space-3) auto var(--space-6);
			display: flex;
			align-items: center;
			justify-content: center;
			gap: var(--space-2);
			flex-wrap: wrap;
			color: var(--muted-fg);
			font-size: var(--text-sm);

			strong {
				color: var(--foreground);
				font-weight: var(--weight-semibold);
			}

			.dot {
				color: var(--border-color);
			}

			.booking_id {
				font-family: monospace;
			}
		}

		.tickets {
			max-width: 640px;
			margin: 0 auto var(--space-8);
		}

		.actions {
			display: flex;
			justify-content: center;
			gap: var(--space-4);
		}
	}
</style>
```

- [ ] **Step 2: Run typecheck**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

Expected: 0 errors. If `screening.format` is reported as possibly undefined despite `showHeader` guard, the issue is Svelte-narrowing across `$derived`. In that case, reorganize the prop pass-through to use locally-narrowed `const` variables inside the `{#if}` block (use a `{@const}` for the screening reference inside the `{#if}`) so TS sees them as defined. (`{@const screening = booking.screening!}` after the `if` predicate.)

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/ZeroWaiting_frontend && git add src/routes/\(client\)/booking/\[bookingId\]/confirmation/+page.svelte && git commit -m "feat(booking): unified ticket header on confirmation page"
```

---

## Task 8: Frontend — wire `<TicketScreeningHeader>` into public master page

**Files:**
- Modify: `src/routes/t/m/[viewerCode]/+page.svelte`

- [ ] **Step 1: Replace the entire `+page.svelte` with the new structure**

Open `~/Desktop/ZeroWaiting_frontend/src/routes/t/m/[viewerCode]/+page.svelte` and replace its full content with:

```svelte
<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import Icon from '@iconify/svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import TicketViewer from '@/components/booking/TicketViewer.svelte';
	import TicketScreeningHeader from '@/components/booking/TicketScreeningHeader.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const movieTitle = $derived(getLocalizedValue(data.master.movie.title, $locale));
	const branchName = $derived(getLocalizedValue(data.master.branch.name, $locale));
	const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
	const viewerUrl = $derived(`${origin}/t/m/${data.viewerCode}`);
</script>

<svelte:head><title>{movieTitle} — ZeroWaiting</title></svelte:head>

<div class="public_master_page">
	<div class="container">
		<div class="header">
			<div class="icon">
				<Icon icon="lucide:ticket" width={64} />
			</div>
			<h1 class="title">{$_('ticket.publicHeader.title')}</h1>
			<p class="subtitle">{$_('booking.scanQr')}</p>
		</div>

		<TicketScreeningHeader
			posterUrl={data.master.movie.posterUrl}
			movieTitle={movieTitle}
			ageRating={data.master.movie.ageRating}
			duration={data.master.movie.duration}
			branchName={branchName}
			hallName={data.master.hall.name}
			startTime={data.master.startTime}
			format={data.master.format}
		/>

		<div class="tickets">
			<TicketViewer {viewerUrl} {origin} seats={data.master.seats} />
		</div>
	</div>
</div>

<style lang="scss">
	.public_master_page {
		padding: var(--space-8) 0 var(--space-16);

		.header {
			text-align: center;
			margin-bottom: var(--space-6);

			.icon {
				color: var(--primary);
				margin-bottom: var(--space-3);
			}

			.title {
				font-size: var(--text-3xl);
				font-weight: var(--weight-bold);
				margin: 0;
			}

			.subtitle {
				font-size: var(--text-base);
				color: var(--muted-fg);
				margin-top: var(--space-2);
			}
		}

		.tickets {
			max-width: 640px;
			margin: var(--space-6) auto 0;
		}
	}
</style>
```

- [ ] **Step 2: Run typecheck**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

Expected: 0 errors. Note: `data.master` is typed by SvelteKit's `PageData`, which is loosely-typed because `+page.server.ts` returns the parsed JSON of the public API as `unknown`-ish. If TS complains about `data.master.format` being unknown, check `+page.server.ts` and add a type annotation that matches the regenerated public master response type (e.g. `import type { PublicMasterTicketDto } from '@/api/model'` and cast / annotate the return).

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/ZeroWaiting_frontend && git add src/routes/t/m/\[viewerCode\]/+page.svelte && git commit -m "feat(ticket): unified ticket header on public master page"
```

---

## Task 9: Build + manual smoke + regression sweep

**Files:** none modified — verification only.

- [ ] **Step 1: Run build**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run build
```

Expected: build succeeds with no errors. SSR for `/t/m/...` should compile.

- [ ] **Step 2: Start backend (if not already running) and frontend dev server**

Backend: ensure `bun run start:dev` is running on `:5000` (from Task 3).

```bash
cd ~/Desktop/ZeroWaiting_frontend && VITE_API_BASE_URL=http://localhost:5000 bun run dev
```

- [ ] **Step 3: Smoke test confirmation page**

Open `http://localhost:5173/booking/<id>/confirmation` for an existing CONFIRMED booking. Verify:
1. Success block (✅ + title + subtitle) rendered.
2. `<TicketScreeningHeader>` rendered with poster, movie title, age rating Badge, duration · format, branch · hall, date range.
3. End time = startTime + movie.duration (eyeball — match against `/admin/screenings` or DB).
4. Compact meta line below (`Итого X сом · <Badge> · #ID`). Old three-row card is gone.
5. `<TicketViewer>` (master/individual tabs) unchanged.
6. Action buttons unchanged.
7. While loading (throttle network to "Slow 3G" in DevTools): three skeletons appear, layout doesn't jump.

- [ ] **Step 4: Smoke test public master page**

Open `http://localhost:5173/t/m/<viewerCode>` in an **Incognito** window (no auth). Verify:
1. 🎫 icon (`lucide:ticket`, primary color), `Билеты` title, `Покажите QR-код на входе` subtitle.
2. Same `<TicketScreeningHeader>` (poster, title, age rating, duration · format, branch · hall, time range).
3. `<TicketViewer>` unchanged.
4. **SSR** check: View Source — movie title and branch name appear in the HTML.

- [ ] **Step 5: Mobile width check**

DevTools → 375px width. On both pages:
- Poster shrinks to 72×108.
- Title font reduces to `--text-lg`.
- Branch · hall and time range don't overflow / don't break ugly.

- [ ] **Step 6: Locale check**

On `/t/m/<viewerCode>` switch locale (`ru → en → ky`):
- Movie title swaps via `getLocalizedValue`.
- Branch name swaps.
- `Билеты` ↔ `Tickets` ↔ `Билеттер`.
- Format label `2D` stays as-is across all locales.
- Date range formats with appropriate locale tag (`ru-RU` for non-en, `en-US` for en).

- [ ] **Step 7: Edge case — `posterUrl: null`**

Find a movie without a poster (or temporarily edit one in DB):
```sql
UPDATE "Movie" SET "posterUrl" = NULL WHERE id = '<id>';
```
Reload confirmation/public page for a booking on that movie. Verify `lucide:film` placeholder renders inside the 96×144 (or 72×108 mobile) box with `--surface` background.

Restore the poster URL after the check.

- [ ] **Step 8: Regression sweep — `screening.hall` consumers**

```bash
cd ~/Desktop/ZeroWaiting_frontend && grep -rn "booking\.screening\.hall\|booking\?.screening\?.hall\|screening?.hall" src --include="*.svelte" --include="*.ts" | grep -v "branch" | head -30
```

For each result, briefly check that it doesn't choke on the now-richer hall shape (with branch). All consumers should treat `branch` as optional and just keep working.

Open `/profile/bookings` in the browser and visually verify it still loads and renders bookings normally.

- [ ] **Step 9: Final typecheck and build**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check && bun run build
```

Expected: both pass with 0 errors.

- [ ] **Step 10: Final commit only if any fixups were needed during smoke**

If smoke uncovered a small fix (e.g. Badge color prop API mismatch, narrowing tweak), commit it now:

```bash
cd ~/Desktop/ZeroWaiting_frontend && git add -p && git commit -m "fix(booking): <specific fix from smoke>"
```

If nothing needed fixing — no commit, the work is done.

---

## Self-Review

**Spec coverage check:**
- ✅ `<TicketScreeningHeader>` component contract (props, layout, responsive, placeholder, tokens) → Task 6.
- ✅ Confirmation page composition (success block + header + compact meta + viewer + actions, removal of old card) → Task 7.
- ✅ Public page composition (icon + title + subtitle + header + viewer, removal of old hand-rolled meta) → Task 8.
- ✅ Backend `findOne` `branch` include → Task 1.
- ✅ Backend `format` on `PublicMasterTicketDto` + projection → Task 2.
- ✅ OpenAPI regen → Task 3.
- ✅ `addMinutes` helper with TDD → Task 4.
- ✅ i18n keys (`ticket.publicHeader.title`, `ticket.header.duration`, `ticket.header.timeRange`, `screening.format.*`) across all 5 locales → Task 5.
- ✅ Edge cases (posterUrl null, missing screening, locales, SSR, tokens) → built into Tasks 6–9.
- ✅ Manual smoke + regression sweep → Task 9.

**Placeholder scan:** No `TODO`, no `TBD`, no "implement later". Each step has explicit code or commands. Backend Step 7 of Task 2 contains a small "verify" check rather than a code change — acceptable because there's a concrete decision (no change needed if no narrow `select`; add `format: true` if there is).

**Type consistency check:**
- Component prop names: `posterUrl`, `movieTitle`, `ageRating`, `duration`, `branchName`, `hallName`, `startTime`, `format`. Same names used in confirmation (Task 7) and public (Task 8) call sites. ✅
- `addMinutes(iso, minutes)` signature consistent across Task 4 (definition), Task 6 (consumer in component). ✅
- `ScreeningFormat` enum: backend value names = `TWO_D | THREE_D | IMAX | DOLBY_ATMOS | FOUR_DX`. i18n keys (Task 5) match exactly. ✅

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-unified-ticket-screening-header.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
