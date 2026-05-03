# Public master ticket page — fix grid collapse

**Date:** 2026-04-26
**Scope:** 1 file, CSS-only

## Problem

Page `/t/m/{viewerCode}` (public master view of all tickets in a booking) renders the per-seat tickets as a single column on desktop, instead of the multi-column grid used on `/booking/{bookingId}/confirmation`.

Both pages use the same `TicketViewer` → `TicketTabsIndividual` → `SeatTicketCard` chain. `TicketTabsIndividual.svelte` already declares `display: grid` with `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))` at `min-width: 600px`, so the grid is correctly defined.

## Root cause

`src/routes/t/+layout.svelte:39-45` — the `<main>` element is a flex container with `align-items: center; justify-content: center;`. A flex item without an explicit `width` shrinks to its intrinsic content width. `<article class="public_master_card">` declares `max-width: 720px` and `margin: 0 auto`, but neither forces it to fill the cross axis of the flex parent.

Result: `<article>` collapses to the widest indivisible child (a `SeatTicketCard` ≈ 280px), and inside that ~280px the grid resolves to a single column.

The confirmation page is unaffected because the `(client)` layout uses a normal block layout — `.tickets { max-width: 640px; margin: 0 auto; }` resolves against the full viewport width and gives the grid room to lay out 3 columns.

## Fix

In `src/routes/t/+layout.svelte`, on the `main` selector:

- Remove `display: flex;`
- Remove `align-items: center;`
- Remove `justify-content: center;`
- Keep `flex: 1;` (parent `.public_ticket_shell` is `flex column`, this lets `<main>` fill remaining vertical space)
- Keep `padding: var(--space-8) var(--space-4);`

## Affected pages and behavior change

| Page | Before | After |
| --- | --- | --- |
| `/t/m/{viewerCode}` | Tickets in one column (collapsed grid) | Grid: 2 columns mobile, 3+ columns desktop (matches confirmation) |
| `/t/{qrCode}` (single ticket) | Card vertically + horizontally centered in viewport | Card horizontally centered (via existing `margin: 0 auto`), top-aligned |

The single-ticket page changes vertically: it loses viewport-centered vertical positioning. This matches every other client-facing page in the project and is acceptable. Horizontal centering is preserved by the page's own `margin: 0 auto`.

## Out of scope

- `TicketViewer.svelte` — no change.
- `TicketTabsIndividual.svelte` — no change (grid already correct).
- `SeatTicketCard.svelte` — no change.
- `.public_master_card` and `.public_ticket_card` styles in their respective `+page.svelte` files — no change.
- Max-width parity between the master page (720px) and confirmation tickets section (640px) — left as-is; the master page is dedicated to tickets and benefits from the wider canvas.

## Manual verification

1. `bun run dev`
2. Open `/t/m/<viewerCode>`, switch to the "По местам" tab → verify 3+ columns on a wide viewport, 2 columns at < 600px.
3. Open `/t/<qrCode>` → verify the single-ticket card is horizontally centered, with normal top padding (no regression in spacing or alignment).
4. Confirm `/booking/<id>/confirmation` is unchanged (it doesn't use the `t/+layout`, so this is a sanity check only).
