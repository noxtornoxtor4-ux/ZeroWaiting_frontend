<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { formatDateTime } from '@/lib/utils/datetime';
	import { formatPriceCompact } from '@/lib/utils/price';
	import { BOOKING_STATUS_CONFIG } from '@/lib/constants/booking-status';
	import { ROLE_LABELS } from '@/lib/constants/roles';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import DateRangeFilter from '@/components/ui/DateRangeFilter.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Avatar from '@/components/ui/Avatar.svelte';
	import type { BookingEntity, GetBookingsV1Params } from '@/api/model';

	const BOOKING_TYPE_LABELS: Record<string, string> = {
		ONLINE: 'Онлайн',
		OFFLINE: 'Касса',
		GROUP: 'Групповая'
	};

	const ROLE_COLORS: Record<string, string> = {
		CUSTOMER: 'var(--muted-fg)',
		STAFF: 'var(--info)',
		MANAGER: 'var(--warning)',
		ADMIN: 'var(--success)',
		SUPER_ADMIN: 'var(--danger)'
	};

	const table = useTableQuery<GetBookingsV1Params>({ searchKey: 'guestName' });

	const query = crmQueryApi.createGetBookingsV1(() => table.params);
	const bookings = $derived(query.data?.data ?? []);
	const meta = $derived(query.data?.meta);

	const getDisplayName = (row: BookingEntity): string => {
		if (row.user) {
			const full = [row.user.firstName, row.user.lastName]
				.filter(Boolean)
				.join(' ')
				.trim();
			return full || row.user.email || '—';
		}
		return row.guestName?.trim() || '—';
	};

	const getInitials = (row: BookingEntity): string => {
		if (row.user) {
			const first = row.user.firstName?.[0] ?? '';
			const last = row.user.lastName?.[0] ?? '';
			return (first + last).trim() || row.user.email?.[0] || '?';
		}
		return row.guestName?.[0] ?? '?';
	};

	const columns: Column<BookingEntity>[] = [
		{
			key: 'id',
			title: 'ID',
			width: '120px',
			accessor: (row) => row.id?.toString().slice(0, 8) + '...'
		},
		{ key: 'customer', title: 'ФИО', minWidth: 220 },
		{
			key: 'email',
			title: 'Email',
			width: '220px',
			accessor: (row) => row.user?.email ?? row.guestEmail ?? '—'
		},
		{ key: 'role', title: 'Роль', width: '130px' },
		{ key: 'type', title: 'Тип', width: '100px' },
		{ key: 'status', title: 'Статус', width: '120px' },
		{
			key: 'totalPrice',
			title: 'Сумма',
			width: '120px',
			align: 'right',
			accessor: (row) => formatPriceCompact(row.totalPrice)
		},
		{
			key: 'createdAt',
			title: 'Дата',
			width: '200px',
			align: 'right',
			accessor: (row) => formatDateTime(row.createdAt)
		}
	];
</script>

<svelte:head><title>Бронирования — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.MANAGER} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск по имени гостя..."
				/>
			</div>
			<DateRangeFilter
				from={table.dateFrom}
				to={table.dateTo}
				onchange={table.setDateRange}
			/>
		</div>

		<DataTable
			{columns}
			data={bookings}
			loading={query.isLoading}
			total={meta?.total ?? 0}
			page={table.page}
			pageSize={table.limit}
			onPageChange={table.setPage}
			onPageSizeChange={table.setLimit}
		>
			{#snippet cell({ row, column, rowIndex })}
				{#if column.key === 'id'}
					<span style="font-family: monospace; font-size: 12px;">
						{row.id?.toString().slice(0, 8)}...
					</span>
				{:else if column.key === 'customer'}
					<div class="user_cell">
						<Avatar
							src={row.user?.photo}
							initials={getInitials(row)}
							size={28}
						/>
						<span>{getDisplayName(row)}</span>
					</div>
				{:else if column.key === 'role'}
					{#if row.user?.role}
						<Badge
							text={ROLE_LABELS[row.user.role] ?? row.user.role}
							color={ROLE_COLORS[row.user.role] ?? 'var(--muted-fg)'}
						/>
					{:else}
						<span style="color: var(--muted-fg);">Гость</span>
					{/if}
				{:else if column.key === 'type'}
					<Badge
						text={BOOKING_TYPE_LABELS[row.type] ?? row.type}
						color="var(--muted-fg)"
						variant="outline"
					/>
				{:else if column.key === 'status'}
					{@const cfg = BOOKING_STATUS_CONFIG[row.status]}
					<Badge
						text={$_(cfg?.labelKey ?? row.status)}
						color={cfg?.color ?? 'var(--muted-fg)'}
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

		.toolbar {
			display: flex;
			align-items: flex-end;
			gap: 16px;
			flex-wrap: wrap;

			.search {
				flex: 1;
				min-width: 240px;
				max-width: 360px;
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
