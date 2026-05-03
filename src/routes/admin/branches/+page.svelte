<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Icon from '@iconify/svelte';
	import type { BranchEntity, GetBranchesV1Params } from '@/api/model';

	type BranchFilters = {
		cinemaId: string;
		city: string;
		isActive: string;
	};

	const table = useTableQuery<GetBranchesV1Params, BranchFilters>({
		filters: { cinemaId: '', city: '', isActive: '' }
	});

	const cinemasQuery = crmQueryApi.createGetCinemasV1(() => ({
		page: 1,
		limit: 100
	}));
	const cinemas = $derived(cinemasQuery.data?.data ?? []);
	const cinemaOptions = $derived(
		cinemas.map((c) => ({ value: c.id, label: getLocalizedValue(c.name) }))
	);

	const STATUS_OPTIONS = [
		{ value: 'true', label: 'Активные' },
		{ value: 'false', label: 'Неактивные' }
	];

	const queryParams = $derived<GetBranchesV1Params>({
		...table.params,
		...(table.filters.isActive && {
			isActive: table.filters.isActive === 'true'
		})
	});

	const branchesQuery = crmQueryApi.createGetBranchesV1(() => queryParams);
	const branches = $derived(branchesQuery.data?.data ?? []);
	const meta = $derived(branchesQuery.data?.meta);

	const cityOptions = $derived(
		Array.from(new Set(branches.map((b) => b.city).filter(Boolean)))
			.sort()
			.map((city) => ({ value: city, label: city }))
	);

	const columns: Column<BranchEntity>[] = [
		{ key: 'name', title: 'Название', minWidth: 220 },
		{
			key: 'cinema',
			title: 'Кинотеатр',
			minWidth: 180,
			accessor: (row) => (row.cinema ? getLocalizedValue(row.cinema.name) : '—')
		},
		{
			key: 'address',
			title: 'Адрес',
			minWidth: 240,
			accessor: (row) => getLocalizedValue(row.address)
		},
		{
			key: 'city',
			title: 'Город',
			width: '130px',
			accessor: (row) => row.city
		},
		{ key: 'contacts', title: 'Контакты', width: '220px' },
		{ key: 'isActive', title: 'Статус', width: '120px' }
	];
</script>

<svelte:head><title>Филиалы — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.ADMIN} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar top">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск по названию или адресу..."
				/>
			</div>
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
					label="Город"
					placeholder="Любой город"
					value={table.filters.city}
					options={cityOptions}
					allowClear
					onChange={(vals) => table.setFilter('city', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter">
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
		</div>

		<DataTable
			{columns}
			data={branches}
			loading={branchesQuery.isLoading}
			total={meta?.total ?? 0}
			page={table.page}
			pageSize={table.limit}
			onPageChange={table.setPage}
			onPageSizeChange={table.setLimit}
		>
			{#snippet cell({ row, column, rowIndex })}
				{#if column.key === 'name'}
					<div class="cell_name">
						{#if row.imageUrl}
							<img class="image" src={row.imageUrl} alt="" />
						{:else}
							<div class="image placeholder">
								<Icon icon="lucide:store" width={18} />
							</div>
						{/if}
						<span class="branch_title">{getLocalizedValue(row.name)}</span>
					</div>
				{:else if column.key === 'contacts'}
					<div class="contacts_cell">
						{#if row.phone}
							<a class="contact_link" href="tel:{row.phone}">
								<Icon icon="lucide:phone" width={12} />
								<span>{row.phone}</span>
							</a>
						{/if}
						{#if row.email}
							<a class="contact_link" href="mailto:{row.email}">
								<Icon icon="lucide:mail" width={12} />
								<span>{row.email}</span>
							</a>
						{/if}
						{#if !row.phone && !row.email}
							<span style="color: var(--muted-fg);">—</span>
						{/if}
					</div>
				{:else if column.key === 'isActive'}
					<Badge
						text={row.isActive ? 'Активен' : 'Неактивен'}
						color={row.isActive ? 'var(--success)' : 'var(--muted-fg)'}
					/>
				{:else}
					{column.accessor?.(row, rowIndex) ?? '—'}
				{/if}
			{/snippet}
		</DataTable>
	</div>
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

			.image {
				width: 36px;
				height: 36px;
				border-radius: var(--radius-sm);
				object-fit: cover;
				flex-shrink: 0;
				background: var(--surface-hover);

				&.placeholder {
					display: flex;
					align-items: center;
					justify-content: center;
					color: var(--muted-fg);
				}
			}

			.branch_title {
				font-weight: 500;
			}
		}

		.contacts_cell {
			display: flex;
			flex-direction: column;
			gap: 4px;

			.contact_link {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				font-size: 12px;
				color: var(--muted-fg);
				text-decoration: none;

				span {
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					max-width: 180px;
				}

				&:hover {
					color: var(--primary);
				}
			}
		}
	}
</style>
