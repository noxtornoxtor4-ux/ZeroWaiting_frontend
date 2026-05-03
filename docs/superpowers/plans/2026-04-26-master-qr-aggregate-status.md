# Master QR aggregate status — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute the aggregate status badge on the "Общий QR" tab from all four ticket statuses (VALID/USED/EXPIRED/CANCELLED), so a booking whose tickets are all EXPIRED no longer shows "Действителен".

**Architecture:** Single component edit in `src/components/booking/TicketTabsMaster.svelte`. Replace the `usedCount`-only `summary` derivation with a four-bucket counter that picks VALID, partiallyUsed, or the dominant non-VALID status. Reuse `TICKET_STATUS_CONFIG` from `src/lib/constants/ticket-status.ts` for label keys and colors so the master view stays in sync with per-seat styling.

**Tech Stack:** Svelte 5 runes (`$derived`, `$derived.by`), TypeScript, svelte-i18n.

**Spec:** `docs/superpowers/specs/2026-04-26-master-qr-aggregate-status-design.md`

---

## File map

- **Modify:** `src/components/booking/TicketTabsMaster.svelte` — replace `summary` logic, rename `key` → `labelKey`, switch counter passed to i18n from `usedCount` to `spentCount`.

No other files change.

---

### Task 1: Rewrite aggregate status logic in `TicketTabsMaster.svelte`

**Files:**
- Modify: `src/components/booking/TicketTabsMaster.svelte`

- [ ] **Step 1: Apply the edit**

In `src/components/booking/TicketTabsMaster.svelte`, edit the `<script lang="ts">` block.

**Add import** (alongside existing imports near the top):

```ts
import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';
```

**Replace the derivations and `summary` block.** Find the existing block:

```ts
const usedCount = $derived(seats.filter((s) => s.status === 'USED').length);
const total = $derived(seats.length);

const summary = $derived.by(() => {
    if (usedCount === 0) return { key: 'booking.ticketStatus.VALID', color: 'var(--success)' };
    if (usedCount === total) return { key: 'booking.ticketStatus.USED', color: 'var(--muted-fg)' };
    return { key: 'ticket.statusPartiallyUsed', color: 'var(--warning)' };
});
```

Replace with:

```ts
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

**Update `lightboxItems`.** Find:

```ts
statusText: $_(summary.key, { values: { count: usedCount, total } }),
```

Replace with:

```ts
statusText: $_(summary.labelKey, { values: { count: spentCount, total } }),
```

**Update the `<Badge>` usage.** Find in template:

```svelte
<Badge
    text={$_(summary.key, { values: { count: usedCount, total } })}
    color={summary.color}
/>
```

Replace with:

```svelte
<Badge
    text={$_(summary.labelKey, { values: { count: spentCount, total } })}
    color={summary.color}
/>
```

After all three substitutions, no references to `summary.key` should remain in the file (only `summary.labelKey` and `summary.color`). Ensure the bare `usedCount` reference inside `$_()` calls is replaced with `spentCount`. The `Seat` interface (`row`, `seat`, `status: string`) is unchanged.

- [ ] **Step 2: Run type check**

Run: `bun run check`
Expected: 0 errors. If pre-existing errors are present, confirm none mention `TicketTabsMaster.svelte` or refer to the renamed properties.

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/TicketTabsMaster.svelte
git commit -m "fix(booking): aggregate master QR status across all ticket states"
```

Conventional commit; NO footers.

---

## Manual verification (controller will perform after commit)

Performed via chrome-devtools MCP against `bun run dev`:

1. Open `/booking/<bookingId>/confirmation` (or the public master URL) for the user-supplied booking with 2 EXPIRED tickets. "Общий QR" tab → badge text `Истёк`, color `muted-fg`. Was `Действителен` before fix.
2. Inspect `summary` cases by scripting through the page state where possible. Minimum acceptance: the EXPIRED case from (1) is correct and per-seat tab still shows correct individual statuses.

## Self-Review

**Spec coverage:** Spec sections — Problem, Fix, Implementation sketch, Cases table, Out of scope, Manual verification. All map to Task 1 steps. ✓

**Placeholder scan:** No TBDs. Code blocks contain full before/after. Commit message explicit. ✓

**Type consistency:** `summary.labelKey` used everywhere after rename. `spentCount` defined before any consumer. `TICKET_STATUS_CONFIG.{USED,EXPIRED,CANCELLED}` are real keys (verified in `src/lib/constants/ticket-status.ts`). ✓
