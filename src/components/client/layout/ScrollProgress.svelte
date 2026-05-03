<script lang="ts">
	import { onMount } from 'svelte';

	let progress = $state(0);

	onMount(() => {
		let docHeight = Math.max(
			0,
			document.documentElement.scrollHeight - window.innerHeight
		);
		let rafId = 0;
		let scheduled = false;

		const recalcDocHeight = () => {
			docHeight = Math.max(
				0,
				document.documentElement.scrollHeight - window.innerHeight
			);
		};

		const tick = () => {
			scheduled = false;
			progress = docHeight > 0 ? window.scrollY / docHeight : 0;
		};

		const onScroll = () => {
			if (scheduled) return;
			scheduled = true;
			rafId = requestAnimationFrame(tick);
		};

		const onResize = () => {
			recalcDocHeight();
			onScroll();
		};

		const ro = new ResizeObserver(() => {
			recalcDocHeight();
			onScroll();
		});
		ro.observe(document.documentElement);

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize, { passive: true });

		tick();

		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
			ro.disconnect();
			if (rafId) cancelAnimationFrame(rafId);
		};
	});
</script>

<div class="scroll-progress" style="--p: {progress}"></div>

<style lang="scss">
	.scroll-progress {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 3px;
		background: linear-gradient(90deg, var(--primary-500), var(--primary-300));
		transform-origin: left;
		z-index: 1001;
		pointer-events: none;
		will-change: transform;
		transform: translateZ(0) scaleX(var(--p, 0));
		backface-visibility: hidden;
	}
</style>
