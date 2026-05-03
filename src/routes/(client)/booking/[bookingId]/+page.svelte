<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { locale } from 'svelte-i18n';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { crmQueryApi } from '@/api/endpoints';
	import { formatPriceCompact } from '@/lib/utils/price';
	import { formatDate, formatTime, formatDuration } from '@/lib/utils/datetime';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { getErrorMessage } from '@/lib/utils/error';
	import { createPendingTimer } from '@/lib/utils/pending-timer.svelte';
	import { BOOKING_STATUS_CONFIG } from '@/lib/constants/booking-status';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Input from '@/components/ui/Input.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Popconfirm from '@/components/ui/Popconfirm.svelte';
	import PendingBookingTimer from '@/components/booking/PendingBookingTimer.svelte';
	import ExpiredBookingView from '@/components/booking/ExpiredBookingView.svelte';
	import SeatsSummary from '@/components/booking/SeatsSummary.svelte';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';

	const FORMAT_LABELS: Record<string, string> = {
		TWO_D: '2D',
		THREE_D: '3D',
		IMAX: 'IMAX',
		DOLBY_ATMOS: 'Dolby Atmos',
		FOUR_DX: '4DX'
	};

	const queryClient = useQueryClient();

	const bookingId = $derived(page.params.bookingId);
	const bookingQuery = crmQueryApi.createGetBookingsByIdV1(() => bookingId!);
	const foodItemsQuery = crmQueryApi.createGetPublicFoodItemsV1();
	const booking = $derived(bookingQuery.data);
	const foodItems = $derived(foodItemsQuery.data?.data ?? []);

	const paymentMutation =
		crmQueryApi.createPostBookingsByBookingIdPaymentV1Mutation();
	const promoMutation = crmQueryApi.createPostPromoCodesValidateV1Mutation();
	const foodOrderMutation =
		crmQueryApi.createPostBookingsByBookingIdFoodOrderV1Mutation();
	const cancelMutation = crmQueryApi.createDeleteBookingsByIdSelfV1Mutation();

	let paymentMethod = $state<'CASH' | 'CARD' | 'ONLINE'>('CARD');
	let promoCode = $state('');
	let promoLoading = $state(false);
	let foodCart = $state<Record<string, number>>({});
	let promoValid = $state<boolean | null>(null);
	let payLoading = $state(false);
	let isCancelling = $state(false);

	const expiresAt = $derived.by(() => {
		const b = bookingQuery.data;
		if (!b || b.status !== 'PENDING') return null;
		return b.expiresAt ?? null;
	});

	const timer = createPendingTimer(() => expiresAt);

	let pollInterval: ReturnType<typeof setInterval> | null = $state(null);

	$effect(() => {
		if (timer.isExpired && bookingQuery.data?.status === 'PENDING') {
			if (pollInterval) return;
			pollInterval = setInterval(() => {
				queryClient.invalidateQueries({
					queryKey: [`/api/v1/bookings/${bookingId}`]
				});
			}, 10_000);
		} else if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
		return () => {
			if (pollInterval) {
				clearInterval(pollInterval);
				pollInterval = null;
			}
		};
	});

	$effect(() => {
		const b = bookingQuery.data;
		if (!b) return;
		if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
			goto(`/booking/${b.id}/confirmation`, { replaceState: true });
		}
	});

	const movieTitle = $derived(
		booking?.screening?.movie
			? getLocalizedValue(
					booking.screening.movie.title as Record<string, string>,
					$locale
				)
			: ''
	);

	const addFood = (id: string) => {
		foodCart = { ...foodCart, [id]: (foodCart[id] ?? 0) + 1 };
	};

	const removeFood = (id: string) => {
		const count = (foodCart[id] ?? 0) - 1;
		if (count <= 0) {
			const { [id]: _, ...rest } = foodCart;
			foodCart = rest;
		} else {
			foodCart = { ...foodCart, [id]: count };
		}
	};

	const foodTotal = $derived(
		Object.entries(foodCart).reduce((sum, [id, qty]) => {
			const item = foodItems.find((f) => f.id === id);
			return sum + (item ? Number(item.price) * qty : 0);
		}, 0)
	);

	const paymentMethods = [
		{
			value: 'CARD' as const,
			label: 'booking.card',
			icon: 'lucide:credit-card'
		},
		{ value: 'CASH' as const, label: 'booking.cash', icon: 'lucide:banknote' },
		{
			value: 'ONLINE' as const,
			label: 'booking.online',
			icon: 'lucide:smartphone'
		}
	];

	const handleValidatePromo = async () => {
		if (!promoCode.trim()) return;
		promoLoading = true;
		try {
			await promoMutation.mutateAsync({ data: { code: promoCode } });
			promoValid = true;
			toast.success('Промокод применён');
		} catch (error) {
			promoValid = false;
			toast.error(getErrorMessage(error, 'Недействительный промокод'));
		} finally {
			promoLoading = false;
		}
	};

	const handlePay = async () => {
		if (!booking) return;
		payLoading = true;
		try {
			const foodEntries = Object.entries(foodCart).filter(([, qty]) => qty > 0);
			if (foodEntries.length > 0) {
				await foodOrderMutation.mutateAsync({
					bookingId: bookingId!,
					data: {
						items: foodEntries.map(([foodItemId, quantity]) => ({
							foodItemId,
							quantity
						}))
					}
				});
			}

			await paymentMutation.mutateAsync({
				bookingId: bookingId!,
				data: {
					amount: booking.totalPrice,
					method: paymentMethod
				}
			});
			queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
			queryClient.invalidateQueries({
				queryKey: [`/api/v1/bookings/${bookingId}`]
			});
			queryClient.invalidateQueries({
				queryKey: [
					`/api/v1/public/screenings/${booking.screeningId}/available-seats`
				]
			});
			toast.success($_('booking.confirmation'));
			goto(`/booking/${bookingId}/confirmation`);
		} catch (error) {
			toast.error(getErrorMessage(error, 'Ошибка оплаты'));
		} finally {
			payLoading = false;
		}
	};

	const handleCancel = async () => {
		if (!booking || isCancelling) return;
		isCancelling = true;
		try {
			await cancelMutation.mutateAsync({ id: bookingId! });
			queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
			queryClient.invalidateQueries({
				queryKey: [
					`/api/v1/public/screenings/${booking.screeningId}/available-seats`
				]
			});
			queryClient.invalidateQueries({
				queryKey: [`/api/v1/bookings/${bookingId}`]
			});
			toast.success($_('booking.cancel_success'));
			goto(`/screenings/${booking.screeningId}`);
		} catch (error) {
			toast.error(getErrorMessage(error, $_('booking.errors.cancel_failed')));
		} finally {
			isCancelling = false;
		}
	};
