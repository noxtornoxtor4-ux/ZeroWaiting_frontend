# QR Preview Lightbox — Design

**Date:** 2026-04-26
**Scope:** Client-side QR preview viewer for booking confirmation page,
individual seat tickets, and the public ticket page.
**Status:** Design

## Problem

When a booking is confirmed, the user sees QR code(s) on three surfaces:

1. **Master QR** in `TicketTabsMaster` — single 240px QR on the confirmation
   page «Общий QR» tab.
2. **Per-seat QRs** in `TicketTabsIndividual` — grid of 140px QR cards in
   the «По местам» tab.
3. **Public ticket QR** at `/t/[qrCode]` — single 220px QR on the public
   single-seat page.

There is no way to enlarge the QR to scan it comfortably from another phone
or to inspect it. A previous attempt (commit `e9530da`) added tap-to-fullscreen
through a hand-rolled overlay, but it was reverted (`4504dca`) because the
visual treatment was unsatisfactory.

The user wants a **photo-viewer-style preview**: tap a QR → fullscreen
overlay opens with a slider to swipe through related QRs and a description
strip below. The component must be **reusable** across all three surfaces
and **match the project's visual language**.

## Goals

- Tap any QR → opens a fullscreen lightbox with the same QR enlarged.
- In «По местам», the lightbox is a **slider** through all individual seat
  QRs of the booking, opened at the tapped index.
- Master QR and public ticket → single-slide lightbox (no slider chrome).
- Description below QR: row/seat label (or seats summary for master),
  status badge, Share button.
- Visual style matches the existing project tokens (no bespoke colors,
  consistent radii, easings, typography).
- One reusable generic primitive (`Lightbox`) usable for any future media
  preview, plus a thin QR-specific wrapper (`QrPreviewLightbox`).
- No new dependencies (no Swiper/Embla/etc.) — slider built on CSS
  scroll-snap.

## Non-goals

- Swipe-down-to-close gesture (deferred — P2).
- Pinch-to-zoom inside the QR.
- Custom horizontal-slide-transition animation between slides (native
  scroll-snap inertia is sufficient).
- Admin-side QR preview (scope is client only).
- "Download QR as PNG" button.

## Architecture

Two new components, three modified call sites.

```
src/components/ui/
  Lightbox.svelte                       NEW — generic snippet-based fullscreen viewer
                                          - controls overlay, scroll-lock, ESC/backdrop close
                                          - CSS scroll-snap track for multi-slide
                                          - dots indicator + desktop arrow nav
                                          - slot-based content & caption
                                          - no QR knowledge

src/components/booking/
  QrPreviewLightbox.svelte              NEW — thin wrapper over <Lightbox>
                                          - knows how to render QR + caption + Badge + Share
                                          - accepts QrSlideItem[]

  TicketTabsMaster.svelte               MODIFIED — wrap master <QrCode> in trigger button,
                                                   open 1-slide QrPreviewLightbox
  TicketTabsIndividual.svelte           MODIFIED — owns lightbox state for the seat grid,
                                                   builds items[], passes onOpen(index) to cards
  SeatTicketCard.svelte                 MODIFIED — accepts onOpen(): void prop,
                                                   wraps inner <QrCode> in trigger button

src/routes/t/[qrCode]/+page.svelte      MODIFIED — wrap <QrCode> in trigger button,
                                                   open 1-slide QrPreviewLightbox

src/lib/utils/seat-label.ts             EXTENDED — add formatSeatsSummary(seats, $_) helper
                                                   (extract from existing SeatsSummary component
                                                   to share with master caption)
```

`TicketViewer.svelte` (root tabs container) and the master public ticket
page (`/t/m/[viewerCode]`) need no changes — they pass through to the
modified `TicketTabsMaster`/`TicketTabsIndividual`.

### Why a separate primitive vs extending Modal.svelte

`Modal.svelte` is a **dialog** primitive: header with brand-gradient,
title, X, optional footer, designed for confirm/cancel flows. The lightbox
is a **media viewer**: chromeless, content-first, photo-viewer aesthetic.
Mixing them via a `chromeless: boolean` prop forces conditional rendering
and breaks single-responsibility. They share concepts (backdrop, ESC,
scroll-lock, exiting animation) but have distinct visuals and semantics.

We replicate Modal's robust patterns (mousedown-on-positioner to avoid
ghost-close on drag-out, `@starting-style` enter animation, exiting
state) but in a separate primitive.

### Why CSS scroll-snap vs hand-rolled pointer slider

