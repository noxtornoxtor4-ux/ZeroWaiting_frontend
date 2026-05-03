<script lang="ts">
	import { onMount } from 'svelte';
	import type Plyr from 'plyr';

	interface Props {
		src: string;
		title?: string;
	}

	let { src, title = 'Video' }: Props = $props();

	let containerEl: HTMLDivElement;
	let player: Plyr | undefined;

	const THUMB_WIDTH = 300;
	const THUMB_INTERVAL = 1;

	const extractYoutubeId = (url: string): string | null => {
		const patterns = [
			/(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
			/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
			/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/
		];

		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match) return match[1];
		}

		return null;
	};

	const isDirectVideo = $derived(
		!extractYoutubeId(src) && !src.includes('vimeo.com')
	);

	const provider = $derived.by(() => {
		if (extractYoutubeId(src)) return 'youtube' as const;
		if (src.includes('vimeo.com')) return 'vimeo' as const;
		return 'html5' as const;
	});

	const videoSource = $derived(
		provider === 'youtube' ? extractYoutubeId(src)! : src
	);

	interface ThumbnailFrame {
		time: number;
		dataUrl: string;
	}

	interface ThumbnailResult {
		frames: ThumbnailFrame[];
		width: number;
		height: number;
		duration: number;
	}

	const generateFrames = (videoUrl: string): Promise<ThumbnailResult> =>
		new Promise((resolve, reject) => {
			const video = document.createElement('video');
			video.crossOrigin = 'anonymous';
			video.preload = 'auto';
			video.muted = true;
			video.playsInline = true;

			video.addEventListener('error', () =>
				reject(new Error('Failed to load video'))
			);

			video.addEventListener('loadedmetadata', async () => {
				const { duration, videoWidth, videoHeight } = video;
				const count = Math.ceil(duration / THUMB_INTERVAL);
				const aspectRatio = videoWidth / videoHeight;
				const thumbW = THUMB_WIDTH;
				const thumbH = Math.round(THUMB_WIDTH / aspectRatio);
				const canvas = document.createElement('canvas');
				canvas.width = thumbW;
				canvas.height = thumbH;
				const ctx = canvas.getContext('2d')!;
				const frames: ThumbnailFrame[] = [];

				const seekTo = (time: number): Promise<void> =>
					new Promise((res) => {
						video.addEventListener('seeked', () => res(), { once: true });
						video.currentTime = time;
					});

				for (let i = 0; i < count; i++) {
					const time = i * THUMB_INTERVAL;
					await seekTo(time);
					ctx.drawImage(video, 0, 0, thumbW, thumbH);
					frames.push({ time, dataUrl: canvas.toDataURL('image/jpeg', 0.6) });
				}

				resolve({ frames, width: thumbW, height: thumbH, duration });
			});

			video.src = videoUrl;
		});

	const setupPreview = (
		frames: ThumbnailFrame[],
		duration: number,
		thumbW: number,
		thumbH: number
	) => {
		const progressEl = containerEl.querySelector(
			'.plyr__progress'
		) as HTMLElement | null;
		const plyrContainer = containerEl.querySelector(
			'.plyr'
		) as HTMLElement | null;
		if (!progressEl || !plyrContainer) return;

		const tooltip = document.createElement('div');
		tooltip.className = 'plyr_preview_thumb';

		const img = document.createElement('img');
		img.width = thumbW;
		img.height = thumbH;
		tooltip.appendChild(img);

		const timeLabel = document.createElement('span');
		timeLabel.className = 'plyr_preview_time';
		tooltip.appendChild(timeLabel);

		const arrow = document.createElement('div');
		arrow.className = 'plyr_preview_arrow';
		tooltip.appendChild(arrow);

		plyrContainer.appendChild(tooltip);

		const formatTime = (s: number) => {
			const m = Math.floor(s / 60);
			const sec = Math.floor(s % 60);
			return `${m}:${String(sec).padStart(2, '0')}`;
		};

		const onMove = (e: MouseEvent) => {
			const progressRect = progressEl.getBoundingClientRect();
			const containerRect = plyrContainer.getBoundingClientRect();
			const ratio = Math.max(
				0,
				Math.min(1, (e.clientX - progressRect.left) / progressRect.width)
			);
			const time = ratio * duration;

			const frameIndex = Math.min(
				Math.floor(time / THUMB_INTERVAL),
				frames.length - 1
			);
			const frame = frames[frameIndex];
			if (!frame) return;

			img.src = frame.dataUrl;
			timeLabel.textContent = formatTime(time);

			const thumbHalf = thumbW / 2 + 4;
			const xInContainer = e.clientX - containerRect.left;
			const left = Math.max(
				thumbHalf,
				Math.min(containerRect.width - thumbHalf, xInContainer)
			);
			const bottom = containerRect.bottom - progressRect.top + 8;

			tooltip.style.left = `${left}px`;
			tooltip.style.bottom = `${bottom}px`;
			tooltip.style.display = 'block';

			const arrowX = xInContainer - left + thumbW / 2;
			const clampedArrowX = Math.max(12, Math.min(thumbW - 8, arrowX));
			arrow.style.left = `${clampedArrowX}px`;
		};

		const onLeave = () => {
			tooltip.style.display = 'none';
		};

		progressEl.addEventListener('mousemove', onMove);
		progressEl.addEventListener('mouseleave', onLeave);

		return () => {
			progressEl.removeEventListener('mousemove', onMove);
			progressEl.removeEventListener('mouseleave', onLeave);
			tooltip.remove();
		};
	};

	onMount(() => {
		let cleanupPreview: (() => void) | undefined;

		const init = async () => {
			const [{ default: PlyrConstructor }] = await Promise.all([
				import('plyr'),
				import('plyr/dist/plyr.css')
			]);

			const el = containerEl.querySelector('[data-plyr]');
			if (!el) return;

			const isMobile = window.matchMedia('(max-width: 768px)').matches;

			const controls = isMobile
				? [
						'play-large',
						'play',
						'progress',
						'current-time',
						'settings',
						'pip',
						'fullscreen'
					]
				: [
						'play-large',
						'play',
						'progress',
						'current-time',
						'mute',
						'volume',
						'settings',
						'pip',
						'fullscreen'
					];

			player = new PlyrConstructor(el as HTMLElement, {
				controls,
				settings: ['speed'],
				speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
				tooltips: { controls: true, seek: false },
				youtube: { noCookie: true },
				volume: 1,
				muted: false,
				storage: { enabled: !isMobile, key: 'plyr' }
			});

			if (isMobile) {
				player.on('ready', () => {
					if (player) {
						player.volume = 1;
						player.muted = false;
					}
				});
			}

			if (isDirectVideo) {
				generateFrames(src)
					.then((result) => {
						cleanupPreview = setupPreview(
							result.frames,
							result.duration,
							result.width,
							result.height
						);
					})
					.catch(() => {});
			}
		};

		init();

		return () => {
			cleanupPreview?.();
			player?.destroy();
		};
	});
