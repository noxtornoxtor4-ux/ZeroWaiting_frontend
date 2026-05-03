<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { locale } from 'svelte-i18n';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import {
		formatTime,
		formatDate,
		formatDuration,
		isInstantPast
	} from '@/lib/utils/datetime';
	import { formatPriceCompact } from '@/lib/utils/price';
	import { seatSelection } from '@/lib/stores/seat-selection.svelte';
	import { BOOKING_CUTOFF_MINUTES } from '@/lib/constants/booking';
	import {
		getBookingConflict,
		isSeatsUnavailable,
		isActiveBookingExists
	} from '@/lib/constants/booking-conflict';
	import { mapSeatIdsToLabels } from '@/lib/utils/seat-label';
	import Button from '@/components/ui/Button.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';
	import { requireAuth } from '@/lib/utils/auth-guard';
	import SeatMap from './components/SeatMap.svelte';
	import SeatLegend from './components/SeatLegend.svelte';
	import ActiveBookingConflictDialog from '@/components/booking/ActiveBookingConflictDialog.svelte';
	import { createActiveBookingGuard } from '@/lib/utils/active-booking-guard.svelte';
	import type { ActiveBookingEntity } from '@/api/model';

	const screeningId = $derived(page.params.id);

	const queryClient = useQueryClient();
	const bookingMutation = crmQueryApi.createPostBookingsV1Mutation();
	const bookingGuard = createActiveBookingGuard(() => screeningId);

	const screeningQuery = crmQueryApi.createGetPublicScreeningsByIdV1(
		() => screeningId!
	);
	const seatsQuery = crmQueryApi.createGetPublicScreeningsByIdAvailableSeatsV1(
		() => screeningId!,
		() => ({ query: { refetchInterval: 15000 } })
	);

	const screening = $derived(screeningQuery.data);
	const envelope = $derived(seatsQuery.data);
	const seats = $derived(envelope?.seats ?? []);
	const hallMeta = $derived(envelope?.hall);

	let now = $state(Date.now());

	$effect(() => {
		const id = setInterval(() => {
			now = Date.now();
		}, 30_000);
		return () => clearInterval(id);
	});

	$effect(() => {
		if (screeningId) seatSelection.bind(screeningId);
	});

	const isFinished = $derived(isInstantPast(screening?.endTime, 0, now));
	const isPastCutoff = $derived(
		isFinished ||
			isInstantPast(screening?.startTime, BOOKING_CUTOFF_MINUTES, now)
	);
	const cutoffMessageKey = $derived(
		isFinished ? 'screening.finished' : 'screening.pastCutoff'
	);

	const FORMAT_LABELS: Record<string, string> = {
		TWO_D: '2D',
		THREE_D: '3D',
		IMAX: 'IMAX',
		DOLBY_ATMOS: 'Dolby Atmos',
		FOUR_DX: '4DX'
	};

	const totalPrice = $derived.by(() => {
		const price = screening?.price ? Number(screening.price) : 0;
		return seatSelection.count * price;
	});

	const movieTitle = $derived(
		screening?.movie
			? getLocalizedValue(
					screening.movie.title as Record<string, string>,
					$locale
				)
			: ''
	);

	const onSeatClick = (seatId: string) => {
		if (isPastCutoff) {
			toast.error($_(cutoffMessageKey));
			return;
		}
		if (!bookingGuard.requireNoActivePending()) return;
		if (!requireAuth('Войдите в аккаунт, чтобы выбрать место')) return;
		seatSelection.toggle(seatId);
	};

	const handleBookingConflict = (error: unknown) => {
		const body = getBookingConflict(error);
		if (!body) {
			toast.error(getErrorMessage(error, $_('booking.errors.generic')));
			return;
		}

		if (isSeatsUnavailable(body)) {
			const labels = mapSeatIdsToLabels(
				body.unavailableSeatIds,
				envelope?.seats
			);
			seatSelection.removeMany(body.unavailableSeatIds);
			queryClient.invalidateQueries({
				queryKey: [`/api/v1/public/screenings/${screeningId}/available-seats`]
			});
			toast.error(
				$_('booking.errors.seats_unavailable', {
					values: { seats: labels.join(', ') }
				})
			);
			return;
		}

		if (isActiveBookingExists(body)) {
			const cached = queryClient.getQueryData(['/api/v1/bookings/active']) as
				| ActiveBookingEntity
				| undefined;
			if (cached) bookingGuard.openWith(cached);
			queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
		}
	};

	const handleContinue = async () => {
		if (seatSelection.isEmpty) return;
		if (isPastCutoff) {
			toast.error($_(cutoffMessageKey));
			return;
		}
		if (!requireAuth('Войдите в аккаунт, чтобы продолжить бронирование'))
			return;

		try {
			const booking = await bookingMutation.mutateAsync({
				data: {
					screeningId: screeningId!,
					type: 'ONLINE',
					seatIds: seatSelection.selectedIds
				}
			});
			queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
			queryClient.invalidateQueries({
				queryKey: [`/api/v1/public/screenings/${screeningId}/available-seats`]
			});
			seatSelection.clear();
			goto(`/booking/${booking.id}`);
		} catch (error) {
			handleBookingConflict(error);
		}
	};

	const handleRebookAfterConflict = async () => {
		await handleContinue();
	};
