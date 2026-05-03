<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import MovieCarousel from '@/components/ui/MovieCarousel.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';

	const moviesQuery = crmQueryApi.createGetPublicMoviesV1(() => ({
		status: 'NOW_SHOWING' as const,
		limit: 14
	}));

	const movies = $derived(moviesQuery.data?.data ?? []);
</script>

{#if moviesQuery.isLoading}
	<section class="NowShowingSection">
		<div class="container">
			<SectionHeader title={$_('home.nowShowing')} />
			<div class="skeleton">
				{#each Array(4) as _}
					<div>
						<Skeleton height="270px" radius="var(--radius-lg)" />
						<Skeleton height="16px" width="80%" />
					</div>
				{/each}
			</div>
		</div>
	</section>
{:else if movies.length > 0}
	<section class="NowShowingSection">
		<div class="container">
			<SectionHeader title={$_('home.nowShowing')}>
				{#snippet actions()}
					<a href="/movies?status=NOW_SHOWING" class="link">
						{$_('movies.viewDetails')} →
					</a>
				{/snippet}
			</SectionHeader>
			<MovieCarousel {movies} />
		</div>
	</section>
{/if}

<style lang="scss">
	.NowShowingSection {
		padding: var(--space-12) 0;

		.skeleton {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
			gap: var(--space-5);

			div {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}
		}

		.link {
			font-size: var(--text-sm);
			color: var(--primary-light);
			font-weight: var(--weight-medium);
			transition: color var(--duration-fast) var(--ease-default);

			&:hover {
				color: var(--primary-300);
			}
		}
	}
</style>
