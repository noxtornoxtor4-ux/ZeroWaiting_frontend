<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import EmptyState from '@/components/ui/EmptyState.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Pagination from '@/components/ui/Pagination.svelte';
	import MovieCarousel from '@/components/ui/MovieCarousel.svelte';
	import type { GetProfileMeFavoritesV1Params } from '@/api/model';

	const table = useTableQuery<GetProfileMeFavoritesV1Params>({
		defaultLimit: 15
	});

	const favoritesQuery = crmQueryApi.createGetProfileMeFavoritesV1(
		() => table.params
	);

	const favorites = $derived(favoritesQuery.data?.data ?? []);
	const favoriteMovies = $derived(
		favorites.filter((f) => f.movie).map((f) => f.movie!)
	);
	const meta = $derived(favoritesQuery.data?.meta);
</script>

<svelte:head>
	<title>{$_('profile.favorites')} — ZeroWaiting</title>
</svelte:head>

<div class="FavoritesPage">
	<SectionHeader title={$_('profile.favorites')} />

	{#if favoritesQuery.isLoading}
		<div class="grid">
			{#each Array(4) as _}
				<Skeleton height="320px" radius="var(--radius-lg)" />
			{/each}
		</div>
	{:else if favoriteMovies.length === 0}
		<EmptyState icon="lucide:heart-off" title={$_('profile.noFavorites')} />
	{:else}
		<MovieCarousel movies={favoriteMovies} />

		{#if meta && meta.totalPages > 1}
			<div class="pagination">
				<Pagination
					page={table.page}
					totalPages={meta.totalPages}
					onchange={table.setPage}
				/>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	.FavoritesPage {
		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
			gap: var(--space-4);
		}

		.pagination {
			margin-top: var(--space-6);
		}
	}
</style>