</script>

<svelte:head>
	<title
		>{movieTitle
			? `${movieTitle} — ${$_('screening.selectSeats')}`
			: $_('screening.selectSeats')} — ZeroWaiting</title
	>
</svelte:head>

{#if screeningQuery.isLoading}
	<div class="ScreeningPage">
		<div class="container">
			<Skeleton height="40px" width="50%" />
			<Skeleton height="300px" />
		</div>
	</div>
{:else if screening}
	<div class="ScreeningPage">
		<div class="container">
			<section class="info">
				{#if screening.movie?.posterUrl}
					<a class="poster" href={`/movies/${screening.movie.id}`}>
						<img src={screening.movie.posterUrl} alt="" />
					</a>
				{/if}

				<div class="details">
					<span class="subtitle">{$_('screening.selectSeats')}</span>
					<h1 class="title">
						{screening.movie
							? getLocalizedValue(
									screening.movie.title as Record<string, string>,
									$locale
								)
							: $_('screening.selectSeats')}
					</h1>

					{#if screening.movie}
						<div class="chips">
							{#if screening.movie.duration}
								<span class="chip">
									<Icon icon="lucide:clock" width={14} />
									{formatDuration(screening.movie.duration)}
								</span>
							{/if}
							{#if screening.movie.ageRating}
								<span class="chip age">{screening.movie.ageRating}</span>
							{/if}
							{#each screening.movie.genres ?? [] as genre}
								<span class="chip">{genre}</span>
							{/each}
						</div>
					{/if}

					<div class="meta">
						{#if screening.hall?.branch}
							<span class="meta_item">
								<Icon icon="lucide:map-pin" width={16} />
								{getLocalizedValue(
									screening.hall.branch.name as Record<string, string>,
									$locale
								)}
							</span>
						{/if}
						{#if screening.hall}
							<span class="meta_item">
								<Icon icon="lucide:armchair" width={16} />
								{screening.hall.name} · {$_(
									`common.hallType.${screening.hall.type}`
								)}
							</span>
						{/if}
						<span class="meta_item">
							<Icon icon="lucide:calendar" width={16} />
							{formatDate(screening.startTime)}
						</span>
						<span class="meta_item">
							<Icon icon="lucide:clock" width={16} />
							<span>{formatTime(screening.startTime)}</span>
							{#if screening.endTime}
								<span class="time_sep">
									<Icon icon="lucide:arrow-right" width={12} />
								</span>
								<span>{formatTime(screening.endTime)}</span>
							{/if}
						</span>
						{#if screening.format}
							<Badge
								text={FORMAT_LABELS[screening.format] ?? screening.format}
								color="var(--info)"
							/>
						{/if}
						<span class="price">{formatPriceCompact(screening.price)}</span>
					</div>
				</div>
			</section>

			<section class="seats">
				{#if isPastCutoff}
					<div class="banner_error">
						<Icon icon="lucide:ban" width={18} />
						<span>{$_(cutoffMessageKey)}</span>
					</div>
				{/if}

				{#if hallMeta}
					<SeatMap
						hall={hallMeta}
						{seats}
						selectedIds={seatSelection.selectedIds}
						disabled={isPastCutoff || bookingMutation.isPending}
						onseatclick={onSeatClick}
					/>
				{/if}

				<SeatLegend />
			</section>

			{#if seatSelection.count > 0}
				<div class="bottom">
					<div class="summary">
						<span class="count">
							{$_('screening.seatsSelected', {
								values: { count: seatSelection.count }
							})}
						</span>
						<span class="total">
							{$_('screening.total')}: {formatPriceCompact(totalPrice)}
						</span>
					</div>
					<Button
						variant="primary"
						size="lg"
						loading={bookingMutation.isPending}
						disabled={seatSelection.isEmpty ||
							bookingMutation.isPending ||
							isPastCutoff ||
							bookingGuard.hasActivePending}
						onclick={handleContinue}
					>
						{$_('screening.continue')}
					</Button>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if bookingGuard.conflictData}
	<ActiveBookingConflictDialog
		open={bookingGuard.conflictOpen}
		existingBookingId={bookingGuard.conflictData.existingBookingId}
		existingScreeningId={bookingGuard.conflictData.existingScreeningId}
		isSameScreening={bookingGuard.conflictData.isSameScreening}
		expiresAt={bookingGuard.conflictData.expiresAt}
		existingSeatLabels={bookingGuard.conflictData.existingSeatLabels}
		onClose={bookingGuard.closeDialog}
		onRebook={handleRebookAfterConflict}
	/>
{/if}

<style lang="scss">
	.ScreeningPage {
		padding: var(--space-8) 0 var(--space-24);

		.info {
			display: flex;
			gap: var(--space-5);
			align-items: flex-start;
			margin-bottom: var(--space-8);

			.poster {
				flex-shrink: 0;
				width: 96px;
				aspect-ratio: 2 / 3;
				border-radius: var(--radius-md);
				overflow: hidden;
				box-shadow: var(--shadow-md);
				background: var(--surface-hover);

				img {
					width: 100%;
					height: 100%;
					object-fit: cover;
					display: block;
				}
			}

			.details {
				flex: 1;
				min-width: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.subtitle {
				font-size: var(--text-xs);
				text-transform: uppercase;
				letter-spacing: 0.08em;
				color: var(--muted-fg);
			}

			.title {
				font-size: var(--text-2xl);
				font-weight: var(--weight-bold);
				line-height: var(--leading-tight);
			}

			.chips {
				display: flex;
				flex-wrap: wrap;
				gap: var(--space-2);
			}

			.chip {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: 4px 10px;
				border-radius: var(--radius-full);
				background: rgba(255, 255, 255, 0.06);
				border: 1px solid rgba(139, 92, 246, 0.15);
				font-size: var(--text-xs);
				color: rgba(255, 255, 255, 0.8);

				&.age {
					color: var(--warning);
					border-color: rgba(245, 158, 11, 0.25);
				}
			}

			.meta {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: var(--space-4);
				margin-top: var(--space-2);
				font-size: var(--text-sm);
				color: var(--muted-fg);
			}

			.meta_item {
				display: inline-flex;
				align-items: center;
				gap: 4px;
			}

			.time_sep {
				display: inline-flex;
				align-items: center;
				color: var(--muted-fg);
				opacity: 0.6;
				margin: 0 2px;
			}

			.price {
				margin-left: auto;
				font-size: var(--text-base);
				font-weight: var(--weight-semibold);
				color: var(--foreground);
			}
		}

		.seats {
			display: flex;
			flex-direction: column;
			gap: 10px;
			margin-bottom: var(--space-8);
		}

		.banner_error {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: var(--space-2);
			padding: var(--space-3);
			margin-bottom: var(--space-6);
			background: var(--danger-bg);
			color: var(--danger);
			border-radius: var(--radius-md);
			font-size: var(--text-sm);
			font-weight: var(--weight-medium);
		}

		.bottom {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			z-index: var(--z-sticky);
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: var(--space-4) var(--space-6);
			background: var(--surface);
			border-top: 1px solid var(--border-color);
			backdrop-filter: blur(16px);
			will-change: backdrop-filter;

			.summary {
				display: flex;
				flex-direction: column;
				gap: 2px;

				.count {
					font-size: var(--text-sm);
					color: var(--muted-fg);
				}

				.total {
					font-size: var(--text-lg);
					font-weight: var(--weight-bold);
				}
			}
		}
	}

	@media (max-width: 640px) {
		.ScreeningPage {
			.bottom {
				flex-direction: column;
				gap: var(--space-3);
			}
		}
	}
</style>
