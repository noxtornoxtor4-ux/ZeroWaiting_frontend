<script lang="ts">
	import { _ } from 'svelte-i18n';
	import SeatTicketCard from '@/components/booking/SeatTicketCard.svelte';
	import QrPreviewLightbox from '@/components/booking/QrPreviewLightbox.svelte';
	import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';

	interface Seat {
		row: number;
		seat: number;
		qrCode: string;
		status: string;
	}
	interface Props {
		seats: Seat[];
		origin: string;
	}

	const { seats, origin }: Props = $props();

	let openIdx = $state<number | null>(null);

	const lightboxItems = $derived(
		seats.map((s) => {
			const cfg =
				TICKET_STATUS_CONFIG[s.status] ?? {
					labelKey: `booking.ticketStatus.${s.status}`,
					color: 'var(--muted-fg)'
				};
			const url = `${origin}/t/${s.qrCode}`;
			return {
				qrValue: url,
				captionText: $_('ticket.rowSeat', {
					values: { row: s.row, seats: s.seat }
				}),
				statusText: $_(cfg.labelKey),
				statusColor: cfg.color,
				shareUrl: url
			};
		})
	);
</script>

<div class="grid">
	{#each seats as seat, i (seat.qrCode)}
		<SeatTicketCard
			row={seat.row}
			seat={seat.seat}
			qrCode={seat.qrCode}
			status={seat.status}
			{origin}
			onOpen={() => (openIdx = i)}
		/>
	{/each}
</div>

<QrPreviewLightbox
	open={openIdx !== null}
	onClose={() => (openIdx = null)}
	items={lightboxItems}
	startIndex={openIdx ?? 0}
/>

<style lang="scss">
	.grid {
		display: grid;
		gap: var(--space-3);
		grid-template-columns: repeat(2, minmax(0, 1fr));

		@media (min-width: 600px) {
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		}
	}
</style>
