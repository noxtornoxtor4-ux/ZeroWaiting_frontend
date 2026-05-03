<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Lightbox from '@/components/ui/Lightbox.svelte';
	import QrCode from '@/components/ui/QrCode.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import ShareButton from '@/components/booking/ShareButton.svelte';
	import type { QrSlideItem } from '@/components/booking/qr-slide-item';

	interface Props {
		open: boolean;
		onClose: () => void;
		items: QrSlideItem[];
		startIndex?: number;
	}

	const { open, onClose, items, startIndex = 0 }: Props = $props();

	let innerW = $state(0);
	let innerH = $state(0);

	const qrSize = $derived(
		Math.max(240, Math.min(520, Math.floor(Math.min(innerW || 0, innerH || 0) * 0.7)))
	);

	const guardedOpen = $derived(open && items.length > 0);
</script>

<svelte:window bind:innerWidth={innerW} bind:innerHeight={innerH} />

<Lightbox
	open={guardedOpen}
	{onClose}
	{items}
	{startIndex}
	ariaLabel={$_('ticket.preview')}
>
	{#snippet slide(item)}
		<QrCode value={item.qrValue} size={qrSize} />
	{/snippet}
	{#snippet caption(item)}
		<div class="qr_caption">
			<p class="caption_text">{item.captionText}</p>
			<Badge text={item.statusText} color={item.statusColor} />
			<ShareButton url={item.shareUrl} title={item.shareTitle} />
		</div>
	{/snippet}
</Lightbox>

<style lang="scss">
	.qr_caption {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);

		.caption_text {
			margin: 0;
			color: var(--foreground);
			font-size: var(--text-base);
			font-weight: var(--weight-semibold);
			white-space: pre-line;
		}
	}
</style>
