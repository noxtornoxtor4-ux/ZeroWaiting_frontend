<script lang="ts">
	import Icon from '@iconify/svelte';

	interface Props {
		page: number;
		totalPages: number;
		onchange: (page: number) => void;
	}

	let { page, totalPages, onchange }: Props = $props();

	const visiblePages = $derived(() => {
		const pages: (number | '...')[] = [];
		const delta = 2;

		for (let i = 1; i <= totalPages; i++) {
			if (
				i === 1 ||
				i === totalPages ||
				(i >= page - delta && i <= page + delta)
			) {
				pages.push(i);
			} else if (pages[pages.length - 1] !== '...') {
				pages.push('...');
			}
		}

		return pages;
	});
</script>

{#if totalPages > 1}
	<nav class="Pagination" aria-label="Пагинация">
		<button
			class="btn"
			disabled={page <= 1}
			onclick={() => onchange(page - 1)}
			aria-label="Предыдущая"
		>
			<Icon icon="lucide:chevron-left" width={20} />
		</button>

		{#each visiblePages() as p}
			{#if p === '...'}
				<span class="ellipsis">...</span>
			{:else}
				<button
					class="btn page"
					class:active={p === page}
					onclick={() => onchange(p)}
				>
					{p}
				</button>
			{/if}
		{/each}

		<button
			class="btn"
			disabled={page >= totalPages}
			onclick={() => onchange(page + 1)}
			aria-label="Следующая"
		>
			<Icon icon="lucide:chevron-right" width={20} />
		</button>
	</nav>
{/if}

<style lang="scss">
	.Pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);

		.btn {
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 36px;
			height: 36px;
			border-radius: var(--radius-md);
			color: var(--muted-fg);
			transition: all var(--duration-fast) var(--ease-default);

			&:hover:not(:disabled) {
				background: var(--surface-hover);
				color: var(--foreground);
			}

			&:disabled {
				opacity: 0.3;
				cursor: not-allowed;
			}
		}

		.page {
			font-size: var(--text-sm);
			font-weight: var(--weight-medium);

			&.active {
				background: var(--primary);
				color: white;

				&:hover {
					background: var(--primary-hover);
					color: white;
				}
			}
		}

		.ellipsis {
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 36px;
			height: 36px;
			color: var(--muted-fg);
			font-size: var(--text-sm);
		}
	}
</style>
