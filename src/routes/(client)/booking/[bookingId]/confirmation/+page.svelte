<script lang="ts">
	import { page } from '$app/state';
	import { _, locale } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { formatPriceCompact } from '@/lib/utils/price';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import Button from '@/components/ui/Button.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Icon from '@iconify/svelte';
	import TicketViewer from '@/components/booking/TicketViewer.svelte';
	import TicketScreeningHeader from '@/components/booking/TicketScreeningHeader.svelte';
	import { seatSelection } from '@/lib/stores/seat-selection.svelte';
	import { BOOKING_STATUS_CONFIG } from '@/lib/constants/booking-status';
	import { onDestroy } from 'svelte';

	const bookingId = $derived(page.params.bookingId);
	const bookingQuery = crmQueryApi.createGetBookingsByIdV1(() => bookingId!);

	const booking = $derived(bookingQuery.data);
	const screening = $derived(booking?.screening);
	const movie = $derived(screening?.movie);
	const hall = $derived(screening?.hall);
	const branch = $derived(hall?.branch);

	const movieTitle = $derived(movie ? getLocalizedValue(movie.title, $locale) : '');
	const branchName = $derived(branch ? getLocalizedValue(branch.name, $locale) : '');

	const showHeader = $derived(!!(screening && movie && branch));
	const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');

	onDestroy(() => {
		seatSelection.clear();
	});
</script>

<svelte:head>
	<title>{$_('booking.confirmation')} — ZeroWaiting</title>
</svelte:head>

{#if bookingQuery.isLoading}
	<div class="ConfirmationPage">
		<div class="container">
			<Skeleton height="60px" width="50%" />
			<Skeleton height="180px" />
			<Skeleton height="300px" />
		</div>
	</div>
{:else if booking}
	<div class="ConfirmationPage">
		<div class="container">
			<div class="header">
				<div class="icon">
					<Icon icon="lucide:check-circle" width={64} />
				</div>
				<h1 class="title">{$_('booking.confirmation')}</h1>
				<p class="subtitle">{$_('booking.scanQr')}</p>
			</div>

			{#if showHeader && movie && hall && branch && screening}
				<TicketScreeningHeader
					posterUrl={movie.posterUrl ?? null}
					movieTitle={movieTitle}
					ageRating={movie.ageRating}
					duration={movie.duration}
					branchName={branchName}
					hallName={hall.name}
					startTime={screening.startTime}
					format={screening.format}
				/>
			{/if}

			<p class="booking_meta">
				<span>
					{$_('screening.total')}
					<strong>{formatPriceCompact(booking.totalPrice)}</strong>
				</span>
				<span class="dot">·</span>
				<Badge
					text={$_(BOOKING_STATUS_CONFIG[booking.status]?.labelKey ?? booking.status)}
					color={BOOKING_STATUS_CONFIG[booking.status]?.color ?? 'var(--muted-fg)'}
				/>
				<span class="dot">·</span>
				<span class="booking_id">#{booking.id.slice(0, 8)}</span>
			</p>

			{#if booking.viewerCode && booking.seats}
				<div class="tickets">
					<TicketViewer
						viewerUrl={`${origin}/t/m/${booking.viewerCode}`}
						{origin}
						seats={booking.seats
							.filter((bs) => bs.seat)
							.map((bs) => ({
								row: bs.seat!.rowNumber,
								seat: bs.seat!.seatNumber,
								qrCode: bs.ticket?.qrCode ?? '',
								status: bs.ticket?.status ?? 'VALID'
							}))
							.filter((s) => s.qrCode)}
					/>
				</div>
			{/if}

			<div class="actions">
				<Button href="/profile/bookings" variant="outline" icon="lucide:ticket">
					{$_('nav.myBookings')}
				</Button>
				<Button href="/" variant="primary" icon="lucide:home">
					{$_('nav.home')}
				</Button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.ConfirmationPage {
		padding: var(--space-8) 0 var(--space-16);

		.header {
			text-align: center;
			margin-bottom: var(--space-6);

			.icon {
				color: var(--success);
				margin-bottom: var(--space-3);
			}

			.title {
				font-size: var(--text-3xl);
				font-weight: var(--weight-bold);
			}

			.subtitle {
				font-size: var(--text-base);
				color: var(--muted-fg);
				margin-top: var(--space-2);
			}
		}

		.booking_meta {
			max-width: 640px;
			margin: var(--space-3) auto var(--space-6);
			display: flex;
			align-items: center;
			justify-content: center;
			gap: var(--space-2);
			flex-wrap: wrap;
			color: var(--muted-fg);
			font-size: var(--text-sm);

			strong {
				color: var(--foreground);
				font-weight: var(--weight-semibold);
			}

			.dot {
				color: var(--border-color);
			}

			.booking_id {
				font-family: monospace;
			}
		}

		.tickets {
			max-width: 640px;
			margin: 0 auto var(--space-8);
		}

		.actions {
			display: flex;
			justify-content: center;
			gap: var(--space-4);
		}
	}
</style>