</script>

<div class="VideoPlayer" bind:this={containerEl}>
	{#if provider === 'youtube'}
		<div
			data-plyr
			data-plyr-provider="youtube"
			data-plyr-embed-id={videoSource}
		></div>
	{:else if provider === 'vimeo'}
		<div
			data-plyr
			data-plyr-provider="vimeo"
			data-plyr-embed-id={videoSource}
		></div>
	{:else}
		<video data-plyr playsinline {title}>
			<source src={videoSource} />
			<track kind="captions" />
		</video>
	{/if}
</div>

<style lang="scss">
	.VideoPlayer {
		border-radius: var(--radius-lg);
		overflow: hidden;
		max-width: 800px;

		:global(.plyr) {
			--plyr-color-main: #a855f7;
			--plyr-video-background: #000;
			border-radius: var(--radius-lg);
		}

		:global {
			.plyr__progress .plyr__tooltip {
				display: none !important;
			}

			.plyr_preview_thumb {
				display: none;
				position: absolute;
				transform: translateX(-50%);
				border-radius: 6px;
				overflow: visible;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
				border: 2px solid rgba(255, 255, 255, 0.9);
				background: #000;
				pointer-events: none;
				z-index: 100;
				text-align: center;

				img {
					display: block;
					border-radius: 4px 4px 0 0;
					object-fit: cover;
				}

				.plyr_preview_arrow {
					position: absolute;
					bottom: -8px;
					transform: translateX(-50%);
					border-left: 8px solid transparent;
					border-right: 8px solid transparent;
					border-top: 8px solid rgba(255, 255, 255, 0.9);
				}
			}

			.plyr_preview_time {
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				font-size: 12px;
				font-weight: 500;
				color: white;
				padding: 12px 0 4px;
				font-variant-numeric: tabular-nums;
				background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
				border-radius: 0 0 4px 4px;
			}
		}
	}
</style>
