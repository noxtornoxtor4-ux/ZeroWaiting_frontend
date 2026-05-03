<script lang="ts">
	import { _ } from 'svelte-i18n';
	import QrCode from '@/components/ui/QrCode.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import SeatsSummary from '@/components/booking/SeatsSummary.svelte';
	import ShareButton from '@/components/booking/ShareButton.svelte';
	import QrPreviewLightbox from '@/components/booking/QrPreviewLightbox.svelte';
	import { formatSeatsSummary } from '@/lib/utils/seat-label';
	import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';

	interface Seat {
		row: number;
		seat: number;
		status: string;
	}
	interface Props {
		viewerUrl: string;
		seats: Seat[];
	}

	const { viewerUrl, seats }: Props = $props();

	const validCount = $derived(seats.filter((s) => s.status === 'VALID').length);
	const usedCount = $derived(seats.filter((s) => s.status === 'USED').length);
	const expiredCount = $derived(seats.filter((s) => s.status === 'EXPIRED').length);
	const cancelledCount = $derived(seats.filter((s) => s.status === 'CANCELLED').length);
	const total = $derived(seats.length);
	const spentCount = $derived(usedCount + expiredCount + cancelledCount);

	const summary = $derived.by(() => {
		if (total === 0 || validCount === total) {
			return { labelKey: 'booking.ticketStatus.VALID', color: 'var(--success)' };
		}
		if (validCount > 0) {
			return { labelKey: 'ticket.statusPartiallyUsed', color: 'var(--warning)' };
		}
		const candidates = [
			{ count: usedCount, cfg: TICKET_STATUS_CONFIG.USED },
			{ count: expiredCount, cfg: TICKET_STATUS_CONFIG.EXPIRED },
			{ count: cancelledCount, cfg: TICKET_STATUS_CONFIG.CANCELLED }
		];
		return candidates.reduce((max, c) => (c.count > max.count ? c : max)).cfg;
	});

	const seatsFlat = $derived(seats.map((s) => ({ row: s.row, seat: s.seat })));

	const seatsForSummary = $derived(
		seatsFlat.map((s) => ({ seat: { rowNumber: s.row, seatNumber: s.seat } }))
	);

	let lightboxOpen = $state(false);

	const lightboxItems = $derived([
		{
			qrValue: viewerUrl,
			captionText: formatSeatsSummary(seatsFlat, $_),
			statusText: $_(summary.labelKey, { values: { count: spentCount, total } }),
			statusColor: summary.color,
			shareUrl: viewerUrl
		}
	]);
</script>

<div class="master_tab">
	<button
		type="button"
		class="qr_btn"
		onclick={() => (lightboxOpen = true)}
		aria-label={$_('ticket.openPreview')}
	>
		<QrCode value={viewerUrl} size={240} />
	</button>
	<SeatsSummary seats={seatsForSummary} />
	<Badge
		text={$_(summary.labelKey, { values: { count: spentCount, total } })}
		color={summary.color}
	/>
	<p class="hint">{$_('ticket.entryWithThisQr')}</p>
	<ShareButton url={viewerUrl} title={$_('ticket.share')} />
</div>

<QrPreviewLightbox
	open={lightboxOpen}
	onClose={() => (lightboxOpen = false)}
	items={lightboxItems}
/>

<style lang="scss">
	.master_tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);

		.qr_btn {
			background: transparent;
			border: 0;
			padding: 0;
			cursor: zoom-in;
			border-radius: var(--radius-md);

			&:focus-visible {
				outline: 2px solid var(--primary);
				outline-offset: 4px;
			}
		}

		.hint {
			color: var(--muted-fg);
			font-size: var(--text-sm);
			text-align: center;
			margin: 0;
		}
	}
</style>
