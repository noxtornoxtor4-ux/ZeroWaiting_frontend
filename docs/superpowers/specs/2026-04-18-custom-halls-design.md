# Custom Hall Layouts — Design Spec

**Date:** 2026-04-18
**Scope:** Backend (NestJS + Prisma at `~/Desktop/ZeroWaiting_backend`) + Frontend admin & client
**Status:** Draft — awaiting review

## 1. Motivation

Today, creating a cinema hall with a custom seating layout is effectively impossible through ZeroWaiting's admin tooling. `/admin/halls` is a read-only table — no create/edit modal, no layout editor. The seat-bulk endpoint only generates uniform rectangular grids, and the client's `SeatMap.svelte` renders plain row-by-row grids that ignore aisles and positional metadata entirely.

This spec defines the end-to-end solution for designing, storing, editing, and rendering custom hall layouts — including aisles, mixed seat types, love-seats, and irregular geometry — driven by a grid-based admin constructor.

## 2. Current state & limitations

### Backend

- `Hall` model: `{ id, externalId, branchId, name, type, capacity }` — no layout fields; `capacity` is a free-form integer, not derived from seats.
- `Seat` model has `positionX`, `positionY`, `rowLabel`, `section` — but none are used by the client renderer.
- `POST /halls/:hallId/seats/bulk` accepts `fromRow / toRow / seatsPerRow` with a single type — cannot produce aisles, mixed types within a row, or love-seats.
- `SeatHold`, `BookingSeat`, `Ticket` all reference `Seat.id` as FK — seats must remain first-class table rows.

### Frontend

- `/admin/halls/+page.svelte` — list-only. No create/edit modal, no layout editor.
- `SeatMap.svelte` (client) builds a `Map<rowNumber, Seat[]>`, sorts by `seatNumber`, renders rows as flex containers. Cannot render aisles or irregular geometry. Ignores `positionX`, `positionY`.
- Generated API types `SeatEntity` / `AvailableSeatEntity` expose positional fields but the renderer doesn't consume them.

**Verdict:** custom hall creation exists in theory via direct API use, but in practice is impossible — the admin has no UI and the client can't render anything non-rectangular.

## 3. Scope / Non-goals

### In scope (v1)

- Full grid-based layout: aisles, mixed seat types per row, different row widths, multi-cell love-seats.
- Six seat types: `STANDARD`, `VIP`, `LOVE_SEAT`, `RECLINER`, `WHEELCHAIR`, `DIRECTOR`.
- Admin grid-painter: palette, click & click-drag painting, undo/redo, resize, auto-numbering, summary stats.
- Single atomic endpoint `PUT /halls/:id/layout` for create/edit of full layout.
- Mutation validation: block destructive edits (removing a seat with an active booking) with 409.
- Client seat map rewrite: CSS grid based on `(gridRow, gridCol)`.
- Delete legacy per-seat CRUD endpoints and the bulk endpoint.
- `POST /halls/:id/duplicate` to copy layout between halls in the same branch.

### Non-goals (v1)

- Pixel-perfect drag-drop canvas (covered by grid constructor instead).
- Curved rows / amphitheater visuals beyond what a rectangular grid implies.
- Multi-select box operations in the painter (copy/paste blocks).
- Row/seat-label overrides — numbers are numeric and auto-computed.
- Versioning of layouts across time (edits mutate the single current layout).
- Per-seat price overrides (pricing remains by type via existing `ScreeningSeatPrice`).

## 4. Architecture overview

1. **Seats remain first-class DB rows.** Each bookable position has one `Seat` record. `SeatHold` / `BookingSeat` / `Ticket` continue to reference `seatId` as FK.
2. **Positioning is grid-based, not pixel-based.** Each seat stores `(gridRow, gridCol)` — integer coordinates within a canvas of size `Hall.layoutRows × Hall.layoutCols`. Aisles = absence of a `Seat` at that coordinate.
3. **Love-seats use `widthCells: 2`.** A single `Seat` row with `widthCells = 2` logically occupies two grid cells horizontally; only the left cell has a `Seat` row, the right is implicitly owned.
4. **Human labels (`rowNumber`, `seatNumber`) are auto-computed at save time.** Populated grid rows receive sequential `rowNumber` (1-based, empty rows skipped). Within a row, `seatNumber` is sequential over bookable units (love-seat counts as one).
5. **Hall metadata (`layoutRows`, `layoutCols`) lives on `Hall`.** `capacity` becomes a denormalized cache recomputed from `seats.count` on layout save.
6. **Atomic layout writes.** The entire hall layout is submitted in a single `PUT /halls/:id/layout` call; the server diffs against current state, validates, and applies create/update/delete in one transaction.
7. **Backwards compatibility is not preserved.** No grandfathered endpoints, no feature flags — the old per-seat CRUD is removed and the client `SeatMap` is rewritten from scratch.