For 1–6 slides per booking, native horizontal scroll with
`scroll-snap-type: x mandatory` is enough. It gives:
- Native iOS/Android touch inertia for free.
- Trackpad two-finger swipe on macOS for free.
- No `pointerdown/move/up` boilerplate, no inertia tuning.
- Programmatic navigation via `track.scrollTo({ left, behavior: 'smooth' })`.

Current index is read off `scrollLeft / clientWidth`, debounced via
`requestAnimationFrame`. Arrows and dots simply call `scrollTo`.

## API: `Lightbox.svelte`

```ts
interface LightboxProps<T = unknown> {
  open: boolean;                                    // controlled
  onClose: () => void;
  items: T[];                                       // 1+ slides; len=1 → no slider chrome
  startIndex?: number;                              // clamped to [0, items.length-1]
  ariaLabel?: string;                               // for role="dialog"
  slide: Snippet<[item: T, index: number]>;         // main content per slide
  caption?: Snippet<[item: T, index: number]>;     // optional caption strip
}
```

**Behavior:**

- `open=false` → component renders nothing.
- `open=true` → mount overlay, set `body.style.overflow = 'hidden'`,
  capture `document.activeElement` as `previouslyFocused`, focus the
  overlay (`tabindex=-1`), apply enter animation via `@starting-style`.
- `Escape` → `onClose()`.
- `mousedown` on `.positioner` where `e.target === e.currentTarget` →
  `onClose()` (mirrors `Modal.handlePositionerMouseDown`).
- X button (top-right, 44×44px circular) → `onClose()`.
- On close: set `exiting=true`, wait 220ms (mirror animation), restore
  `body.style.overflow`, restore focus to `previouslyFocused`,
  unmount.

**When `items.length > 1`:**

- Render `‹ ›` arrow buttons centered vertically, `var(--space-4)` from
  edges. Hidden via `@media (max-width: 640px)`.
- Render dots indicator below caption. Active dot — `var(--primary)`,
  inactive — `var(--muted-fg)` at opacity 0.4. Click → scrollTo.
- Render counter `{current}/{total}` next to X (top-right area).
- Track current index via `IntersectionObserver` on slide nodes with
  `threshold: 0.5` and `root: track`. The slide whose intersection
  ratio is highest becomes `currentIdx`. This is robust against
  scroll-snap browser quirks (Safari occasionally reports stale
  `scrollLeft` during snap).
- On `resize`, re-pin scroll position to `currentIdx * clientWidth`
  with `behavior: 'instant'` so the visible slide stays aligned.

**Styling tokens:**

- backdrop: `rgba(0, 0, 0, 0.85)` + `backdrop-filter: blur(8px)`
- close button: 44×44 circle, `border: 1px solid var(--border-color)`,
  `background: rgba(0, 0, 0, 0.6)`, hover `rgba(255, 255, 255, 0.1)`,
  icon `lucide:x` 28px
- arrow buttons: same chip style as close, icon `lucide:chevron-left`/
  `lucide:chevron-right` 28px
- caption strip: `background: rgba(0, 0, 0, 0.6)` +
  `backdrop-filter: blur(12px)`, `padding: var(--space-3)`,
  `text-align: center`, `color: var(--foreground)`
- focus-visible: `outline: 2px solid var(--primary); outline-offset: 4px`
- z-index: `1000` (must be above floating `ActiveBookingBanner`)

**No inverse-scale wrap** (unlike `Modal.svelte`). The lightbox occupies
real `100vw × 100dvh` regardless of root font-size — `postcss-pxtorem`
shouldn't shrink overlay geometry. QR pixel size is computed independently
(see wrapper API below).

## API: `QrPreviewLightbox.svelte`

```ts
interface QrSlideItem {
  qrValue: string;          // payload encoded into the QR (URL)
  captionText: string;      // pre-formatted caption line
  statusText: string;       // pre-localized badge text; consumer interpolates
  statusColor: string;      // CSS color (e.g. var(--success))
  shareUrl: string;         // url passed to ShareButton
  shareTitle?: string;      // optional title for navigator.share
}

interface QrPreviewLightboxProps {
  open: boolean;
  onClose: () => void;
  items: QrSlideItem[];
  startIndex?: number;
}
```

Renders:

```svelte
<Lightbox {open} {onClose} {items} {startIndex} ariaLabel={$_('ticket.preview')}>
  {#snippet slide(item)}
    <QrCode value={item.qrValue} size={qrSize} />
  {/snippet}
  {#snippet caption(item)}
    <div class="qr_caption">
      <p class="caption_text">{item.captionText}</p>
      <Badge text={item.statusText} color={item.statusColor} />
      <ShareButton url={item.shareUrl} title={item.shareTitle} />
    </div>
  {/snippet}
</Lightbox>
```

