<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole } from '@/api/model';
	import { ROLE_LABELS } from '@/lib/constants/roles';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Avatar from '@/components/ui/Avatar.svelte';
	import type {
		UserCinemaEntity,
		GetStaffV1Params,
		GetStaffV1Role
	} from '@/api/model';

	type StaffFilters = {
		cinemaId: string;
		branchId: string;
		role: string;
	};

	const table = useTableQuery<GetStaffV1Params, StaffFilters>({
		filters: { cinemaId: '', branchId: '', role: '' }
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

	const ROLE_OPTIONS = [
		{ value: UserRole.SUPER_ADMIN, label: 'Супер-админ' },
		{ value: UserRole.ADMIN, label: 'Админ' },
		{ value: UserRole.MANAGER, label: 'Менеджер' },
		{ value: UserRole.STAFF, label: 'Сотрудник' }
	];

	const queryParams = $derived<GetStaffV1Params>({
		...table.params,
		...(table.filters.role && {
			role: table.filters.role as GetStaffV1Role
		})
	});

	const staffQuery = crmQueryApi.createGetStaffV1(() => queryParams);
	const staff = $derived(staffQuery.data?.data ?? []);
	const meta = $derived(staffQuery.data?.meta);

	const ROLE_COLORS: Record<string, string> = {
		SUPER_ADMIN: 'var(--danger)',
		ADMIN: 'var(--warning)',
		MANAGER: 'var(--info)',
		STAFF: 'var(--success)',
		CUSTOMER: 'var(--muted-fg)'
	};

	const getDisplayName = (row: UserCinemaEntity): string => {
		if (!row.user) return row.userId;
		return (
			[row.user.firstName, row.user.lastName]
				.filter(Boolean)
				.join(' ')
				.trim() ||
			row.user.email ||
			row.userId
		);
	};

	const getInitials = (row: UserCinemaEntity): string => {
		if (!row.user) return '?';
		const first = row.user.firstName?.[0] ?? '';
		const last = row.user.lastName?.[0] ?? '';
		return (first + last).trim() || row.user.email?.[0] || '?';
	};

	const columns: Column<UserCinemaEntity>[] = [
		{ key: 'user', title: 'Сотрудник', minWidth: 220 },
		{
			key: 'email',
			title: 'Email',
			minWidth: 200,
			accessor: (row) => row.user?.email ?? '—'
		},
		{
			key: 'phone',
			title: 'Телефон',
			width: '160px',
			accessor: (row) => row.user?.phone ?? '—'
		},
		{ key: 'role', title: 'Роль', width: '150px' },
		{
			key: 'cinema',
			title: 'Кинотеатр',
			minWidth: 180,
			accessor: (row) => (row.cinema ? getLocalizedValue(row.cinema.name) : '—')
		},
		{
			key: 'createdAt',
			title: 'Добавлен',
			width: '140px',
			align: 'right',
			accessor: (row) => new Date(row.createdAt).toLocaleDateString('ru-RU')
		}
	];
</script>

<svelte:head><title>Сотрудники — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.ADMIN} redirectTo="/admin/dashboard">
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
					label="Роль"
					placeholder="Любая роль"
					value={table.filters.role}
					options={ROLE_OPTIONS}
					allowClear
					onChange={(vals) => table.setFilter('role', String(vals[0] ?? ''))}
				/>
			</div>
		</div>

		<DataTable
			{columns}
			data={staff}
			loading={staffQuery.isLoading}
			total={meta?.total ?? 0}
			page={table.page}
			pageSize={table.limit}
			onPageChange={table.setPage}
			onPageSizeChange={table.setLimit}
		>
			{#snippet cell({ row, column, rowIndex })}
				{#if column.key === 'user'}
					<div class="user_cell">
						<Avatar
							src={row.user?.photo}
							initials={getInitials(row)}
							size={32}
						/>
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
