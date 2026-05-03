<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { formatDate, formatDuration } from '@/lib/utils/datetime';
	import { MOVIE_STATUS_CONFIG } from '@/lib/constants/movie-status';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole, MovieStatus } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import DateRangeFilter from '@/components/ui/DateRangeFilter.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Popconfirm from '@/components/ui/Popconfirm.svelte';
	import MovieFormModal from './components/MovieFormModal.svelte';
	import type {
		MovieEntity,
		GetMoviesV1Params,
		GetMoviesV1Status
	} from '@/api/model';

	type MovieFilters = {
		status: string;
		language: string;
		ageRating: string;
	};

	const table = useTableQuery<GetMoviesV1Params, MovieFilters>({
		searchKey: 'title',
		dateFromKey: 'releaseDateFrom',
		dateToKey: 'releaseDateTo',
		filters: { status: '', language: '', ageRating: '' }
	});

	let formOpen = $state(false);
	let editingMovie = $state<MovieEntity | null>(null);

	const STATUS_OPTIONS = [
		{ value: MovieStatus.NOW_SHOWING, label: 'В прокате' },
		{ value: MovieStatus.UPCOMING, label: 'Скоро' },
		{ value: MovieStatus.ARCHIVED, label: 'Архив' }
	];

	const LANGUAGE_OPTIONS = [
		{ value: 'ru', label: 'Русский' },
		{ value: 'en', label: 'Английский' },
		{ value: 'kg', label: 'Кыргызский' },
		{ value: 'kz', label: 'Казахский' },
		{ value: 'uz', label: 'Узбекский' }
	];

	const AGE_RATING_OPTIONS = [
		{ value: '0+', label: '0+' },
		{ value: '6+', label: '6+' },
		{ value: '12+', label: '12+' },
		{ value: '16+', label: '16+' },
		{ value: '18+', label: '18+' }
	];

	const queryParams = $derived<GetMoviesV1Params>({
		...table.params,
		...(table.filters.status && {
			status: table.filters.status as GetMoviesV1Status
		})
	});

	const moviesQuery = crmQueryApi.createGetMoviesV1(() => queryParams);

	const movies = $derived(moviesQuery.data?.data ?? []);
	const meta = $derived(moviesQuery.data?.meta);

	const deleteMutation = crmQueryApi.createDeleteMoviesByIdV1Mutation();

	const handleCreate = () => {
		editingMovie = null;
		formOpen = true;
	};

	const handleEdit = (movie: MovieEntity) => {
		editingMovie = movie;
		formOpen = true;
	};

	const handleDelete = async (id: string) => {
		await deleteMutation.mutateAsync({ id });
		moviesQuery.refetch();
	};

	const columns: Column<MovieEntity>[] = [
		{ key: 'title', title: 'Название', minWidth: 240 },
		{ key: 'status', title: 'Статус', width: '120px' },
		{
			key: 'genres',
			title: 'Жанры',
			minWidth: 180,
			accessor: (row) => row.genres?.join(', ') || '—'
		},
		{
			key: 'language',
			title: 'Язык',
			width: '100px',
			accessor: (row) => row.language?.toUpperCase() ?? '—'
		},
		{
			key: 'ageRating',
			title: 'Возраст',
			width: '100px',
			align: 'center'
		},
		{
			key: 'duration',
			title: 'Длит.',
			width: '100px',
			accessor: (row) => formatDuration(row.duration)
		},
		{
			key: 'releaseDate',
			title: 'Дата выхода',
			width: '150px',
			accessor: (row) => formatDate(row.releaseDate)
		},
		{ key: 'actions', title: '', width: '80px', align: 'center' }
	];
</script>

<svelte:head>
	<title>Фильмы — ZeroWaiting Admin</title>
</svelte:head>

<RoleGuard minRole={UserRole.ADMIN} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar top">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск фильмов..."
				/>
			</div>
			<Button
				variant="primary"
				size="sm"
				icon="lucide:plus"
				onclick={handleCreate}
			>
				Добавить фильм
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
					label="Язык"
					placeholder="Любой язык"
					value={table.filters.language}
					options={LANGUAGE_OPTIONS}
					allowClear
					onChange={(vals) =>
						table.setFilter('language', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter">
				<Select
					label="Возраст"
					placeholder="Любой"
					value={table.filters.ageRating}
					options={AGE_RATING_OPTIONS}
					allowClear
					onChange={(vals) =>
						table.setFilter('ageRating', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter date_range">
				<DateRangeFilter
					from={table.dateFrom}
					to={table.dateTo}
					labelFrom="Дата выхода с"
					labelTo="По"
					onchange={table.setDateRange}
				/>
			</div>
		</div>

		<DataTable
			{columns}
			data={movies}
			loading={moviesQuery.isLoading}
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
						{#if row.posterUrl}
							<img class="poster" src={row.posterUrl} alt="" />
						{:else}
							<div class="poster placeholder"></div>
						{/if}
						<span>{getLocalizedValue(row.title)}</span>
					</div>
				{:else if column.key === 'status'}
					<Badge
						text={$_(MOVIE_STATUS_CONFIG[row.status]?.labelKey ?? row.status)}
						color={MOVIE_STATUS_CONFIG[row.status]?.color ?? 'var(--muted-fg)'}
					/>
				{:else if column.key === 'ageRating'}
					<Badge
						text={row.ageRating ?? '—'}
						color="var(--warning)"
						variant="outline"
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
							title="Удалить фильм?"
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

	<MovieFormModal
		bind:open={formOpen}
		movie={editingMovie}
		onclose={() => {
			formOpen = false;
		}}
		onsaved={() => {
			moviesQuery.refetch();
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
			}

			.date_range {
				flex: 1 1 320px;
				min-width: 280px;
			}
		}

		.cell_title {
			display: flex;
			align-items: center;
			gap: 12px;

			.poster {
				width: 36px;
				height: 54px;
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
