<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { formatDateTime } from '@/lib/utils/datetime';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole, BookingStatus, GroupBookingType } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import DateRangeFilter from '@/components/ui/DateRangeFilter.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import type {
		GroupBookingEntity,
		GetGroupBookingsV1Params
	} from '@/api/model';

	type GroupBookingFilters = {
		status: string;
		type: string;
	};

	const GROUP_STATUS_LABELS: Record<string, string> = {
		PENDING: 'Ожидание',
		CONFIRMED: 'Подтверждено',
		CANCELLED: 'Отменено',
		COMPLETED: 'Завершено',
		NO_SHOW: 'Не явились'
	};

	const STATUS_COLORS: Record<string, string> = {
		PENDING: 'var(--warning)',
		CONFIRMED: 'var(--success)',
		CANCELLED: 'var(--danger)',
		COMPLETED: 'var(--info)',
		NO_SHOW: 'var(--muted-fg)'
	};

	const GROUP_TYPE_LABELS: Record<string, string> = {
		BIRTHDAY: 'День рождения',
		CORPORATE: 'Корпоратив',
		SCHOOL: 'Школа',
		PRIVATE: 'Приват'
	};

	const STATUS_OPTIONS = Object.entries(GROUP_STATUS_LABELS).map(
		([value, label]) => ({ value, label })
	);

	const TYPE_OPTIONS = Object.entries(GROUP_TYPE_LABELS).map(
		([value, label]) => ({ value, label })
	);

	const table = useTableQuery<GetGroupBookingsV1Params, GroupBookingFilters>({
		filters: { status: '', type: '' }
	});

	const queryParams = $derived<GetGroupBookingsV1Params>({
		...table.params,
		...(table.filters.status && {
			status: table.filters.status as BookingStatus
		}),
		...(table.filters.type && {
			type: table.filters.type as GroupBookingType
		})
	});

	const query = crmQueryApi.createGetGroupBookingsV1(() => queryParams);
	const data = $derived(query.data?.data ?? []);
	const meta = $derived(query.data?.meta);

	const columns: Column<GroupBookingEntity>[] = [
		{ key: 'type', title: 'Тип', width: '160px' },
		{
			key: 'movie',
			title: 'Фильм / Сеанс',
			minWidth: 220
		},
		{
			key: 'guestCount',
			title: 'Гостей',
			width: '100px',
			align: 'right',
			accessor: (row) => String(row.guestCount)
		},
		{ key: 'contact', title: 'Контакт', minWidth: 200 },
		{ key: 'status', title: 'Статус', width: '140px' },
		{
			key: 'createdAt',
			title: 'Создан',
			width: '160px',
			align: 'right',
			accessor: (row) => formatDateTime(row.createdAt)
		}
	];
</script>

<svelte:head><title>Групповые заявки — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.MANAGER} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar top">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск по имени, телефону или email..."
				/>
			</div>
		</div>

		<div class="filters">
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
					labelFrom="Создан с"
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
		>
			{#snippet cell({ row, column, rowIndex })}
				{#if column.key === 'type'}
					<Badge
						text={GROUP_TYPE_LABELS[row.type] ?? row.type}
						color="var(--info)"
						variant="outline"
					/>
				{:else if column.key === 'movie'}
					<div class="movie_cell">
						<span class="movie_title">
							{row.screening?.movie
								? getLocalizedValue(row.screening.movie.title)
								: '—'}
						</span>
						{#if row.screening}
							<span class="screening_time">
								{formatDateTime(row.screening.startTime)}
							</span>
						{/if}
					</div>
				{:else if column.key === 'contact'}
					<div class="contact_cell">
						<span class="contact_name">{row.contactName}</span>
						<a class="contact_phone" href={`tel:${row.contactPhone}`}>
							{row.contactPhone}
						</a>
					</div>
				{:else if column.key === 'status'}
					<Badge
						text={GROUP_STATUS_LABELS[row.status] ?? row.status}
						color={STATUS_COLORS[row.status] ?? 'var(--muted-fg)'}
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

			.date_range {
				flex: 1 1 320px;
				min-width: 280px;
				max-width: none;
			}
		}

		.movie_cell {
			display: flex;
			flex-direction: column;
			gap: 2px;
			min-width: 0;

			.movie_title {
				font-size: 13px;
				color: var(--foreground);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.screening_time {
				font-size: 11px;
				color: var(--muted-fg);
			}
		}

		.contact_cell {
			display: flex;
			flex-direction: column;
			gap: 2px;
			min-width: 0;

			.contact_name {
				font-size: 13px;
				color: var(--foreground);
				font-weight: 500;
			}

			.contact_phone {
				font-size: 11px;
				color: var(--muted-fg);
				text-decoration: none;

				&:hover {
					color: var(--primary);
				}
			}
		}
	}
</style>
