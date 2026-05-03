<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import { _, locale } from 'svelte-i18n';
	import toast from 'svelte-french-toast';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { getErrorMessage } from '@/lib/utils/error';
	import { updateMovieFavoriteCache } from '@/lib/utils/favorite';
	import { requireAuth } from '@/lib/utils/auth-guard';
	import { formatDuration } from '@/lib/utils/datetime';
	import { optimizedImageUrl } from '@/lib/utils/image';

	const moviesQuery = crmQueryApi.createGetPublicMoviesV1(() => ({
		status: 'NOW_SHOWING' as const,
		limit: 10
	}));

	const movies = $derived(moviesQuery.data?.data ?? []);
	const queryClient = useQueryClient();

	const addFavMutation =
		crmQueryApi.createPostProfileMeFavoritesByMovieIdV1Mutation();
	const removeFavMutation =
		crmQueryApi.createDeleteProfileMeFavoritesByMovieIdV1Mutation();

	const toggleFavorite = async (movie: (typeof movies)[number]) => {
		if (!requireAuth('Войдите в аккаунт, чтобы сохранять фильмы в избранное'))
			return;
		const prev = !!movie.isFavorite;
		updateMovieFavoriteCache(queryClient, movie.id, !prev);
		try {
			if (prev) {
				await removeFavMutation.mutateAsync({ movieId: movie.id });
			} else {
				await addFavMutation.mutateAsync({ movieId: movie.id });
			}
			queryClient.invalidateQueries({
				queryKey: ['/api/v1/profile/me/favorites']
			});
		} catch (error) {
			updateMovieFavoriteCache(queryClient, movie.id, prev);
			toast.error(getErrorMessage(error, 'Ошибка'));
		}
	};

	let currentSlide = $state(0);
	let isPaused = $state(false);
	let elapsedTime = $state(0);
	let autoplayInterval: ReturnType<typeof setInterval> | undefined;

	const PROGRESS_DURATION = 5000;
	const INTERVAL_STEP = 50;

	const current = $derived(movies[currentSlide]);
	const progressPercentage = $derived(
		Math.min((elapsedTime / PROGRESS_DURATION) * 100, 100)
	);

	const goToSlide = (index: number) => {
		currentSlide = index;
		elapsedTime = 0;
	};

	const startAutoplay = () => {
		if (autoplayInterval) return;
		autoplayInterval = setInterval(() => {
			if (isPaused || movies.length === 0) return;
			elapsedTime += INTERVAL_STEP;
			if (elapsedTime >= PROGRESS_DURATION) {
				currentSlide = (currentSlide + 1) % movies.length;
				elapsedTime = 0;
			}
		}, INTERVAL_STEP);
	};

	const stopAutoplay = () => {
		if (autoplayInterval) {
			clearInterval(autoplayInterval);
			autoplayInterval = undefined;
		}
	};

	const togglePlayPause = () => (isPaused = !isPaused);

	let hasInitialized = $state(false);
	$effect(() => {
		if (movies.length > 0 && !hasInitialized) {
			hasInitialized = true;
			startAutoplay();
		}
	});

	onMount(() => () => stopAutoplay());

	type Movie = (typeof movies)[number];
	const getTitle = (m: Movie) => getLocalizedValue(m.title, $locale);
	const getDescription = (m: Movie) => {
		const text = getLocalizedValue(m.description, $locale);
		return text.length <= 120 ? text : text.substring(0, 120).trim() + '…';
	};

	let touchStartX = 0;
	const onTouchStart = (e: TouchEvent) => {
		touchStartX = e.touches[0]?.clientX ?? 0;
	};
	const onTouchEnd = (e: TouchEvent) => {
		const endX = e.changedTouches[0]?.clientX ?? 0;
		const diff = endX - touchStartX;
		if (Math.abs(diff) < 50 || movies.length === 0) return;
		if (diff < 0) {
			goToSlide((currentSlide + 1) % movies.length);
		} else {
			goToSlide((currentSlide - 1 + movies.length) % movies.length);
		}
	};
</script>

