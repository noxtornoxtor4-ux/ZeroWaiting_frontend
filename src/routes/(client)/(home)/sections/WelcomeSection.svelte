<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import { _, locale } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { getErrorMessage } from '@/lib/utils/error';
	import { updateMovieFavoriteCache } from '@/lib/utils/favorite';
	import { requireAuth } from '@/lib/utils/auth-guard';
	import { formatDuration } from '@/lib/utils/datetime';
	import { optimizedImageUrl } from '@/lib/utils/image';
	import toast from 'svelte-french-toast';

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
	let isHovered = $state(false);
	let elapsedTime = $state(0);
	let autoplayInterval: ReturnType<typeof setInterval> | undefined = $state();

	const PROGRESS_DURATION = 5000;
	const INTERVAL_STEP = 16;

	const currentMovie = $derived(movies[currentSlide]);
	const progressPercentage = $derived(
		Math.min((elapsedTime / PROGRESS_DURATION) * 100, 100)
	);

	const nextSlide = (isAutomatic = false) => {
		if (movies.length === 0) return;
		currentSlide = (currentSlide + 1) % movies.length;
		if (!isAutomatic) resetProgress();
	};

	const prevSlide = () => {
		if (movies.length === 0) return;
		currentSlide = currentSlide === 0 ? movies.length - 1 : currentSlide - 1;
		resetProgress();
	};

	const goToSlide = (index: number) => {
		currentSlide = index;
		resetProgress();
	};

	const startAutoplay = () => {
		if (autoplayInterval) return;
		autoplayInterval = setInterval(() => {
			if (!isPaused && !isHovered) {
				elapsedTime += INTERVAL_STEP;
				if (elapsedTime >= PROGRESS_DURATION) {
					nextSlide(true);
					elapsedTime = 0;
				}
			}
		}, INTERVAL_STEP);
	};

	const stopAutoplay = () => {
		if (autoplayInterval) {
			clearInterval(autoplayInterval);
			autoplayInterval = undefined;
		}
	};

	const resetProgress = () => {
		stopAutoplay();
		elapsedTime = 0;
		startAutoplay();
	};

	const togglePlayPause = () => {
		isPaused = !isPaused;
	};

	type Movie = (typeof movies)[number];

	const getTitle = (movie: Movie) => getLocalizedValue(movie.title, $locale);

	const isNearSlide = (index: number) => {
		if (movies.length <= 3) return true;
		const prev = (currentSlide - 1 + movies.length) % movies.length;
		const next = (currentSlide + 1) % movies.length;
		return index === currentSlide || index === prev || index === next;
	};

	const getDescription = (movie: Movie) => {
		const text = getLocalizedValue(movie.description, $locale);
		return text.length <= 200 ? text : text.substring(0, 200).trim() + '...';
	};

	let hasInitialized = $state(false);

	$effect(() => {
		if (movies.length > 0 && !hasInitialized) {
			hasInitialized = true;
			resetProgress();
		}
	});

	onMount(() => {
		return () => stopAutoplay();
	});
</script>