## 5. Data model (Prisma)

### `Hall`

```prisma
model Hall {
  id           String   @id @default(uuid())
  externalId   String?  @unique
  branchId     String
  name         String
  type         HallType @default(STANDARD)

  layoutRows   Int
  layoutCols   Int

  // Denormalized — recomputed in service on every layout save.
  capacity     Int      @default(0)

  branch       Branch      @relation(fields: [branchId], references: [id])
  seats        Seat[]
  screenings   Screening[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### `Seat`

```prisma
model Seat {
  id          String   @id @default(uuid())
  hallId      String

  gridRow     Int
  gridCol     Int
  widthCells  Int      @default(1)

  rowNumber   Int
  seatNumber  Int

  type        SeatType
  section     String?   // optional, for analytics / pricing tiers
  isActive    Boolean   @default(true)

  hall          Hall          @relation(fields: [hallId], references: [id], onDelete: Cascade)
  bookingSeats  BookingSeat[]
  seatHolds     SeatHold[]
  tickets       Ticket[]

  @@unique([hallId, gridRow, gridCol])
  @@unique([hallId, rowNumber, seatNumber])
  @@index([hallId])
}

enum SeatType {
  STANDARD
  VIP
  LOVE_SEAT
  RECLINER
  WHEELCHAIR
  DIRECTOR
}
```

### Invariants

- `(hallId, gridRow, gridCol)` unique — one seat per grid cell.
- `(hallId, rowNumber, seatNumber)` unique — for display labels ("Ряд 3, Место 7").
- All seats satisfy `0 ≤ gridRow < layoutRows` and `0 ≤ gridCol + widthCells - 1 < layoutCols`.
- Love-seat overlap validation is enforced in the service layer (a `widthCells = 2` seat at `(r, c)` reserves `(r, c+1)`, which must have no `Seat` row). DB unique constraint alone cannot express this.

### Dropped fields

- `Seat.rowLabel` — removed. Labels are numeric only.
- `Seat.positionX`, `Seat.positionY` — removed, replaced by `gridRow` / `gridCol`.

## 6. API

### `POST /branches/:branchId/halls`

Create a hall with empty layout.

**Body:**

```json
{ "name": "Зал 1", "type": "IMAX", "layoutRows": 10, "layoutCols": 15 }
```

**Response:** `HallEntity` with `seats: []`.

### `PUT /halls/:id/layout`

The single atomic endpoint for all layout changes. Replaces `layoutRows`, `layoutCols`, and the entire seats list.

**Body:** (client sends only grid data; `rowNumber` / `seatNumber` are server-computed)

```json
{
	"layoutRows": 10,
	"layoutCols": 15,
	"seats": [
		{ "gridRow": 0, "gridCol": 0, "type": "STANDARD", "widthCells": 1 },
		{ "gridRow": 2, "gridCol": 4, "type": "LOVE_SEAT", "widthCells": 2 }
	]
}
```

**Server transaction:**

1. **Validate payload:**
   - All seats within `layoutRows × layoutCols` (account for `widthCells`).
   - No two seats overlap on the grid (a `widthCells = 2` seat at `(r, c)` reserves both `(r, c)` and `(r, c+1)`).
   - `(gridRow, gridCol)` unique within payload.
2. **Compute labels:** walk populated grid rows in ascending `gridRow` order, assigning `rowNumber` 1..N (skipping empty rows). Within each row, sort by `gridCol` and assign `seatNumber` 1..M (love-seats count as one).
3. **Diff vs current DB state keyed by `(gridRow, gridCol)`:**
   - Position present in both → `UPDATE` (`type`, `rowNumber`, `seatNumber`, `widthCells`).
   - New position → `INSERT`.
   - Removed position → check no active `SeatHold` / `BookingSeat` (where booking status ∈ `PENDING` / `CONFIRMED`) / `Ticket` for that `seatId`. If conflict → abort with `409 Conflict` and body listing the problematic seats. Otherwise `DELETE`.
4. Recompute `Hall.capacity = count(seats)`, update `layoutRows`, `layoutCols`, `updatedAt`.
5. Return the updated layout in the same shape as `GET /halls/:id/layout`.

### `GET /halls/:id/layout`

Fetch full layout for admin editor.

**Response:**

```json
{
	"hallId": "…",
	"layoutRows": 10,
	"layoutCols": 15,
	"seats": [
		/* full list */
	]
}
```

### `POST /halls/:id/duplicate`

Copy a hall's layout to a new hall within the same branch.

**Body:**

```json
{ "name": "Зал 1 (копия)" }
```

Creates a new `Hall` + all `Seat` rows with fresh UUIDs. No bookings are carried over.

### `GET /public/screenings/:id/available-seats` (changed shape)

Returns a wrapper containing both layout metadata and seat availability:

```json
{
	"hall": { "layoutRows": 10, "layoutCols": 15 },
	"seats": [
		{
			"id": "…",
			"gridRow": 0,
			"gridCol": 0,
			"widthCells": 1,
			"rowNumber": 1,
			"seatNumber": 1,
			"type": "STANDARD",
			"isActive": true,
			"status": "AVAILABLE"
		}
	]
}
```

### Endpoints removed

- `POST /halls/:hallId/seats`
- `POST /halls/:hallId/seats/bulk`
- `GET /halls/:hallId/seats`
- `PATCH /seats/:id`
- `DELETE /seats/:id`

The single ingress for seat data becomes `PUT /halls/:id/layout`.

### Mutation semantics with existing bookings

| Change                                                                                         | Allowed?                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delete seat with no active bookings                                                            | ✅                                                                                                                                                                                                                              |
| Delete seat with active `SeatHold` / `BookingSeat` / `Ticket` (status `PENDING` / `CONFIRMED`) | ❌ → 409 with conflict list                                                                                                                                                                                                     |
| Change `type`                                                                                  | ✅ — existing bookings retain whatever price was recorded at booking creation. Implementation must confirm `BookingSeat` stores a price snapshot (not a live lookup by current `Seat.type`); if it doesn't, that's fixed first. |
| Move seat to different `(gridRow, gridCol)`                                                    | ✅ (`seatId` unchanged, bookings intact)                                                                                                                                                                                        |
| Enlarge canvas                                                                                 | ✅                                                                                                                                                                                                                              |
| Shrink canvas                                                                                  | ✅ only if all remaining seats fit                                                                                                                                                                                              |
| Change `widthCells` (standard ↔ love-seat)                                                     | ✅ if no active bookings; else 409                                                                                                                                                                                              |

## 7. Admin UX

### Navigation

- `/admin/halls` — existing list, augmented with a "Создать зал" button that opens a small modal.
- Create-hall modal fields: `cinema` → `branch` cascade, `name`, `type`, `layoutRows`, `layoutCols`. On submit: creates hall with empty layout → navigates to `/admin/halls/:id/layout`.
- `/admin/halls/:id/layout` — **new** dedicated page with the grid-painter editor (not a modal — too large).
- `/admin/halls/:id/edit` — modal for metadata (`name`, `type`, `branch`). Changing `branch` is blocked when the hall has any screenings.

### Grid-painter layout

Three-column workspace:

- **Left:** seat-type palette — `STANDARD`, `VIP`, `LOVE_SEAT`, `RECLINER`, `WHEELCHAIR`, `DIRECTOR`, plus "eraser" for removing a cell. Active type highlighted with purple border.
- **Center top:** toolbar with `Rows`, `Cols` numeric inputs, "Auto-fill std", "Clear", `Undo`, `Redo`, `Cancel`, `Save layout` (primary action).
- **Center:** canvas — screen indicator on top, then the `layoutRows × layoutCols` grid of cells. Row labels ("Ряд N") on the left, aligned to populated rows only.
- **Right:** summary panel — total cells, total seats, breakdown by type, keyboard shortcut cheat-sheet.

### Interactions

- Click on cell paints with current palette selection. Clicking a cell already painted with the same type leaves it unchanged.
- Click + drag paints a continuous series — tracks `mousemove` while button is pressed. Diagonal drags paint the bounding cells.
- `Eraser` (or key `E`) removes the seat, leaving an aisle.
- Selecting `LOVE_SEAT` and painting a cell also reserves the cell to the right. If that right cell is occupied or out of bounds, painting is a no-op and a brief toast explains why.
- Keyboard: `1`–`6` select seat types (1=STD, 2=VIP, 3=LOVE, 4=RECL, 5=WHEEL, 6=DIR), `E` eraser, `⌘Z` / `⌘⇧Z` undo/redo.
- Hover on a cell shows a tooltip: "Ряд N, Место M · TYPE" (TYPE capitalized in Russian).
- Changing `Rows` or `Cols`:
  - Enlarging — always allowed.
  - Shrinking — if any seats fall outside the new bounds, show a confirmation dialog listing them; on confirm, those seats are removed (same delete-validation applied).
- Undo/redo stack: last 20 operations, cleared on successful `Save`.

### Numbering behavior

- `rowNumber` and `seatNumber` are **recomputed at save time** from `gridRow` / `gridCol`. Admin never edits them manually.
- `rowNumber`: sequential 1…N over populated grid rows. An empty grid row does not consume a row number.
- `seatNumber`: sequential 1…M within each populated row, ordered by ascending `gridCol`. Love-seats count as one unit. Aisle cells are skipped.

### Visual conventions

- Cell size 28×28 px with 4 px gap, rounded corners (top more than bottom) to resemble a seat.
- Seat types differ **only by color** — no icons inside cells. Legend in palette + right panel explains color → type.
- Cell contents: the `seatNumber` in white sans-serif. Love-seats display a single number, centered across the 2-cell span.
- Empty cells: transparent with a faint dashed outline (only visible against the canvas background) — conveys "paintable" without polluting the preview.

## 8. Client UX

### Route

`src/routes/(client)/screenings/[id]/+page.svelte` — no URL change. Internal data shape and child component are rewritten.

### `SeatMap.svelte` (rewritten)

```svelte
<script lang="ts">
	import type { AvailableSeatEntity, HallLayoutMeta } from '@/api/model';

	interface Props {
		hall: HallLayoutMeta;
		seats: AvailableSeatEntity[];
		selected: string[];
		onToggle: (seatId: string) => void;
	}

	let { hall, seats, selected, onToggle }: Props = $props();

	const byCell = $derived.by(() => {
		const map = new Map<string, AvailableSeatEntity>();
		for (const s of seats) map.set(`${s.gridRow}:${s.gridCol}`, s);
		return map;
	});
