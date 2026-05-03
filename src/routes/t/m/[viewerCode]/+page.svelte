<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import Icon from '@iconify/svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import TicketViewer from '@/components/booking/TicketViewer.svelte';
	import TicketScreeningHeader from '@/components/booking/TicketScreeningHeader.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const movieTitle = $derived(getLocalizedValue(data.master.movie.title, $locale));
	const branchName = $derived(getLocalizedValue(data.master.branch.name, $locale));
	const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
	const viewerUrl = $derived(`${origin}/t/m/${data.viewerCode}`);
</script>

<svelte:head><title>{movieTitle} — ZeroWaiting</title></svelte:head>

<div class="public_master_page">
	<div class="container">
		<div class="header">
			<div class="icon">
				<Icon icon="lucide:ticket" width={64} />
			</div>
			<h1 class="title">{$_('ticket.publicHeader.title')}</h1>
			<p class="subtitle">{$_('booking.scanQr')}</p>
		</div>

		<TicketScreeningHeader
			posterUrl={data.master.movie.posterUrl}
			movieTitle={movieTitle}
			ageRating={data.master.movie.ageRating}
			duration={data.master.movie.duration}
			branchName={branchName}
			hallName={data.master.hall.name}
			startTime={data.master.startTime}
			format={data.master.format}
		/>

		<div class="tickets">
			<TicketViewer {viewerUrl} {origin} seats={data.master.seats} />
		</div>
	</div>
</div>

<style lang="scss">
	.public_master_page {
		padding: var(--space-8) 0 var(--space-16);

		.header {
			text-align: center;
			margin-bottom: var(--space-6);

			.icon {
				color: var(--primary);
				margin-bottom: var(--space-3);
			}

			.title {
				font-size: var(--text-3xl);
				font-weight: var(--weight-bold);
				margin: 0;
			}

			.subtitle {
				font-size: var(--text-base);
				color: var(--muted-fg);
				margin-top: var(--space-2);
			}
		}

		.tickets {
			max-width: 640px;
			margin: var(--space-6) auto 0;
		}
	}
</style>
