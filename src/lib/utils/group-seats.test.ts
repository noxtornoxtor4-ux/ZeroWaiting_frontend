import { describe, it, expect } from 'vitest';
import { groupSeatsByRow } from './group-seats';

describe('groupSeatsByRow', () => {
	it('groups and sorts', () => {
		const input = [
			{ rowNumber: 5, seatNumber: 4 },
			{ rowNumber: 5, seatNumber: 3 },
			{ rowNumber: 6, seatNumber: 1 }
		];
		expect(groupSeatsByRow(input)).toEqual([
			{ row: 5, seats: [3, 4] },
			{ row: 6, seats: [1] }
		]);
	});

	it('handles empty input', () => {
		expect(groupSeatsByRow([])).toEqual([]);
	});

	it('sorts rows in ascending order regardless of input order', () => {
		expect(
			groupSeatsByRow([
				{ rowNumber: 6, seatNumber: 1 },
				{ rowNumber: 5, seatNumber: 2 },
				{ rowNumber: 7, seatNumber: 3 }
			])
		).toEqual([
			{ row: 5, seats: [2] },
			{ row: 6, seats: [1] },
			{ row: 7, seats: [3] }
		]);
	});
});
