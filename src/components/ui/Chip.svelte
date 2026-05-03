<script lang="ts">
	interface Props {
		text: string;
		active?: boolean;
		removable?: boolean;
		onclick?: () => void;
		onremove?: () => void;
	}

	let {
		text,
		active = false,
		removable = false,
		onclick,
		onremove
	}: Props = $props();
</script>

{#if onclick}
	<button
		class="Chip"
		class:active
		class:clickable={true}
		{onclick}
		type="button"
	>
		<span class="text">{text}</span>
		{#if removable}
			<span
				class="remove"
				role="button"
				tabindex={0}
				onclick={(e) => {
					e.stopPropagation();
					onremove?.();
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.stopPropagation();
						onremove?.();
					}
				}}
			>
				&times;
			</span>
		{/if}
	</button>
{:else}
	<span class="Chip" class:active>
		<span class="text">{text}</span>
		{#if removable}
			<button
				class="remove"
				onclick={(e) => {
					e.stopPropagation();
					onremove?.();
				}}
				aria-label="Удалить"
				type="button"
			>
				&times;
			</button>
		{/if}
	</span>
{/if}

<style lang="scss">
	.Chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-full);
		font-size: var(--text-sm);
		background: var(--surface-hover);
		color: var(--muted-fg);
		border: 1px solid var(--border-color);
		transition: all var(--duration-fast) var(--ease-default);

		&.clickable {
			cursor: pointer;

			&:hover {
				border-color: var(--primary);
				color: var(--primary-light);
			}
		}

		&.active {
			background: var(--primary-subtle);
			border-color: var(--primary);
			color: var(--primary-light);
		}

		.remove {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 16px;
			height: 16px;
			border-radius: 50%;
			font-size: 14px;
			line-height: 1;
			color: var(--muted-fg);

			&:hover {
				background: var(--danger);
				color: white;
			}
		}
	}
</style>
