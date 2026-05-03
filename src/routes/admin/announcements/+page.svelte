<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { formatDate } from '@/lib/utils/datetime';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Popconfirm from '@/components/ui/Popconfirm.svelte';
	import AnnouncementFormModal from './components/AnnouncementFormModal.svelte';
	import type {
		AnnouncementEntity,
		GetAnnouncementsV1Params
	} from '@/api/model';

	type AnnouncementFilters = {
		status: string;
		movieId: string;
	};

	const STATUS_OPTIONS = [
		{ value: 'true', label: 'Активные' },
		{ value: 'false', label: 'Неактивные' }
	];

	const table = useTableQuery<GetAnnouncementsV1Params, AnnouncementFilters>({
		searchKey: 'title',
		filters: { status: '', movieId: '' }
	});

	let formOpen = $state(false);
	let editingAnnouncement = $state<AnnouncementEntity | null>(null);

	const moviesQuery = crmQueryApi.createGetMoviesV1(() => ({
		page: 1,
		limit: 100
	}));
	const movies = $derived(moviesQuery.data?.data ?? []);
	const movieOptions = $derived(
		movies.map((m) => ({ value: m.id, label: getLocalizedValue(m.title) }))
	);

	const queryParams = $derived<GetAnnouncementsV1Params>({
		...table.params,
		...(table.filters.status && {
			isActive: table.filters.status === 'true'
		})
	});

	const query = crmQueryApi.createGetAnnouncementsV1(() => queryParams);
	const data = $derived(query.data?.data ?? []);
	const meta = $derived(query.data?.meta);

	const deleteMutation = crmQueryApi.createDeleteAnnouncementsByIdV1Mutation();

	const handleCreate = () => {
		editingAnnouncement = null;
		formOpen = true;
	};

	const handleEdit = (announcement: AnnouncementEntity) => {
		editingAnnouncement = announcement;
		formOpen = true;
	};

	const handleDelete = async (id: string) => {
		await deleteMutation.mutateAsync({ id });
		query.refetch();
	};

	const formatPeriod = (row: AnnouncementEntity): string => {
		const start = formatDate(row.publishDate);
		const end = row.expiryDate ? formatDate(row.expiryDate) : '∞';
		return `${start} — ${end}`;
	};

	const columns: Column<AnnouncementEntity>[] = [
		{ key: 'title', title: 'Заголовок', minWidth: 240 },
		{
			key: 'movie',
			title: 'Фильм',
			minWidth: 180,
			accessor: (row) => (row.movie ? getLocalizedValue(row.movie.title) : '—')
		},
		{
			key: 'period',
			title: 'Период',
			width: '220px',
			accessor: formatPeriod
		},
		{ key: 'isActive', title: 'Статус', width: '120px' },
		{ key: 'actions', title: '', width: '80px', align: 'center' }
	];
</script>

<svelte:head><title>Анонсы — ZeroWaiting Admin</title></svelte:head>

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
				Добавить анонс
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
			<div class="filter">
				<Select
					label="Фильм"
					placeholder="Любой фильм"
					value={table.filters.movieId}
					options={movieOptions}
					allowClear
					onChange={(vals) => table.setFilter('movieId', String(vals[0] ?? ''))}
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
							title="Удалить анонс?"
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

	<AnnouncementFormModal
		bind:open={formOpen}
		announcement={editingAnnouncement}
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

		.cell_actions {
			display: flex;
			align-items: center;
			gap: 4px;
		}
	}
</style>
