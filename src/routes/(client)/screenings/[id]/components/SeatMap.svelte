<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { SEAT_TYPE_CONFIG } from '@/lib/constants/seat-types';
	import type { AvailableSeatEntity } from '@/api/model';

	interface HallLayoutMeta {
		layoutRows: number;
		layoutCols: number;
	}

	interface Props {
		hall: HallLayoutMeta;
		seats: AvailableSeatEntity[];
		selectedIds: string[];
		disabled?: boolean;
		onseatclick: (seatId: string) => void;
	}

	let {
		hall,
		seats,
		selectedIds,
		disabled = false,
		onseatclick
	}: Props = $props();

	const byCell = $derived.by(() => {
		const map = new Map<string, AvailableSeatEntity>();
		for (const s of seats) {
			for (let dc = 0; dc < s.widthCells; dc++) {
				map.set(`${s.gridRow}:${s.gridCol + dc}`, s);
			}
		}
		return map;
	});

	const rowNumberByRow = $derived.by(() => {
		const map = new Map<number, number>();
		for (const s of seats) {
			if (!map.has(s.gridRow)) map.set(s.gridRow, s.rowNumber);
		}
		return map;
	});

	const isDisabled = (s: AvailableSeatEntity): boolean =>
		s.status === 'BOOKED' || s.status === 'HELD';

	const seatToneFor = (s: AvailableSeatEntity): string =>
		SEAT_TYPE_CONFIG[s.type].color;

	const handleClick = (seat: AvailableSeatEntity) => {
		if (disabled) return;
		if (isDisabled(seat)) return;
		onseatclick(seat.id);
	};
</script>

<div class="Canvas">
	<div class="screen_bar"></div>
	<div class="screen_label">{$_('screening.screen')}</div>

	<div class="rows">
		{#each Array.from({ length: hall.layoutRows }) as _, r}
			{@const rowLabel = rowNumberByRow.get(r)}
			<div class="row" style:--cols={hall.layoutCols}>
				<div class="row_label left">{rowLabel ? `Ряд ${rowLabel}` : ''}</div>
				{#each Array.from({ length: hall.layoutCols }) as _, c}
					{@const seat = byCell.get(`${r}:${c}`)}
					{@const isLeft = !seat || seat.gridCol === c}
					{#if isLeft}
						{#if seat}
							<button
								type="button"
								class="cell"
								class:selected={selectedIds.includes(seat.id) ||
									seat.status === 'HELD_BY_YOU'}
								class:booked={seat.status === 'BOOKED'}
								class:held={seat.status === 'HELD'}
								style:grid-column-end="span {seat.widthCells}"
								style:--tone={seatToneFor(seat)}
								disabled={isDisabled(seat)}
								aria-label={`Ряд ${seat.rowNumber}, Место ${seat.seatNumber}`}
								onclick={() => handleClick(seat)}
							>
								{seat.seatNumber}
							</button>
						{:else}
							<div class="cell empty"></div>
						{/if}
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
		width: fit-content;
		max-width: 100%;
		margin: 0 auto;

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
				cursor: default;
			}

			&:hover:not(.empty, :disabled) {
				outline: 2px solid #a855f7;
				outline-offset: 1px;
				z-index: 1;
			}

			&.selected {
				background: linear-gradient(45deg, #8b5cf6, #a855f7) !important;
				border-color: #c084fc !important;
				box-shadow: 0 0 14px rgba(168, 85, 247, 0.7);
			}

			&.booked {
				background: rgba(255, 255, 255, 0.04) !important;
				border-color: rgba(255, 255, 255, 0.06) !important;
				color: rgba(255, 255, 255, 0.15) !important;
				text-decoration: line-through;
				cursor: not-allowed;
			}

			&.held {
				background: var(--seat-held-bg) !important;
				border-color: var(--seat-held-border) !important;
				color: rgba(255, 255, 255, 0.4) !important;
				cursor: not-allowed;
			}
		}
	}

	@media (max-width: 640px) {
		.Canvas {
			padding: 10px 0 0 0;
			width: 100%;
			max-width: 100%;

			.rows {
				width: 100%;
				overflow-x: auto;
				-webkit-overflow-scrolling: touch;
				padding-bottom: 10px;
			}

			.row {
				grid-template-columns: 44px repeat(var(--cols), 26px) 44px;
				gap: 4px;
				flex-shrink: 0;
				min-width: min-content;
			}

			.row_label {
				font-size: 10px;

				&.left {
					padding-right: 4px;
				}

				&.right {
					padding-left: 4px;
				}
			}

			.cell {
				min-width: 26px;
				height: 26px;
				font-size: 10px;
			}
		}
	}
</style>
