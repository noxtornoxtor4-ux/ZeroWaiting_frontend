<script lang="ts">
	import Icon from '@iconify/svelte';

	interface Props {
		value?: string;
		placeholder?: string;
	}

	let { value = $bindable(''), placeholder = 'Поиск...' }: Props = $props();

	const handleInput = (e: Event) => {
		value = (e.target as HTMLInputElement).value;
	};

	const clear = () => {
		value = '';
	};
</script>

<div class="SearchInput">
	<span class="icon"><Icon icon="lucide:search" width={18} /></span>
	<input
		class="input"
		type="text"
		{placeholder}
		{value}
		oninput={handleInput}
	/>
	{#if value}
		<button class="clear" onclick={clear} aria-label="Очистить">
			<Icon icon="lucide:x" width={16} />
		</button>
	{/if}
</div>

<style lang="scss">
	.SearchInput {
		position: relative;
		display: flex;
		align-items: center;

		.icon {
			position: absolute;
			left: var(--space-3);
			top: 50%;
			transform: translateY(-50%);
			display: flex;
			align-items: center;
			justify-content: center;
			color: var(--muted-fg);
			pointer-events: none;
			line-height: 0;
		}

		.input {
			width: 100%;
			height: 40px;
			padding: 0 var(--space-10) 0 calc(var(--space-3) + 18px + var(--space-2));
			background: var(--surface);
			border: 1px solid var(--border-color);
			border-radius: var(--radius-md);
			color: var(--foreground);
			font-size: var(--text-sm);
			outline: none;
			transition: border-color var(--duration-fast) var(--ease-default);

			&::placeholder {
				color: var(--muted-fg);
			}

			&:focus {
				border-color: var(--primary);
				box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
			}
		}

		.clear {
			position: absolute;
			right: var(--space-2);
			top: 50%;
			transform: translateY(-50%);
			display: flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 28px;
			border: none;
			background: transparent;
			border-radius: var(--radius-sm);
			color: var(--muted-fg);
			cursor: pointer;

			&:hover {
				background: var(--surface-hover);
				color: var(--foreground);
			}
		}
	}
</style>
