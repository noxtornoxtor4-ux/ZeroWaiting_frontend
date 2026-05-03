<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { SeatType } from '@/api/model';
	import { SEAT_TYPE_CONFIG } from '@/lib/constants/seat-types';

	const TYPES: SeatType[] = [
		'STANDARD',
		'VIP',
		'LOVE_SEAT',
		'RECLINER',
		'WHEELCHAIR',
		'DIRECTOR'
	];
</script>

<div class="SeatLegend">
	{#each TYPES as t}
		{@const cfg = SEAT_TYPE_CONFIG[t]}
		<div class="item">
			<span class="dot" style:background={cfg.color}></span>
			<span>{$_(cfg.labelKey)}</span>
		</div>
	{/each}

	<div class="item">
		<span class="dot selected_dot"></span>
		<span>{$_('screening.selected')}</span>
	</div>
	<div class="item">
		<span class="dot held_dot"></span>
		<span>{$_('screening.held')}</span>
	</div>
	<div class="item">
		<span class="dot booked_dot"></span>
		<span>{$_('screening.booked')}</span>
	</div>
</div>

<style lang="scss">
	.SeatLegend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-4);

		.item {
			display: flex;
			align-items: center;
			gap: var(--space-2);
			font-size: var(--text-xs);
			color: var(--muted-fg);
		}

		.dot {
			width: 16px;
			height: 16px;
			border-radius: var(--radius-sm);
		}

		.selected_dot {
			background: linear-gradient(45deg, #8b5cf6, #a855f7);
		}

		.held_dot {
			background: var(--seat-held-bg);
			border: 1px solid var(--seat-held-border);
		}

		.booked_dot {
			background: rgba(255, 255, 255, 0.04);
			border: 1px solid rgba(255, 255, 255, 0.06);
		}
	}
</style>
