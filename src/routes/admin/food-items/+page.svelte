<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { formatPriceCompact } from '@/lib/utils/price';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Popconfirm from '@/components/ui/Popconfirm.svelte';
	import FoodItemFormModal from './components/FoodItemFormModal.svelte';
	import type { FoodItemEntity, GetFoodItemsV1Params } from '@/api/model';

	type FoodFilters = {
		category: string;
		cinemaId: string;
		branchId: string;
		availability: string;
	};

	const FOOD_CATEGORY_LABELS: Record<string, string> = {
		SNACKS: 'Снеки',
		BEVERAGES: 'Напитки',
		COMBO: 'Комбо',
		DESSERTS: 'Десерты'
	};

	const CATEGORY_OPTIONS = [
		{ value: 'SNACKS', label: 'Снеки' },
		{ value: 'BEVERAGES', label: 'Напитки' },
		{ value: 'COMBO', label: 'Комбо' },
		{ value: 'DESSERTS', label: 'Десерты' }
	];

	const AVAILABILITY_OPTIONS = [
		{ value: 'true', label: 'Доступно' },
		{ value: 'false', label: 'Недоступно' }
	];

	const table = useTableQuery<GetFoodItemsV1Params, FoodFilters>({
		filters: { category: '', cinemaId: '', branchId: '', availability: '' }
	});

	let formOpen = $state(false);
	let editingFoodItem = $state<FoodItemEntity | null>(null);

	const cinemasQuery = crmQueryApi.createGetCinemasV1(() => ({
		page: 1,
		limit: 100
	}));
	const cinemas = $derived(cinemasQuery.data?.data ?? []);
	const cinemaOptions = $derived(
		cinemas.map((c) => ({ value: c.id, label: getLocalizedValue(c.name) }))
	);

	const branchesQuery = crmQueryApi.createGetBranchesV1(
		() => ({
			page: 1,
			limit: 100,
			cinemaId: table.filters.cinemaId
		}),
		() => ({ query: { enabled: !!table.filters.cinemaId } })
	);
	const branches = $derived(branchesQuery.data?.data ?? []);
	const branchOptions = $derived(
		branches.map((b) => ({ value: b.id, label: getLocalizedValue(b.name) }))
	);

	$effect(() => {
		if (!table.filters.cinemaId && table.filters.branchId) {
			table.setFilter('branchId', '');
		}
	});

	const queryParams = $derived<GetFoodItemsV1Params>({
		...table.params,
		...(table.filters.availability && {
			isAvailable: table.filters.availability === 'true'
		})
	});

	const query = crmQueryApi.createGetFoodItemsV1(() => queryParams);
	const data = $derived(query.data?.data ?? []);
	const meta = $derived(query.data?.meta);

	const deleteMutation = crmQueryApi.createDeleteFoodItemsByIdV1Mutation();

	const handleCreate = () => {
		editingFoodItem = null;
		formOpen = true;
	};

	const handleEdit = (foodItem: FoodItemEntity) => {
		editingFoodItem = foodItem;
		formOpen = true;
	};

	const handleDelete = async (id: string) => {
		await deleteMutation.mutateAsync({ id });
		query.refetch();
	};

	const columns: Column<FoodItemEntity>[] = [
		{ key: 'name', title: 'Название', minWidth: 240 },
		{ key: 'category', title: 'Категория', width: '130px' },
		{
			key: 'location',
			title: 'Кинотеатр / Филиал',
			minWidth: 220
		},
		{
			key: 'price',
			title: 'Цена',
			width: '110px',
			align: 'right',
			accessor: (row) => formatPriceCompact(row.price)
		},
		{ key: 'isAvailable', title: 'Статус', width: '120px' },
		{ key: 'actions', title: '', width: '80px', align: 'center' }
	];
</script>

<svelte:head><title>Еда — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.MANAGER} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar top">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск по названию..."
				/>
			</div>
			<Button
				variant="primary"
				size="sm"
				icon="lucide:plus"
				onclick={handleCreate}
			>
				Добавить позицию
			</Button>
		</div>

		<div class="filters">
			<div class="filter">
				<Select
					label="Категория"
					placeholder="Любая категория"
					value={table.filters.category}
					options={CATEGORY_OPTIONS}
					allowClear
					onChange={(vals) =>
						table.setFilter('category', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter">
				<Select
					label="Кинотеатр"
					placeholder="Все кинотеатры"
					value={table.filters.cinemaId}
					options={cinemaOptions}
					allowClear
					onChange={(vals) =>
						table.setFilter('cinemaId', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter">
				<Select
					label="Филиал"
					placeholder="Все филиалы"
					value={table.filters.branchId}
					options={branchOptions}
					disabled={!table.filters.cinemaId}
					allowClear
					onChange={(vals) =>
						table.setFilter('branchId', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter">
				<Select
					label="Доступность"
					placeholder="Любая"
					value={table.filters.availability}
					options={AVAILABILITY_OPTIONS}
					allowClear
					onChange={(vals) =>
						table.setFilter('availability', String(vals[0] ?? ''))}
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
				{#if column.key === 'name'}
					<div class="cell_name">
						{#if row.imageUrl}
							<img class="thumb" src={row.imageUrl} alt="" />
						{:else}
							<div class="thumb placeholder"></div>
						{/if}
						<span>{getLocalizedValue(row.name)}</span>
					</div>
				{:else if column.key === 'category'}
					<Badge
						text={FOOD_CATEGORY_LABELS[row.category] ?? row.category}
						color="var(--muted-fg)"
						variant="outline"
					/>
				{:else if column.key === 'location'}
					<div class="location_cell">
						<span class="cinema_name">
							{row.branch?.cinema
								? getLocalizedValue(row.branch.cinema.name)
								: '—'}
						</span>
						{#if row.branch}
							<span class="branch_name">
								{getLocalizedValue(row.branch.name)}
							</span>
						{/if}
					</div>
				{:else if column.key === 'isAvailable'}
					<Badge
						text={row.isAvailable ? 'Доступно' : 'Недоступно'}
						color={row.isAvailable ? 'var(--success)' : 'var(--muted-fg)'}
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
							title="Удалить позицию?"
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

	<FoodItemFormModal
		bind:open={formOpen}
		foodItem={editingFoodItem}
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
		}

		.cell_name {
			display: flex;
			align-items: center;
			gap: 12px;

			.thumb {
				width: 40px;
				height: 40px;
				border-radius: var(--radius-sm);
				object-fit: cover;
				flex-shrink: 0;

				&.placeholder {
					background: var(--surface-hover);
				}
			}
		}

		.location_cell {
			display: flex;
			flex-direction: column;
			gap: 2px;
			min-width: 0;

			.cinema_name {
				font-size: 13px;
				color: var(--foreground);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.branch_name {
				font-size: 11px;
				color: var(--muted-fg);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
		}

		.cell_actions {
			display: flex;
			align-items: center;
			gap: 4px;
		}
	}
</style>
