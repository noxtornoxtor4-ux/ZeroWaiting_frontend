<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		computePosition,
		autoUpdate,
		offset,
		flip,
		shift
	} from '@floating-ui/dom';

	interface Props {
		text: string;
		placement?:
			| 'top'
			| 'top-start'
			| 'top-end'
			| 'bottom'
			| 'bottom-start'
			| 'bottom-end'
			| 'left'
			| 'right';
		stretch?: boolean;
		children: Snippet;
	}

	let { text, placement = 'top', stretch = false, children }: Props = $props();

	let triggerEl: HTMLElement | undefined = $state();
	let tooltipEl: HTMLElement | undefined = $state();
	let visible = $state(false);
	let cleanup: (() => void) | undefined;

	const show = () => {
		visible = true;
		if (triggerEl && tooltipEl) {
			cleanup = autoUpdate(triggerEl, tooltipEl, () => {
				if (triggerEl && tooltipEl) {
					computePosition(triggerEl, tooltipEl, {
						placement,
						middleware: [offset(8), flip(), shift({ padding: 8 })]
					}).then(({ x, y }) => {
						if (tooltipEl) {
							tooltipEl.style.left = `${x}px`;
							tooltipEl.style.top = `${y}px`;
						}
					});
				}
			});
		}
	};

	const hide = () => {
		visible = false;
		cleanup?.();
	};
</script>

<div
	class="tooltip-trigger"
	class:tooltip-trigger--stretch={stretch}
	role="group"
	bind:this={triggerEl}
	onmouseenter={show}
	onmouseleave={hide}
	onfocus={show}
	onblur={hide}
>
	{@render children()}
</div>

{#if visible}
	<div class="tooltip" bind:this={tooltipEl} role="tooltip">
		{text}
	</div>
{/if}

<style lang="scss">
	.tooltip-trigger {
		display: inline-flex;

		&--stretch {
			display: flex;
			width: 100%;
			height: 100%;
		}
	}

	.tooltip {
		position: fixed;
		z-index: 9999;
		padding: 6px 12px;
		background: var(--surface);
		border: 1px solid var(--border-color);
		color: var(--foreground);
		font-size: 12px;
		border-radius: 8px;
		white-space: nowrap;
		pointer-events: none;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
	}
</style>