**`qrSize` computation** lives inside the wrapper (`QrPreviewLightbox`),
not inside `Lightbox`. `Lightbox` is content-agnostic and shouldn't
know about QR sizing. The wrapper listens to `svelte:window` resize
and computes:

```ts
let innerW = $state(0), innerH = $state(0);
const qrSize = $derived(
  Math.max(240, Math.min(520, Math.floor(Math.min(innerW, innerH) * 0.7)))
);
```

The same `qrSize` is used for every slide so visual scale stays
identical when swiping.

## Integration points

### Master tab (`TicketTabsMaster.svelte`)

```svelte
<button
  type="button"
  class="qr_btn"
  onclick={() => (open = true)}
  aria-label={$_('ticket.openPreview')}
>
  <QrCode value={viewerUrl} size={240} />
</button>
…
<QrPreviewLightbox
  {open}
  onClose={() => (open = false)}
  items={[{
    qrValue: viewerUrl,
    captionText: formatSeatsSummary(seats, $_),
    statusText: $_(summary.key, { values: { count: usedCount, total } }),
    statusColor: summary.color,
    shareUrl: viewerUrl,
    shareTitle: $_('ticket.share'),
  }]}
/>
```

`Lightbox` auto-hides slider chrome when `items.length === 1`.

### Individual seats tab (`TicketTabsIndividual.svelte`)

State lives in the parent — not in each card — otherwise each card opens
its own single-slide lightbox and we lose the swipe-between-seats
behavior.

```svelte
<script lang="ts">
  let openIdx = $state<number | null>(null);

  const lightboxItems = $derived(
    seats.map((s) => ({
      qrValue: `${origin}/t/${s.qrCode}`,
      captionText: $_('ticket.rowSeat', { values: { row: s.row, seats: s.seat } }),
      statusText: $_(
        TICKET_STATUS_CONFIG[s.status]?.labelKey
          ?? `booking.ticketStatus.${s.status}`
      ),
      statusColor: TICKET_STATUS_CONFIG[s.status]?.color ?? 'var(--muted-fg)',
      shareUrl: `${origin}/t/${s.qrCode}`,
    }))
  );
</script>

{#each seats as s, i (s.qrCode)}
  <SeatTicketCard {...s} {origin} onOpen={() => (openIdx = i)} />
{/each}

<QrPreviewLightbox
  open={openIdx !== null}
  onClose={() => (openIdx = null)}
  items={lightboxItems}
  startIndex={openIdx ?? 0}
/>
```

`SeatTicketCard.svelte` — minimal change: wrap `<QrCode>` in
`<button class="qr_btn" onclick={onOpen}>`, add `onOpen?: () => void` prop.
Card retains its existing `seat_label`/`Badge`/`ShareButton` below QR
(grid card layout is unchanged — lightbox just enlarges the same QR).

### Public ticket page `/t/[qrCode]/+page.svelte`

```svelte
<script lang="ts">
  let open = $state(false);
  const url = $derived(typeof window !== 'undefined' ? window.location.href : '');
</script>

<button type="button" class="qr_btn" onclick={() => (open = true)}>
  <QrCode value={url} size={220} />
</button>
…
<QrPreviewLightbox
  {open}
  onClose={() => (open = false)}
  items={[{
    qrValue: url,
    captionText: $_('ticket.rowSeat', { values: { row: ticket.seat.row, seats: ticket.seat.seat } }),
    statusText: $_(statusConfig.labelKey),
    statusColor: statusConfig.color,
    shareUrl: url,
    shareTitle: movieTitle,
  }]}
/>
```

`/t/m/[viewerCode]/+page.svelte` (master public viewer) does **not**
change — it composes `TicketViewer` which composes the modified
`TicketTabsMaster`/`TicketTabsIndividual`, so the feature lights up
there for free.

### Cursor / interaction affordance

`.qr_btn` has `cursor: zoom-in` on the QR area, `border-radius: var(--radius-md)`,
`transition: transform var(--duration-fast)`, slight `scale(1.02)` on hover
on devices with `(hover: hover)`. Focus-visible — same outline as
elsewhere.

## i18n

New keys added to all five locales (`ru`, `en`, `ky`, `kz`, `uz`) under
the existing `ticket` namespace:

