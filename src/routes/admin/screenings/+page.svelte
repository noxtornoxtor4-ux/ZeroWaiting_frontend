<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { formatDateTime } from '@/lib/utils/datetime';
	import { formatPriceCompact } from '@/lib/utils/price';
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
	import ScreeningFormModal from './components/ScreeningFormModal.svelte';
	import type {
		ScreeningEntity,
		GetScreeningsV1Params,
		GetScreeningsV1Format
	} from '@/api/model';

	type ScreeningFilters = {
		cinemaId: string;
		branchId: string;
		format: string;
		isActive: string;
	};

	const table = useTableQuery<GetScreeningsV1Params, ScreeningFilters>({
		filters: { cinemaId: '', branchId: '', format: '', isActive: '' }
	});

	let formOpen = $state(false);
	let editingScreening = $state<ScreeningEntity | null>(null);

	const cinemasQuery = crmQueryApi.createGetCinemasV1(() => ({
		page: 1,
		limit: 100
	}));
	const cinemas = $derived(cinemasQuery.data?.data ?? []);
	const cinemaOptions = $derived(
		cinemas.map((c) => ({ value: c.id, label: getLocalizedValue(c.name) }))
	);

	const branchesQuery = crmQueryApi.createGetCinemasByCinemaIdBranchesV1(
		() => table.filters.cinemaId,
		() => ({ page: 1, limit: 100 }),
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

	const FORMAT_OPTIONS = [
		{ value: 'TWO_D', label: '2D' },
		{ value: 'THREE_D', label: '3D' },
		{ value: 'IMAX', label: 'IMAX' },
		{ value: 'DOLBY_ATMOS', label: 'Dolby Atmos' },
		{ value: 'FOUR_DX', label: '4DX' }
	];

	const STATUS_OPTIONS = [
		{ value: 'true', label: 'Активные' },
		{ value: 'false', label: 'Неактивные' }
	];

	const FORMAT_LABELS: Record<string, string> = {
		TWO_D: '2D',
		THREE_D: '3D',
		IMAX: 'IMAX',
		DOLBY_ATMOS: 'Dolby',
		FOUR_DX: '4DX'
	};

	const queryParams = $derived<GetScreeningsV1Params>({
		...table.params,
		...(table.filters.format && {
			format: table.filters.format as GetScreeningsV1Format
		}),
		...(table.filters.isActive && {
			isActive: table.filters.isActive === 'true'
		})
	});

	const query = crmQueryApi.createGetScreeningsV1(() => queryParams);
	const screenings = $derived(query.data?.data ?? []);
	const meta = $derived(query.data?.meta);

	const deleteMutation = crmQueryApi.createDeleteScreeningsByIdV1Mutation();

	const handleCreate = () => {
		editingScreening = null;
		formOpen = true;
	};

	const handleEdit = (screening: ScreeningEntity) => {
		editingScreening = screening;
		formOpen = true;
	};

	const handleDelete = async (id: string) => {
		await deleteMutation.mutateAsync({ id });
		query.refetch();
	};

	const columns: Column<ScreeningEntity>[] = [
		{ key: 'movie', title: 'Фильм', minWidth: 240 },
		{ key: 'location', title: 'Кинотеатр / Филиал', minWidth: 220 },
		{
			key: 'hall',
			title: 'Зал',
			width: '140px',
			accessor: (row) => row.hall?.name ?? '—'
		},
		{
			key: 'startTime',
			title: 'Время',
			width: '170px',
			accessor: (row) => formatDateTime(row.startTime)
		},
		{ key: 'format', title: 'Формат', width: '100px' },
		{
			key: 'price',
			title: 'Цена',
			width: '100px',
			align: 'right',
			accessor: (row) => formatPriceCompact(row.price)
		},
		{ key: 'isActive', title: 'Статус', width: '100px' },
		{ key: 'actions', title: '', width: '80px', align: 'center' }
	];
</script>

<svelte:head><title>Сеансы — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.MANAGER} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar top">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск по названию фильма..."
				/>
			</div>
			<Button
				variant="primary"
				size="sm"
				icon="lucide:plus"
				onclick={handleCreate}
			>
				Добавить сеанс
			</Button>
		</div>

		<div class="filters">
			<div class="filter cinema">
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
			<div class="filter branch">
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
			<div class="filter format">
				<Select
					label="Формат"
					placeholder="Все форматы"
					value={table.filters.format}
					options={FORMAT_OPTIONS}
					allowClear
					onChange={(vals) => table.setFilter('format', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter status">
				<Select
					label="Статус"
					placeholder="Любой статус"
					value={table.filters.isActive}
					options={STATUS_OPTIONS}
					allowClear
					onChange={(vals) =>
						table.setFilter('isActive', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter date_range">
				<DateRangeFilter
					from={table.dateFrom}
					to={table.dateTo}
					labelFrom="Начиная с"
					labelTo="По"
					onchange={table.setDateRange}
				/>
			</div>
		</div>

		<DataTable
			{columns}
			data={screenings}
			loading={query.isLoading}
			total={meta?.total ?? 0}
			page={table.page}
			pageSize={table.limit}
			onPageChange={table.setPage}
			onPageSizeChange={table.setLimit}
			rowKey={(row) => row.id}
		>
			{#snippet cell({ row, column, rowIndex })}
				{#if column.key === 'movie'}
					<div class="movie_cell">
						{#if row.movie?.posterUrl}
							<img class="poster" src={row.movie.posterUrl} alt="" />
						{:else}
							<div class="poster placeholder"></div>
						{/if}
						<span class="movie_title">
							{row.movie ? getLocalizedValue(row.movie.title) : '—'}
						</span>
					</div>
				{:else if column.key === 'location'}
					<div class="location_cell">
						<span class="cinema_name">
							{row.hall?.branch?.cinema
								? getLocalizedValue(row.hall.branch.cinema.name)
								: '—'}
						</span>
						{#if row.hall?.branch}
							<span class="branch_name">
								{getLocalizedValue(row.hall.branch.name)}
							</span>
						{/if}
					</div>
				{:else if column.key === 'format'}
					<Badge
						text={FORMAT_LABELS[row.format] ?? row.format}
						color="var(--info)"
					/>
				{:else if column.key === 'isActive'}
					<Badge
						text={row.isActive ? 'Активен' : 'Неактивен'}
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
							title="Удалить сеанс?"
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

	<ScreeningFormModal
		bind:open={formOpen}
		screening={editingScreening}
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

		.toolbar {
			&.top {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;

				.search {
					flex: 1;
					max-width: 360px;
				}
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
			}

			.date_range {
				flex: 1 1 320px;
				min-width: 280px;
			}
		}

		.movie_cell {
			display: flex;
			align-items: center;
			gap: 12px;

			.poster {
				width: 32px;
				height: 48px;
				border-radius: var(--radius-sm);
				object-fit: cover;
				flex-shrink: 0;

				&.placeholder {
					background: var(--surface-hover);
				}
			}

			.movie_title {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
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
