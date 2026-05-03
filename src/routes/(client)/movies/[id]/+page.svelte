<script lang="ts">
	import { page } from '$app/state';
	import { _ } from 'svelte-i18n';
	import { locale } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import {
		formatDuration,
		formatDate,
		presetRange
	} from '@/lib/utils/datetime';
	import RatingStars from '@/components/ui/RatingStars.svelte';
	import Chip from '@/components/ui/Chip.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import EmptyState from '@/components/ui/EmptyState.svelte';
	import Icon from '@iconify/svelte';
	import VideoPlayer from '@/components/ui/VideoPlayer.svelte';
	import ReviewCard from './components/ReviewCard.svelte';
	import ReviewForm from './components/ReviewForm.svelte';
	import ScreeningCard from './components/ScreeningCard.svelte';
	import ScheduleFilterBar from './components/ScheduleFilterBar.svelte';

	const movieId = $derived(page.params.id);

	const movieQuery = crmQueryApi.createGetPublicMoviesByIdV1(() => movieId!);
	const reviewsQuery = crmQueryApi.createGetPublicMoviesByMovieIdReviewsV1(
		() => movieId!,
		() => ({ limit: 10 })
	);
	const initialPreset = presetRange('today');
	let dateFrom = $state(initialPreset.dateFrom);
	let dateTo = $state(initialPreset.dateTo);

	const repertoireQuery = crmQueryApi.createGetPublicRepertoireV1(() => ({
		movieId,
		dateFrom,
		dateTo
	}));

	const movie = $derived(movieQuery.data);
	const reviews = $derived(reviewsQuery.data?.data ?? []);
	const screenings = $derived(repertoireQuery.data ?? []);

	const title = $derived(movie ? getLocalizedValue(movie.title, $locale) : '');
	const description = $derived(
		movie?.description ? getLocalizedValue(movie.description, $locale) : ''
	);
</script>

<svelte:head>
	<title>{title || 'Загрузка...'} — ZeroWaiting</title>
</svelte:head>

