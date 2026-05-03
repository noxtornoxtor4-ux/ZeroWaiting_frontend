import { getContext, setContext } from 'svelte';
import { crmQueryApi } from '@/api/endpoints';

const KEY = Symbol('zerowaiting-active-booking');

type ActiveBookingQuery = ReturnType<
	typeof crmQueryApi.createGetBookingsActiveV1
>;

export const provideActiveBooking = (): ActiveBookingQuery => {
	const query = crmQueryApi.createGetBookingsActiveV1(
		() => ({
			query: {
				refetchOnWindowFocus: true,
				refetchInterval: 60_000,
				staleTime: 30_000,
				retry: false
			}
		}),
		undefined
	);
	setContext(KEY, query);
	return query;
};

export const useActiveBooking = (): ActiveBookingQuery => {
	const query = getContext<ActiveBookingQuery | undefined>(KEY);
	if (!query) {
		throw new Error(
			'useActiveBooking must be called inside provideActiveBooking'
		);
	}
	return query;
};
