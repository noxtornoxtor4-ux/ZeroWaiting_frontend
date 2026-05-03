<script lang="ts">
	import { locale } from 'svelte-i18n';
	import type { MovieWithFavoriteEntity } from '@/api/model';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { formatDuration } from '@/lib/utils/datetime';
	import { optimizedImageUrl } from '@/lib/utils/image';
	import FavoriteButton from '@/components/ui/FavoriteButton.svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		movies: MovieWithFavoriteEntity[];
	}

	let { movies }: Props = $props();
</script>

<div class="MovieCarousel">
	{#each movies as movie (movie.id)}
		{@const title = getLocalizedValue(
			movie.title as Record<string, string>,
			$locale
		)}
		<div class="card_wrap">
			<a href="/movies/{movie.id}" class="card" aria-label={title}>
				<div class="poster">
					{#if movie.posterUrl}
						<img
							src={optimizedImageUrl(movie.posterUrl, 360)}
							alt={title}
							loading="lazy"
						/>
					{:else}
						<div class="placeholder">
							<Icon icon="lucide:clapperboard" width={48} aria-hidden="true" />
						</div>
					{/if}

					{#if movie.ageRating}
						<span class="age">{movie.ageRating}</span>
					{/if}

					<div class="bottom_gradient"></div>
					<div class="bottom_row">
						{#if movie.averageRating}
							<span class="chip rating_chip">
								<Icon icon="lucide:star" width={12} aria-hidden="true" />
								{movie.averageRating.toFixed(1)}
								{#if movie.reviewCount}
									<span class="review_count">({movie.reviewCount})</span>
								{/if}
							</span>
						{/if}
						{#if movie.duration}
							<span class="chip duration_chip">
								<Icon icon="lucide:clock" width={12} aria-hidden="true" />
								{formatDuration(movie.duration)}
							</span>
						{/if}
					</div>

					{#if movie.trailerUrl}
						<div class="play_overlay" aria-hidden="true">
							<div class="play_btn">
								<Icon icon="lucide:play" width={22} />
							</div>
						</div>
					{/if}
				</div>
				<div class="info">
					<h3 class="title">{title}</h3>
					{#if movie.genres?.length}
						<div class="genres">
							{#each movie.genres.slice(0, 2) as genre}
								<span class="genre">{genre}</span>
							{/each}
						</div>
					{/if}
				</div>
			</a>
			<div class="favorite_slot">
				<FavoriteButton
					movieId={movie.id}
					isFavorite={movie.isFavorite}
					size={18}
				/>
			</div>
		</div>
	{/each}
</div>

<style lang="scss">
	.MovieCarousel {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--space-5);

		.card_wrap {
			position: relative;
			display: flex;

			&:hover,
			&:has(:focus-visible) {
				.card {
					border-color: var(--primary);
					transform: translateY(-4px);
					box-shadow:
						0 12px 32px rgba(0, 0, 0, 0.4),
						0 0 0 1px rgba(168, 85, 247, 0.35),
						0 0 32px rgba(168, 85, 247, 0.25);
				}

				.poster img {
					transform: scale(1.06);
				}

				.bottom_gradient,
				.bottom_row {
					opacity: 1;
				}

				.play_overlay {
					opacity: 1;

					.play_btn {
						transform: scale(1);
					}
				}
			}
		}

		.card {
			display: flex;
			flex-direction: column;
			border-radius: var(--radius-lg);
			overflow: hidden;
			background: var(--card-bg);
			border: 1px solid var(--border-color-subtle);
			content-visibility: auto;
			contain-intrinsic-size: 180px 360px;
			position: relative;
			flex: 1;
			will-change: transform;
			transition:
				border-color var(--duration-normal) var(--ease-default),
				transform var(--duration-normal) var(--ease-default),
				box-shadow var(--duration-normal) var(--ease-default);

			&:focus-visible {
				outline: none;
				border-color: var(--primary-light);
			}
		}

		.poster {
			position: relative;
			aspect-ratio: 2/3;
			overflow: hidden;
			background: var(--surface-hover);
			isolation: isolate;

			img {
				width: 100%;
				height: 100%;
				object-fit: cover;
				transition: transform var(--duration-slow) var(--ease-default);
			}
		}

		.placeholder {
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			color: var(--muted-fg);
			background: linear-gradient(
				135deg,
				var(--neutral-900),
				var(--neutral-800)
			);
		}

		.favorite_slot {
			position: absolute;
			top: var(--space-2);
			left: var(--space-2);
			width: 36px;
			height: 36px;
			border-radius: var(--radius-full);
			background: rgba(0, 0, 0, 0.55);
			backdrop-filter: blur(8px);
			-webkit-backdrop-filter: blur(8px);
			border: 1px solid rgba(255, 255, 255, 0.08);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 4;
			transition: background var(--duration-fast) var(--ease-default);

			&:hover {
				background: rgba(0, 0, 0, 0.75);
			}

			:global(.FavoriteButton) {
				width: 100%;
				height: 100%;
				border-radius: inherit;
				color: #fff;
			}

			:global(.FavoriteButton--active) {
				color: var(--danger);
			}
		}

		.age {
			position: absolute;
			top: var(--space-2);
			right: var(--space-2);
			display: inline-flex;
			align-items: center;
			padding: 4px 10px;
			background: rgba(0, 0, 0, 0.55);
			backdrop-filter: blur(8px);
			-webkit-backdrop-filter: blur(8px);
			border: 1px solid rgba(255, 255, 255, 0.08);
			color: #fff;
			font-size: 11px;
			font-weight: var(--weight-bold);
			border-radius: var(--radius-full);
			letter-spacing: 0.02em;
			z-index: 2;
		}

		.bottom_gradient {
			position: absolute;
			left: 0;
			right: 0;
			bottom: 0;
			height: 60%;
			background: linear-gradient(
				to top,
				rgba(0, 0, 0, 0.8) 0%,
				rgba(0, 0, 0, 0.35) 50%,
				transparent 100%
			);
			opacity: 0;
			transition: opacity var(--duration-normal) var(--ease-default);
			pointer-events: none;
			z-index: 1;
		}

		.bottom_row {
			position: absolute;
			left: var(--space-2);
			right: var(--space-2);
			bottom: var(--space-2);
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: var(--space-2);
			opacity: 0;
			transition: opacity var(--duration-normal) var(--ease-default);
			pointer-events: none;
			z-index: 2;
		}

		.chip {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 4px 8px;
			background: rgba(0, 0, 0, 0.65);
			backdrop-filter: blur(8px);
			-webkit-backdrop-filter: blur(8px);
			border: 1px solid rgba(255, 255, 255, 0.1);
			color: #fff;
			font-size: 11px;
			font-weight: var(--weight-semibold);
			border-radius: var(--radius-full);
			font-variant-numeric: tabular-nums;

			.review_count {
				color: rgba(255, 255, 255, 0.65);
				font-weight: var(--weight-normal);
				margin-left: 2px;
			}
		}

		.rating_chip {
			color: #fbbf24;

			.review_count {
				color: rgba(255, 255, 255, 0.65);
			}
		}

		.play_overlay {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			opacity: 0;
			transition: opacity var(--duration-normal) var(--ease-default);
			pointer-events: none;
			z-index: 3;
			background: radial-gradient(
				circle at center,
				rgba(0, 0, 0, 0.35) 0%,
				transparent 60%
			);

			.play_btn {
				width: 56px;
				height: 56px;
				border-radius: var(--radius-full);
				background: linear-gradient(
					135deg,
					var(--primary-600),
					var(--primary-500)
				);
				color: #fff;
				display: flex;
				align-items: center;
				justify-content: center;
				box-shadow:
					0 8px 24px rgba(0, 0, 0, 0.5),
					0 0 24px rgba(168, 85, 247, 0.45);
				transform: scale(0.7);
				will-change: transform;
				transition: transform var(--duration-normal) var(--ease-bounce);
			}
		}

		.info {
			padding: var(--space-3) var(--space-3) var(--space-4);
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			flex: 1;
		}

		.title {
			font-size: var(--text-base);
			font-weight: var(--weight-semibold);
			color: var(--foreground);
			line-height: 1.25;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}

		.genres {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			margin-top: auto;

			.genre {
				padding: 2px 8px;
				background: color-mix(in srgb, var(--primary) 10%, transparent);
				border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
				color: var(--primary-light);
				font-size: 11px;
				font-weight: var(--weight-medium);
				border-radius: var(--radius-full);
				letter-spacing: 0.01em;
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.MovieCarousel .card,
		.MovieCarousel .card .poster img,
		.MovieCarousel .play_overlay .play_btn {
			transition: none;
		}

		.MovieCarousel .card_wrap:hover .card,
		.MovieCarousel .card_wrap:has(:focus-visible) .card {
			transform: none;
		}

		.MovieCarousel .card_wrap:hover .poster img,
		.MovieCarousel .card_wrap:has(:focus-visible) .poster img {
			transform: none;
		}
	}

	@media (max-width: 640px) {
		.MovieCarousel {
			grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
			gap: var(--space-3);

			.title {
				font-size: var(--text-sm);
			}

			.favorite_slot {
				width: 32px;
				height: 32px;
			}
		}
	}
</style>
