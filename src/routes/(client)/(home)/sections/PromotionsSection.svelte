<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import PromotionCard from '../components/PromotionCard.svelte';

	const promoQuery = crmQueryApi.createGetPublicPromotionsV1();

	const promotions = $derived(promoQuery.data?.data ?? []);
</script>

{#if promotions.length > 0}
	<section class="PromotionsSection">
		<div class="container">
			<SectionHeader title={$_('home.promotions')} />
			<div class="grid">
				{#each promotions.slice(0, 3) as promotion}
					<PromotionCard {promotion} />
				{/each}
			</div>
		</div>
	</section>
{/if}

<style lang="scss">
	.PromotionsSection {
		padding: var(--space-12) 0;

		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
			gap: var(--space-5);
		}
	}

	@media (max-width: 640px) {
		.PromotionsSection {
			.grid {
				grid-template-columns: 1fr;
			}
		}
	}
</style>
