# Public master ticket grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the per-seat ticket grid on `/t/m/{viewerCode}` so it lays out in 2/3+ columns (matching `/booking/{id}/confirmation`) instead of collapsing to one column.

**Architecture:** Single CSS-only edit to `src/routes/t/+layout.svelte`. The `<main>` element is currently a flex container that shrinks its child `<article>` to intrinsic width, collapsing the inner CSS grid. Removing flex centering on `<main>` lets the article expand to its declared `max-width` and lets the existing grid in `TicketTabsIndividual.svelte` resolve normally.

**Tech Stack:** SvelteKit 2, Svelte 5, SCSS.

**Spec:** `docs/superpowers/specs/2026-04-26-public-master-grid-design.md`

---

## File map

- **Modify:** `src/routes/t/+layout.svelte` — remove flex centering from `<main>`.

No other files change. The grid in `src/components/booking/TicketTabsIndividual.svelte` is already correct and will start working as soon as its outer container has room.

---

### Task 1: Remove flex centering from `t/+layout.svelte` `<main>`

**Files:**
- Modify: `src/routes/t/+layout.svelte:39-45`

- [ ] **Step 1: Apply the edit**

In `src/routes/t/+layout.svelte`, replace the `main` block in `<style lang="scss">`:

Before:
```scss
main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) var(--space-4);
}
```

After:
```scss
main {
    flex: 1;
    padding: var(--space-8) var(--space-4);
}
```

Three properties removed: `display: flex`, `align-items: center`, `justify-content: center`. `flex: 1` and `padding` stay — `flex: 1` is needed because the parent `.public_ticket_shell` is `display: flex; flex-direction: column` and we want `<main>` to fill remaining vertical space.

- [ ] **Step 2: Run type check**

Run: `bun run check`
Expected: passes (this is a CSS-only change, but the project convention is to run check after every edit). If pre-existing errors are present, confirm they are unrelated to this file.

- [ ] **Step 3: Start dev server**

Run: `bun run dev`
Expected: server starts on a local port (typically `http://localhost:5173`). Note the URL.

- [ ] **Step 4: Manual smoke — `/t/m/{viewerCode}`**

In a browser at the local dev URL, navigate to a public master view: `/t/m/<any-existing-viewerCode>`. To find one, you can:
- Use the seed/known data, or
- Open `/booking/<bookingId>/confirmation` for a confirmed booking and copy the viewer URL from the "Общий QR" tab, or
- Ask the user for a viewer code.

Switch to the **«По местам»** tab.

Verify on a wide viewport (≥ 900px window):
- Tickets render as a multi-column grid (3 columns expected for a 720px container with 180px min-track).
- No tickets are clipped; QR codes are fully visible.

Resize the window narrower (≤ 599px viewport):
- Grid collapses to **2 columns** (the explicit mobile rule in `TicketTabsIndividual.svelte:67`).

Resize between (600–899px):
- Grid uses `auto-fit, minmax(180px, 1fr)` — 2 or 3 columns depending on width. No horizontal scroll.

- [ ] **Step 5: Manual smoke — `/t/{qrCode}` (single ticket regression check)**

Navigate to a single-ticket page: `/t/<any-existing-qrCode>`.

Verify:
- The ticket card is **horizontally centered** (this is preserved by the page's own `margin: 0 auto`).
- The card is **top-aligned** under the header instead of vertically centered in the viewport. This is the intentional behavior change described in the spec — confirm it looks acceptable, no overlapping or odd spacing.
- QR, badge, share button render normally.

- [ ] **Step 6: Stop dev server**

Stop `bun run dev`.

- [ ] **Step 7: Commit**

```bash
git add src/routes/t/+layout.svelte
git commit -m "fix(t): unblock per-seat grid on public master view"
```

Commit message follows project convention `<type>(<scope>): <subject>`, no footers.

---

## Self-Review

**Spec coverage:** Spec sections — Problem, Root cause, Fix (3 properties removed, 2 kept), Affected pages (master + single ticket), Out of scope, Manual verification (3 checks). All four spec verification steps map to plan steps 4–5. ✓

**Placeholder scan:** No TBDs. Edit shows full before/after. Commands explicit. Smoke check has concrete viewport widths and expected column counts. ✓

**Type consistency:** No types/methods introduced — CSS-only change. ✓
