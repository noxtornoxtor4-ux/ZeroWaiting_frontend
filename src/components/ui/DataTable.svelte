<script module lang="ts">
	export type Column<R> = {
		key: string;
		title: string;
		accessor?: (row: R, index: number) => string | number | null | undefined;
		width?: string;
		minWidth?: number;
		align?: 'left' | 'center' | 'right';
	};
</script>

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import Icon from '@iconify/svelte';

	const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];

	interface Props {
		columns: Column<T>[];
		data: T[];
		loading?: boolean;
		emptyText?: string;
		total?: number;
		page?: number;
		pageSize?: number;
		onPageChange?: (page: number) => void;
		onPageSizeChange?: (size: number) => void;
		cell?: Snippet<[{ row: T; column: Column<T>; rowIndex: number }]>;
		rowKey?: (row: T) => string | number;
		onRowClick?: (row: T) => void;
	}

	let {
		columns,
		data,
		loading = false,
		emptyText = 'Нет данных',
		total = 0,
		page = 1,
		pageSize = 15,
		onPageChange,
		onPageSizeChange,
		cell,
		rowKey,
		onRowClick
	}: Props = $props();

	let lastTotal = $state(0);
	$effect(() => {
		if (total > 0) lastTotal = total;
	});
	const stableTotal = $derived(total > 0 ? total : lastTotal);

	const totalPages = $derived(
		pageSize > 0 ? Math.ceil(stableTotal / pageSize) : 0
	);
	const rangeFrom = $derived((page - 1) * pageSize + 1);
	const rangeTo = $derived(Math.min(page * pageSize, stableTotal));

	const getPageNumbers = (
		current: number,
		count: number
	): (number | '...')[] => {
		if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);

		const pages: (number | '...')[] = [];
		const delta = 2;

		pages.push(1);
		if (current - delta > 2) pages.push('...');

		const start = Math.max(2, current - delta);
		const end = Math.min(count - 1, current + delta);
		for (let i = start; i <= end; i++) pages.push(i);

		if (current + delta < count - 1) pages.push('...');
		if (count > 1) pages.push(count);

		return pages;
	};

	const pageNumbers = $derived(getPageNumbers(page, totalPages));
	const isEmpty = $derived(!loading && data.length === 0);

	let sizeDropdownOpen = $state(false);

	const getRowKey = (row: T, index: number): string | number =>
		rowKey ? rowKey(row) : index;

	const getCellValue = (row: T, column: Column<T>, index: number): string =>
		column.accessor != null ? String(column.accessor(row, index) ?? '—') : '—';

	const selectPageSize = (size: number) => {
		sizeDropdownOpen = false;
		onPageSizeChange?.(size);
	};
</script>

<svelte:window
	onclick={(e) => {
		if (!(e.target as Element).closest('.sizer')) {
			sizeDropdownOpen = false;
		}
	}}
/>