</script>

<div class="seatmap" style="--cols: {hall.layoutCols}">
	{#each Array.from({ length: hall.layoutRows }) as _, r}
		{@const rowSeats = seats
			.filter((s) => s.gridRow === r)
			.sort((a, b) => a.gridCol - b.gridCol)}
		{#if rowSeats.length > 0}
			<div class="row">
				<span class="row_label">{rowSeats[0].rowNumber}</span>
				<div class="cells">
					{#each Array.from({ length: hall.layoutCols }) as _, c}
						{@const seat = byCell.get(`${r}:${c}`)}
						{#if seat}
							<button
								class="seat"
								data-type={seat.type}
								class:selected={selected.includes(seat.id)}
								class:booked={seat.status === 'BOOKED'}
								class:held={seat.status === 'HELD'}
								style:grid-column="span {seat.widthCells}"
								disabled={seat.status === 'BOOKED' || seat.status === 'HELD'}
								onclick={() => onToggle(seat.id)}
							>
								{seat.seatNumber}
							</button>
						{:else}
							<div class="gap"></div>
						{/if}
					{/each}
				</div>
				<span class="row_label">{rowSeats[0].rowNumber}</span>
			</div>
		{/if}
	{/each}
</div>
```

### Styling rules

- `.cells { display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: 6px; }` — a single CSS grid drives the entire row; `grid-column: span 2` on love-seats just works.
- Seat type colors come from CSS custom properties in `src/app.scss`:
  - `--seat-standard: #3a3a48`
  - `--seat-vip: #a855f7`
  - `--seat-love: #ec4899`
  - `--seat-recliner: #f59e0b`
  - `--seat-wheelchair: #3b82f6`
  - `--seat-director: #10b981`
- Selected state: purple gradient + glow + `translateY(-2px)`, overriding the type color. Number stays visible.
- Booked state: desaturated, semi-transparent, number strikethrough, cursor `not-allowed`.
- Held state: amber-tinted background, semi-transparent number.
- Empty `.gap` has no background and no border — purely spacer.

### Legend and summary

- Legend strip below the map shows every seat type, plus `Выбрано`, `Временно занято`, `Продано`. Generated from the same CSS variables — no hardcoded color duplication.
- Sticky bottom summary shows count, row/seat text ("Ряд 3, Места 7, 8 · VIP"), total price, and "Продолжить" CTA.

### Mobile behavior

- Breakpoint `< 640px`: cell size drops to 22 px, gap to 4 px.
- Container wraps in `overflow-x: auto` with horizontal snap; `min-width` computed from `layoutCols × cellWidth + gaps`. Halls wider than 14 columns will scroll horizontally.
- Row labels hide on the right side at narrow widths; keep only left-side labels.

## 9. Migration plan

### Backend (Prisma + NestJS)

1. **Schema changes**
   - Add `Hall.layoutRows`, `Hall.layoutCols` as nullable; backfill from `max(rowNumber)` / `max(seatNumber)` per hall; set `NOT NULL`.
   - Add `Seat.gridRow`, `Seat.gridCol`, `Seat.widthCells` as nullable; backfill `gridRow = rowNumber - 1`, `gridCol = seatNumber - 1`, `widthCells = 1`; set `NOT NULL`.
   - Drop `Seat.positionX`, `Seat.positionY`, `Seat.rowLabel`.
   - Add enum values `LOVE_SEAT`, `RECLINER`, `DIRECTOR` (`ALTER TYPE SeatType ADD VALUE …`).
   - Add `@@unique([hallId, gridRow, gridCol])`.
2. **Service layer**
   - Delete `SeatService` per-seat CRUD and bulk methods.
   - New `HallLayoutService` with `getLayout(hallId)`, `saveLayout(hallId, dto)`, `duplicateLayout(hallId, dto)`.
   - `saveLayout` performs the validated diff in a single Prisma transaction.
3. **Controllers**
   - Remove `/halls/:hallId/seats` and `/seats/:id` routes.
   - Add `/halls/:id/layout` (`GET`, `PUT`).
   - Add `/halls/:id/duplicate` (`POST`).
   - Extend `BranchHallsController.create` to accept `layoutRows` / `layoutCols`.
   - Extend `ScreeningController.findAvailableSeats` and public variant to return the new `{ hall, seats }` envelope.
4. **OpenAPI / DTO**
   - Delete obsolete DTOs (`CreateSeatDto`, `BulkCreateSeatsDto`, `UpdateSeatDto`).
   - Add `SaveHallLayoutDto` with nested `SeatLayoutItemDto`.
   - Add `HallLayoutResponseDto` and `AvailableSeatsEnvelopeDto`.
5. **Regenerate frontend API client** via `bun run generate:api`.

### Frontend

1. **Admin**
   - Add create-hall modal under `src/routes/admin/halls/` (inline component using `Modal`).
   - Add `src/routes/admin/halls/[id]/layout/+page.svelte` with `<HallLayoutEditor>` component.
   - Add `src/routes/admin/halls/[id]/edit/+page.svelte` modal for metadata.
   - Wire list page with create button + row actions ("Редактировать схему", "Дублировать").
2. **Client**
   - Rewrite `src/routes/(client)/screenings/[id]/components/SeatMap.svelte` from scratch against the new `{ hall, seats }` envelope.
   - Update `src/routes/(client)/screenings/[id]/+page.svelte` to destructure the envelope.
   - Add CSS custom properties for new seat types in `src/app.scss`.
3. **i18n**
   - Add Russian labels for new seat types in `src/lib/constants/seat-types.ts` (love seat, recliner, director) — this is a client-facing constants file, i18n for 5 languages.

### No data migration required for bookings

`SeatHold`, `BookingSeat`, `Ticket` all reference `Seat.id` — unchanged across the migration.

## 10. Open questions & YAGNI deferred

- **Multi-select / block operations in the painter.** Useful for "make rows 5–8 all VIP" or copy/paste blocks. Not included in v1 — can be added as a future refinement once the basic painter is in use.
- **Layout templates library.** Saving a layout as a named template for reuse. Out of v1; duplicate-hall endpoint partially covers the use case.
- **Visual row labels beyond `Ряд N`.** Some cinemas use "А", "Б", "Балкон". Deferred — numbers only.
- **Multiple love-seat widths or tall seats (`heightCells`).** Not requested; `widthCells` is fixed to 1 or 2.
- **Per-seat price overrides.** Pricing stays by type via `ScreeningSeatPrice`. If needed later, add a `Seat.priceOverride` field.
- **Sections (`section` field).** Kept as optional metadata on `Seat` for future analytics / tier-based pricing, but no admin UI in v1.
