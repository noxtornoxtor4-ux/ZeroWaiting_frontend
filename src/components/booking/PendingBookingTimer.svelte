<script lang="ts">
	import { createPendingTimer } from '@/lib/utils/pending-timer.svelte';

	interface Props {
		expiresAt: string | null | undefined;
		size?: 'sm' | 'md' | 'lg';
	}

	let { expiresAt, size = 'md' }: Props = $props();

	const timer = createPendingTimer(() => expiresAt);

	const state = $derived.by(() => {
		if (timer.isExpired) return 'expired';
		if (timer.remainingMs < 30_000) return 'critical';
		if (timer.remainingMs < 120_000) return 'warning';
		return 'normal';
	});
</script>

<div
	class="PendingBookingTimer"
	class:sm={size === 'sm'}
	class:lg={size === 'lg'}
	class:expired={state === 'expired'}
	class:critical={state === 'critical'}
	class:warning={state === 'warning'}
>
	{#if state === 'expired'}
		<span class="label">Истекло</span>
	{:else}
		<span class="value">{timer.formatted}</span>
	{/if}
</div>

<style lang="scss">
	.PendingBookingTimer {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--primary);
		font-size: 1.125rem;

		&.sm {
			font-size: 0.875rem;
		}

		&.lg {
			font-size: 1.5rem;
		}

		&.warning {
			color: #f59e0b;
		}

		&.critical {
			color: #ef4444;
			animation: pulse 1s ease-in-out infinite;
		}

		&.expired {
			color: rgba(255, 255, 255, 0.5);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}

		50% {
			opacity: 0.55;
		}
	}
</style>
