<script lang="ts">
	import { _ } from 'svelte-i18n';
	import QrCode from '@/components/ui/QrCode.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import ShareButton from '@/components/booking/ShareButton.svelte';
	import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';

	interface Props {
		row: number;
		seat: number;
		qrCode: string;
		status: string;
		origin: string;
		onOpen?: () => void;
	}

	const { row, seat, qrCode, status, origin, onOpen }: Props = $props();

	const url = $derived(`${origin}/t/${qrCode}`);
	const seatLabel = $derived(
		$_('ticket.rowSeat', { values: { row, seats: seat } })
	);
	const statusConfig = $derived(
		TICKET_STATUS_CONFIG[status] ?? {
			labelKey: `booking.ticketStatus.${status}`,
			color: 'var(--muted-fg)'
		}
	);
</script>

<div class="seat_ticket_card">
	{#if onOpen}
		<button
			type="button"
			class="qr_btn"
			onclick={onOpen}
			aria-label={`${$_('ticket.openPreview')}: ${seatLabel}`}
		>
			<QrCode value={url} size={140} />
		</button>
	{:else}
		<QrCode value={url} size={140} />
	{/if}
	<div class="seat_label">{seatLabel}</div>
	<Badge text={$_(statusConfig.labelKey)} color={statusConfig.color} />
	<ShareButton {url} iconOnly />
</div>

<style lang="scss">
	.seat_ticket_card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--surface);
		border: 1px solid var(--border-color);

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

		.seat_label {
			font-size: var(--text-sm);
			font-weight: var(--weight-semibold);
			color: var(--foreground);
		}
	}
</style>
