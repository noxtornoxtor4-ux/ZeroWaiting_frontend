<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import {
		computePosition,
		autoUpdate,
		offset,
		flip,
		shift
	} from '@floating-ui/dom';

	interface Props {
		placement?:
			| 'bottom'
			| 'bottom-start'
			| 'bottom-end'
			| 'top'
			| 'top-start'
			| 'top-end';
		open?: boolean;
		children: Snippet;
		content: Snippet;
	}

	let {
		placement = 'bottom-end',
		open = $bindable(false),
		children,
		content
	}: Props = $props();

	let triggerRef = $state<HTMLDivElement | null>(null);
	let popoverRef = $state<HTMLDivElement | null>(null);
	let cleanupAutoUpdate: (() => void) | null = null;

	const applyPosition = async () => {
		if (!triggerRef || !popoverRef) return;

		const { x, y } = await computePosition(triggerRef, popoverRef, {
			strategy: 'absolute',
			placement,
			middleware: [offset(8), flip(), shift({ padding: 10 })]
		});

		popoverRef.style.left = `${x}px`;
		popoverRef.style.top = `${y}px`;
		popoverRef.style.pointerEvents = 'auto';
	};

	$effect(() => {
		if (open && triggerRef && popoverRef) {
			cleanupAutoUpdate = autoUpdate(triggerRef, popoverRef, applyPosition);
		} else {
			cleanupAutoUpdate?.();
			cleanupAutoUpdate = null;
		}

		return () => {
			cleanupAutoUpdate?.();
			cleanupAutoUpdate = null;
		};
	});

	const portal = (node: HTMLElement) => {
		document.body.appendChild(node);
		return {
			destroy() {
				if (document.body.contains(node)) document.body.removeChild(node);
			}
		};
	};

	const handleClickOutside = (e: MouseEvent) => {
		const path = e.composedPath();
		const inTrigger = triggerRef ? path.includes(triggerRef) : false;
		const inPopover = popoverRef ? path.includes(popoverRef) : false;
		if (!inTrigger && !inPopover) open = false;
	};

	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	});
</script>

<div
	bind:this={triggerRef}
	class="trigger-wrap"
	onclick={() => (open = !open)}
	role="button"
	tabindex="0"
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (open = !open)}
>
	{@render children()}
</div>

{#if open}
	<div
		use:portal
		bind:this={popoverRef}
		class="popover-content"
		onclick={() => (open = false)}
		onkeydown={(e) => e.key === 'Escape' && (open = false)}
		role="menu"
		tabindex="-1"
	>
		{@render content()}
	</div>
{/if}

<style>
	.trigger-wrap {
		display: inline-flex;
	}

	:global(.popover-content) {
		position: absolute;
		z-index: 9999;
	}
</style>
