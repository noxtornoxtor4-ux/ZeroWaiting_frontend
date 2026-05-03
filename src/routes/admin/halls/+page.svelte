<script lang="ts">
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { getErrorMessage } from '@/lib/utils/error';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Select from '@/components/ui/Select.svelte';
	import CreateHallModal from './components/CreateHallModal.svelte';
	import EditHallModal from './components/EditHallModal.svelte';
	import type {
		HallEntity,
		GetHallsV1Params,
		GetHallsV1Type
	} from '@/api/model';

	type HallFilters = {
		cinemaId: string;
		branchId: string;
		type: string;
	};

	const table = useTableQuery<GetHallsV1Params, HallFilters>({
		filters: { cinemaId: '', branchId: '', type: '' }
	});

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

	const TYPE_OPTIONS = [
		{ value: 'STANDARD', label: 'Стандарт' },
		{ value: 'IMAX', label: 'IMAX' },
		{ value: 'VIP', label: 'VIP' }
	];

	const TYPE_LABELS: Record<string, string> = {
		STANDARD: 'Стандарт',
		IMAX: 'IMAX',
		VIP: 'VIP'
	};

	const queryParams = $derived<GetHallsV1Params>({
		...table.params,
		...(table.filters.type && {
			type: table.filters.type as GetHallsV1Type
		})
	});

	const hallsQuery = crmQueryApi.createGetHallsV1(() => queryParams);
	const halls = $derived(hallsQuery.data?.data ?? []);
	const meta = $derived(hallsQuery.data?.meta);

	let createOpen = $state(false);
	let editOpen = $state(false);
	let hallToEdit = $state<HallEntity | null>(null);
	let duplicatingId = $state<string | null>(null);

	const openEdit = (hall: HallEntity) => {
		hallToEdit = hall;
		editOpen = true;
	};

	const duplicateMutation =
		crmQueryApi.createPostHallsByIdDuplicateV1Mutation();

	const duplicateHall = async (hall: HallEntity) => {
		if (duplicatingId) return;
		duplicatingId = hall.id;
		try {
			const copy = await duplicateMutation.mutateAsync({
				id: hall.id,
				data: { name: `${hall.name} (копия)` }
			});
			toast.success('Зал скопирован');
			await goto(`/admin/halls/${copy.hallId}/layout`);
		} catch (error) {
			toast.error(getErrorMessage(error, 'Не удалось дублировать зал'));
		} finally {
			duplicatingId = null;
		}
	};

	const columns: Column<HallEntity>[] = [
		{
			key: 'name',
			title: 'Название',
			minWidth: 180,
			accessor: (row) => row.name
		},
		{
			key: 'location',
			title: 'Кинотеатр / Филиал',
			minWidth: 240
		},
		{ key: 'type', title: 'Тип', width: '120px' },
		{
			key: 'capacity',
			title: 'Вместимость',
			width: '140px',
			align: 'right',
			accessor: (row) => `${row.capacity} мест`
		},
		{ key: 'actions', title: '', width: '220px', align: 'center' }
	];
</script>

<svelte:head><title>Залы — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.ADMIN} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar top">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск по названию зала..."
				/>
			</div>
			<Button
				variant="primary"
				size="sm"
				icon="lucide:plus"
				onclick={() => (createOpen = true)}
			>
				Создать зал
			</Button>
		</div>

		<div class="filters">
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
					label="Тип"
					placeholder="Любой тип"
					value={table.filters.type}
					options={TYPE_OPTIONS}
					allowClear
					onChange={(vals) => table.setFilter('type', String(vals[0] ?? ''))}
				/>
			</div>
		</div>

		<DataTable
			{columns}
			data={halls}
			loading={hallsQuery.isLoading}
			total={meta?.total ?? 0}
			page={table.page}
			pageSize={table.limit}
			onPageChange={table.setPage}
			onPageSizeChange={table.setLimit}
		>
			{#snippet cell({ row, column, rowIndex })}
				{#if column.key === 'location'}
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
				{:else if column.key === 'type'}
					<Badge text={TYPE_LABELS[row.type] ?? row.type} color="var(--info)" />
				{:else if column.key === 'actions'}
					<div class="cell_actions">
						<Button
							variant="ghost"
							size="sm"
							icon="lucide:layout-grid"
							href={`/admin/halls/${row.id}/layout`}
						>
							Схема
						</Button>
						<Button
							variant="ghost"
							size="sm"
							icon="lucide:pencil"
							onclick={() => openEdit(row)}
						/>
						<Button
							variant="ghost"
							size="sm"
							icon="lucide:copy"
							loading={duplicatingId === row.id}
							onclick={() => duplicateHall(row)}
						/>
					</div>
				{:else}
					{column.accessor?.(row, rowIndex) ?? '—'}
				{/if}
			{/snippet}
		</DataTable>
	</div>

	<CreateHallModal
		bind:open={createOpen}
		onclose={() => (createOpen = false)}
		onsaved={() => hallsQuery.refetch()}
	/>

	<EditHallModal
		bind:open={editOpen}
		hall={hallToEdit}
		onclose={() => {
			editOpen = false;
			hallToEdit = null;
		}}
		onsaved={() => hallsQuery.refetch()}
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
			justify-content: center;
			gap: 4px;
		}
	}
</style>
