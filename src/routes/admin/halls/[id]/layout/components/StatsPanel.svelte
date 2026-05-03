<script lang="ts">
	import type { SeatType } from '@/api/model';
	import { SEAT_TYPE_CONFIG } from '@/lib/constants/seat-types';
	import { countSeatsByType } from '../lib/numbering';
	import type { LayoutState } from '../lib/layout-state.svelte';

	interface Props {
		layout: LayoutState;
	}

	let { layout }: Props = $props();

	const counts = $derived(countSeatsByType(layout.snapshot.cells));

	const TYPES: SeatType[] = [
		'STANDARD',
		'VIP',
		'LOVE_SEAT',
		'RECLINER',
		'WHEELCHAIR',
		'DIRECTOR'
	];

	const TYPE_LABELS: Record<SeatType, string> = {
		STANDARD: 'Standard',
		VIP: 'VIP',
		LOVE_SEAT: 'Love-seat',
		RECLINER: 'Recliner',
		WHEELCHAIR: 'Wheelchair',
		DIRECTOR: 'Director'
	};
</script>

<div class="StatsPanel">
	<div class="section_label">Сводка</div>

	<div class="row">
		<span class="k">Размер</span>
		<span class="v"
			>{layout.snapshot.layoutRows} × {layout.snapshot.layoutCols}</span
		>
	</div>
	<div class="row">
		<span class="k">Всего мест</span>
		<span class="v">{counts.total}</span>
	</div>

	<div class="divider"></div>

	{#each TYPES as t}
		<div class="row">
			<span class="k">
				<span class="swatch" style:background={SEAT_TYPE_CONFIG[t].color}
				></span>
				{TYPE_LABELS[t]}
			</span>
			<span class="v">{counts[t]}</span>
		</div>
	{/each}

	<div class="divider"></div>

	<div class="hint">
		<kbd>1</kbd>–<kbd>6</kbd> типы · <kbd>E</kbd> стереть<br />
		Зажми и тяни — красит серию
	</div>
</div>

<style lang="scss">
	.StatsPanel {
		background: rgba(255, 255, 255, 0.03);
		border-radius: 8px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-size: 11px;
		min-width: 200px;

		.section_label {
			font-size: 9px;
			letter-spacing: 1.5px;
			text-transform: uppercase;
			color: rgba(255, 255, 255, 0.4);
		}

		.row {
			display: flex;
			justify-content: space-between;
			align-items: center;

			.k {
				color: rgba(255, 255, 255, 0.55);
				display: flex;
				align-items: center;
				gap: 6px;
			}

			.v {
				color: white;
				font-weight: 600;
			}

			.swatch {
				width: 10px;
				height: 10px;
				border-radius: 2px;
				display: inline-block;
			}
		}

		.divider {
			height: 1px;
			background: rgba(255, 255, 255, 0.08);
		}

		.hint {
			background: rgba(168, 85, 247, 0.08);
			border: 1px solid rgba(168, 85, 247, 0.2);
			border-radius: 6px;
			padding: 8px 10px;
			color: rgba(255, 255, 255, 0.7);
			line-height: 1.5;
			font-size: 10px;

			kbd {
				background: rgba(0, 0, 0, 0.35);
				padding: 1px 5px;
				border-radius: 3px;
				border: 1px solid rgba(255, 255, 255, 0.1);
				font-size: 9px;
				font-family: monospace;
			}
		}
	}
</style>
