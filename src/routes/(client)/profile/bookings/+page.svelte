<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { formatDateTime } from '@/lib/utils/datetime';
	import { formatPriceCompact } from '@/lib/utils/price';
	import { BOOKING_STATUS_CONFIG } from '@/lib/constants/booking-status';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Pagination from '@/components/ui/Pagination.svelte';
	import EmptyState from '@/components/ui/EmptyState.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Icon from '@iconify/svelte';
	import type { GetProfileMeBookingsV1Params } from '@/api/model';

	const table = useTableQuery<GetProfileMeBookingsV1Params>({
		defaultLimit: 10
	});

	const bookingsQuery = crmQueryApi.createGetProfileMeBookingsV1(
		() => table.params
	);

	const bookings = $derived(bookingsQuery.data?.data ?? []);
	const meta = $derived(bookingsQuery.data?.meta);
</script>

<svelte:head>
	<title>{$_('profile.bookings')} — ZeroWaiting</title>
</svelte:head>

<div class="BookingsPage">
	<SectionHeader title={$_('profile.bookings')} />

	{#if bookingsQuery.isLoading}
		<div class="list">
			{#each Array(3) as _}
				<Skeleton height="100px" radius="var(--radius-lg)" />
			{/each}
		</div>
	{:else if bookings.length === 0}
		<EmptyState icon="lucide:ticket-x" title={$_('profile.noBookings')} />
	{:else}
		<div class="list">
			{#each bookings as booking}
				{@const cfg = BOOKING_STATUS_CONFIG[booking.status]}
				<a href="/booking/{booking.id}/confirmation" class="card glass-card">
					<div class="main">
						<div class="row">
							<span class="id">#{booking.id.slice(0, 8)}</span>
							<Badge
								text={$_(cfg?.labelKey ?? booking.status)}
								color={cfg?.color ?? 'var(--muted-fg)'}
							/>
						</div>
						<div class="meta">
							<span>
								<Icon icon="lucide:calendar" width={14} />
								{formatDateTime(booking.createdAt)}
							</span>
							<span>
								<Icon icon="lucide:tag" width={14} />
								{$_(`common.bookingType.${booking.type}`)}
							</span>
						</div>
					</div>
					<div class="price">
						{formatPriceCompact(booking.totalPrice)}
					</div>
				</a>
			{/each}
		</div>

		{#if meta && meta.totalPages > 1}
			<div class="pagination">
				<Pagination
					page={table.page}
					totalPages={meta.totalPages}
					onchange={table.setPage}
				/>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	.BookingsPage {
		.list {
			display: flex;
			flex-direction: column;
			gap: var(--space-3);
		}

		.card {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: var(--space-4) var(--space-5);
			transition: border-color var(--duration-fast) var(--ease-default);

			&:hover {
				border-color: var(--primary);
			}

			.main {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);

				.row {
					display: flex;
					align-items: center;
					gap: var(--space-3);

					.id {
						font-size: var(--text-sm);
						font-weight: var(--weight-semibold);
						font-family: monospace;
						color: var(--foreground);
					}
				}

				.meta {
					display: flex;
					gap: var(--space-4);
					font-size: var(--text-xs);
					color: var(--muted-fg);

					span {
						display: flex;
						align-items: center;
						gap: 4px;
					}
				}
			}

			.price {
				font-size: var(--text-lg);
				font-weight: var(--weight-bold);
				color: var(--foreground);
			}
		}

		.pagination {
			margin-top: var(--space-6);
		}
	}
</style>