{#if movieQuery.isLoading}
	<div class="MovieDetail">
		<div class="container">
			<div class="hero">
				<Skeleton height="450px" width="300px" radius="var(--radius-lg)" />
				<div class="hero_info">
					<Skeleton height="36px" width="70%" />
					<Skeleton height="20px" width="50%" />
					<Skeleton height="100px" />
				</div>
			</div>
		</div>
	</div>
{:else if movie}
	<div class="MovieDetail">
		<!-- Hero Section -->
		<section class="hero_section">
			<div class="container">
				<div class="hero">
					<div class="poster">
						{#if movie.posterUrl}
							<img src={movie.posterUrl} alt={title} />
						{:else}
							<div class="poster_placeholder">
								<Icon icon="lucide:clapperboard" width={64} />
							</div>
						{/if}
					</div>

					<div class="info">
						<h1 class="title">{title}</h1>

						<div class="badges">
							{#if movie.ageRating}
								<Badge text={movie.ageRating} color="var(--warning)" />
							{/if}
							{#if movie.status}
								<Badge
									text={movie.status === 'NOW_SHOWING'
										? $_('movies.nowShowing')
										: $_('movies.upcoming')}
									color={movie.status === 'NOW_SHOWING'
										? 'var(--success)'
										: 'var(--info)'}
								/>
							{/if}
						</div>

						{#if movie.genres?.length}
							<div class="genres">
								{#each movie.genres as genre}
									<Chip text={genre} />
								{/each}
							</div>
						{/if}

						<div class="meta">
							{#if movie.duration}
								<div class="meta_item">
									<Icon icon="lucide:clock" width={18} />
									<span>{formatDuration(movie.duration)}</span>
								</div>
							{/if}
							{#if movie.language}
								<div class="meta_item">
									<Icon icon="lucide:languages" width={18} />
									<span>{movie.language}</span>
								</div>
							{/if}
							{#if movie.releaseDate}
								<div class="meta_item">
									<Icon icon="lucide:calendar" width={18} />
									<span>{formatDate(movie.releaseDate)}</span>
								</div>
							{/if}
						</div>

						{#if description}
							<p class="description">{description}</p>
						{/if}
					</div>
				</div>
			</div>
		</section>

		<!-- Trailer Section -->
		{#if movie.trailerUrl}
			<section class="section">
				<div class="container">
					<SectionHeader title={$_('movie.trailer')} />
					<VideoPlayer src={movie.trailerUrl} {title} />
				</div>
			</section>
		{/if}

		<!-- Screenings Section -->
		<section class="section">
			<div class="container">
				<SectionHeader title={$_('movie.sessions')} />
				<ScheduleFilterBar bind:dateFrom bind:dateTo />
				{#if repertoireQuery.isLoading}
					<Skeleton height="120px" />
				{:else if screenings.length > 0}
					{#each screenings as repertoire}
						{#each repertoire.dates ?? [] as dateGroup}
							<h3 class="date_title">{dateGroup.date}</h3>
							{#each dateGroup.branches ?? [] as branch}
								<div class="branch_group">
									<span class="branch_name"
										>{getLocalizedValue(branch.name, $locale)}</span
									>
									{#each branch.halls ?? [] as hall}
										<div class="hall_group">
											<span class="hall_name">{hall.name} ({hall.type})</span>
											<div class="screenings">
												{#each hall.screenings ?? [] as screening}
													<ScreeningCard {screening} />
												{/each}
											</div>
										</div>
									{/each}
								</div>
							{/each}
						{/each}
					{/each}
				{:else}
					<EmptyState icon="lucide:calendar" title={$_('movie.noSessions')} />
				{/if}
			</div>
		</section>

		<!-- Reviews Section -->
		<section class="section">
			<div class="container">
				<SectionHeader title={$_('movie.reviews')} />
				<ReviewForm movieId={movieId!} onsaved={() => reviewsQuery.refetch()} />
				{#if reviews.length > 0}
					<div class="reviews">
						{#each reviews as review}
							<ReviewCard {review} />
						{/each}
					</div>
				{:else}
					<EmptyState
						icon="lucide:message-circle"
						title={$_('common.noResults')}
					/>
				{/if}
			</div>
		</section>
	</div>
{/if}

<style lang="scss">
	.MovieDetail {
		padding-bottom: var(--space-16);

		.hero_section {
			padding: var(--space-8) 0 var(--space-12);
			background: radial-gradient(
				ellipse at 30% 20%,
				rgba(168, 85, 247, 0.1) 0%,
				transparent 60%
			);
		}

		.hero {
			display: grid;
			grid-template-columns: 300px 1fr;
			gap: var(--space-8);
			align-items: start;
		}

		.poster {
			border-radius: var(--radius-lg);
			overflow: hidden;
			box-shadow: var(--shadow-lg);
			aspect-ratio: 2/3;
			background: var(--surface-hover);

			img {
				width: 100%;
				height: 100%;
				object-fit: cover;
			}
		}

		.poster_placeholder {
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			color: var(--muted-fg);
		}

		.info {
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
		}

		.title {
			font-size: var(--text-3xl);
			font-weight: var(--weight-bold);
			line-height: var(--leading-tight);
		}

		.badges {
			display: flex;
			gap: var(--space-2);
		}

		.genres {
			display: flex;
			gap: var(--space-2);
			flex-wrap: wrap;
		}

		.meta {
			display: flex;
			flex-wrap: wrap;
			gap: var(--space-5);
		}

		.meta_item {
			display: flex;
			align-items: center;
			gap: var(--space-2);
			font-size: var(--text-sm);
			color: var(--muted-fg);
		}

		.description {
			font-size: var(--text-base);
			color: var(--foreground-secondary);
			line-height: var(--leading-relaxed);
			max-width: 640px;
		}

		.section {
			padding: var(--space-10) 0;
		}

		.date_title {
			font-size: var(--text-lg);
			font-weight: var(--weight-semibold);
			margin: var(--space-4) 0 var(--space-2);
		}

		.branch_group {
			margin-bottom: var(--space-4);
		}

		.branch_name {
			font-size: var(--text-base);
			font-weight: var(--weight-medium);
			color: var(--foreground);
		}

		.hall_group {
			margin-top: var(--space-2);
			margin-left: var(--space-4);
		}

		.hall_name {
			font-size: var(--text-sm);
			color: var(--muted-fg);
		}

		.screenings {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
			gap: var(--space-4);
		}

		.reviews {
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
		}
	}

	@media (max-width: 768px) {
		.MovieDetail {
			.hero {
				grid-template-columns: 1fr;
				gap: var(--space-5);
			}

			.poster {
				max-width: 240px;
				margin: 0 auto;
			}

			.title {
				font-size: var(--text-2xl);
			}

			.hall_group {
				margin-left: 0;
			}
		}
	}
</style>
