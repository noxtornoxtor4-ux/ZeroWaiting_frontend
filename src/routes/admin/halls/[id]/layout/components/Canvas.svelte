<script lang="ts">
	import { SEAT_TYPE_CONFIG } from '@/lib/constants/seat-types';
	import { computeClientLabels } from '../lib/numbering';
	import type { LayoutState, SeatCell } from '../lib/layout-state.svelte';

	interface Props {
		layout: LayoutState;
	}

	let { layout }: Props = $props();

	const labels = $derived(computeClientLabels(layout.snapshot.cells));

	const rowNumberByRow = $derived.by(() => {
		const map = new Map<number, number>();
		for (const [key, label] of labels) {
			const row = Number(key.split(':')[0]);
			if (!map.has(row)) map.set(row, label.rowNumber);
		}
		return map;
	});

	let isPainting = $state(false);
	const onPointerDownCell = (r: number, c: number) => {
		layout.setCell(r, c, layout.activeTool);
		isPainting = true;
	};

	const onPointerEnterCell = (r: number, c: number) => {
		if (!isPainting) return;
		layout.setCell(r, c, layout.activeTool);
	};

	const stop = () => (isPainting = false);

	const seatToneFor = (cell: SeatCell): string =>
		SEAT_TYPE_CONFIG[cell.type].color;
</script>

<svelte:window onpointerup={stop} onpointercancel={stop} />

<div class="Canvas">
	<div class="screen_bar"></div>
	<div class="screen_label">ЭКРАН</div>

	<div class="rows">
		{#each Array.from({ length: layout.snapshot.layoutRows }) as _, r}
			{@const rowLabel = rowNumberByRow.get(r)}
			<div class="row" style:--cols={layout.snapshot.layoutCols}>
				<div class="row_label left">{rowLabel ? `Ряд ${rowLabel}` : ''}</div>
				{#each Array.from({ length: layout.snapshot.layoutCols }) as _, c}
					{@const cell = layout.cellAt(r, c)}
					{@const isLeft = !cell || cell.gridCol === c}
					{#if isLeft}
						{@const label = cell
							? labels.get(`${r}:${cell.gridCol}`)
							: undefined}
						<button
							type="button"
							class="cell"
							class:empty={!cell}
							style:grid-column-end="span {cell?.widthCells ?? 1}"
							style:--tone={cell ? seatToneFor(cell) : 'transparent'}
							onpointerdown={(e) => {
								e.preventDefault();
								onPointerDownCell(r, c);
							}}
							onpointerenter={() => onPointerEnterCell(r, c)}
							aria-label={cell && label
								? `Ряд ${label.rowNumber}, Место ${label.seatNumber}`
								: 'Проход'}
						>
							{#if cell && label}
								{label.seatNumber}
							{/if}
						</button>
					{/if}
				{/each}
				<div class="row_label right">{rowLabel ? `Ряд ${rowLabel}` : ''}</div>
			</div>
		{/each}
	</div>
</div>

<style lang="scss">
	.Canvas {
		background: rgba(0, 0, 0, 0.25);
		border-radius: 8px;
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		user-select: none;

		.screen_bar {
			background: linear-gradient(
				90deg,
				rgba(168, 85, 247, 0.15),
				rgba(168, 85, 247, 0.55),
				rgba(168, 85, 247, 0.15)
			);
			height: 6px;
			width: 55%;
			border-radius: 100px 100px 3px 3px;
			box-shadow: 0 14px 30px -18px #a855f7;
		}

		.screen_label {
			font-size: 10px;
			letter-spacing: 4px;
			color: rgba(255, 255, 255, 0.3);
			margin: 6px 0 18px;
		}

		.rows {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		.row {
			display: grid;
			grid-template-columns: 60px repeat(var(--cols), 40px) 60px;
			gap: 6px;
			align-items: center;
		}

		.row_label {
			font-size: 13px;
			color: rgba(255, 255, 255, 0.55);
			white-space: nowrap;

			&.left {
				text-align: right;
				padding-right: 6px;
			}

			&.right {
				text-align: left;
				padding-left: 6px;
			}
		}

		.cell {
			width: 100%;
			min-width: 40px;
			height: 40px;
			border-radius: 6px;
			background: var(--tone);
			border: 1px solid transparent;
			color: white;
			font-size: 13px;
			font-weight: 600;
			cursor: pointer;
			font-variant-numeric: tabular-nums;
			padding: 0;
			display: flex;
			align-items: center;
			justify-content: center;

			&.empty {
				background: rgba(255, 255, 255, 0.03);
				border: 1px dashed rgba(255, 255, 255, 0.08);
			}

			&:hover {
				outline: 2px solid #a855f7;
				outline-offset: 1px;
				z-index: 1;
			}
		}
	}
</style>
