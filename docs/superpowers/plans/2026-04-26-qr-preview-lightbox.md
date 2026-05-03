# QR Preview Lightbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fullscreen photo-viewer-style preview for QR codes. Tap any QR (master, per-seat, public ticket) to enlarge it; in the «По местам» tab the preview is a slider through all individual seat QRs. Reusable generic `Lightbox` primitive + thin `QrPreviewLightbox` wrapper.

**Architecture:** Introduce `src/components/ui/Lightbox.svelte` (snippet-based generic overlay) and `src/components/booking/QrPreviewLightbox.svelte` (QR-specific wrapper). Wire it into `TicketTabsMaster`, `TicketTabsIndividual` (state lives in parent for the seat slider), `SeatTicketCard` (loses inner state, gains `onOpen` callback), and `routes/t/[qrCode]/+page.svelte`. DRY: extract a pure `formatSeatsSummary` helper from `SeatsSummary.svelte` so the master caption can reuse it as a string.

**Tech Stack:** Svelte 5 runes, SCSS with project tokens, `qrcode` (already used by `QrCode.svelte`), `lucide` icons via `@iconify/svelte`, `svelte-i18n`, `vitest` for pure-function tests.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-04-26-qr-preview-lightbox-design.md`
- Project rules: `CLAUDE.md`
- Booking flow context: `.claude/skills/booking/SKILL.md`
- Project conventions: `.claude/skills/{ui,svelte,styling,i18n,booking}/SKILL.md`

**Key constraints from CLAUDE.md:**
- Arrow functions only (no `function` keyword).
- No `any`. Types from `@/api/model` or local `interface`.
- No BEM. `underscore_case` for SCSS class names. SCSS nesting mirrors DOM.
- `$app/state`, never `$app/stores`.
- Imports via `@/` alias (no relative `../`).
- Loading UI uses `isLoading` (n/a here, no async).
- Admin = russian hardcoded; Client = `$_()` i18n. This feature is client-side, so all user-visible strings go through `$_()`.

---

## File Structure

**New files:**
- `src/components/ui/Lightbox.svelte` — generic snippet-based fullscreen viewer.
- `src/components/booking/QrPreviewLightbox.svelte` — QR-specific wrapper.
- `src/components/booking/qr-slide-item.ts` — `QrSlideItem` type, separate from the `.svelte` so consumers can `import type` it without pulling component runtime.
- `src/lib/utils/seat-label.test.ts` — vitest for `formatSeatsSummary`.

**Modified files:**
- `src/lib/utils/seat-label.ts` — add `formatSeatsSummary`.
- `src/components/booking/SeatsSummary.svelte` — delegate string-building to `formatSeatsSummary`.
- `src/components/booking/TicketTabsMaster.svelte` — wrap master QR in trigger button + 1-slide lightbox.
- `src/components/booking/TicketTabsIndividual.svelte` — own lightbox state, build items[], pass `onOpen(index)` to cards.
- `src/components/booking/SeatTicketCard.svelte` — accept `onOpen` prop, wrap inner `<QrCode>` in button.
- `src/routes/t/[qrCode]/+page.svelte` — wrap QR in trigger button + 1-slide lightbox.
- `src/lib/i18n/locales/{ru,en,ky,kz,uz}.json` — add 5 new keys under `ticket`.

---

## Task 1: Add `formatSeatsSummary` helper (TDD)

**Why first:** It's a pure function with no dependencies on UI; we can write proper tests for it. Both `SeatsSummary.svelte` and `QrPreviewLightbox` will use it. Doing it first means later tasks consume a tested helper.

**Files:**
- Create: `src/lib/utils/seat-label.test.ts`
- Modify: `src/lib/utils/seat-label.ts`

- [ ] **Step 1.1: Write the failing test**

Create `src/lib/utils/seat-label.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatSeatsSummary } from './seat-label';