{#if moviesQuery.isLoading}
	<div class="Welcome">
		<div class="slider_container">
			<div class="slider_loading">
				<div class="loading_spinner"></div>
				<p class="loading_text">{$_('home.welcome.loading')}</p>
			</div>
		</div>
	</div>
{:else if movies.length > 0}
	<div
		class="Welcome"
		role="region"
		aria-label={$_('home.welcome.movie')}
		onmouseenter={() => (isHovered = true)}
		onmouseleave={() => (isHovered = false)}
	>
		<div class="slider_container">
			<div class="slider_content">
				{#each movies as movie, index (movie.id)}
					<div class="slide" class:active={index === currentSlide}>
						<div class="slide_bg">
							{#if movie.posterUrl && isNearSlide(index)}
								<img
									src={optimizedImageUrl(movie.posterUrl, 1200, 80)}
									alt=""
									class="slide_bg_image"
									loading={index === currentSlide ? 'eager' : 'lazy'}
									decoding="async"
									fetchpriority={index === currentSlide ? 'high' : 'low'}
								/>
							{/if}
							<div class="slide_gradient"></div>
						</div>

						<div class="container">
							<div class="slide_content">
								<div class="slide_info">
									<div class="slide_meta">
										<span>
											<Icon icon="lucide:film" width={16} />
											{$_('home.welcome.movie')}
										</span>
										{#if movie.ageRating}
											<span>
												<Icon icon="lucide:shield" width={16} />
												{movie.ageRating}
											</span>
										{/if}
										<span>
											<Icon icon="lucide:calendar" width={16} />
											{new Date(movie.releaseDate).getFullYear()}
										</span>
										{#if movie.language}
											<span>
												<Icon icon="lucide:globe" width={16} />
												{movie.language}
											</span>
										{/if}
										<span>
											<Icon icon="lucide:clock" width={16} />
											{formatDuration(movie.duration)}
										</span>
									</div>

									<h2 class="slide_title">
										<span class="slide_title_text">
											{getTitle(movie)}
										</span>
										<div class="slide_title_underline"></div>
									</h2>

									{#if movie.description}
										<p class="slide_description">
											{getDescription(movie)}
										</p>
									{/if}

									{#if movie.genres?.length}
										<div class="slide_genres">
											{#each movie.genres.slice(0, 3) as genre}
												<span class="genre_tag">{genre}</span>
											{/each}
										</div>
									{/if}

									<div class="slide_actions">
										<a href="/movies/{movie.id}" class="btn primary">
											<Icon icon="lucide:play" width={20} />
											<span class="btn_text">
												{$_('home.welcome.goToMovie')}
											</span>
										</a>
										<button
											class="btn secondary"
											class:favorited={movie.isFavorite}
											onclick={() => toggleFavorite(movie)}
										>
											<Icon icon="lucide:heart" width={20} />
											<span class="btn_text">
												{movie.isFavorite
													? $_('home.welcome.inFavorites')
													: $_('home.welcome.addToFavorites')}
											</span>
										</button>
									</div>
								</div>

								<div class="slide_poster">
									<div class="poster_container">
										{#if movie.posterUrl && isNearSlide(index)}
											<img
												src={optimizedImageUrl(movie.posterUrl, 400, 70)}
												alt={getTitle(movie)}
												class="poster_image"
												loading={index === currentSlide ? 'eager' : 'lazy'}
												decoding="async"
											/>
										{/if}
										<div class="poster_glow"></div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/each}

				<div class="slider_nav">
					<button
						class="nav_btn"
						onclick={prevSlide}
						disabled={movies.length <= 1}
						aria-label="Previous slide"
					>
						<Icon icon="lucide:chevron-left" width={24} />
					</button>
					<button
						class="nav_btn"
						onclick={() => nextSlide()}
						disabled={movies.length <= 1}
						aria-label="Next slide"
					>
						<Icon icon="lucide:chevron-right" width={24} />
					</button>
				</div>

				<div class="slider_dots">
					{#each movies as _, index (index)}
						<button
							class="dot"
							class:active={index === currentSlide}
							onclick={() => goToSlide(index)}
							aria-label="Go to slide {index + 1}"
						>
							<div class="dot_inner"></div>
						</button>
					{/each}
				</div>

				<div class="slider_progress">
					<div
						class="progress_bar"
						style:width="{progressPercentage}%"
						style:transition={isPaused || isHovered
							? 'none'
							: 'width 16ms linear'}
					>
						<div class="progress_glow"></div>
					</div>
				</div>

				<button
					class="play_pause_btn"
					class:paused={isPaused}
					onclick={togglePlayPause}
					title={isPaused ? $_('home.welcome.play') : $_('home.welcome.pause')}
				>
					<Icon icon={isPaused ? 'lucide:play' : 'lucide:pause'} width={20} />
				</button>
			</div>
		</div>

		<div class="hero_bg_effects">
			<div class="hero_gradient"></div>
			<div class="hero_particles"></div>
		</div>
	</div>
{/if}

<style lang="scss">
	.Welcome {
		position: relative;
		height: 80vh;
		min-height: 600px;
		overflow: hidden;
		background: var(--neutral-950);

		.slider_container {
			position: relative;
			height: 100%;
			width: 100%;
		}

		.slider_loading {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			height: 100%;
			gap: 32px;

			.loading_spinner {
				width: 60px;
				height: 60px;
				border: 4px solid rgba(168, 85, 247, 0.1);
				border-left: 4px solid var(--primary);
				border-radius: 50%;
				animation: spin 1s linear infinite;
			}

			.loading_text {
				color: var(--muted-fg);
				font-size: 18px;
				font-weight: 500;
				animation: pulse 2s ease-in-out infinite;
			}
		}

		.slider_content {
			.slide {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				opacity: 0;
				visibility: hidden;
				transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
				transform: scale(1.05);
				display: flex;
				align-items: center;

				&.active {
					opacity: 1;
					visibility: visible;
					transform: scale(1);

					.slide_title_text {
						animation: slideInUp 1s ease-out 0.3s both;
					}

					.slide_title_underline {
						animation: slideInRight 1s ease-out 0.5s both;
					}

					.slide_description {
						animation: slideInUp 1s ease-out 0.4s both;
					}

					.slide_actions {
						animation: slideInUp 1s ease-out 0.5s both;
					}

					.slide_bg_image {
						transform: scale(1.1);
					}
				}

				.slide_bg {
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					z-index: 1;

					.slide_bg_image {
						width: 100%;
						height: 100%;
						object-fit: cover;
						object-position: center top;
						filter: blur(3px) brightness(0.9);
						transition: transform 8s ease-in-out;
						will-change: transform;
					}

					.slide_gradient {
						position: absolute;
						top: 0;
						left: 0;
						right: 0;
						bottom: 0;
						background:
							linear-gradient(
								135deg,
								rgba(2, 6, 23, 0.9) 0%,
								rgba(15, 23, 42, 0.7) 40%,
								rgba(15, 23, 42, 0.8) 100%
							),
							linear-gradient(90deg, rgba(0, 0, 0, 0.8) 0%, transparent 70%);
					}
				}

				.slide_content {
					position: relative;
					z-index: 2;
					height: 100%;
					display: flex;
					align-items: center;
					gap: 64px;

					@media (max-width: 1024px) {
						flex-direction: column;
						justify-content: center;
						text-align: center;
						gap: 32px;
					}
				}

				.slide_info {
					flex: 1;
					max-width: 670px;

					.slide_meta {
						display: flex;
						align-items: center;
						gap: 16px;
						margin-bottom: 24px;
						flex-wrap: wrap;

						@media (max-width: 1024px) {
							justify-content: center;
						}

						span {
							display: flex;
							align-items: center;
							gap: 8px;
							padding: 8px 16px;
							background: rgba(168, 85, 247, 0.2);
							border: 1px solid rgba(168, 85, 247, 0.4);
							border-radius: 20px;
							color: #c084fc;
							font-size: 14px;
							font-weight: 500;
							transition: all 0.3s ease;

							&:hover {
								background: rgba(168, 85, 247, 0.3);
								border-color: rgba(168, 85, 247, 0.6);
								transform: translateY(-2px);
							}
						}
					}

					.slide_title {
						position: relative;
						margin-bottom: 24px;

						.slide_title_text {
							font-size: clamp(40px, 5vw, 56px);
							font-weight: 800;
							color: white;
							line-height: 1.1;
							display: block;
							opacity: 0;
						}

						.slide_title_underline {
							position: absolute;
							bottom: -8px;
							left: 0;
							width: 0;
							height: 4px;
							background: linear-gradient(
								45deg,
								var(--primary-500),
								var(--primary-400)
							);
							border-radius: 2px;

							@media (max-width: 1024px) {
								left: 50%;
								transform: translateX(-50%);
							}
						}
					}

					.slide_description {
						font-size: 18px;
						line-height: 1.6;
						color: rgba(255, 255, 255, 0.8);
						margin-bottom: 24px;
						opacity: 0;
					}

					.slide_genres {
						display: flex;
						gap: 8px;
						margin-bottom: 32px;
						flex-wrap: wrap;

						@media (max-width: 1024px) {
							justify-content: center;
						}

						.genre_tag {
							padding: 6px 14px;
							background: rgba(255, 255, 255, 0.08);
							border-radius: 20px;
							color: var(--muted-fg);
							font-size: 13px;
							font-weight: 500;
						}
					}

					.slide_actions {
						display: flex;
						gap: 16px;
						flex-wrap: wrap;
						opacity: 0;

						@media (max-width: 1024px) {
							justify-content: center;
						}

						.btn {
							position: relative;
							display: flex;
							align-items: center;
							gap: 12px;
							padding: 16px 32px;
							border-radius: 50px;
							font-weight: 600;
							font-size: 16px;
							border: none;
							cursor: pointer;
							transition: all 0.3s ease;
							text-decoration: none;

							.btn_text {
								position: relative;
								z-index: 1;
							}

							&.primary {
								background: linear-gradient(
									45deg,
									var(--primary-500),
									var(--primary-400)
								);
								color: white;
								will-change: transform;

								&:hover {
									transform: translateY(-2px);
									box-shadow: 0 8px 25px rgba(168, 85, 247, 0.4);
								}
							}

							&.secondary {
								background: rgba(255, 255, 255, 0.1);
								color: white;
								border: 1px solid rgba(168, 85, 247, 0.3);

								&:hover {
									background: rgba(168, 85, 247, 0.2);
									border-color: rgba(168, 85, 247, 0.5);
									transform: translateY(-2px);
								}

								&.favorited {
									background: rgba(239, 68, 68, 0.15);
									border-color: rgba(239, 68, 68, 0.4);
									color: var(--danger);
								}
							}
						}
					}
				}

				.slide_poster {
					flex: 0 0 auto;

					@media (max-width: 1024px) {
						order: -1;
					}

					.poster_container {
						position: relative;
						width: 300px;
						aspect-ratio: 2/3;
						border-radius: 20px;
						overflow: hidden;
						border: 2px solid rgba(168, 85, 247, 0.3);
						transition: all 0.3s ease;

						@media (max-width: 1024px) {
							width: 250px;
						}

						@media (max-width: 480px) {
							width: 200px;
						}

						&:hover {
							border-color: rgba(168, 85, 247, 0.6);
							transform: scale(1.05);

							.poster_glow {
								opacity: 1;
							}
						}

						.poster_image {
							width: 100%;
							height: 100%;
							object-fit: cover;
							transition: transform 0.3s ease;
						}

						.poster_glow {
							position: absolute;
							top: -10px;
							left: -10px;
							right: -10px;
							bottom: -10px;
							background: linear-gradient(
								45deg,
								var(--primary-500),
								var(--primary-400)
							);
							border-radius: 30px;
							opacity: 0;
							filter: blur(20px);
							transition: opacity 0.3s ease;
							will-change: opacity;
							z-index: -1;
						}
					}
				}
			}
		}

		.slider_nav {
			position: absolute;
			top: 50%;
			left: 0;
			right: 0;
			z-index: 10;
			display: flex;
			justify-content: space-between;
			padding: 0 32px;
			transform: translateY(-50%);
			pointer-events: none;

			.nav_btn {
				pointer-events: all;
				width: 60px;
				height: 60px;
				background: rgba(0, 0, 0, 0.5);
				border: 1px solid rgba(168, 85, 247, 0.3);
				border-radius: 50%;
				color: white;
				cursor: pointer;
				transition: all 0.3s ease;
				display: flex;
				align-items: center;
				justify-content: center;

				&:hover:not(:disabled) {
					background: var(--primary);
					border-color: var(--primary);
					transform: scale(1.1);
				}

				&:disabled {
					opacity: 0.3;
					cursor: not-allowed;
				}

				@media (max-width: 768px) {
					width: 50px;
					height: 50px;
				}
			}
		}

		.slider_dots {
			position: absolute;
			bottom: 32px;
			left: 50%;
			transform: translateX(-50%);
			z-index: 10;
			display: flex;
			gap: 16px;

			.dot {
				width: 12px;
				height: 12px;
				border-radius: 50%;
				background: transparent;
				border: 2px solid rgba(255, 255, 255, 0.3);
				cursor: pointer;
				transition: all 0.3s ease;
				padding: 0;

				.dot_inner {
					width: 0;
					height: 0;
					background: var(--primary);
					border-radius: 50%;
					transition: all 0.3s ease;
					margin: auto;
				}

				&:hover {
					border-color: rgba(168, 85, 247, 0.7);
					transform: scale(1.2);

					.dot_inner {
						width: 8px;
						height: 8px;
					}
				}

				&.active {
					border-color: var(--primary);

					.dot_inner {
						width: 8px;
						height: 8px;
					}
				}
			}
		}

		.slider_progress {
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			height: 4px;
			background: rgba(255, 255, 255, 0.1);
			z-index: 10;

			.progress_bar {
				position: relative;
				height: 100%;
				background: linear-gradient(
					45deg,
					var(--primary-500),
					var(--primary-400)
				);
				width: 0;

				.progress_glow {
					position: absolute;
					top: -2px;
					right: -5px;
					width: 10px;
					height: 8px;
					background: var(--primary-400);
					border-radius: 50%;
					filter: blur(3px);
					animation: pulse 1s ease-in-out infinite;
					will-change: opacity, transform;
				}
			}
		}

		.play_pause_btn {
			position: absolute;
			top: 112px;
			right: 32px;
			z-index: 10;
			width: 50px;
			height: 50px;
			background: rgba(0, 0, 0, 0.5);
			border: 1px solid rgba(168, 85, 247, 0.3);
			border-radius: 50%;
			color: white;
			cursor: pointer;
			transition: all 0.3s ease;
			display: flex;
			align-items: center;
			justify-content: center;

			&:hover {
				background: var(--primary);
				border-color: var(--primary);
				transform: scale(1.1);
			}

			&.paused {
				background: rgba(245, 158, 11, 0.2);
				border-color: var(--warning);
				color: var(--warning);

				&:hover {
					background: var(--warning);
					color: white;
				}
			}
		}

		.hero_bg_effects {
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			pointer-events: none;
			z-index: 0;

			.hero_gradient {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background:
					radial-gradient(
						circle at 20% 80%,
						rgba(168, 85, 247, 0.1) 0%,
						transparent 50%
					),
					radial-gradient(
						circle at 80% 20%,
						rgba(168, 85, 247, 0.08) 0%,
						transparent 50%
					);
			}

			.hero_particles {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;

				&::before,
				&::after {
					content: '';
					position: absolute;
					width: 4px;
					height: 4px;
					background: rgba(168, 85, 247, 0.3);
					border-radius: 50%;
					animation: float 6s ease-in-out infinite;
				}

				&::before {
					top: 20%;
					left: 10%;
					animation-delay: 0s;
				}

				&::after {
					top: 60%;
					right: 15%;
					animation-delay: 3s;
				}
			}
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes slideInRight {
		from {
			width: 0;
		}
		to {
			width: 100px;
		}
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-20px);
		}
	}

	@media (max-width: 768px) {
		.Welcome {
			height: 80vh;
			min-height: 500px;

			.slider_nav {
				padding: 0 16px;
			}

			.slider_content .slide .slide_content {
				padding: 16px 0;
				gap: 24px;
			}

			.slider_content .slide .slide_info .slide_title .slide_title_text {
				font-size: clamp(32px, 8vw, 48px);
			}

			.slider_content .slide .slide_info .slide_actions {
				justify-content: center;
			}
		}
	}

	@media (max-width: 480px) {
		.Welcome {
			height: 70vh;
			min-height: 400px;

			.slider_content .slide .slide_info {
				.slide_description {
					font-size: 16px;
				}

				.slide_actions .btn {
					padding: 12px 24px;
					font-size: 14px;
				}
			}
		}
	}
</style>
