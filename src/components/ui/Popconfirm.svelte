<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import type { Snippet } from 'svelte';
	import {
		computePosition,
		autoUpdate,
		offset,
		flip,
		shift
	} from '@floating-ui/dom';

	interface Props {
		title?: string;
		description?: string;
		confirmText?: string;
		cancelText?: string;
		placement?:
			| 'top'
			| 'top-start'
			| 'top-end'
			| 'bottom'
			| 'bottom-start'
			| 'bottom-end'
			| 'left'
			| 'left-start'
			| 'left-end'
			| 'right'
			| 'right-start'
			| 'right-end';
		onConfirm: () => void;
		children: Snippet;
	}

	let {
		title = 'Вы уверены?',
		description,
		confirmText = 'Да',
		cancelText = 'Нет',
		placement = 'top',
		onConfirm,
		children
	}: Props = $props();

	let open = $state(false);
	let triggerRef = $state<HTMLSpanElement | null>(null);
	let popoverRef = $state<HTMLDivElement | null>(null);
	let cleanupAutoUpdate: (() => void) | null = null;

	const handleConfirm = () => {
		open = false;
		onConfirm();
	};

	const applyPosition = async () => {
		if (!triggerRef || !popoverRef) return;

		const { x, y } = await computePosition(triggerRef, popoverRef, {
			strategy: 'absolute',
			placement: 'bottom-start',
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

<span
	bind:this={triggerRef}
	class="trigger"
	role="button"
	tabindex="0"
	onclick={() => (open = !open)}
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (open = !open)}
>
	{@render children()}
</span>

{#if open}
	<div use:portal bind:this={popoverRef} class="popconfirm">
		<div class="popconfirm__inner">
			<div class="popconfirm__header">
				<Icon icon="lucide:circle-help" width={16} class="popconfirm-icon" />
				<span class="popconfirm__title">{title}</span>
			</div>
			{#if description}
				<p class="popconfirm__desc">{description}</p>
			{/if}
			<div class="popconfirm__actions">
				<button
					class="popconfirm__btn popconfirm__btn--cancel"
					type="button"
					onmousedown={(e) => e.preventDefault()}
					onclick={() => (open = false)}
				>
					{cancelText}
				</button>
				<button
					class="popconfirm__btn popconfirm__btn--confirm"
					type="button"
					onmousedown={(e) => e.preventDefault()}
					onclick={handleConfirm}
				>
					{confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.trigger {
		display: inline-flex;
	}

	:global(.popconfirm) {
		position: absolute;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
		z-index: 9999;
		min-width: 220px;
		max-width: 280px;
		pointer-events: auto;
		will-change: transform;

		.popconfirm__inner {
			padding: 14px 16px 12px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.popconfirm__header {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.popconfirm__title {
			font-size: 13px;
			font-weight: 600;
			color: #1a1a2e;
		}

		.popconfirm__desc {
			font-size: 12px;
			color: #64748b;
			margin: 0;
			padding-left: 24px;
		}

		.popconfirm__actions {
			display: flex;
			justify-content: flex-end;
			gap: 6px;
			margin-top: 2px;
		}

		.popconfirm__btn {
			height: 28px;
			padding: 0 12px;
			border-radius: 6px;
			font-size: 12px;
			font-weight: 500;
			cursor: pointer;
			transition:
				background 0.15s,
				border-color 0.15s,
				color 0.15s;

			&--cancel {
				background: #fff;
				border: 1px solid #e2e8f0;
				color: #374151;

				&:hover {
					border-color: #5460e6;
					color: #5460e6;
				}
			}

			&--confirm {
				background: #dc2626;
				border: 1px solid #dc2626;
				color: #fff;

				&:hover {
					background: #b91c1c;
					border-color: #b91c1c;
				}
			}
		}
	}

	:global(.popconfirm-icon) {
		color: #f59e0b;
		flex-shrink: 0;
	}
</style>