describe('formatSeatsSummary', () => {
	const t = (
		key: string,
		opts?: { values?: Record<string, string | number | boolean | Date | null | undefined> }
	): string => {
		const values = opts?.values ?? {};
		if (key === 'ticket.rowSeat') return `Ряд ${values.row}: место ${values.seats}`;
		if (key === 'ticket.rowSeats') return `Ряд ${values.row}: места ${values.seats}`;
		return key;
	};

	it('returns a single row with one seat as "место"', () => {
		expect(formatSeatsSummary([{ row: 4, seat: 4 }], t)).toBe('Ряд 4: место 4');
	});

	it('returns a single row with multiple seats as "места"', () => {
		expect(formatSeatsSummary([{ row: 5, seat: 7 }, { row: 5, seat: 8 }], t)).toBe(
			'Ряд 5: места 7, 8'
		);
	});

	it('groups multiple rows with newline separator', () => {
		const result = formatSeatsSummary(
			[
				{ row: 4, seat: 4 },
				{ row: 5, seat: 7 },
				{ row: 5, seat: 8 },
				{ row: 6, seat: 6 }
			],
			t
		);
		expect(result).toBe('Ряд 4: место 4\nРяд 5: места 7, 8\nРяд 6: место 6');
	});

	it('sorts rows ascending and seats ascending within a row', () => {
		expect(
			formatSeatsSummary(
				[
					{ row: 6, seat: 3 },
					{ row: 5, seat: 8 },
					{ row: 5, seat: 7 }
				],
				t
			)
		).toBe('Ряд 5: места 7, 8\nРяд 6: место 3');
	});

	it('returns an empty string for empty input', () => {
		expect(formatSeatsSummary([], t)).toBe('');
	});
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `bun run test src/lib/utils/seat-label.test.ts`

Expected: FAIL with `formatSeatsSummary is not exported` (or similar).

- [ ] **Step 1.3: Implement `formatSeatsSummary`**

Replace contents of `src/lib/utils/seat-label.ts` with:

```ts
import type { AvailableSeatEntity } from '@/api/model';
import { groupSeatsByRow } from '@/lib/utils/group-seats';

export const mapSeatIdsToLabels = (
	seatIds: string[],
	seats: AvailableSeatEntity[] | undefined
): string[] => {
	if (!seats) return [];
	const byId = new Map(seats.map((s) => [s.id, s]));
	return seatIds
		.map((id) => byId.get(id))
		.filter((s): s is AvailableSeatEntity => Boolean(s))
		.map((s) => `${s.rowNumber}-${s.seatNumber}`);
};

interface SeatLike {
	row: number;
	seat: number;
}

type Translator = (
	key: string,
	opts?: {
		values?: Record<string, string | number | boolean | Date | null | undefined>;
	}
) => string;

export const formatSeatsSummary = (seats: SeatLike[], t: Translator): string => {
	if (seats.length === 0) return '';
	const grouped = groupSeatsByRow(
		seats.map((s) => ({ rowNumber: s.row, seatNumber: s.seat }))
	);
	return grouped
		.map((row) =>
			t(row.seats.length === 1 ? 'ticket.rowSeat' : 'ticket.rowSeats', {
				values: { row: row.row, seats: row.seats.join(', ') }
			})
		)
		.join('\n');
};
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `bun run test src/lib/utils/seat-label.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 1.5: Run typecheck**

Run: `bun run check`

Expected: zero errors. Existing `mapSeatIdsToLabels` consumers must still compile.

- [ ] **Step 1.6: Commit**

```bash
git add src/lib/utils/seat-label.ts src/lib/utils/seat-label.test.ts
git commit -m "feat(utils): formatSeatsSummary builds localized multi-row seat string"
```

---

## Task 2: Refactor `SeatsSummary.svelte` to delegate to `formatSeatsSummary` (DRY)

**Why:** Existing `SeatsSummary.svelte` builds row-by-row strings inline. After Task 1, the same logic lives in a tested helper. Delegating removes duplication.

**Files:**
- Modify: `src/components/booking/SeatsSummary.svelte`

- [ ] **Step 2.1: Replace SeatsSummary internals**

Replace contents of `src/components/booking/SeatsSummary.svelte` with:

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { formatSeatsSummary } from '@/lib/utils/seat-label';

	interface SeatLike {
		rowNumber: number;
		seatNumber: number;
	}
	interface BookingSeatLike {
		seat?: SeatLike;
	}

	interface Props {
		seats: BookingSeatLike[];
	}
	const { seats }: Props = $props();

	const flat = $derived(
		seats
			.map((bs) => bs.seat)
			.filter((s): s is SeatLike => !!s)
			.map((s) => ({ row: s.rowNumber, seat: s.seatNumber }))
	);

	const lines = $derived(formatSeatsSummary(flat, $_).split('\n').filter(Boolean));
</script>

<div class="seats_summary">
	{#each lines as line}
		<span class="seats_summary_row">{line}</span>
	{/each}
</div>

<style lang="scss">
	.seats_summary {
		display: flex;
		flex-direction: column;
		gap: 4px;

		.seats_summary_row {
			color: var(--foreground);
			font-weight: 500;
		}
	}
</style>
```

- [ ] **Step 2.2: Typecheck**

Run: `bun run check`

Expected: zero errors.

- [ ] **Step 2.3: Manual UI verification**

Run: `bun run dev` (in another terminal). Open a booking confirmation page that has multi-row seats (e.g., master QR tab on `/booking/{id}/confirmation`). Verify that the seats summary still renders identically to before — same lines, same translations, same gap. Test both ru and en locales via the language switcher.

- [ ] **Step 2.4: Commit**

```bash
git add src/components/booking/SeatsSummary.svelte
git commit -m "refactor(booking): SeatsSummary delegates to formatSeatsSummary"
```

---

## Task 3: Add i18n keys for the lightbox

**Why:** All five locales must include the new keys before any consumer code references them — otherwise `$_()` falls back to the key path, which looks broken in production.

**Files:**
- Modify: `src/lib/i18n/locales/ru.json`
- Modify: `src/lib/i18n/locales/en.json`
- Modify: `src/lib/i18n/locales/ky.json`
- Modify: `src/lib/i18n/locales/kz.json`
- Modify: `src/lib/i18n/locales/uz.json`

- [ ] **Step 3.1: Add keys to `ru.json`**

Inside the existing `"ticket": { ... }` block, add (preserving existing keys):

```json
"preview": "Просмотр билета",
"openPreview": "Увеличить QR-код",
"closePreview": "Закрыть",
"previousSlide": "Предыдущий билет",
"nextSlide": "Следующий билет",
"slideCounter": "{current} из {total}"
```

- [ ] **Step 3.2: Add keys to `en.json`**

```json
"preview": "Ticket preview",
"openPreview": "Open QR preview",
"closePreview": "Close preview",
"previousSlide": "Previous ticket",
"nextSlide": "Next ticket",
"slideCounter": "{current} of {total}"
```

- [ ] **Step 3.3: Add keys to `ky.json`**

```json
"preview": "Билетти кароо",
"openPreview": "QR-кодду ачуу",
"closePreview": "Жабуу",
"previousSlide": "Мурунку билет",
"nextSlide": "Кийинки билет",
"slideCounter": "{current} / {total}"
```

- [ ] **Step 3.4: Add keys to `kz.json`**

```json
"preview": "Билетті көру",
"openPreview": "QR-кодты ашу",
"closePreview": "Жабу",
"previousSlide": "Алдыңғы билет",
"nextSlide": "Келесі билет",
"slideCounter": "{total} ішінен {current}"
```

- [ ] **Step 3.5: Add keys to `uz.json`**

```json
"preview": "Chiptani ko'rish",
"openPreview": "QR-kodni ochish",
"closePreview": "Yopish",
"previousSlide": "Oldingi chipta",
"nextSlide": "Keyingi chipta",
"slideCounter": "{total} dan {current}"
```

- [ ] **Step 3.6: Verify JSON validity**

Run: `node -e "['ru','en','ky','kz','uz'].forEach(l => JSON.parse(require('fs').readFileSync('src/lib/i18n/locales/' + l + '.json','utf8')))"`

Expected: no output, exit code 0. (Any syntax error throws.)

- [ ] **Step 3.7: Commit**

```bash
git add src/lib/i18n/locales/
git commit -m "feat(i18n): ticket lightbox keys for all locales"
```

---

## Task 4: Build the generic `Lightbox.svelte` primitive

**Why:** This is the heart of the feature. Every later task consumes it.

**Files:**
- Create: `src/components/ui/Lightbox.svelte`

- [ ] **Step 4.1: Create the file**

Create `src/components/ui/Lightbox.svelte` with the complete contents below. The component is generic over an item type `T`.

```svelte
<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import Icon from '@iconify/svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		open: boolean;
		onClose: () => void;
		items: T[];
		startIndex?: number;
		ariaLabel?: string;
		slide: Snippet<[item: T, index: number]>;
		caption?: Snippet<[item: T, index: number]>;
	}

	const {
		open,
		onClose,
		items,
		startIndex = 0,
		ariaLabel,
		slide,
		caption
	}: Props = $props();

	const clampedStart = $derived(
		Math.max(0, Math.min(items.length - 1, startIndex))
	);

	let currentIdx = $state(0);
	let exiting = $state(false);
	let trackEl: HTMLDivElement | null = $state(null);
	let previouslyFocused: HTMLElement | null = null;
	const slideEls: HTMLDivElement[] = [];

	const isMulti = $derived(items.length > 1);

	const scrollToIdx = (idx: number, behavior: ScrollBehavior = 'smooth'): void => {
		if (!trackEl) return;
		const w = trackEl.clientWidth;
		trackEl.scrollTo({ left: idx * w, behavior });
	};

	const goPrev = (): void => {
		if (currentIdx > 0) scrollToIdx(currentIdx - 1);
	};

	const goNext = (): void => {
		if (currentIdx < items.length - 1) scrollToIdx(currentIdx + 1);
	};

	const close = (): void => {
		if (exiting) return;
		exiting = true;
		setTimeout(() => {
			exiting = false;
			onClose();
		}, 220);
	};

	const handlePositionerMouseDown = (e: MouseEvent): void => {
		if (e.target === e.currentTarget) close();
	};

	$effect(() => {
		if (!open) return;

		previouslyFocused = (document.activeElement as HTMLElement) ?? null;
		document.body.style.overflow = 'hidden';
		currentIdx = clampedStart;

		const onKey = (e: KeyboardEvent): void => {
			if (exiting) return;
			if (e.key === 'Escape') close();
			else if (e.key === 'ArrowLeft' && isMulti) goPrev();
			else if (e.key === 'ArrowRight' && isMulti) goNext();
		};
		window.addEventListener('keydown', onKey);

		queueMicrotask(() => scrollToIdx(clampedStart, 'instant'));

		return () => {
			document.body.style.overflow = '';
			window.removeEventListener('keydown', onKey);
			previouslyFocused?.focus?.();
			previouslyFocused = null;
		};
	});

	$effect(() => {
		if (!open || !trackEl || !isMulti) return;

		const observer = new IntersectionObserver(
			(entries) => {
				let bestIdx = currentIdx;
				let bestRatio = 0;
				for (const entry of entries) {
					if (entry.intersectionRatio > bestRatio) {
						bestRatio = entry.intersectionRatio;
						const idxAttr = (entry.target as HTMLElement).dataset.idx;
						if (idxAttr) bestIdx = Number(idxAttr);
					}
				}
				if (bestRatio > 0) currentIdx = bestIdx;
			},
			{ root: trackEl, threshold: [0.5, 0.75, 1] }
		);

		slideEls.length = items.length;
		for (const el of slideEls) {
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	});

	$effect(() => {
		if (!open || !trackEl) return;
		const onResize = (): void => {
			scrollToIdx(currentIdx, 'instant');
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
</script>

{#if open || exiting}
	<div class="Lightbox">
		<div class="backdrop" class:exiting></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="positioner"
			onmousedown={handlePositionerMouseDown}
			role="dialog"
			aria-modal="true"
			aria-label={ariaLabel}
			tabindex="-1"
		>
			<div class="chrome" class:exiting>
				<button
					type="button"
					class="close_btn"
					onclick={close}
					aria-label={$_('ticket.closePreview')}
				>
					<Icon icon="lucide:x" width={28} />
				</button>
				{#if isMulti}
					<span class="counter">
						{$_('ticket.slideCounter', {
							values: { current: currentIdx + 1, total: items.length }
						})}
					</span>
				{/if}
			</div>

			{#if isMulti}
				<button
					type="button"
					class="arrow arrow_prev"
					onclick={goPrev}
					aria-label={$_('ticket.previousSlide')}
					disabled={currentIdx === 0}
				>
					<Icon icon="lucide:chevron-left" width={28} />
				</button>
				<button
					type="button"
					class="arrow arrow_next"
					onclick={goNext}
					aria-label={$_('ticket.nextSlide')}
					disabled={currentIdx === items.length - 1}
				>
					<Icon icon="lucide:chevron-right" width={28} />
				</button>
			{/if}

			<div class="track" bind:this={trackEl} class:exiting>
				{#each items as item, i (i)}
					<div
						class="slide"
						data-idx={i}
						bind:this={slideEls[i]}
					>
						{@render slide(item, i)}
					</div>
				{/each}
			</div>

			{#if caption}
				<div class="caption_strip" class:exiting>
					{@render caption(items[currentIdx], currentIdx)}
				</div>
			{/if}

			{#if isMulti}
				<div class="dots" class:exiting>
					{#each items as _item, i (i)}
						<button
							type="button"
							class="dot"
							class:active={i === currentIdx}
							onclick={() => scrollToIdx(i)}
							aria-label={$_('ticket.slideCounter', {
							values: { current: i + 1, total: items.length }
						})}
						></button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	.Lightbox {
		.backdrop {
			position: fixed;
			inset: 0;
			z-index: 1000;
			background: rgba(0, 0, 0, 0.85);
			backdrop-filter: blur(8px);
			opacity: 1;
			transition: opacity 220ms ease;

			@starting-style {
				opacity: 0;
			}

			&.exiting {
				opacity: 0;
			}
		}

		.positioner {
			position: fixed;
			inset: 0;
			z-index: 1001;
			display: grid;
			grid-template-rows: auto 1fr auto auto;
			align-items: center;
		}

		.chrome {
			position: absolute;
			top: var(--space-4);
			right: var(--space-4);
			display: flex;
			align-items: center;
			gap: var(--space-3);
			z-index: 2;
			opacity: 1;
			transition: opacity 220ms ease;

			@starting-style {
				opacity: 0;
			}

			&.exiting {
				opacity: 0;
			}

			.counter {
				color: var(--foreground);
				font-size: var(--text-sm);
				background: rgba(0, 0, 0, 0.6);
				padding: 6px 10px;
				border-radius: 999px;
			}

			.close_btn {
				width: 44px;
				height: 44px;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 50%;
				border: 1px solid var(--border-color);
				background: rgba(0, 0, 0, 0.6);
				color: var(--foreground);
				cursor: pointer;
				transition: background var(--duration-fast) var(--ease-default);

				&:hover {
					background: rgba(255, 255, 255, 0.1);
				}

				&:focus-visible {
					outline: 2px solid var(--primary);
					outline-offset: 4px;
				}
			}
		}

		.arrow {
			position: absolute;
			top: 50%;
			transform: translateY(-50%);
			width: 48px;
			height: 48px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 50%;
			border: 1px solid var(--border-color);
			background: rgba(0, 0, 0, 0.6);
			color: var(--foreground);
			cursor: pointer;
			z-index: 2;
			transition: background var(--duration-fast) var(--ease-default);

			&:hover:not(:disabled) {
				background: rgba(255, 255, 255, 0.1);
			}

			&:disabled {
				opacity: 0.3;
				cursor: default;
			}

			&:focus-visible {
				outline: 2px solid var(--primary);
				outline-offset: 4px;
			}

			@media (max-width: 640px) {
				display: none;
			}

			&.arrow_prev {
				left: var(--space-4);
			}
			&.arrow_next {
				right: var(--space-4);
			}
		}

		.track {
			grid-row: 2 / 3;
			display: flex;
			overflow-x: auto;
			overflow-y: hidden;
			scroll-snap-type: x mandatory;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
			width: 100vw;
			height: 100%;
			opacity: 1;
			transform: scale(1) translateY(0);
			transition:
				opacity 220ms ease,
				transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);

			&::-webkit-scrollbar {
				display: none;
			}

			@starting-style {
				opacity: 0;
				transform: scale(0.96) translateY(8px);
			}

			&.exiting {
				opacity: 0;
				transform: scale(0.96) translateY(8px);
				transition-timing-function: ease, ease;
			}
		}

		.slide {
			width: 100vw;
			height: 100%;
			flex-shrink: 0;
			scroll-snap-align: center;
			scroll-snap-stop: always;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: var(--space-4);
		}

		.caption_strip {
			grid-row: 3 / 4;
			background: rgba(0, 0, 0, 0.6);
			backdrop-filter: blur(12px);
			padding: var(--space-3);
			color: var(--foreground);
			text-align: center;
			z-index: 2;
			opacity: 1;
			transition: opacity 220ms ease;

			@starting-style {
				opacity: 0;
			}

			&.exiting {
				opacity: 0;
			}
		}

		.dots {
			grid-row: 4 / 5;
			display: flex;
			justify-content: center;
			gap: 8px;
			padding: var(--space-3);
			background: rgba(0, 0, 0, 0.4);
			z-index: 2;
			opacity: 1;
			transition: opacity 220ms ease;

			@starting-style {
				opacity: 0;
			}

			&.exiting {
				opacity: 0;
			}

			.dot {
				width: 10px;
				height: 10px;
				border-radius: 50%;
				border: 0;
				padding: 0;
				background: var(--muted-fg);
				opacity: 0.4;
				cursor: pointer;
				transition: opacity var(--duration-fast) var(--ease-default),
					background var(--duration-fast) var(--ease-default);

				&.active {
					background: var(--primary);
					opacity: 1;
				}

				&:focus-visible {
					outline: 2px solid var(--primary);
					outline-offset: 4px;
				}
			}
		}
	}
</style>
```

**Notes for the implementer:**
- The component uses Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) and Snippet typing.
- `slideEls` is a plain (non-rune) array because we only need stable refs for `IntersectionObserver`; we don't read it reactively elsewhere.
- `previouslyFocused?.focus?.()` runs in the `return ()` cleanup of the open-effect, which fires when `open` flips to `false`. That's how we restore focus to the trigger.
- `queueMicrotask` ensures the DOM is mounted before the initial `scrollToIdx`.
- Using `inset: 0` + `position: fixed` works under iOS Safari with `100dvh` implicitly (no explicit height needed because of `inset: 0`).

- [ ] **Step 4.2: Typecheck**

Run: `bun run check`

Expected: zero errors. The `generics="T"` syntax is supported by `svelte-check`.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/ui/Lightbox.svelte
git commit -m "feat(ui): Lightbox primitive with snippet slot, scroll-snap slider, IO-tracked index"
```

---

## Task 5: Build the `QrPreviewLightbox.svelte` wrapper

**Why:** Single place that knows how to render QR + caption + Badge + Share. Used by all three integration points.

**Files:**
- Create: `src/components/booking/qr-slide-item.ts`
- Create: `src/components/booking/QrPreviewLightbox.svelte`

- [ ] **Step 5.1: Create the type file**

Create `src/components/booking/qr-slide-item.ts`:

```ts
export interface QrSlideItem {
	qrValue: string;
	captionText: string;
	statusText: string;
	statusColor: string;
	shareUrl: string;
	shareTitle?: string;
}
```

This lives outside the `.svelte` so consumers (`TicketTabsMaster`, `TicketTabsIndividual`, the public ticket route) can `import type { QrSlideItem }` without pulling in the component runtime.

- [ ] **Step 5.2: Create the wrapper**

Create `src/components/booking/QrPreviewLightbox.svelte`:

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Lightbox from '@/components/ui/Lightbox.svelte';
	import QrCode from '@/components/ui/QrCode.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import ShareButton from '@/components/booking/ShareButton.svelte';
	import type { QrSlideItem } from '@/components/booking/qr-slide-item';

	interface Props {
		open: boolean;
		onClose: () => void;
		items: QrSlideItem[];
		startIndex?: number;
	}

	const { open, onClose, items, startIndex = 0 }: Props = $props();

	let innerW = $state(0);
	let innerH = $state(0);

	const qrSize = $derived(
		Math.max(240, Math.min(520, Math.floor(Math.min(innerW || 0, innerH || 0) * 0.7)))
	);

	const guardedOpen = $derived(open && items.length > 0);
</script>

<svelte:window bind:innerWidth={innerW} bind:innerHeight={innerH} />

<Lightbox
	open={guardedOpen}
	{onClose}
	{items}
	{startIndex}
	ariaLabel={$_('ticket.preview')}
>
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

<style lang="scss">
	.qr_caption {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);

		.caption_text {
			margin: 0;
			color: var(--foreground);
			font-size: var(--text-base);
			font-weight: var(--weight-semibold);
			white-space: pre-line;
		}
	}
</style>
```

**Notes:**
- `white-space: pre-line` lets the master caption render multiple rows on separate lines (because `formatSeatsSummary` joins with `\n`).
- `innerW || 0` defends against the brief moment between SSR hydration and the first `bind:innerWidth` value (which would otherwise yield `NaN`).
- `QrSlideItem` lives in `qr-slide-item.ts` so consumers can `import type` it without pulling component runtime.

- [ ] **Step 5.3: Typecheck**

Run: `bun run check`

Expected: zero errors.

- [ ] **Step 5.4: Commit**

```bash
git add src/components/booking/qr-slide-item.ts src/components/booking/QrPreviewLightbox.svelte
git commit -m "feat(booking): QrPreviewLightbox wrapper renders QR + caption + status + share"
```

---

## Task 6: Wire the master QR (`TicketTabsMaster.svelte`) to the lightbox

**Files:**
- Modify: `src/components/booking/TicketTabsMaster.svelte`

- [ ] **Step 6.1: Replace the file contents**

Replace contents of `src/components/booking/TicketTabsMaster.svelte` with:

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import QrCode from '@/components/ui/QrCode.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import SeatsSummary from '@/components/booking/SeatsSummary.svelte';
	import ShareButton from '@/components/booking/ShareButton.svelte';
	import QrPreviewLightbox from '@/components/booking/QrPreviewLightbox.svelte';
	import { formatSeatsSummary } from '@/lib/utils/seat-label';

	interface Seat {
		row: number;
		seat: number;
		status: string;
	}
	interface Props {
		viewerUrl: string;
		seats: Seat[];
	}

	const { viewerUrl, seats }: Props = $props();

	const usedCount = $derived(seats.filter((s) => s.status === 'USED').length);
	const total = $derived(seats.length);

	const summary = $derived.by(() => {
		if (usedCount === 0) return { key: 'booking.ticketStatus.VALID', color: 'var(--success)' };
		if (usedCount === total) return { key: 'booking.ticketStatus.USED', color: 'var(--muted-fg)' };
		return { key: 'ticket.statusPartiallyUsed', color: 'var(--warning)' };
	});

	const seatsFlat = $derived(seats.map((s) => ({ row: s.row, seat: s.seat })));

	const seatsForSummary = $derived(
		seatsFlat.map((s) => ({ seat: { rowNumber: s.row, seatNumber: s.seat } }))
	);

	let lightboxOpen = $state(false);

	const lightboxItems = $derived([
		{
			qrValue: viewerUrl,
			captionText: formatSeatsSummary(seatsFlat, $_),
			statusText: $_(summary.key, { values: { count: usedCount, total } }),
			statusColor: summary.color,
			shareUrl: viewerUrl
		}
	]);
</script>

<div class="master_tab">
	<button
		type="button"
		class="qr_btn"
		onclick={() => (lightboxOpen = true)}
		aria-label={$_('ticket.openPreview')}
	>
		<QrCode value={viewerUrl} size={240} />
	</button>
	<SeatsSummary seats={seatsForSummary} />
	<Badge
		text={$_(summary.key, { values: { count: usedCount, total } })}
		color={summary.color}
	/>
	<p class="hint">{$_('ticket.entryWithThisQr')}</p>
	<ShareButton url={viewerUrl} title={$_('ticket.share')} />
</div>

<QrPreviewLightbox
	open={lightboxOpen}
	onClose={() => (lightboxOpen = false)}
	items={lightboxItems}
/>

<style lang="scss">
	.master_tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);

		.qr_btn {
			background: transparent;
			border: 0;
			padding: 0;
			cursor: zoom-in;
			border-radius: var(--radius-md);

			&:focus-visible {
				outline: 2px solid var(--primary);
				outline-offset: 4px;
			}
		}

		.hint {
			color: var(--muted-fg);
			font-size: var(--text-sm);
			text-align: center;
			margin: 0;
		}
	}
</style>
```

- [ ] **Step 6.2: Typecheck**

Run: `bun run check`

Expected: zero errors.

- [ ] **Step 6.3: Manual verify**

`bun run dev`, open a confirmed booking's `/booking/{id}/confirmation`, «Общий QR» tab. Tap the QR. Expect:
- Fullscreen overlay with backdrop blur.
- QR enlarged (200–520px depending on viewport).
- Caption shows multi-line «Ряд X: место Y» summary, status badge, Share button.
- No counter/dots/arrows (single slide).
- ESC, X, tap-on-backdrop all close. Body scroll is locked while open. Focus returns to the trigger.

- [ ] **Step 6.4: Commit**

```bash
git add src/components/booking/TicketTabsMaster.svelte
git commit -m "feat(booking): tap master QR to open enlarged preview"
```

---

## Task 7: Make `SeatTicketCard` open externally

**Why:** Lightbox state for the per-seat slider must live in the parent (so swipe between seats works). The card becomes a presentation-only view that triggers an `onOpen` callback.

**Files:**
- Modify: `src/components/booking/SeatTicketCard.svelte`

- [ ] **Step 7.1: Replace the file contents**

Replace contents of `src/components/booking/SeatTicketCard.svelte` with:

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import QrCode from '@/components/ui/QrCode.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import ShareButton from '@/components/booking/ShareButton.svelte';
	import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';

	interface Props {
		row: number;
		seat: number;
		qrCode: string;
		status: string;
		origin: string;
		onOpen?: () => void;
	}

	const { row, seat, qrCode, status, origin, onOpen }: Props = $props();

	const url = $derived(`${origin}/t/${qrCode}`);
	const seatLabel = $derived(
		$_('ticket.rowSeat', { values: { row, seats: seat } })
	);
	const statusConfig = $derived(
		TICKET_STATUS_CONFIG[status] ?? {
			labelKey: `booking.ticketStatus.${status}`,
			color: 'var(--muted-fg)'
		}
	);
</script>

<div class="seat_ticket_card">
	{#if onOpen}
		<button
			type="button"
			class="qr_btn"
			onclick={onOpen}
			aria-label={$_('ticket.openPreview')}
		>
			<QrCode value={url} size={140} />
		</button>
	{:else}
		<QrCode value={url} size={140} />
	{/if}
	<div class="seat_label">{seatLabel}</div>
	<Badge text={$_(statusConfig.labelKey)} color={statusConfig.color} />
	<ShareButton {url} iconOnly />
</div>

<style lang="scss">
	.seat_ticket_card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--surface);
		border: 1px solid var(--border-color);

		.qr_btn {
			background: transparent;
			border: 0;
			padding: 0;
			cursor: zoom-in;
			border-radius: var(--radius-md);

			&:focus-visible {
				outline: 2px solid var(--primary);
				outline-offset: 4px;
			}
		}

		.seat_label {
			font-size: var(--text-sm);
			font-weight: var(--weight-semibold);
			color: var(--foreground);
		}
	}
</style>
```

**Notes:**
- `onOpen?: () => void` is optional. If absent, the card renders the QR without a button wrapper (back-compat for any consumer that doesn't want preview behavior). All current callers will pass it.

- [ ] **Step 7.2: Typecheck**

Run: `bun run check`

Expected: zero errors.

- [ ] **Step 7.3: Commit**

```bash
git add src/components/booking/SeatTicketCard.svelte
git commit -m "refactor(booking): SeatTicketCard accepts external onOpen for QR preview"
```

---

## Task 8: Wire individual seats grid to the slider lightbox

**Files:**
- Modify: `src/components/booking/TicketTabsIndividual.svelte`

- [ ] **Step 8.1: Replace the file contents**

Replace contents of `src/components/booking/TicketTabsIndividual.svelte` with:

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import SeatTicketCard from '@/components/booking/SeatTicketCard.svelte';
	import QrPreviewLightbox from '@/components/booking/QrPreviewLightbox.svelte';
	import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';

	interface Seat {
		row: number;
		seat: number;
		qrCode: string;
		status: string;
	}
	interface Props {
		seats: Seat[];
		origin: string;
	}

	const { seats, origin }: Props = $props();

	let openIdx = $state<number | null>(null);

	const lightboxItems = $derived(
		seats.map((s) => {
			const cfg =
				TICKET_STATUS_CONFIG[s.status] ?? {
					labelKey: `booking.ticketStatus.${s.status}`,
					color: 'var(--muted-fg)'
				};
			const url = `${origin}/t/${s.qrCode}`;
			return {
				qrValue: url,
				captionText: $_('ticket.rowSeat', {
					values: { row: s.row, seats: s.seat }
				}),
				statusText: $_(cfg.labelKey),
				statusColor: cfg.color,
				shareUrl: url
			};
		})
	);
</script>

<div class="grid">
	{#each seats as seat, i (seat.qrCode)}
		<SeatTicketCard
			row={seat.row}
			seat={seat.seat}
			qrCode={seat.qrCode}
			status={seat.status}
			{origin}
			onOpen={() => (openIdx = i)}
		/>
	{/each}
</div>

<QrPreviewLightbox
	open={openIdx !== null}
	onClose={() => (openIdx = null)}
	items={lightboxItems}
	startIndex={openIdx ?? 0}
/>

<style lang="scss">
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-3);
	}
</style>
```

- [ ] **Step 8.2: Typecheck**

Run: `bun run check`

Expected: zero errors.

- [ ] **Step 8.3: Manual verify**

`bun run dev`, open `/booking/{id}/confirmation`, switch to «По местам» tab. Tap seat #1. Expect:
- Lightbox opens at slide 0 with that seat's QR.
- Counter «1 of 4» (or your locale equivalent) in the top-right.
- Arrow buttons on desktop ≥641px; not visible on narrow.
- Dots strip at the bottom; active dot is `--primary`.
- Swipe left/right on touch / arrow keys / arrow buttons / dots all navigate.
- Caption updates to the active slide.
- Close via ESC / X / backdrop tap. Reset `openIdx` to null.

- [ ] **Step 8.4: Commit**

```bash
git add src/components/booking/TicketTabsIndividual.svelte
git commit -m "feat(booking): tap seat QR to open slider preview across all seats"
```

---

## Task 9: Wire the public single-seat ticket page

**Files:**
- Modify: `src/routes/t/[qrCode]/+page.svelte`

- [ ] **Step 9.1: Replace the file contents**

Replace contents of `src/routes/t/[qrCode]/+page.svelte` with:

```svelte
<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import Badge from '@/components/ui/Badge.svelte';
	import QrCode from '@/components/ui/QrCode.svelte';
	import ShareButton from '@/components/booking/ShareButton.svelte';
	import QrPreviewLightbox from '@/components/booking/QrPreviewLightbox.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { formatDateTime } from '@/lib/utils/datetime';
	import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const ticket = $derived(data.ticket);
	const movieTitle = $derived(getLocalizedValue(ticket.movie.title, $locale));
	const branchName = $derived(getLocalizedValue(ticket.branch.name, $locale));

	const url = $derived(typeof window !== 'undefined' ? window.location.href : '');

	const statusConfig = $derived(
		TICKET_STATUS_CONFIG[ticket.status] ?? {
			labelKey: `booking.ticketStatus.${ticket.status}`,
			color: 'var(--muted-fg)'
		}
	);

	let lightboxOpen = $state(false);

	const lightboxItems = $derived([
		{
			qrValue: url,
			captionText: $_('ticket.rowSeat', {
				values: { row: ticket.seat.row, seats: ticket.seat.seat }
			}),
			statusText: $_(statusConfig.labelKey),
			statusColor: statusConfig.color,
			shareUrl: url,
			shareTitle: movieTitle
		}
	]);
</script>

<svelte:head><title>{movieTitle} — ZeroWaiting</title></svelte:head>

<article class="public_ticket_card glass-card">
	{#if ticket.movie.posterUrl}
		<img class="poster" src={ticket.movie.posterUrl} alt="" />
	{/if}
	<h1 class="title">{movieTitle}</h1>
	<p class="meta">{branchName} · {ticket.hall.name} · {formatDateTime(ticket.startTime)}</p>

	<button
		type="button"
		class="qr_btn"
		onclick={() => (lightboxOpen = true)}
		aria-label={$_('ticket.openPreview')}
	>
		<QrCode value={url} size={220} />
	</button>
	<div class="seat">
		{$_('ticket.rowSeat', { values: { row: ticket.seat.row, seats: ticket.seat.seat } })}
	</div>

	<Badge text={$_(statusConfig.labelKey)} color={statusConfig.color} />
	{#if ticket.status === 'USED' && ticket.scannedAt}
		<p class="scanned_at">
			{$_('publicTicket.statusUsedAt', {
				values: { time: formatDateTime(ticket.scannedAt) }
			})}
		</p>
	{/if}

	<ShareButton {url} title={movieTitle} />
</article>

<QrPreviewLightbox
	open={lightboxOpen}
	onClose={() => (lightboxOpen = false)}
	items={lightboxItems}
/>

<style lang="scss">
	.public_ticket_card {
		max-width: 420px;
		margin: 0 auto;
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		text-align: center;

		.poster { max-width: 180px; border-radius: var(--radius-md); }
		.title { font-size: var(--text-xl); font-weight: var(--weight-bold); margin: 0; }
		.meta { color: var(--muted-fg); font-size: var(--text-sm); margin: 0; }
		.qr_btn {
			background: transparent;
			border: 0;
			padding: 0;
			cursor: zoom-in;
			border-radius: var(--radius-md);

			&:focus-visible {
				outline: 2px solid var(--primary);
				outline-offset: 4px;
			}
		}
		.seat { font-weight: var(--weight-semibold); }
		.scanned_at { color: var(--muted-fg); font-size: var(--text-sm); margin: 0; }
	}
</style>
```

- [ ] **Step 9.2: Typecheck**

Run: `bun run check`

Expected: zero errors.

- [ ] **Step 9.3: Manual verify**

`bun run dev`. Open a public ticket URL `/t/{qrCode}` (you can grab one by copying a URL from the per-seat tab in a real booking). Tap the QR. Expect:
- 1-slide lightbox with the same enlarged QR.
- Caption «Ряд X: место Y», status badge, Share button.
- No arrows/dots/counter.
- Close via ESC / X / backdrop.

- [ ] **Step 9.4: Commit**

```bash
git add src/routes/t/[qrCode]/+page.svelte
git commit -m "feat(routes): tap public ticket QR to open enlarged preview"
```

---

## Task 10: End-to-end manual verification + cleanup

**Files:** none (verification only).

- [ ] **Step 10.1: Final typecheck**

Run: `bun run check`

Expected: zero errors, zero warnings beyond what was already present on `main`.

- [ ] **Step 10.2: Final test run**

Run: `bun run test`

Expected: all tests pass, including the 5 new `formatSeatsSummary` tests.

- [ ] **Step 10.3: Cross-browser manual verification**

Run: `bun run dev`. Verify in:

- **Desktop Chrome:** master tab + individual tab + public ticket. ESC, click X, click backdrop, click arrows, click dots, arrow keys, mouse-wheel/trackpad swipe between slides.
- **Desktop narrow viewport (≤640px width via DevTools device toolbar):** arrows must be hidden; dots and swipe still work; QR enlarges only up to viewport bound.
- **Mobile Safari (real device or Responsive Design Mode):** touch swipe between slides; tap-on-backdrop closes; body scroll behind lightbox does not happen.
- **Locale switch:** open lightbox, change locale via the language switcher (closes the page or modal — verify the keys all show translated text in `ru`, `en`, `ky`, `kz`, `uz`).

- [ ] **Step 10.4: Verify no stylesheet leakage**

Run: `bun run check` and visually compare a non-lightbox page (admin or movie list) before/after — there should be no stray fixed-positioned elements, no body-overflow stuck on `hidden`.

- [ ] **Step 10.5: Final cleanup**

Confirm:
- No `console.log`, `debugger`.
- No new `:global()` selectors with generic class names.
- All new files use `@/` aliased imports, `underscore_case` SCSS, arrow functions only.

If any cleanup needed, do it as a `chore: ...` commit. Otherwise nothing to commit.

---

## Done condition

- All 10 tasks committed.
- `bun run check` clean.
- `bun run test` clean (5 new unit tests for `formatSeatsSummary`).
- Tap on any QR on `/booking/{id}/confirmation` (master or seat tab) and on `/t/{qrCode}` opens the lightbox.
- Per-seat lightbox swipes through all seats; master and public are single-slide.
- Caption shows row/seat (or seats summary) + status badge + Share button.
- ESC, X, backdrop tap, arrow keys, arrows, dots all behave as specified.
- Body scroll locked while open; focus restored on close.
- All five locales render new keys correctly.