<div class="DataTable">
	<div class="scroll">
		<table class="table">
			<thead>
				<tr>
					{#each columns as column}
						<th
							class="th"
							class:right={column.align === 'right'}
							class:center={column.align === 'center'}
							style:min-width={column.minWidth
								? `${column.minWidth}px`
								: undefined}
							style:width={column.width}
						>
							{column.title}
						</th>
					{/each}
				</tr>
			</thead>
			{#if !loading && !isEmpty}
				<tbody>
					{#each data as row, rowIndex (getRowKey(row, rowIndex))}
						<tr
							class="tr"
							class:clickable={!!onRowClick}
							onclick={() => onRowClick?.(row)}
						>
							{#each columns as column}
								<td
									class="td"
									class:right={column.align === 'right'}
									class:center={column.align === 'center'}
								>
									<div
										class="inner"
										class:right={column.align === 'right'}
										class:center={column.align === 'center'}
									>
										{#if cell}
											{@render cell({ row, column, rowIndex })}
										{:else}
											{getCellValue(row, column, rowIndex)}
										{/if}
									</div>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			{/if}
		</table>

		{#if loading}
			<div class="state_overlay">
				<div class="spinner"></div>
			</div>
		{:else if isEmpty}
			<div class="state_overlay empty">
				<Icon icon="lucide:inbox" width={48} />
				<span class="empty_text">{emptyText}</span>
			</div>
		{/if}
	</div>

	{#if stableTotal > 0}
		<div class="pagination">
			<span class="range">
				{rangeFrom}–{rangeTo} / {stableTotal}
			</span>

			<div class="controls">
				<button
					class="arrow"
					disabled={page <= 1}
					onclick={() => onPageChange?.(page - 1)}
					aria-label="Предыдущая страница"
				>
					<Icon icon="lucide:chevron-left" width={16} />
				</button>

				{#each pageNumbers as p}
					{#if p === '...'}
						<span class="ellipsis">…</span>
					{:else}
						<button
							class="page_btn"
							class:active={p === page}
							onclick={() => onPageChange?.(p as number)}
						>
							{p}
						</button>
					{/if}
				{/each}

				<button
					class="arrow"
					disabled={page >= totalPages}
					onclick={() => onPageChange?.(page + 1)}
					aria-label="Следующая страница"
				>
					<Icon icon="lucide:chevron-right" width={16} />
				</button>
			</div>

			<div class="sizer">
				<button
					class="sizer_btn"
					onclick={() => (sizeDropdownOpen = !sizeDropdownOpen)}
				>
					{pageSize} / стр.
					<Icon icon="lucide:chevron-down" width={13} />
				</button>

				{#if sizeDropdownOpen}
					<ul class="sizer_dropdown">
						{#each PAGE_SIZE_OPTIONS as option}
							<li>
								<button
									class="sizer_option"
									class:active={option === pageSize}
									onclick={() => selectPageSize(option)}
								>
									{option} / стр.
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.DataTable {
		display: flex;
		flex-direction: column;
		gap: 16px;
		flex: 1;
		min-height: 0;

		.scroll {
			flex: 1;
			min-height: 0;
			overflow: auto;
			border-radius: var(--radius-lg);
			border: 1px solid var(--border-color);
			background: var(--surface);
			display: flex;
			flex-direction: column;
		}

		.table {
			width: 100%;
			border-collapse: collapse;
			font-size: 14px;
			white-space: nowrap;
		}

		.th {
			padding: 12px 16px;
			text-align: left;
			font-size: 12px;
			font-weight: 600;
			color: var(--muted-fg);
			text-transform: uppercase;
			letter-spacing: 0.04em;
			background: var(--surface);
			border-bottom: 1px solid var(--border-color);
			position: sticky;
			top: 0;
			z-index: 1;

			&.right {
				text-align: right;
			}

			&.center {
				text-align: center;
			}
		}

		.tr {
			transition: background-color 0.1s;

			&:nth-child(odd) {
				background-color: var(--surface);
			}

			&:nth-child(even) {
				background-color: rgba(255, 255, 255, 0.02);
			}

			&:hover {
				background-color: var(--surface-hover);
			}

			&.clickable {
				cursor: pointer;
			}
		}

		.td {
			padding: 0;
			height: 1px;
			color: var(--foreground);
			border-bottom: 1px solid rgba(255, 255, 255, 0.05);

			&.right {
				text-align: right;
			}

			&.center {
				text-align: center;
			}

			.inner {
				display: flex;
				align-items: center;
				padding: 12px 16px;
				height: 100%;

				&.right {
					justify-content: flex-end;
				}

				&.center {
					justify-content: center;
				}
			}
		}

		.state_overlay {
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 48px 16px;
			color: var(--muted-fg);
			font-size: 14px;

			&.empty {
				flex-direction: column;
				gap: 7px;

				.empty_text {
					font-size: 16px;
					font-weight: 500;
				}
			}
		}

		.spinner {
			width: 28px;
			height: 28px;
			border: 3px solid var(--border-color);
			border-top-color: var(--primary);
			border-radius: 50%;
			animation: spin 0.7s linear infinite;
			margin: 0 auto;
			flex-shrink: 0;
		}

		.pagination {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 4px;
			gap: 12px;

			.range {
				font-size: 13px;
				color: var(--muted-fg);
				white-space: nowrap;
				min-width: 80px;
			}

			.controls {
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.arrow {
				width: 32px;
				height: 32px;
				display: flex;
				align-items: center;
				justify-content: center;
				border: none;
				background: none;
				color: var(--muted-fg);
				cursor: pointer;
				border-radius: 6px;
				transition:
					color 0.15s,
					background-color 0.15s;

				&:hover:not(:disabled) {
					color: var(--primary);
					background-color: var(--surface-hover);
				}

				&:disabled {
					opacity: 0.35;
					cursor: not-allowed;
				}
			}

			.page_btn {
				min-width: 32px;
				height: 32px;
				padding: 0 6px;
				border: 1px solid transparent;
				border-radius: 50%;
				background: none;
				color: var(--foreground);
				font-size: 13px;
				font-weight: 500;
				cursor: pointer;
				transition:
					background-color 0.15s,
					border-color 0.15s,
					color 0.15s;

				&:hover:not(.active) {
					border-color: var(--border-color);
					background-color: var(--surface-hover);
				}

				&.active {
					border-color: var(--primary);
					color: var(--primary);
					font-weight: 600;
				}
			}

			.ellipsis {
				min-width: 32px;
				height: 32px;
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--muted-fg);
				font-size: 13px;
			}

			.sizer {
				position: relative;

				.sizer_btn {
					display: flex;
					align-items: center;
					gap: 6px;
					height: 32px;
					padding: 0 12px;
					border: 1px solid var(--border-color);
					border-radius: 8px;
					background: var(--surface);
					color: var(--foreground);
					font-size: 13px;
					font-weight: 500;
					cursor: pointer;
					white-space: nowrap;
					transition:
						border-color 0.15s,
						color 0.15s;

					&:hover {
						border-color: var(--primary);
						color: var(--primary);
					}
				}

				.sizer_dropdown {
					position: absolute;
					bottom: calc(100% + 6px);
					right: 0;
					background: var(--surface);
					border: 1px solid var(--border-color);
					border-radius: 10px;
					box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
					list-style: none;
					margin: 0;
					padding: 4px;
					min-width: 110px;
					z-index: 10;
				}

				.sizer_option {
					display: block;
					width: 100%;
					padding: 7px 12px;
					background: none;
					border: none;
					border-radius: 6px;
					font-size: 13px;
					color: var(--foreground);
					cursor: pointer;
					text-align: left;
					transition:
						background-color 0.1s,
						color 0.1s;

					&:hover {
						background: var(--surface-hover);
					}

					&.active {
						background: var(--primary-subtle);
						color: var(--primary-light);
						font-weight: 600;
					}
				}
			}
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
