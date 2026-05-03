import { describe, it, expect } from 'vitest';
import { mapSeatIdsToLabels, formatSeatsSummary } from './seat-label';
import type { AvailableSeatEntity } from '@/api/model';

const mk = (id: string, row: number, seat: number): AvailableSeatEntity =>
	({
		id,
		rowNumber: row,
		seatNumber: seat
	}) as AvailableSeatEntity;

describe('mapSeatIdsToLabels', () => {
	it('returns labels in "row-seat" format', () => {
		const seats = [mk('a', 5, 3), mk('b', 5, 4), mk('c', 6, 1)];
		expect(mapSeatIdsToLabels(['a', 'b'], seats)).toEqual(['5-3', '5-4']);
	});
	it('skips ids not present in the seat list', () => {
		const seats = [mk('a', 5, 3)];
		expect(mapSeatIdsToLabels(['a', 'missing'], seats)).toEqual(['5-3']);
	});
	it('preserves the order of the input ids', () => {
		const seats = [mk('a', 5, 3), mk('b', 5, 4)];
		expect(mapSeatIdsToLabels(['b', 'a'], seats)).toEqual(['5-4', '5-3']);
	});
	it('returns empty array when seats undefined', () => {
		expect(mapSeatIdsToLabels(['a'], undefined)).toEqual([]);
	});
});

describe('formatSeatsSummary', () => {
	const t = (
		key: string,
		opts?: { values?: Record<string, string | number | boolean | Date | null | undefined> }
	): string => {
		const values = opts?.values ?? {};
		if (key === 'ticket.rowSeat') return `Ряд ${values.row}: место ${values.seats}`;
		if (key === 'ticket.rowSeats') return `Ряд ${values.row}: места ${values.seats}`;
		return key;
	};

	it('returns a single row with one seat as "место"', () => {
		expect(formatSeatsSummary([{ row: 4, seat: 4 }], t)).toBe('Ряд 4: место 4');
	});

	it('returns a single row with multiple seats as "места"', () => {
		expect(formatSeatsSummary([{ row: 5, seat: 7 }, { row: 5, seat: 8 }], t)).toBe(
			'Ряд 5: места 7, 8'
		);
	});

	it('groups multiple rows with newline separator', () => {
		const result = formatSeatsSummary(
			[
				{ row: 4, seat: 4 },
				{ row: 5, seat: 7 },
				{ row: 5, seat: 8 },
				{ row: 6, seat: 6 }
			],
			t
		);
		expect(result).toBe('Ряд 4: место 4\nРяд 5: места 7, 8\nРяд 6: место 6');
	});

	it('sorts rows ascending and seats ascending within a row', () => {
		expect(
			formatSeatsSummary(
				[
					{ row: 6, seat: 3 },
					{ row: 5, seat: 8 },
					{ row: 5, seat: 7 }
				],
				t
			)
		).toBe('Ряд 5: места 7, 8\nРяд 6: место 3');
	});

	it('returns an empty string for empty input', () => {
		expect(formatSeatsSummary([], t)).toBe('');
	});

	it('does not deduplicate identical (row, seat) pairs', () => {
		expect(
			formatSeatsSummary(
				[
					{ row: 5, seat: 7 },
					{ row: 5, seat: 7 }
				],
				t
			)
		).toBe('Ряд 5: места 7, 7');
	});
});
