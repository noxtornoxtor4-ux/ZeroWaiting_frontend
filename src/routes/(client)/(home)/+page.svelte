<script lang="ts">
	import { _ } from 'svelte-i18n';
	import WelcomeSection from './sections/WelcomeSection.svelte';
	import WelcomeSectionMobile from './sections/WelcomeSectionMobile.svelte';
	import NowShowingSection from './sections/NowShowingSection.svelte';
	import UpcomingSection from './sections/UpcomingSection.svelte';
	import PromotionsSection from './sections/PromotionsSection.svelte';
	import AnnouncementsSection from './sections/AnnouncementsSection.svelte';
</script>

<svelte:head>
	<title>ZeroWaiting — {$_('home.heroTitle')}</title>
</svelte:head>

<div class="welcome_desktop">
	<WelcomeSection />
</div>
<div class="welcome_mobile">
	<WelcomeSectionMobile />
</div>

<NowShowingSection />
<UpcomingSection />
<PromotionsSection />
<AnnouncementsSection />

<style>
	.welcome_desktop {
		display: block;
	}
	.welcome_mobile {
		display: none;
	}

	@media (max-width: 768px) {
		.welcome_desktop {
			display: none;
		}
		.welcome_mobile {
			display: block;
		}
	}
</style>
