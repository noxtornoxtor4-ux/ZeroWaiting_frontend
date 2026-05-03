<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		variant?: 'primary' | 'ghost' | 'outline' | 'success' | 'danger' | 'icon';
		intent?: 'default' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		icon?: string;
		iconRight?: string;
		href?: string;
		fullWidth?: boolean;
		children?: Snippet;
		onclick?: (e: MouseEvent) => void;
	}

	let {
		variant = 'primary',
		intent = 'default',
		size = 'md',
		type = 'button',
		disabled = false,
		loading = false,
		icon,
		iconRight,
		href,
		fullWidth = false,
		children,
		onclick
	}: Props = $props();

	const isDisabled = $derived(disabled || loading);
</script>

{#if href}
	<a
		{href}
		class="Button {variant} {size}"
		class:full={fullWidth}
		class:disabled={isDisabled}
		class:intent_danger={intent === 'danger'}
	>
		{#if loading}
			<span class="spinner"></span>
		{:else if icon}
			<Icon {icon} class="btn_icon" />
		{/if}
		{#if children}
			<span class="label">{@render children()}</span>
		{/if}
		{#if iconRight}
			<Icon icon={iconRight} class="btn_icon" />
		{/if}
	</a>
{:else}
	<button
		{type}
		class="Button {variant} {size}"
		class:full={fullWidth}
		class:disabled={isDisabled}
		class:intent_danger={intent === 'danger'}
		disabled={isDisabled}
		{onclick}
	>
		{#if loading}
			<span class="spinner"></span>
		{:else if icon}
			<Icon {icon} class="btn_icon" />
		{/if}
		{#if children}
			<span class="label">{@render children()}</span>
		{/if}
		{#if iconRight}
			<Icon icon={iconRight} class="btn_icon" />
		{/if}
	</button>
{/if}

<style lang="scss">
	.Button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		font-weight: var(--weight-medium);
		border-radius: 999px;
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-default);
		white-space: nowrap;
		text-decoration: none;

		&.sm {
			padding: var(--space-1) var(--space-3);
			font-size: var(--text-xs);
			height: 32px;
		}

		&.md {
			padding: var(--space-2) var(--space-5);
			font-size: var(--text-xs);
			height: 40px;
		}

		&.lg {
			padding: var(--space-3) var(--space-6);
			font-size: var(--text-sm);
			height: 48px;
		}

		&.primary {
			background: linear-gradient(135deg, #7c3aed, #8b5cf6);
			color: white;
			border: none;
			box-shadow: 0 2px 12px rgba(124, 58, 237, 0.25);

			&:hover:not(.disabled) {
				background: linear-gradient(135deg, #6d28d9, #7c3aed);
				box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
			}

			&:active:not(.disabled) {
				background: linear-gradient(135deg, #5b21b6, #6d28d9);
			}
		}

		&.ghost {
			background: transparent;
			color: var(--foreground);

			&:hover:not(.disabled) {
				background: var(--surface-hover);
			}
		}

		&.outline {
			background: rgba(255, 255, 255, 0.06);
			color: var(--foreground);
			border: 1px solid rgba(255, 255, 255, 0.15);

			&:hover:not(.disabled) {
				background: rgba(255, 255, 255, 0.1);
				border-color: rgba(139, 92, 246, 0.4);
				color: var(--primary-light);
			}
		}

		&.success {
			background: var(--success);
			color: white;

			&:hover:not(.disabled) {
				filter: brightness(1.1);
			}
		}

		&.danger {
			background: var(--danger);
			color: white;

			&:hover:not(.disabled) {
				filter: brightness(1.1);
			}
		}

		&.icon {
			background: transparent;
			color: var(--muted-fg);
			padding: 0;
			width: 32px;
			height: 32px;
			min-width: unset;
			border-radius: 8px;

			&:hover:not(.disabled) {
				color: var(--foreground);
				background: rgba(255, 255, 255, 0.08);
			}

			&.intent_danger:hover:not(.disabled) {
				color: var(--danger);
				background: rgba(239, 68, 68, 0.1);
			}
		}

		&.full {
			width: 100%;
		}

		&.disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.label {
			line-height: 1;
		}

		.spinner {
			width: 16px;
			height: 16px;
			border: 2px solid rgba(255, 255, 255, 0.3);
			border-top-color: white;
			border-radius: 50%;
			animation: btn_spin 0.6s linear infinite;
		}
	}

	@keyframes btn_spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
