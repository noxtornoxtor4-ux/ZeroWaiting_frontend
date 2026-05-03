interface SeatLike {
	rowNumber: number;
	seatNumber: number;
}

export interface GroupedRow {
	row: number;
	seats: number[];
}

export const groupSeatsByRow = (seats: SeatLike[]): GroupedRow[] => {
	const byRow = new Map<number, number[]>();
	for (const s of seats) {
		const arr = byRow.get(s.rowNumber) ?? [];
		arr.push(s.seatNumber);
		byRow.set(s.rowNumber, arr);
	}
	return [...byRow.entries()]
		.sort(([a], [b]) => a - b)
		.map(([row, seats]) => ({ row, seats: seats.sort((a, b) => a - b) }));
};
