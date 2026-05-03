<script lang="ts">
	import { goto } from '$app/navigation';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { _ } from 'svelte-i18n';
	import Modal from '@/components/ui/Modal.svelte';
	import Button from '@/components/ui/Button.svelte';
	import PendingBookingTimer from './PendingBookingTimer.svelte';
	import { crmQueryApi } from '@/api/endpoints';
	import { getErrorMessage } from '@/lib/utils/error';
	import toast from 'svelte-french-toast';

	interface Props {
		open: boolean;
		existingBookingId: string;
		existingScreeningId: string;
		isSameScreening: boolean;
		expiresAt: string | null;
		existingSeatLabels: string[];
		onClose: () => void;
		onRebook: () => Promise<void>;
	}

	let {
		open,
		existingBookingId,
		existingScreeningId,
		isSameScreening,
		expiresAt,
		existingSeatLabels,
		onClose,
		onRebook
	}: Props = $props();

	let isCancelling = $state(false);
	const queryClient = useQueryClient();
	const cancelMutation = crmQueryApi.createDeleteBookingsByIdSelfV1Mutation();

	const handleReturn = () => {
		onClose();
		goto(`/booking/${existingBookingId}`);
	};

	const handleCancelAndRebook = async () => {
		if (isCancelling) return;
		isCancelling = true;
		try {
			await cancelMutation.mutateAsync({ id: existingBookingId });
			queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
			queryClient.invalidateQueries({
				queryKey: [
					`/api/v1/public/screenings/${existingScreeningId}/available-seats`
				]
			});
			onClose();
			await onRebook();
		} catch (error) {
			toast.error(getErrorMessage(error, $_('booking.errors.cancel_failed')));
		} finally {
			isCancelling = false;
		}
	};
</script>

<Modal
	{open}
	{onClose}
	title={isSameScreening
		? $_('booking.conflict_dialog.same_screening_title')
		: $_('booking.conflict_dialog.other_screening_title')}
>
	<div class="ActiveBookingConflictDialog">
		<p class="body">
			{isSameScreening
				? $_('booking.conflict_dialog.same_screening_body', {
						values: { seats: existingSeatLabels.join(', ') }
					})
				: $_('booking.conflict_dialog.other_screening_body')}
		</p>

		{#if expiresAt}
			<div class="timer_row">
				<span class="label">{$_('booking.conflict_dialog.remaining')}</span>
				<PendingBookingTimer {expiresAt} size="sm" />
			</div>
		{/if}

		<div class="actions">
			<Button variant="primary" onclick={handleReturn}>
				{$_('booking.conflict_dialog.return_to_payment_cta')}
			</Button>
			<Button
				variant="ghost"
				onclick={handleCancelAndRebook}
				disabled={isCancelling}
			>
				{$_('booking.conflict_dialog.cancel_and_rebook_cta')}
			</Button>
		</div>
	</div>
</Modal>

<style lang="scss">
	.ActiveBookingConflictDialog {
		display: flex;
		flex-direction: column;
		gap: 16px;

		.body {
			color: rgba(255, 255, 255, 0.8);
			line-height: 1.5;
		}

		.timer_row {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 12px 16px;
			background: rgba(139, 92, 246, 0.1);
			border: 1px solid rgba(139, 92, 246, 0.2);
			border-radius: 8px;

			.label {
				color: rgba(255, 255, 255, 0.7);
				font-size: 0.875rem;
			}
		}

		.actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}
	}
</style>
