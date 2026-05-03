<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { formatDate } from '@/lib/utils/datetime';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import DateRangeFilter from '@/components/ui/DateRangeFilter.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Popconfirm from '@/components/ui/Popconfirm.svelte';
	import PromotionFormModal from './components/PromotionFormModal.svelte';
	import type { PromotionEntity, GetPromotionsV1Params } from '@/api/model';

	type PromotionFilters = {
		status: string;
	};

	const STATUS_OPTIONS = [
		{ value: 'true', label: 'Активные' },
		{ value: 'false', label: 'Неактивные' }
	];

	const table = useTableQuery<GetPromotionsV1Params, PromotionFilters>({
		searchKey: 'title',
		filters: { status: '' }
	});

	let formOpen = $state(false);
	let editingPromotion = $state<PromotionEntity | null>(null);

	const queryParams = $derived<GetPromotionsV1Params>({
		...table.params,
		...(table.filters.status && {
			isActive: table.filters.status === 'true'
		})
	});

	const query = crmQueryApi.createGetPromotionsV1(() => queryParams);
	const data = $derived(query.data?.data ?? []);
	const meta = $derived(query.data?.meta);

	const deleteMutation = crmQueryApi.createDeletePromotionsByIdV1Mutation();

	const handleCreate = () => {
		editingPromotion = null;
		formOpen = true;
	};

	const handleEdit = (promotion: PromotionEntity) => {
		editingPromotion = promotion;
		formOpen = true;
	};

	const handleDelete = async (id: string) => {
		await deleteMutation.mutateAsync({ id });
		query.refetch();
	};

	const getPeriodState = (
		row: PromotionEntity
	): { label: string; color: string } => {
		const now = Date.now();
		const start = new Date(row.startDate).getTime();
		const end = new Date(row.endDate).getTime();
		if (now < start) return { label: 'Предстоит', color: 'var(--info)' };
		if (now > end) return { label: 'Завершена', color: 'var(--muted-fg)' };
		return { label: 'Идёт сейчас', color: 'var(--success)' };
	};

	const columns: Column<PromotionEntity>[] = [
		{ key: 'title', title: 'Заголовок', minWidth: 240 },
		{
			key: 'promoCode',
			title: 'Промокод',
			width: '160px',
			accessor: (row) => row.promoCode?.code ?? '—'
		},
		{
			key: 'dates',
			title: 'Период',
			width: '220px',
			accessor: (row) =>
				`${formatDate(row.startDate)} — ${formatDate(row.endDate)}`
		},
		{ key: 'state', title: 'Фаза', width: '130px' },
		{ key: 'isActive', title: 'Статус', width: '120px' },
		{ key: 'actions', title: '', width: '80px', align: 'center' }
	];
</script>

<svelte:head><title>Акции — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.ADMIN} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar top">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск по заголовку..."
				/>
			</div>
			<Button
				variant="primary"
				size="sm"
				icon="lucide:plus"
				onclick={handleCreate}
			>
				Добавить акцию
			</Button>
		</div>

		<div class="filters">
			<div class="filter">
				<Select
					label="Статус"
					placeholder="Любой статус"
					value={table.filters.status}
					options={STATUS_OPTIONS}
					allowClear
					onChange={(vals) => table.setFilter('status', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter date_range">
				<DateRangeFilter
					from={table.dateFrom}
					to={table.dateTo}
					labelFrom="Идёт в период с"
					labelTo="По"
					onchange={table.setDateRange}
				/>
			</div>
		</div>

		<DataTable
			{columns}
			{data}
			loading={query.isLoading}
			total={meta?.total ?? 0}
			page={table.page}
			pageSize={table.limit}
			onPageChange={table.setPage}
			onPageSizeChange={table.setLimit}
			rowKey={(row) => row.id}
		>
			{#snippet cell({ row, column, rowIndex })}
				{#if column.key === 'title'}
					<div class="cell_title">
						{#if row.imageUrl}
							<img class="thumb" src={row.imageUrl} alt="" />
						{:else}
							<div class="thumb placeholder"></div>
						{/if}
						<span>{getLocalizedValue(row.title)}</span>
					</div>
				{:else if column.key === 'promoCode'}
					{#if row.promoCode}
						<span class="code_cell">{row.promoCode.code}</span>
					{:else}
						—
					{/if}
				{:else if column.key === 'state'}
					<Badge
						text={getPeriodState(row).label}
						color={getPeriodState(row).color}
						variant="outline"
					/>
				{:else if column.key === 'isActive'}
					<Badge
						text={row.isActive ? 'Активна' : 'Неактивна'}
						color={row.isActive ? 'var(--success)' : 'var(--muted-fg)'}
					/>
				{:else if column.key === 'actions'}
					<div class="cell_actions">
						<Button
							variant="icon"
							size="sm"
							icon="lucide:pencil"
							onclick={() => handleEdit(row)}
						/>
						<Popconfirm
							title="Удалить акцию?"
							onConfirm={() => handleDelete(row.id)}
							placement="bottom-start"
						>
							<Button
								variant="icon"
								intent="danger"
								size="sm"
								icon="lucide:trash-2"
							/>
						</Popconfirm>
					</div>
				{:else}
					{column.accessor?.(row, rowIndex) ?? '—'}
				{/if}
			{/snippet}
		</DataTable>
	</div>

	<PromotionFormModal
		bind:open={formOpen}
		promotion={editingPromotion}
		onclose={() => {
			formOpen = false;
		}}
		onsaved={() => {
			query.refetch();
		}}
	/>
</RoleGuard>

<style lang="scss">
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		flex: 1;
		min-height: 0;

		.toolbar.top {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;

			.search {
				flex: 1;
				max-width: 360px;
			}
		}

		.filters {
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
			align-items: flex-end;

			.filter {
				flex: 1 1 160px;
				min-width: 160px;
				max-width: 240px;
			}

			.date_range {
				flex: 1 1 320px;
				min-width: 280px;
				max-width: none;
			}
		}

		.cell_title {
			display: flex;
			align-items: center;
			gap: 12px;

			.thumb {
				width: 48px;
				height: 32px;
				border-radius: var(--radius-sm);
				object-fit: cover;
				flex-shrink: 0;

				&.placeholder {
					background: var(--surface-hover);
				}
			}
		}

		.code_cell {
			font-family: var(
				--font-mono,
				ui-monospace,
				SFMono-Regular,
				Menlo,
				monospace
			);
			font-weight: 600;
			letter-spacing: 0.5px;
		}

		.cell_actions {
			display: flex;
			align-items: center;
			gap: 4px;
		}
	}
</style>
