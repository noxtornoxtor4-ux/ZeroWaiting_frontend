<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import { formatDateTime } from '@/lib/utils/datetime';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import DateRangeFilter from '@/components/ui/DateRangeFilter.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Avatar from '@/components/ui/Avatar.svelte';
	import type { AuditLogEntity, GetAuditLogsV1Params } from '@/api/model';

	type AuditFilters = {
		action: string;
		entity: string;
	};

	const table = useTableQuery<GetAuditLogsV1Params, AuditFilters>({
		filters: { action: '', entity: '' }
	});

	const query = crmQueryApi.createGetAuditLogsV1(() => table.params);
	const data = $derived(query.data?.data ?? []);
	const meta = $derived(query.data?.meta);

	const ACTION_OPTIONS = [
		{ value: 'CREATE', label: 'Создание' },
		{ value: 'UPDATE', label: 'Обновление' },
		{ value: 'DELETE', label: 'Удаление' }
	];

	const ENTITY_OPTIONS = [
		{ value: 'Cinemas', label: 'Кинотеатры' },
		{ value: 'Branches', label: 'Филиалы' },
		{ value: 'Halls', label: 'Залы' },
		{ value: 'Movies', label: 'Фильмы' },
		{ value: 'Screenings', label: 'Сеансы' },
		{ value: 'Bookings', label: 'Бронирования' },
		{ value: 'PromoCodes', label: 'Промокоды' },
		{ value: 'Promotions', label: 'Акции' },
		{ value: 'Announcements', label: 'Анонсы' },
		{ value: 'FoodItems', label: 'Еда' },
		{ value: 'Users', label: 'Пользователи' }
	];

	const ACTION_COLORS: Record<string, string> = {
		CREATE: 'var(--success)',
		UPDATE: 'var(--info)',
		DELETE: 'var(--danger)'
	};

	const ACTION_LABELS: Record<string, string> = {
		CREATE: 'Создание',
		UPDATE: 'Обновление',
		DELETE: 'Удаление'
	};

	const ENTITY_LABELS: Record<string, string> = {
		Cinemas: 'Кинотеатры',
		Branches: 'Филиалы',
		Halls: 'Залы',
		Movies: 'Фильмы',
		Screenings: 'Сеансы',
		Bookings: 'Бронирования',
		PromoCodes: 'Промокоды',
		Promotions: 'Акции',
		Announcements: 'Анонсы',
		FoodItems: 'Еда',
		Users: 'Пользователи',
		Staff: 'Сотрудники',
		GroupBookings: 'Групповые заявки',
		Notifications: 'Уведомления',
		Tickets: 'Билеты',
		Payments: 'Платежи',
		Seats: 'Места',
		Reviews: 'Отзывы',
		Favorites: 'Избранное',
		LoyaltyCards: 'Карты лояльности'
	};

	const ROLE_LABELS: Record<string, string> = {
		CUSTOMER: 'Клиент',
		STAFF: 'Сотрудник',
		MANAGER: 'Менеджер',
		ADMIN: 'Админ',
		SUPER_ADMIN: 'Супер-админ'
	};

	const ROLE_COLORS: Record<string, string> = {
		CUSTOMER: 'var(--muted-fg)',
		STAFF: 'var(--info)',
		MANAGER: 'var(--warning)',
		ADMIN: 'var(--success)',
		SUPER_ADMIN: 'var(--danger)'
	};

	const columns: Column<AuditLogEntity>[] = [
		{ key: 'action', title: 'Действие', width: '140px' },
		{
			key: 'entity',
			title: 'Сущность',
			width: '140px',
			accessor: (row) => ENTITY_LABELS[row.entity] ?? row.entity
		},
		{
			key: 'entityId',
			title: 'ID объекта',
			width: '120px',
			accessor: (row) => (row.entityId ? row.entityId.slice(0, 8) + '...' : '—')
		},
		{ key: 'user', title: 'Пользователь', width: '200px' },
		{
			key: 'email',
			title: 'Email',
			width: '200px',
			accessor: (row) => row.user?.email ?? '—'
		},
		{ key: 'role', title: 'Роль', width: '130px' },
		{
			key: 'ipAddress',
			title: 'IP',
			width: '120px',
			accessor: (row) => row.ipAddress ?? '—'
		},
		{
			key: 'createdAt',
			title: 'Дата',
			width: '180px',
			align: 'right',
			accessor: (row) => formatDateTime(row.createdAt)
		}
	];
</script>

<svelte:head><title>Аудит-лог — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.ADMIN} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="filters">
			<div class="filter">
				<Select
					label="Действие"
					placeholder="Любое действие"
					value={table.filters.action}
					options={ACTION_OPTIONS}
					allowClear
					onChange={(vals) => table.setFilter('action', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter">
				<Select
					label="Сущность"
					placeholder="Любая сущность"
					value={table.filters.entity}
					options={ENTITY_OPTIONS}
					allowClear
					onChange={(vals) => table.setFilter('entity', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter date_range">
				<DateRangeFilter
					from={table.dateFrom}
					to={table.dateTo}
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
				{#if column.key === 'action'}
					<Badge
						text={ACTION_LABELS[row.action] ?? row.action}
						color={ACTION_COLORS[row.action] ?? 'var(--muted-fg)'}
					/>
				{:else if column.key === 'entityId'}
					<span
						style="font-family: monospace; font-size: 12px; color: var(--muted-fg);"
					>
						{column.accessor?.(row, rowIndex) ?? '—'}
					</span>
				{:else if column.key === 'user'}
					{#if row.user}
						<div class="user_cell">
							<Avatar
								src={row.user.photo}
								initials={row.user.firstName[0] +
									(row.user.lastName?.[0] ?? '')}
								size={24}
							/>
							<span>{row.user.firstName} {row.user.lastName ?? ''}</span>
						</div>
					{:else}
						<span style="color: var(--muted-fg);">—</span>
					{/if}
				{:else if column.key === 'role'}
					{#if row.user?.role}
						<Badge
							text={ROLE_LABELS[row.user.role] ?? row.user.role}
							color={ROLE_COLORS[row.user.role] ?? 'var(--muted-fg)'}
						/>
					{:else}
						<span style="color: var(--muted-fg);">—</span>
					{/if}
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
				max-width: unset;
			}
		}

		.user_cell {
			display: flex;
			align-items: center;
			gap: 8px;

			span {
				font-size: 13px;
			}
		}
	}
</style>
