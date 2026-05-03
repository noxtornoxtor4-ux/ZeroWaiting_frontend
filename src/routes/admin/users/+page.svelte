<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole } from '@/api/model';
	import { ROLE_LABELS } from '@/lib/constants/roles';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import DateRangeFilter from '@/components/ui/DateRangeFilter.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Avatar from '@/components/ui/Avatar.svelte';
	import type {
		UserEntity,
		GetSuperAdminUsersV1Params,
		GetSuperAdminUsersV1Role
	} from '@/api/model';

	type UsersFilters = {
		role: string;
	};

	const table = useTableQuery<GetSuperAdminUsersV1Params, UsersFilters>({
		filters: { role: '' }
	});

	const ROLE_OPTIONS = [
		{ value: UserRole.SUPER_ADMIN, label: 'Супер-админ' },
		{ value: UserRole.ADMIN, label: 'Админ' },
		{ value: UserRole.MANAGER, label: 'Менеджер' },
		{ value: UserRole.STAFF, label: 'Сотрудник' },
		{ value: UserRole.CUSTOMER, label: 'Клиент' }
	];

	const queryParams = $derived<GetSuperAdminUsersV1Params>({
		...table.params,
		...(table.filters.role && {
			role: table.filters.role as GetSuperAdminUsersV1Role
		})
	});

	const query = crmQueryApi.createGetSuperAdminUsersV1(() => queryParams);
	const data = $derived(query.data?.data ?? []);
	const meta = $derived(query.data?.meta);

	const ROLE_COLORS: Record<string, string> = {
		SUPER_ADMIN: 'var(--danger)',
		ADMIN: 'var(--warning)',
		MANAGER: 'var(--info)',
		STAFF: 'var(--success)',
		CUSTOMER: 'var(--muted-fg)'
	};

	const getDisplayName = (row: UserEntity): string =>
		[row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email;

	const getInitials = (row: UserEntity): string => {
		const first = row.firstName?.[0] ?? '';
		const last = row.lastName?.[0] ?? '';
		return (first + last).trim() || row.email?.[0] || '?';
	};

	const columns: Column<UserEntity>[] = [
		{ key: 'user', title: 'Пользователь', minWidth: 220 },
		{
			key: 'email',
			title: 'Email',
			minWidth: 200,
			accessor: (row) => row.email
		},
		{
			key: 'phone',
			title: 'Телефон',
			width: '160px',
			accessor: (row) => row.phone ?? '—'
		},
		{ key: 'role', title: 'Роль', width: '140px' },
		{
			key: 'createdAt',
			title: 'Регистрация',
			width: '140px',
			align: 'right',
			accessor: (row) => new Date(row.createdAt).toLocaleDateString('ru-RU')
		}
	];
</script>

<svelte:head><title>Пользователи — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.SUPER_ADMIN} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar top">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск по имени или email..."
				/>
			</div>
		</div>

		<div class="filters">
			<div class="filter">
				<Select
					label="Роль"
					placeholder="Любая роль"
					value={table.filters.role}
					options={ROLE_OPTIONS}
					allowClear
					onChange={(vals) => table.setFilter('role', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter date_range">
				<DateRangeFilter
					from={table.dateFrom}
					to={table.dateTo}
					labelFrom="Регистрация с"
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
				{#if column.key === 'user'}
					<div class="user_cell">
						<Avatar src={row.photo} initials={getInitials(row)} size={32} />
						<span class="user_name">{getDisplayName(row)}</span>
					</div>
				{:else if column.key === 'role'}
					<Badge
						text={ROLE_LABELS[row.role] ?? row.role}
						color={ROLE_COLORS[row.role] ?? 'var(--muted-fg)'}
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

		.user_cell {
			display: flex;
			align-items: center;
			gap: 10px;

			.user_name {
				font-weight: 500;
			}
		}
	}
</style>