```jsonc
"ticket": {
  "preview": "Просмотр билета",                 // dialog aria-label
  "openPreview": "Открыть превью QR-кода",      // trigger aria-label
  "closePreview": "Закрыть превью",             // X button aria-label
  "previousSlide": "Предыдущий билет",          // arrow aria-label
  "nextSlide": "Следующий билет",
  "slideCounter": "{current} из {total}"       // counter (params)
}
```

`formatSeatsSummary(seats, $_)` reuses existing keys from
`SeatsSummary.svelte` (no new key for master caption).

Admin is untouched. Per project rule: «Admin = русский hardcoded,
Client = `$_()` i18n.»

## Edge cases

- **`items.length === 0`:** wrapper gates rendering with
  `{#if open && items.length > 0}`. Defensive — should never occur.
- **`startIndex` out of range:** `Math.max(0, Math.min(items.length - 1, startIndex ?? 0))`.
- **Resize / orientation change:** `qrSize` recomputes via `$derived`;
  `track.scrollLeft` re-pinned to `currentIdx * clientWidth` in `$effect`
  to keep the visible slide aligned after width change.
- **SSR:** `Lightbox` body renders only `if (open)`; `window`/`document`
  access lives inside `$effect`/event handlers. Wrapper passes
  `qrValue: ''` is impossible (always derived from URL).
- **`navigator.share` unavailable:** `ShareButton` already handles this
  (clipboard fallback). Lightbox doesn't add anything new.
- **Multiple lightboxes opened simultaneously:** disallowed by design —
  each call site owns one boolean state. If two were ever opened,
  `body.style.overflow` would correctly remain `hidden` and restore
  on the last close.
- **Focus trap:** out of scope for v1. ESC works, X works, backdrop tap
  works; the overlay catches keyboard via `tabindex=-1`. Tab cycling
  inside the overlay is acceptable to leak (browser default behavior),
  given the limited interactive elements (X, arrows, dots, ShareButton).
- **`active-booking-banner` overlap:** banner z-index < 1000, so banner
  is hidden behind backdrop. Acceptable.

## Out of scope (deferred)

- **Swipe-down-to-close gesture** — P2 follow-up.
- **Pinch-to-zoom inside QR.**
- **Download QR as PNG button.**
- **Custom slide-transition animation.** Native scroll-snap inertia
  ships in v1.
- **Focus trap.** ESC + X + backdrop close are sufficient for v1.
- **Admin-side QR previews.** Scanner/admin pages are not modified.

## Testing approach

- **Unit:** `formatSeatsSummary(seats, $_)` — pure function, easy to
  test with a mocked `$_`.
- **Component (manual via `bun run dev`):**
  - Open `/booking/{id}/confirmation` after a fresh booking with 4
    seats. Verify:
    - Tap master QR → 1-slide lightbox, no arrows, no dots, no counter.
    - Tap a seat card QR → multi-slide lightbox starts at correct index;
      swipe horizontally on iOS Safari, Android Chrome; arrow buttons
      visible on desktop ≥641px, hidden on narrow.
    - ESC closes; X closes; tap on backdrop closes.
    - Body scroll locked while open.
    - Focus returns to trigger button on close.
    - Resize the window — current slide stays aligned, QR resizes.
    - All five locales render correctly (ru/en/ky/kz/uz).
  - Open `/t/{qrCode}` (public single seat) — verify same single-slide
    flow.
  - Verify status badges (`VALID`, `USED`) render with right colors.
- **`bun run check`** must pass with zero errors.

## Files touched

**New:**
- `src/components/ui/Lightbox.svelte`
- `src/components/booking/QrPreviewLightbox.svelte`

**Modified:**
- `src/components/booking/TicketTabsMaster.svelte`
- `src/components/booking/TicketTabsIndividual.svelte`
- `src/components/booking/SeatTicketCard.svelte`
- `src/routes/t/[qrCode]/+page.svelte`
- `src/lib/utils/seat-label.ts` — add
  `formatSeatsSummary(seats: { row: number; seat: number }[], t: (key: string, opts?: { values?: Record<string, unknown> }) => string): string`
  helper. Takes the source shape used by `TicketTabsMaster` (`{ row, seat }`)
  — not the `SeatsSummary`-mapped shape (`{ seat: { rowNumber, seatNumber } }`).
- `src/components/booking/SeatsSummary.svelte` — refactor internals to
  delegate string-building to `formatSeatsSummary` (DRY). Public API of
  `SeatsSummary` is unchanged.
- `src/locales/ru.json`, `en.json`, `ky.json`, `kz.json`, `uz.json` —
  new keys under `ticket`
