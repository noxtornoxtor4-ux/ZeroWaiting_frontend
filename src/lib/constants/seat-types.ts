import type { SeatType } from '@/api/model';

export const SEAT_TYPE_CONFIG: Record<
	SeatType,
	{
		labelKey: string;
		color: string;
		borderColor: string;
		widthCells: 1 | 2;
	}
> = {
	STANDARD: {
		labelKey: 'common.seatType.STANDARD',
		color: 'var(--seat-standard)',
		borderColor: 'var(--seat-standard-border)',
		widthCells: 1
	},
	VIP: {
		labelKey: 'common.seatType.VIP',
		color: 'var(--seat-vip)',
		borderColor: 'var(--seat-vip-border)',
		widthCells: 1
	},
	LOVE_SEAT: {
		labelKey: 'common.seatType.LOVE_SEAT',
		color: 'var(--seat-love)',
		borderColor: 'var(--seat-love-border)',
		widthCells: 2
	},
	RECLINER: {
		labelKey: 'common.seatType.RECLINER',
		color: 'var(--seat-recliner)',
		borderColor: 'var(--seat-recliner-border)',
		widthCells: 1
	},
	WHEELCHAIR: {
		labelKey: 'common.seatType.WHEELCHAIR',
		color: 'var(--seat-wheelchair)',
		borderColor: 'var(--seat-wheelchair-border)',
		widthCells: 1
	},
	DIRECTOR: {
		labelKey: 'common.seatType.DIRECTOR',
		color: 'var(--seat-director)',
		borderColor: 'var(--seat-director-border)',
		widthCells: 1
	}
};
