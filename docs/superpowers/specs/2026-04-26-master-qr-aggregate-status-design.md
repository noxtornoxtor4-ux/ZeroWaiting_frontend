# Master QR aggregate status — fix EXPIRED/CANCELLED handling

**Date:** 2026-04-26
**Scope:** 1 file, logic-only

## Problem

The "Общий QR" tab in `TicketViewer` shows a single aggregate status badge for the booking. Today the badge is computed only from `USED` count:

```ts
const usedCount = seats.filter((s) => s.status === 'USED').length;
if (usedCount === 0) return VALID;
if (usedCount === total) return USED;
return partiallyUsed;
```

(`src/components/booking/TicketTabsMaster.svelte:22-29`)

Tickets with status `EXPIRED` or `CANCELLED` slip through the `usedCount === 0` branch and are shown as **VALID** (green). Confirmed visually: a booking with 2 `EXPIRED` tickets shows "Действителен" on Общий QR while the per-seat tab correctly shows "Истёк".

Per-ticket statuses come from backend enum `TicketStatus`: `VALID`, `USED`, `CANCELLED`, `EXPIRED` (`src/lib/constants/ticket-status.ts`).

## Fix — aggregate semantics

1. **All `VALID`** → badge `VALID` (color `var(--success)`).
2. **Any `VALID` + any non-`VALID`** → badge `ticket.statusPartiallyUsed` (color `var(--warning)`), text `"{count} из {total} использовано"` where `count = usedCount + expiredCount + cancelledCount`, `total = seats.length`. (Today `count` equals `usedCount`; under the new rule the partial-use copy aggregates all "spent" tickets so the counter matches reality when expired/cancelled exist alongside valid ones.)
3. **No `VALID`** → show the **dominant** non-VALID status. Implemented by picking the entry with the largest count from `[USED, EXPIRED, CANCELLED]`. On ties, the array order resolves the winner: `USED > EXPIRED > CANCELLED` (used = strongest signal a ticket actually went through the gate).

## Implementation sketch

```ts
import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';

const validCount = $derived(seats.filter((s) => s.status === 'VALID').length);
const usedCount = $derived(seats.filter((s) => s.status === 'USED').length);
const expiredCount = $derived(seats.filter((s) => s.status === 'EXPIRED').length);
const cancelledCount = $derived(seats.filter((s) => s.status === 'CANCELLED').length);
const total = $derived(seats.length);
const spentCount = $derived(usedCount + expiredCount + cancelledCount);

const summary = $derived.by(() => {
    if (total === 0 || validCount === total) {
        return { labelKey: 'booking.ticketStatus.VALID', color: 'var(--success)' };
    }
    if (validCount > 0) {
        return { labelKey: 'ticket.statusPartiallyUsed', color: 'var(--warning)' };
    }
    const candidates = [
        { count: usedCount, cfg: TICKET_STATUS_CONFIG.USED },
        { count: expiredCount, cfg: TICKET_STATUS_CONFIG.EXPIRED },
        { count: cancelledCount, cfg: TICKET_STATUS_CONFIG.CANCELLED }
    ];
    return candidates.reduce((max, c) => (c.count > max.count ? c : max)).cfg;
});
```

Then update template references:

- `Badge text={$_(summary.labelKey, { values: { count: spentCount, total } })}` (was `summary.key`, `count: usedCount`).
- `lightboxItems[0].statusText = $_(summary.labelKey, { values: { count: spentCount, total } })` (same).
- `lightboxItems[0].statusColor = summary.color` — unchanged.

## Cases

| Mix (n=2) | validCount | Dominant | Badge | Color |
| --- | --- | --- | --- | --- |
| VALID, VALID | 2 | — | VALID | success |
| VALID, USED | 1 | — | partiallyUsed (1/2) | warning |
| VALID, EXPIRED | 1 | — | partiallyUsed (1/2) | warning |
| USED, USED | 0 | USED | USED | muted-fg |
| EXPIRED, EXPIRED | 0 | EXPIRED | EXPIRED | muted-fg |
| CANCELLED, CANCELLED | 0 | CANCELLED | CANCELLED | danger |
| USED, EXPIRED | 0 | USED (tie → array order) | USED | muted-fg |
| EXPIRED, CANCELLED | 0 | EXPIRED (tie → array order) | EXPIRED | muted-fg |
| USED, CANCELLED | 0 | USED (tie → array order) | USED | muted-fg |

## Out of scope

- `TicketTabsIndividual` — per-seat statuses already correct.
- `TICKET_STATUS_CONFIG` — no changes.
- i18n locale files — all keys already present (`booking.ticketStatus.{VALID,USED,EXPIRED,CANCELLED}`, `ticket.statusPartiallyUsed`).
- Backend — no changes.

## Manual verification

1. `bun run dev`. Open `/booking/<bookingId>/confirmation` for the user's booking that has 2 EXPIRED tickets. "Общий QR" tab → badge shows **«Истёк»** (was «Действителен»).
2. Sanity case via DOM injection through chrome-devtools `evaluate_script`: temporarily mutate `seats` (e.g. via Svelte component dev hook is not feasible — instead pick another booking with mixed statuses if available, or rely on unit-style branch coverage by reading the diff).
3. Verify partial-use copy: if a booking with 1 VALID + 1 USED exists, badge reads "1 из 2 использовано" and color is warning.
