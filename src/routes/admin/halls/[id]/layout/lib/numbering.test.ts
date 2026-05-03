import { describe, it, expect } from 'vitest';
import { computeClientLabels, countSeatsByType } from './numbering';
import type { SeatCell } from './layout-state.svelte';

describe('computeClientLabels', () => {
	it('numbers populated grid rows sequentially and skips empty ones', () => {
		const cells: SeatCell[] = [
			{ gridRow: 0, gridCol: 0, widthCells: 1, type: 'STANDARD' },
			{ gridRow: 2, gridCol: 0, widthCells: 1, type: 'STANDARD' }
		];
		const out = computeClientLabels(cells);
		expect(out.get('0:0')).toEqual({ rowNumber: 1, seatNumber: 1 });
		expect(out.get('2:0')).toEqual({ rowNumber: 2, seatNumber: 1 });
	});

	it('numbers seats in a row by ascending gridCol, love-seat counts as one', () => {
		const cells: SeatCell[] = [
			{ gridRow: 0, gridCol: 1, widthCells: 2, type: 'LOVE_SEAT' },
			{ gridRow: 0, gridCol: 0, widthCells: 1, type: 'STANDARD' },
			{ gridRow: 0, gridCol: 4, widthCells: 1, type: 'STANDARD' }
		];
		const out = computeClientLabels(cells);
		expect(out.get('0:0')).toEqual({ rowNumber: 1, seatNumber: 1 });
		expect(out.get('0:1')).toEqual({ rowNumber: 1, seatNumber: 2 });
		expect(out.get('0:4')).toEqual({ rowNumber: 1, seatNumber: 3 });
	});

	it('returns empty map for empty input', () => {
		expect(computeClientLabels([]).size).toBe(0);
	});
});

describe('countSeatsByType', () => {
	it('counts each type and total bookable seats', () => {
		const cells: SeatCell[] = [
			{ gridRow: 0, gridCol: 0, widthCells: 1, type: 'STANDARD' },
			{ gridRow: 0, gridCol: 1, widthCells: 1, type: 'VIP' },
			{ gridRow: 0, gridCol: 2, widthCells: 2, type: 'LOVE_SEAT' }
		];
		const counts = countSeatsByType(cells);
		expect(counts.STANDARD).toBe(1);
		expect(counts.VIP).toBe(1);
		expect(counts.LOVE_SEAT).toBe(1);
		expect(counts.total).toBe(3);
		expect(counts.RECLINER).toBe(0);
	});
});
