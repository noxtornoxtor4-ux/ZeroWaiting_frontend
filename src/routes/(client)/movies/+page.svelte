<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import Chip from '@/components/ui/Chip.svelte';
	import Pagination from '@/components/ui/Pagination.svelte';
	import EmptyState from '@/components/ui/EmptyState.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import MovieCarousel from '@/components/ui/MovieCarousel.svelte';
	import type { GetPublicMoviesV1Params } from '@/api/model';

	const table = useTableQuery<GetPublicMoviesV1Params, { status: string }>({
		defaultLimit: 14,
		searchKey: 'title',
		filters: { status: '' }
	});

	const statusFilters = [
		{ value: '', label: 'movies.allGenres' },
		{ value: 'NOW_SHOWING', label: 'movies.nowShowing' },
		{ value: 'UPCOMING', label: 'movies.upcoming' }
	];

	const moviesQuery = crmQueryApi.createGetPublicMoviesV1(() => table.params);

	const movies = $derived(moviesQuery.data?.data ?? []);
	const meta = $derived(moviesQuery.data?.meta);
</script>

<svelte:head>
	<title>ZeroWaiting — {$_('movies.title')}</title>
</svelte:head>

<section class="MoviesPage">
	<div class="container">
		<SectionHeader title={$_('movies.title')} />

		<div class="filters">
			<div class="chips">
				{#each statusFilters as filter}
					<Chip
						text={$_(filter.label)}
						active={table.filters.status === filter.value}
						onclick={() => table.setFilter('status', filter.value)}
					/>
				{/each}
			</div>
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder={$_('movies.search')}
				/>
			</div>
		</div>

		{#if moviesQuery.isLoading}
			<div class="grid">
				{#each Array(8) as _}
					<div class="skeleton">
						<Skeleton height="270px" radius="var(--radius-lg)" />
						<Skeleton height="16px" width="80%" />
						<Skeleton height="12px" width="60%" />
					</div>
				{/each}
			</div>
		{:else if movies.length === 0}
			<EmptyState icon="lucide:film" title={$_('movies.noMovies')} />
		{:else}
			<MovieCarousel {movies} />

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
</section>

<style lang="scss">
	.MoviesPage {
		padding: var(--space-8) 0 var(--space-16);

		.filters {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-4);
			margin-bottom: var(--space-6);
			flex-wrap: wrap;
		}

		.chips {
			display: flex;
			gap: var(--space-2);
			flex-wrap: wrap;
		}

		.search {
			width: 260px;
		}

		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
			gap: var(--space-5);
		}

		.skeleton {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
		}

		.pagination {
			margin-top: var(--space-8);
		}
	}

	@media (max-width: 640px) {
		.MoviesPage {
			.filters {
				flex-direction: column;
				align-items: stretch;
			}

			.search {
				width: 100%;
			}

			.grid {
				grid-template-columns: repeat(2, 1fr);
				gap: var(--space-3);
			}
		}
	}
</style>