</script>

<svelte:head>
	<title>{$_('booking.title')} — ZeroWaiting</title>
</svelte:head>

{#if bookingQuery.isLoading}
	<div class="CheckoutPage">
		<div class="container">
			<Skeleton height="40px" width="40%" />
			<Skeleton height="200px" />
		</div>
	</div>
{:else if !booking}
	<!-- booking not found or not yet loaded -->
{:else if booking.status === 'CANCELLED' || booking.status === 'NO_SHOW'}
	<ExpiredBookingView screeningId={booking.screeningId} />
{:else if booking.status === 'CONFIRMED' || booking.status === 'COMPLETED'}
	<div class="CheckoutPage">
		<div class="container">
			<Skeleton height="200px" />
		</div>
	</div>
{:else if timer.isExpired && booking.status === 'PENDING'}
	<ExpiredBookingView screeningId={booking.screeningId} />
{:else}
	<div class="CheckoutPage">
		<div class="container">
			<header class="booking_header">
				<h1 class="booking_title">{movieTitle}</h1>
				<PendingBookingTimer {expiresAt} size="lg" />
			</header>

			<div class="grid">
				<div class="main">
					<!-- Order Summary -->
					<div class="card glass-card">
						<h3 class="card_title">
							<Icon icon="lucide:ticket" width={20} />
							{$_('booking.orderSummary')}
						</h3>

						{#if booking.screening}
							<div class="movie_info">
								{#if booking.screening.movie?.posterUrl}
									<img
										src={booking.screening.movie.posterUrl}
										alt={getLocalizedValue(
											booking.screening.movie.title,
											$locale
										)}
										class="poster"
									/>
								{/if}
								<div class="movie_details">
									<span class="movie_title">
										{getLocalizedValue(booking.screening.movie?.title, $locale)}
									</span>
									<div class="movie_meta">
										<span>
											<Icon icon="lucide:calendar" width={14} />
											{formatDate(booking.screening.startTime)}
										</span>
										<span>
											<Icon icon="lucide:clock" width={14} />
											{formatTime(booking.screening.startTime)} — {formatTime(
												booking.screening.endTime
											)}
										</span>
										{#if booking.screening.movie?.duration}
											<span>
												<Icon icon="lucide:timer" width={14} />
												{formatDuration(booking.screening.movie.duration)}
											</span>
										{/if}
									</div>
									<div class="movie_meta">
										<span>
											<Icon icon="lucide:monitor" width={14} />
											{booking.screening.hall?.name ?? '—'}
										</span>
										<Badge
											text={FORMAT_LABELS[booking.screening.format] ??
												booking.screening.format}
											color="var(--primary)"
										/>
									</div>
								</div>
							</div>
						{/if}

						{#if booking.seats && booking.seats.length > 0}
							<div class="seats_info">
								<span class="seats_label">
									<Icon icon="lucide:armchair" width={14} />
									{$_('screening.seatsSelected', {
										values: { count: booking.seats.length }
									})}
								</span>
								<SeatsSummary seats={booking.seats} />
							</div>
						{/if}

						<div class="order">
							<div class="order_row">
								<span>ID</span>
								<span class="order_value">{booking.id.slice(0, 8)}...</span>
							</div>
							<div class="order_row">
								<span>{$_('common.status')}</span>
								<Badge
									text={$_(
										BOOKING_STATUS_CONFIG[booking.status]?.labelKey ??
											booking.status
									)}
									color={BOOKING_STATUS_CONFIG[booking.status]?.color ??
										'var(--muted-fg)'}
								/>
							</div>
							<div class="total_row">
								<span>{$_('screening.total')}</span>
								<span class="total_price"
									>{formatPriceCompact(booking.totalPrice)}</span
								>
							</div>
						</div>
					</div>

					<!-- Promo Code -->
					<div class="card glass-card">
						<h3 class="card_title">
							<Icon icon="lucide:ticket-percent" width={20} />
							{$_('booking.promoCode')}
						</h3>
						<div class="promo">
							<Input
								bind:value={promoCode}
								placeholder="SUMMER2024"
								error={promoValid === false
									? 'Недействительный промокод'
									: undefined}
							/>
							<Button
								variant="outline"
								loading={promoLoading}
								onclick={handleValidatePromo}
							>
								{$_('booking.apply')}
							</Button>
						</div>
					</div>

					<!-- Food Pre-order -->
					{#if foodItems.length > 0}
						<div class="card glass-card">
							<h3 class="card_title">
								<Icon icon="lucide:utensils" width={20} />
								{$_('booking.foodOrder')}
							</h3>
							<div class="food_grid">
								{#each foodItems as item}
									<div class="food_item">
										<div class="food_info">
											<span class="food_name"
												>{getLocalizedValue(item.name, $locale)}</span
											>
											<span class="food_price"
												>{formatPriceCompact(item.price)}</span
											>
										</div>
										<div class="food_controls">
											{#if foodCart[item.id]}
												<button
													class="food_btn"
													onclick={() => removeFood(item.id)}>−</button
												>
												<span class="food_qty">{foodCart[item.id]}</span>
											{/if}
											<button
												class="food_btn add"
												onclick={() => addFood(item.id)}>+</button
											>
										</div>
									</div>
								{/each}
							</div>
							{#if foodTotal > 0}
								<div class="total_row">
									<span>Еда итого</span>
									<span class="total_price"
										>{formatPriceCompact(foodTotal)}</span
									>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Payment Method -->
					<div class="card glass-card">
						<h3 class="card_title">
							<Icon icon="lucide:wallet" width={20} />
							{$_('booking.payment')}
						</h3>
						<div class="methods">
							{#each paymentMethods as method}
								<button
									class="method"
									class:active={paymentMethod === method.value}
									onclick={() => {
										paymentMethod = method.value;
									}}
								>
									<Icon icon={method.icon} width={24} />
									<span>{$_(method.label)}</span>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<div class="sidebar">
					<div class="card glass-card">
						<div class="pay_total">
							<span>{$_('screening.total')}</span>
							<span class="pay_price"
								>{formatPriceCompact(booking.totalPrice)}</span
							>
						</div>
						<Button
							variant="primary"
							size="lg"
							fullWidth
							loading={payLoading}
							onclick={handlePay}
							icon="lucide:lock"
						>
							{$_('booking.pay')}
						</Button>
						<div class="cancel_action">
							<Popconfirm
								title={$_('booking.cancel_confirm_title')}
								description={$_('booking.cancel_confirm_body')}
								confirmText={$_('booking.cancel_confirm_yes')}
								cancelText={$_('booking.cancel_confirm_no')}
								onConfirm={handleCancel}
							>
								<Button variant="ghost" loading={isCancelling} fullWidth>
									{$_('booking.cancel_cta')}
								</Button>
							</Popconfirm>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.CheckoutPage {
		padding: var(--space-8) 0 var(--space-16);

		.booking_header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: var(--space-6);
			gap: var(--space-4);

			.booking_title {
				font-size: var(--text-2xl);
				font-weight: var(--weight-bold);
				color: var(--foreground);
				margin: 0;
			}
		}

		.grid {
			display: grid;
			grid-template-columns: 1fr 360px;
			gap: var(--space-6);
			align-items: start;
		}

		.main {
			display: flex;
			flex-direction: column;
			gap: var(--space-5);
		}

		.card {
			padding: var(--space-5);

			.card_title {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				font-size: var(--text-base);
				font-weight: var(--weight-semibold);
				margin-bottom: var(--space-4);
			}
		}

		.movie_info {
			display: flex;
			gap: var(--space-4);
			margin-bottom: var(--space-4);
			padding-bottom: var(--space-4);
			border-bottom: 1px solid var(--border-color);

			.poster {
				width: 80px;
				height: 120px;
				border-radius: var(--radius-md);
				object-fit: cover;
				flex-shrink: 0;
			}

			.movie_details {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);

				.movie_title {
					font-size: var(--text-base);
					font-weight: var(--weight-semibold);
					color: var(--foreground);
				}

				.movie_meta {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					gap: var(--space-3);
					font-size: var(--text-xs);
					color: var(--muted-fg);

					span {
						display: flex;
						align-items: center;
						gap: 4px;
					}
				}
			}
		}

		.seats_info {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			margin-bottom: var(--space-4);
			padding-bottom: var(--space-4);
			border-bottom: 1px solid var(--border-color);

			.seats_label {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				font-size: var(--text-sm);
				color: var(--muted-fg);
			}

		}

		.order {
			display: flex;
			flex-direction: column;
			gap: var(--space-3);

			.order_row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				font-size: var(--text-sm);
				color: var(--muted-fg);

				.order_value {
					color: var(--foreground);
					font-weight: var(--weight-medium);
				}
			}
		}

		.total_row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding-top: var(--space-3);
			border-top: 1px solid var(--border-color);
			font-size: var(--text-sm);
			color: var(--muted-fg);

			.total_price {
				font-size: var(--text-lg);
				font-weight: var(--weight-bold);
				color: var(--foreground);
			}
		}

		.promo {
			display: flex;
			gap: var(--space-3);
			align-items: flex-start;
		}

		.methods {
			display: flex;
			gap: var(--space-3);

			.method {
				flex: 1;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-4);
				border-radius: var(--radius-lg);
				border: 2px solid var(--border-color);
				color: var(--muted-fg);
				transition: all var(--duration-fast) var(--ease-default);

				&:hover {
					border-color: var(--neutral-600);
					color: var(--foreground);
				}

				&.active {
					border-color: var(--primary);
					background: var(--primary-subtle);
					color: var(--primary-light);
				}

				span {
					font-size: var(--text-sm);
					font-weight: var(--weight-medium);
				}
			}
		}

		.food_grid {
			display: flex;
			flex-direction: column;
			gap: var(--space-3);
			margin-bottom: var(--space-4);

			.food_item {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: var(--space-2) 0;
				border-bottom: 1px solid var(--border-color-subtle);

				.food_info {
					display: flex;
					flex-direction: column;
					gap: 2px;

					.food_name {
						font-size: var(--text-sm);
						color: var(--foreground);
					}

					.food_price {
						font-size: var(--text-xs);
						color: var(--muted-fg);
					}
				}

				.food_controls {
					display: flex;
					align-items: center;
					gap: var(--space-2);

					.food_btn {
						width: 28px;
						height: 28px;
						border-radius: var(--radius-sm);
						display: flex;
						align-items: center;
						justify-content: center;
						font-size: var(--text-base);
						font-weight: var(--weight-bold);
						color: var(--muted-fg);
						border: 1px solid var(--border-color);

						&:hover {
							border-color: var(--primary);
							color: var(--primary-light);
						}

						&.add {
							color: var(--primary-light);
							border-color: var(--primary);
						}
					}

					.food_qty {
						font-size: var(--text-sm);
						font-weight: var(--weight-semibold);
						min-width: 20px;
						text-align: center;
					}
				}
			}
		}

		.sidebar {
			position: sticky;
			top: 100px;

			.pay_total {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: var(--space-5);
				font-size: var(--text-sm);

				.pay_price {
					font-size: var(--text-2xl);
					font-weight: var(--weight-bold);
					color: var(--primary-light);
				}
			}

			.cancel_action {
				margin-top: var(--space-3);
			}
		}
	}

	@media (max-width: 768px) {
		.CheckoutPage {
			.booking_header {
				flex-direction: column;
				align-items: flex-start;
			}

			.grid {
				grid-template-columns: 1fr;
			}

			.sidebar {
				position: static;
			}

			.methods {
				flex-direction: column;
			}
		}
	}
</style>
