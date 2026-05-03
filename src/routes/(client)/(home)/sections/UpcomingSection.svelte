<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import MovieCarousel from '@/components/ui/MovieCarousel.svelte';

	const moviesQuery = crmQueryApi.createGetPublicMoviesV1(() => ({
		status: 'UPCOMING' as const,
		limit: 14
	}));

	const movies = $derived(moviesQuery.data?.data ?? []);
</script>

{#if movies.length > 0}
	<section class="UpcomingSection">
		<div class="container">
			<SectionHeader title={$_('home.upcoming')}>
				{#snippet actions()}
					<a href="/movies?status=UPCOMING" class="link">
						{$_('movies.viewDetails')} →
					</a>
				{/snippet}
			</SectionHeader>
			<MovieCarousel {movies} />
		</div>
	</section>
{/if}

<style lang="scss">
	.UpcomingSection {
		padding: var(--space-12) 0;

		.link {
			font-size: var(--text-sm);
			color: var(--primary-light);
			font-weight: var(--weight-medium);

			&:hover {
				color: var(--primary-300);
			}
		}
	}
</style>
