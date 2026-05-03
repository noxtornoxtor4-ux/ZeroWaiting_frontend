<script lang="ts">
	import { browser } from '$app/environment';
	import Icon from '@iconify/svelte';

	const MOBILE_QUERY = '(max-width: 640px)';

	let isMobile = $state(browser && window.matchMedia(MOBILE_QUERY).matches);

	$effect(() => {
		if (!browser) return;
		const mql = window.matchMedia(MOBILE_QUERY);
		const onChange = (e: MediaQueryListEvent) => {
			isMobile = e.matches;
		};
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	});

	const SPARKLE_COUNT = 30;

	const ICONS = ['lucide:sparkle', 'lucide:star'];
	const COLORS = ['var(--primary-light)', '#fbbf24', '#c084fc'];
	const rand = (min: number, max: number) => min + Math.random() * (max - min);
	const pick = <T,>(arr: T[]): T =>
		arr[Math.floor(Math.random() * arr.length)]!;

	const SAFE = { top: 5, bottom: 92, left: 4, right: 96 };
	const gridCols = Math.ceil(Math.sqrt(SPARKLE_COUNT));
	const gridRows = Math.ceil(SPARKLE_COUNT / gridCols);
	const cellW = (SAFE.right - SAFE.left) / gridCols;
	const cellH = (SAFE.bottom - SAFE.top) / gridRows;

	const sparkles = Array.from({ length: SPARKLE_COUNT }, (_, i) => {
		const col = i % gridCols;
		const row = Math.floor(i / gridCols);
		return {
			top: SAFE.top + row * cellH + rand(cellH * 0.15, cellH * 0.85),
			left: SAFE.left + col * cellW + rand(cellW * 0.15, cellW * 0.85),
			size: rand(10, 20),
			icon: pick(ICONS),
			color: pick(COLORS),
			duration: rand(5, 10),
			delay: rand(0, 5)
		};
	});
</script>

{#if !isMobile}
	<div class="HomeAmbient" aria-hidden="true">
		<div class="grid_overlay"></div>

		<div class="strip strip_left"></div>
		<div class="strip strip_right"></div>

		{#each sparkles as s, i (i)}
			<div
				class="sparkle"
				style:top="{s.top}%"
				style:left="{s.left}%"
				style:color={s.color}
				style:animation-duration="{s.duration}s"
				style:animation-delay="{s.delay}s"
			>
				<Icon icon={s.icon} width={s.size} />
			</div>
		{/each}
	</div>
{/if}

<style lang="scss">
	.HomeAmbient {
		position: fixed;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
	}

	.grid_overlay {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(168, 85, 247, 0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(168, 85, 247, 0.04) 1px, transparent 1px);
		background-size: 64px 64px;
		mask-image: radial-gradient(
			ellipse at center,
			rgba(0, 0, 0, 0.6) 0%,
			transparent 70%
		);
		-webkit-mask-image: radial-gradient(
			ellipse at center,
			rgba(0, 0, 0, 0.6) 0%,
			transparent 70%
		);
	}

	.strip {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 34px;
		opacity: 0.35;
		overflow: hidden;
		filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.4));

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: -32px;
			background-image: linear-gradient(
				to bottom,
				rgba(168, 85, 247, 0.6) 0,
				rgba(139, 92, 246, 0.3) 18px,
				transparent 18px,
				transparent 32px
			);
			background-size: 14px 32px;
			background-position: center top;
			background-repeat: repeat-y;
			animation: strip_scroll 1.5s linear infinite;
			will-change: transform;
			transform: translateZ(0);
		}
	}

	.strip_left {
		left: 8px;
		mask-image: linear-gradient(
			to bottom,
			transparent 0%,
			black 15%,
			black 85%,
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent 0%,
			black 15%,
			black 85%,
			transparent 100%
		);
	}

	.strip_right {
		right: 8px;
		mask-image: linear-gradient(
			to bottom,
			transparent 0%,
			black 15%,
			black 85%,
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent 0%,
			black 15%,
			black 85%,
			transparent 100%
		);
	}

	.sparkle {
		position: absolute;
		opacity: 0.55;
		animation: twinkle ease-in-out infinite;
		will-change: transform, opacity;
		transform: translateZ(0);
	}

	@keyframes strip_scroll {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			transform: translate3d(0, -32px, 0);
		}
	}

	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.2;
			transform: scale(0.8) rotate(0deg);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.15) rotate(180deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sparkle,
		.strip::before {
			animation: none;
		}
	}

	@media (max-width: 1200px) {
		.strip {
			display: none;
		}
		.sparkle:nth-child(2n) {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.sparkle {
			display: none;
		}
		.grid_overlay {
			opacity: 0.5;
		}
	}
</style>
