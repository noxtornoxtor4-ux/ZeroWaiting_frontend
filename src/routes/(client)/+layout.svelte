<script lang="ts">
	import { page } from '$app/state';
	import Header from '@/components/client/layout/Header.svelte';
	import Footer from '@/components/client/layout/Footer.svelte';
	import ScrollProgress from '@/components/client/layout/ScrollProgress.svelte';
	import HomeAmbient from './(home)/components/HomeAmbient.svelte';
	import ActiveBookingBanner from '@/components/booking/ActiveBookingBanner.svelte';
	import { provideActiveBooking } from '@/lib/stores/active-booking.svelte';

	let { children } = $props();

	let headerHeight = $state(0);

	provideActiveBooking();
</script>

<ScrollProgress />
<HomeAmbient />

<div class="layout">
	<Header bind:height={headerHeight} />
	<main
		class="main"
		class:active={page.url.pathname === '/'}
		style:--header-height="{headerHeight}px"
	>
		{@render children()}
	</main>
	<Footer />
	<ActiveBookingBanner />
</div>

<style lang="scss">
	.layout {
		overflow-x: clip;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-height: 100dvh;
		position: relative;
		z-index: 1;

		.main {
			flex: 1;
			&.active {
				position: relative;
				top: calc(-1 * var(--header-height, 0px));
			}
		}
	}
</style>
