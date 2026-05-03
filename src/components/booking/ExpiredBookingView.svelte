<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import Button from '@/components/ui/Button.svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		screeningId: string;
	}

	let { screeningId }: Props = $props();

	const handleSelectAgain = () => {
		goto(`/screenings/${screeningId}`);
	};
</script>

<div class="ExpiredBookingView">
	<div class="icon">
		<Icon icon="lucide:clock-x" width={48} />
	</div>
	<h2 class="title">{$_('booking.expired_view.title')}</h2>
	<p class="subtitle">{$_('booking.expired_view.subtitle')}</p>
	<Button onclick={handleSelectAgain}>
		{$_('booking.expired_view.select_again_cta')}
	</Button>
</div>

<style lang="scss">
	.ExpiredBookingView {
		max-width: 420px;
		margin: 80px auto;
		text-align: center;
		padding: 32px;

		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(139, 92, 246, 0.15);
		border-radius: 16px;
		backdrop-filter: blur(10px);

		.icon {
			color: rgba(255, 255, 255, 0.6);
			margin-bottom: 16px;
		}

		.title {
			font-size: 1.5rem;
			color: white;
			margin-bottom: 8px;
		}

		.subtitle {
			color: rgba(255, 255, 255, 0.7);
			line-height: 1.5;
			margin-bottom: 24px;
		}
	}
</style>
