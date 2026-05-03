<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import Badge from '@/components/ui/Badge.svelte';
	import QrCode from '@/components/ui/QrCode.svelte';
	import ShareButton from '@/components/booking/ShareButton.svelte';
	import QrPreviewLightbox from '@/components/booking/QrPreviewLightbox.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { formatDateTime } from '@/lib/utils/datetime';
	import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const ticket = $derived(data.ticket);
	const movieTitle = $derived(getLocalizedValue(ticket.movie.title, $locale));
	const branchName = $derived(getLocalizedValue(ticket.branch.name, $locale));

	const url = $derived(typeof window !== 'undefined' ? window.location.href : '');

	const statusConfig = $derived(
		TICKET_STATUS_CONFIG[ticket.status] ?? {
			labelKey: `booking.ticketStatus.${ticket.status}`,
			color: 'var(--muted-fg)'
		}
	);

	let lightboxOpen = $state(false);

	const lightboxItems = $derived([
		{
			qrValue: url,
			captionText: $_('ticket.rowSeat', {
				values: { row: ticket.seat.row, seats: ticket.seat.seat }
			}),
			statusText: $_(statusConfig.labelKey),
			statusColor: statusConfig.color,
			shareUrl: url,
			shareTitle: movieTitle
		}
	]);
</script>

<svelte:head><title>{movieTitle} — ZeroWaiting</title></svelte:head>

<article class="public_ticket_card glass-card">
	{#if ticket.movie.posterUrl}
		<img class="poster" src={ticket.movie.posterUrl} alt="" />
	{/if}
	<h1 class="title">{movieTitle}</h1>
	<p class="meta">{branchName} · {ticket.hall.name} · {formatDateTime(ticket.startTime)}</p>

	<button
		type="button"
		class="qr_btn"
		onclick={() => (lightboxOpen = true)}
		aria-label={$_('ticket.openPreview')}
	>
		<QrCode value={url} size={220} />
	</button>
	<div class="seat">
		{$_('ticket.rowSeat', { values: { row: ticket.seat.row, seats: ticket.seat.seat } })}
	</div>

	<Badge text={$_(statusConfig.labelKey)} color={statusConfig.color} />
	{#if ticket.status === 'USED' && ticket.scannedAt}
		<p class="scanned_at">
			{$_('publicTicket.statusUsedAt', {
				values: { time: formatDateTime(ticket.scannedAt) }
			})}
		</p>
	{/if}

	<ShareButton {url} title={movieTitle} />
</article>

<QrPreviewLightbox
	open={lightboxOpen}
	onClose={() => (lightboxOpen = false)}
	items={lightboxItems}
/>

<style lang="scss">
	.public_ticket_card {
		max-width: 420px;
		margin: 0 auto;
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		text-align: center;

		.poster { max-width: 180px; border-radius: var(--radius-md); }
		.title { font-size: var(--text-xl); font-weight: var(--weight-bold); margin: 0; }
		.meta { color: var(--muted-fg); font-size: var(--text-sm); margin: 0; }
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
		.seat { font-weight: var(--weight-semibold); }
		.scanned_at { color: var(--muted-fg); font-size: var(--text-sm); margin: 0; }
	}
</style>
