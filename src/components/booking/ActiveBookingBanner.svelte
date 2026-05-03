<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { _, locale } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { useActiveBooking } from '@/lib/stores/active-booking.svelte';
	import { createPendingTimer } from '@/lib/utils/pending-timer.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { getErrorMessage } from '@/lib/utils/error';
	import type { ActiveBookingEntity } from '@/api/model';
	import Button from '@/components/ui/Button.svelte';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';

	const query = useActiveBooking();
	const queryClient = useQueryClient();
	const cancelMutation = crmQueryApi.createDeleteBookingsByIdSelfV1Mutation();

	const booking = $derived(
		(query.data as ActiveBookingEntity | undefined) ?? null
	);
	const hidden = $derived(
		page.url.pathname.startsWith('/booking/') ||
			page.url.pathname.startsWith('/admin') ||
			!booking
	);

	const timer = createPendingTimer(() => booking?.expiresAt);

	const movieTitle = $derived(
		booking?.screening?.movie
			? getLocalizedValue(
					booking.screening.movie.title as Record<string, string>,
					$locale
				)
			: ''
	);

	const urgency = $derived.by(() => {
		if (timer.remainingMs < 30_000) return 'critical';
		if (timer.remainingMs < 120_000) return 'warning';
		return 'normal';
	});

	let isCancelling = $state(false);

	const handleCancel = async () => {
		if (!booking || isCancelling) return;
		isCancelling = true;
		try {
			await cancelMutation.mutateAsync({ id: booking.id });
			queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
			queryClient.invalidateQueries({
				queryKey: [
					`/api/v1/public/screenings/${booking.screeningId}/available-seats`
				]
			});
			toast.success($_('booking.cancel_success'));
		} catch (error) {
			toast.error(getErrorMessage(error, $_('booking.errors.cancel_failed')));
		} finally {
			isCancelling = false;
		}
	};

	const handlePay = () => {
		if (!booking) return;
		goto(`/booking/${booking.id}`);
	};
</script>

{#if !hidden && booking}
	<div
		class="ActiveBookingBanner"
		class:warning={urgency === 'warning'}
		class:critical={urgency === 'critical'}
	>
		<div class="info">
			<div class="title">
				<Icon icon="lucide:clock" width={16} />
				{$_('booking.active_banner.title')}
			</div>
			<div class="meta">
				{movieTitle} · <span class="timer">{timer.formatted}</span>
			</div>
		</div>
		<div class="actions">
			<Button size="sm" onclick={handlePay}>
				{$_('booking.active_banner.pay_cta')}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onclick={handleCancel}
				disabled={isCancelling}
			>
				{$_('booking.active_banner.cancel_cta')}
			</Button>
		</div>
	</div>
{/if}

<style lang="scss">
	.ActiveBookingBanner {
		position: fixed;
		right: 24px;
		bottom: 24px;
		max-width: 360px;
		z-index: 40;

		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;

		background: rgba(139, 92, 246, 0.12);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(139, 92, 246, 0.2);
		border-radius: 12px;
		box-shadow:
			0 12px 32px rgba(0, 0, 0, 0.35),
			inset 0 1px rgba(255, 255, 255, 0.05);

		animation: slide_in 200ms ease-out;
		will-change: transform;

		.info {
			.title {
				display: flex;
				align-items: center;
				gap: 6px;
				font-size: 0.8125rem;
				color: rgba(255, 255, 255, 0.7);
				text-transform: uppercase;
				letter-spacing: 0.04em;
			}

			.meta {
				margin-top: 4px;
				font-size: 0.9375rem;
				color: white;

				.timer {
					font-variant-numeric: tabular-nums;
				}
			}
		}

		.actions {
			display: flex;
			gap: 8px;
		}

		&.warning {
			border-color: rgba(245, 158, 11, 0.4);

			.timer {
				color: #f59e0b;
			}
		}

		&.critical {
			border-color: rgba(239, 68, 68, 0.5);

			.timer {
				color: #ef4444;
				animation: pulse 1s ease-in-out infinite;
			}
		}

		@media (max-width: 640px) {
			inset: auto 16px 16px 16px;
			max-width: none;

			.actions {
				flex-direction: column;
			}
		}
	}

	@keyframes slide_in {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
</style>