{#if moviesQuery.isLoading}
	<section class="WelcomeMobile">
		<div class="skeleton_slide"></div>
	</section>
{:else if movies.length > 0 && current}
	<section
		class="WelcomeMobile"
		aria-roledescription="carousel"
		aria-label={$_('home.welcome.movie')}
		ontouchstart={onTouchStart}
		ontouchend={onTouchEnd}
	>
		{#each movies as movie, index (movie.id)}
			<article class="slide" class:active={index === currentSlide}>
				{#if movie.posterUrl}
					<img
						class="bg"
						src={optimizedImageUrl(movie.posterUrl, 800, 70)}
						alt=""
						loading={index === currentSlide ? 'eager' : 'lazy'}
						decoding="async"
					/>
				{/if}
				<div class="bg_scrim"></div>

				<div class="badges_row">
					<div class="badge_group">
						{#if movie.ageRating}
							<span class="badge">{movie.ageRating}</span>
						{/if}
						<span class="badge">
							{new Date(movie.releaseDate).getFullYear()}
						</span>
					</div>
				</div>

				<div class="content">
					<h2 class="title">{getTitle(movie)}</h2>

					<div class="meta">
						<span>
							<Icon icon="lucide:clock" width={13} aria-hidden="true" />
							{formatDuration(movie.duration)}
						</span>
						{#if movie.genres?.length}
							<span class="dot_sep"></span>
							<span class="genres">{movie.genres.slice(0, 2).join(', ')}</span>
						{/if}
					</div>

					{#if movie.description}
						<p class="description">{getDescription(movie)}</p>
					{/if}

					<div class="actions">
						<a href="/movies/{movie.id}" class="cta primary">
							<Icon icon="lucide:play" width={16} aria-hidden="true" />
							{$_('home.welcome.goToMovie')}
						</a>
						<button
							type="button"
							class="cta secondary"
							class:favorited={movie.isFavorite}
							onclick={() => toggleFavorite(movie)}
							aria-label={movie.isFavorite
								? $_('home.welcome.inFavorites')
								: $_('home.welcome.addToFavorites')}
						>
							<Icon
								icon={movie.isFavorite ? 'mdi:heart' : 'mdi:heart-outline'}
								width={18}
								aria-hidden="true"
							/>
							<span class="cta_text">
								{movie.isFavorite
									? $_('home.welcome.inFavorites')
									: $_('home.welcome.addToFavorites')}
							</span>
						</button>
					</div>
				</div>
			</article>
		{/each}

		<div class="controls">
			<div class="dots">
				{#each movies as _, index (index)}
					<button
						type="button"
						class="dot"
						class:active={index === currentSlide}
						onclick={() => goToSlide(index)}
						aria-label="Слайд {index + 1}"
					></button>
				{/each}
			</div>
			<button
				type="button"
				class="play_pause"
				onclick={togglePlayPause}
				aria-label={isPaused ? 'Play' : 'Pause'}
			>
				<Icon
					icon={isPaused ? 'lucide:play' : 'lucide:pause'}
					width={14}
					aria-hidden="true"
				/>
			</button>
		</div>

		<div class="progress">
			<div class="progress_bar" style:width="{progressPercentage}%"></div>
		</div>
	</section>
{/if}

<style lang="scss">
	.WelcomeMobile {
		position: relative;
		height: calc(100dvh - 80px);
		min-height: 560px;
		max-height: 720px;
		overflow: hidden;
		background: var(--neutral-950);
		touch-action: pan-y;

		:global(.FavoriteButton) {
			color: #fff;
		}

		:global(.FavoriteButton--active) {
			color: var(--danger);
		}
	}

	.skeleton_slide {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			135deg,
			var(--neutral-900),
			var(--neutral-800),
			var(--neutral-900)
		);
		background-size: 200% 100%;
		animation: shimmer 1.6s ease-in-out infinite;
	}

	@keyframes shimmer {
		0%,
		100% {
			background-position: 0% 0%;
		}
		50% {
			background-position: 100% 0%;
		}
	}

	.slide {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.5s ease;

		&.active {
			opacity: 1;
			visibility: visible;
		}

		.bg {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			object-fit: cover;
			object-position: center top;
			filter: brightness(0.55);
		}

		.bg_scrim {
			position: absolute;
			inset: 0;
			background:
				linear-gradient(
					to bottom,
					rgba(18, 18, 22, 0.2) 0%,
					rgba(18, 18, 22, 0.4) 35%,
					rgba(18, 18, 22, 0.88) 70%,
					rgba(18, 18, 22, 0.98) 100%
				),
				linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, transparent 60%);
		}
	}

	.badges_row {
		position: absolute;
		top: calc(var(--header-height, 80px) + 16px);
		left: 16px;
		right: 16px;
		display: flex;
		justify-content: flex-end;
		align-items: flex-start;
		z-index: 3;
		pointer-events: none;

		.badge_group {
			display: flex;
			gap: 6px;
			pointer-events: auto;
		}

		.badge {
			padding: 4px 10px;
			background: rgba(0, 0, 0, 0.55);
			backdrop-filter: blur(10px);
			-webkit-backdrop-filter: blur(10px);
			border: 1px solid rgba(255, 255, 255, 0.1);
			color: #fff;
			font-size: 11px;
			font-weight: var(--weight-bold);
			border-radius: var(--radius-full);
			letter-spacing: 0.02em;
		}
	}

	.content {
		position: relative;
		z-index: 2;
		padding: 24px 20px 88px;
		display: flex;
		flex-direction: column;
		gap: 12px;

		.title {
			font-size: clamp(26px, 8vw, 34px);
			font-weight: var(--weight-extrabold);
			line-height: 1.1;
			color: #fff;
			background: linear-gradient(135deg, #fff 0%, var(--primary-300) 100%);
			-webkit-background-clip: text;
			background-clip: text;
			-webkit-text-fill-color: transparent;
			letter-spacing: -0.01em;
		}

		.meta {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 13px;
			color: rgba(255, 255, 255, 0.75);
			font-weight: var(--weight-medium);

			span {
				display: inline-flex;
				align-items: center;
				gap: 4px;
			}

			.dot_sep {
				width: 3px;
				height: 3px;
				border-radius: 50%;
				background: rgba(255, 255, 255, 0.4);
			}

			.genres {
				color: var(--primary-light);
			}
		}

		.description {
			font-size: 14px;
			line-height: 1.5;
			color: rgba(255, 255, 255, 0.72);
			display: -webkit-box;
			-webkit-line-clamp: 3;
			line-clamp: 3;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}

		.actions {
			display: flex;
			gap: 8px;
			margin-top: 4px;
			flex-wrap: wrap;
		}

		.cta {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			padding: 12px 18px;
			border-radius: var(--radius-full);
			font-size: 14px;
			font-weight: var(--weight-semibold);
			text-decoration: none;
			border: 1px solid transparent;
			cursor: pointer;
			transition:
				transform var(--duration-fast) var(--ease-default),
				background var(--duration-fast) var(--ease-default),
				border-color var(--duration-fast) var(--ease-default),
				color var(--duration-fast) var(--ease-default);

			&:active {
				transform: scale(0.97);
			}

			&.primary {
				background: linear-gradient(
					135deg,
					var(--primary-600),
					var(--primary-500)
				);
				color: #fff;
				box-shadow: 0 8px 20px rgba(168, 85, 247, 0.35);
			}

			&.secondary {
				background: rgba(255, 255, 255, 0.08);
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				border-color: rgba(255, 255, 255, 0.14);
				color: #fff;

				&.favorited {
					background: rgba(239, 68, 68, 0.15);
					border-color: rgba(239, 68, 68, 0.45);
					color: var(--danger);
				}
			}

			.cta_text {
				white-space: nowrap;
			}
		}
	}

	.controls {
		position: absolute;
		bottom: 22px;
		left: 20px;
		right: 20px;
		z-index: 4;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;

		.dots {
			display: flex;
			gap: 6px;
			flex: 1;
			max-width: 70%;

			.dot {
				flex: 1;
				height: 3px;
				max-width: 28px;
				border: none;
				border-radius: 2px;
				background: rgba(255, 255, 255, 0.25);
				cursor: pointer;
				transition: background var(--duration-fast) var(--ease-default);
				padding: 0;

				&.active {
					background: var(--primary-light);
				}
			}
		}

		.play_pause {
			width: 34px;
			height: 34px;
			border-radius: 50%;
			background: rgba(0, 0, 0, 0.55);
			backdrop-filter: blur(10px);
			-webkit-backdrop-filter: blur(10px);
			border: 1px solid rgba(255, 255, 255, 0.1);
			color: #fff;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
		}
	}

	.progress {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: rgba(255, 255, 255, 0.08);
		z-index: 4;

		.progress_bar {
			height: 100%;
			background: linear-gradient(
				90deg,
				var(--primary-500),
				var(--primary-300)
			);
			width: 0;
			transition: width 50ms linear;
		}
	}
</style>
