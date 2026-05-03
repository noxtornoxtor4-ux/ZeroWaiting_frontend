import { BookingStatus } from '@/api/model';

export const BOOKING_STATUS_CONFIG: Record<
	string,
	{ labelKey: string; color: string }
> = {
	[BookingStatus.PENDING]: {
		labelKey: 'booking.status.PENDING',
		color: 'var(--warning)'
	},
	[BookingStatus.CONFIRMED]: {
		labelKey: 'booking.status.CONFIRMED',
		color: 'var(--success)'
	},
	[BookingStatus.CANCELLED]: {
		labelKey: 'booking.status.CANCELLED',
		color: 'var(--danger)'
	},
	[BookingStatus.COMPLETED]: {
		labelKey: 'booking.status.COMPLETED',
		color: 'var(--info)'
	},
	[BookingStatus.NO_SHOW]: {
		labelKey: 'booking.status.NO_SHOW',
		color: 'var(--muted-fg)'
	}
};
