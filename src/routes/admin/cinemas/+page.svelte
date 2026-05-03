<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Popconfirm from '@/components/ui/Popconfirm.svelte';
	import Icon from '@iconify/svelte';
	import CinemaFormModal from './components/CinemaFormModal.svelte';
	import type { CinemaEntity, GetCinemasV1Params } from '@/api/model';

	type CinemaFilters = { isActive: string };

	const table = useTableQuery<GetCinemasV1Params, CinemaFilters>({
		searchKey: 'name',
		filters: { isActive: '' }
	});

	let formOpen = $state(false);
	let editingCinema = $state<CinemaEntity | null>(null);

	const STATUS_OPTIONS = [
		{ value: 'true', label: 'Активные' },
		{ value: 'false', label: 'Неактивные' }
	];

	const queryParams = $derived<GetCinemasV1Params>({
		...table.params,
		...(table.filters.isActive && {
			isActive: table.filters.isActive === 'true'
		})
	});

	const query = crmQueryApi.createGetCinemasV1(() => queryParams);
	const cinemas = $derived(query.data?.data ?? []);
	const meta = $derived(query.data?.meta);

	const deleteMutation = crmQueryApi.createDeleteCinemasByIdV1Mutation();

	const handleCreate = () => {
		editingCinema = null;
		formOpen = true;
	};

	const handleEdit = (cinema: CinemaEntity) => {
		editingCinema = cinema;
		formOpen = true;
	};

	const handleDelete = async (id: string) => {
		await deleteMutation.mutateAsync({ id });
		query.refetch();
	};

	const columns: Column<CinemaEntity>[] = [
		{ key: 'name', title: 'Название', minWidth: 260 },
		{
			key: 'description',
			title: 'Описание',
			minWidth: 300,
			accessor: (row) =>
				row.description ? getLocalizedValue(row.description) : '—'
		},
		{ key: 'website', title: 'Сайт', width: '180px' },
		{ key: 'isActive', title: 'Статус', width: '120px' },
		{ key: 'actions', title: '', width: '80px', align: 'center' }
	];
</script>

<svelte:head><title>Кинотеатры — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.ADMIN} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar top">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск кинотеатров..."
				/>
			</div>
			<Button
				variant="primary"
				size="sm"
				icon="lucide:plus"
				onclick={handleCreate}
			>
				Добавить кинотеатр
			</Button>
		</div>

		<div class="filters">
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
			data={cinemas}
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
						{#if row.logoUrl}
							<img class="logo" src={row.logoUrl} alt="" />
						{:else}
							<div class="logo placeholder">
								<Icon icon="lucide:building-2" width={18} />
							</div>
						{/if}
						<span class="cinema_title">{getLocalizedValue(row.name)}</span>
					</div>
				{:else if column.key === 'description'}
					<span class="description_cell"
						>{column.accessor?.(row, rowIndex) ?? '—'}</span
					>
				{:else if column.key === 'website'}
					{#if row.website}
						<a
							class="website_link"
							href={row.website}
							target="_blank"
							rel="noopener noreferrer"
						>
							<Icon icon="lucide:external-link" width={12} />
							<span>{row.website.replace(/^https?:\/\//, '')}</span>
						</a>
					{:else}
						<span style="color: var(--muted-fg);">—</span>
					{/if}
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
							title="Удалить кинотеатр?"
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

	<CinemaFormModal
		bind:open={formOpen}
		cinema={editingCinema}
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

			.logo {
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

			.cinema_title {
				font-weight: 500;
			}
		}

		.description_cell {
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
			font-size: 13px;
			color: var(--muted-fg);
			white-space: normal;
			line-height: 1.4;
		}

		.website_link {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			font-size: 12px;
			color: var(--primary-light);
			text-decoration: none;
			max-width: 100%;

			span {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			&:hover {
				color: var(--primary);
				text-decoration: underline;
			}
		}

		.cell_actions {
			display: flex;
			align-items: center;
			gap: 4px;
		}
	}
</style>
