<script lang="ts">
	import QRCode from 'qrcode';

	interface Props {
		value: string;
		size?: number;
	}

	let { value, size = 150 }: Props = $props();

	let dataUrl = $state('');

	$effect(() => {
		QRCode.toDataURL(value, {
			width: size,
			margin: 1,
			color: { dark: '#1a1a2e', light: '#ffffff' }
		}).then((url) => {
			dataUrl = url;
		});
	});
</script>

{#if dataUrl}
	<img src={dataUrl} alt="QR" width={size} height={size} class="qr_image" />
{/if}

<style lang="scss">
	.qr_image {
		border-radius: var(--radius-md);
		max-width: 100%;
		height: auto;
	}
</style>
