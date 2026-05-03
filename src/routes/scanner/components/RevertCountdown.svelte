<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		durationMs: number;
		onExpire: () => void;
	}

	const { durationMs, onExpire }: Props = $props();

	let remaining = $state(0);
	let interval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		remaining = durationMs;
		const start = Date.now();
		const duration = durationMs;
		interval = setInterval(() => {
			remaining = Math.max(0, duration - (Date.now() - start));
			if (remaining === 0 && interval) {
				clearInterval(interval);
				interval = null;
				onExpire();
			}
		}, 250);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	const seconds = $derived(Math.ceil(remaining / 1000));
</script>

<span class="revert_countdown">{seconds}</span>

<style lang="scss">
	.revert_countdown {
		display: inline-block;
		min-width: 20px;
		text-align: center;
		font-variant-numeric: tabular-nums;
		color: var(--muted-fg);
		font-size: var(--text-sm);
	}
</style>
