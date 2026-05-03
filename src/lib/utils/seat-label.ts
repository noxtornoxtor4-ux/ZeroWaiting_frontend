import type { AvailableSeatEntity } from '@/api/model';
import { groupSeatsByRow } from '@/lib/utils/group-seats';

export const mapSeatIdsToLabels = (
	seatIds: string[],
	seats: AvailableSeatEntity[] | undefined
): string[] => {
	if (!seats) return [];
	const byId = new Map(seats.map((s) => [s.id, s]));
	return seatIds
		.map((id) => byId.get(id))
		.filter((s): s is AvailableSeatEntity => Boolean(s))
		.map((s) => `${s.rowNumber}-${s.seatNumber}`);
};

interface SeatLike {
	row: number;
	seat: number;
}

type Translator = (
	key: string,
	opts?: {
		values?: Record<string, string | number | boolean | Date | null | undefined>;
	}
) => string;

export const formatSeatsSummary = (seats: SeatLike[], t: Translator): string => {
	if (seats.length === 0) return '';
	const grouped = groupSeatsByRow(
		seats.map((s) => ({ rowNumber: s.row, seatNumber: s.seat }))
	);
	return grouped
		.map((row) =>
			t(row.seats.length === 1 ? 'ticket.rowSeat' : 'ticket.rowSeats', {
				values: { row: row.row, seats: row.seats.join(', ') }
			})
		)
		.join('\n');
};
