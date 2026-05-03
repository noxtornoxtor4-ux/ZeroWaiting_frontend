import { AxiosError } from 'axios';
import type {
	ActiveBookingExistsErrorDto,
	SeatsUnavailableErrorDto
} from '@/api/model';

export type BookingConflictBody =
	| ActiveBookingExistsErrorDto
	| SeatsUnavailableErrorDto;

export const getBookingConflict = (
	error: unknown
): BookingConflictBody | null => {
	if (!(error instanceof AxiosError)) return null;
	if (error.response?.status !== 409) return null;
	const data = error.response.data as Partial<BookingConflictBody> | undefined;
	if (!data || typeof data.code !== 'string') return null;
	if (
		data.code === 'ACTIVE_BOOKING_EXISTS' ||
		data.code === 'SEATS_UNAVAILABLE'
	) {
		return data as BookingConflictBody;
	}
	return null;
};

export const isSeatsUnavailable = (
	body: BookingConflictBody
): body is SeatsUnavailableErrorDto => body.code === 'SEATS_UNAVAILABLE';

export const isActiveBookingExists = (
	body: BookingConflictBody
): body is ActiveBookingExistsErrorDto => body.code === 'ACTIVE_BOOKING_EXISTS';
