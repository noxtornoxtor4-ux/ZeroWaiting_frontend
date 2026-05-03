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

	const portal = (node: HTMLElement) => {
		document.body.appendChild(node);
		return {
			destroy: () => {
				if (node.parentNode === document.body) document.body.removeChild(node);
			}
		};
	};

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

	$effect(() => {
		const max = Math.max(0, items.length - 1);
		if (currentIdx > max) currentIdx = max;
	});

	const scrollToIdx = (
		idx: number,
		behavior: ScrollBehavior = 'smooth'
	): void => {
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
	<div class="Lightbox" use:portal>
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
				{#if isMulti}
					<span class="counter">
						{$_('ticket.slideCounter', {
							values: { current: currentIdx + 1, total: items.length }
						})}
					</span>
				{/if}
				<button
					type="button"
					class="close_btn"
					onclick={close}
					aria-label={$_('ticket.closePreview')}
				>
					<Icon icon="lucide:x" width={28} />
				</button>
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
					<div class="slide" data-idx={i} bind:this={slideEls[i]}>
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
			will-change: opacity;

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
				transition:
					opacity var(--duration-fast) var(--ease-default),
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
