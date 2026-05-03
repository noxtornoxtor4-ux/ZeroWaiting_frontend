import type { SeatType } from '@/api/model';
import type { SeatCell } from './layout-state.svelte';

export interface SeatLabel {
	rowNumber: number;
	seatNumber: number;
}

export const computeClientLabels = (
	cells: SeatCell[]
): Map<string, SeatLabel> => {
	const populatedRows = [...new Set(cells.map((c) => c.gridRow))].sort(
		(a, b) => a - b
	);
	const rowNumberOf = new Map(populatedRows.map((r, i) => [r, i + 1]));

	const byRow = new Map<number, SeatCell[]>();
	for (const cell of cells) {
		let list = byRow.get(cell.gridRow);
		if (!list) {
			list = [];
			byRow.set(cell.gridRow, list);
		}
		list.push(cell);
	}

	const out = new Map<string, SeatLabel>();
	for (const [gridRow, rowCells] of byRow) {
		const sorted = [...rowCells].sort((a, b) => a.gridCol - b.gridCol);
		sorted.forEach((cell, idx) => {
			out.set(`${cell.gridRow}:${cell.gridCol}`, {
				rowNumber: rowNumberOf.get(gridRow)!,
				seatNumber: idx + 1
			});
		});
	}
	return out;
};

export type SeatTypeCounts = Record<SeatType, number> & { total: number };

export const countSeatsByType = (cells: SeatCell[]): SeatTypeCounts => {
	const counts: SeatTypeCounts = {
		STANDARD: 0,
		VIP: 0,
		LOVE_SEAT: 0,
		RECLINER: 0,
		WHEELCHAIR: 0,
		DIRECTOR: 0,
		total: 0
	};
	for (const cell of cells) {
		counts[cell.type] = (counts[cell.type] ?? 0) + 1;
		counts.total += 1;
	}
	return counts;
};
