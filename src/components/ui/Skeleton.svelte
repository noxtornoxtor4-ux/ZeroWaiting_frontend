<script lang="ts">
	interface Props {
		width?: string;
		height?: string;
		radius?: string;
		circle?: boolean;
	}

	let {
		width = '100%',
		height = '20px',
		radius = 'var(--radius-md)',
		circle = false
	}: Props = $props();
</script>

<div
	class="skeleton"
	class:skeleton--circle={circle}
	style:width={circle ? height : width}
	style:height
	style:border-radius={circle ? '50%' : radius}
></div>

<style lang="scss">
	.skeleton {
		background: linear-gradient(
			90deg,
			var(--surface-hover) 25%,
			var(--surface-active) 50%,
			var(--surface-hover) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>
