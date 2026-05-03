import { useActiveBooking } from '@/lib/stores/active-booking.svelte';
import type { ActiveBookingEntity } from '@/api/model';

export interface ActiveBookingConflictState {
	existingBookingId: string;
	existingScreeningId: string;
	isSameScreening: boolean;
	expiresAt: string | null;
	existingSeatLabels: string[];
}

export const createActiveBookingGuard = (
	getCurrentScreeningId: () => string | null | undefined
) => {
	const activeBookingQuery = useActiveBooking();

	const activeBooking = $derived.by<ActiveBookingEntity | null>(() => {
		const data = activeBookingQuery.data;
		if (data && typeof data === 'object' && 'id' in data) {
			return data as ActiveBookingEntity;
		}
		return null;
	});
	const hasActivePending = $derived(activeBooking !== null);

	let conflictOpen = $state(false);
	let conflictData = $state<ActiveBookingConflictState | null>(null);
	let lastSeenActiveBookingId = $state<string | null>(null);

	const buildConflict = (
		booking: ActiveBookingEntity
	): ActiveBookingConflictState => {
		const screeningId = getCurrentScreeningId();
		return {
			existingBookingId: booking.id,
			existingScreeningId: booking.screeningId,
			isSameScreening: booking.screeningId === screeningId,
			expiresAt: booking.expiresAt ?? null,
			existingSeatLabels:
				booking.seats
					?.filter((bs) => bs.seat)
					.map((bs) => `${bs.seat!.rowNumber}-${bs.seat!.seatNumber}`) ?? []
		};
	};

	$effect(() => {
		if (!activeBooking) {
			lastSeenActiveBookingId = null;
			return;
		}
		if (lastSeenActiveBookingId === activeBooking.id) return;
		lastSeenActiveBookingId = activeBooking.id;
		conflictData = buildConflict(activeBooking);
		conflictOpen = true;
	});

	const openWith = (booking: ActiveBookingEntity) => {
		conflictData = buildConflict(booking);
		conflictOpen = true;
		lastSeenActiveBookingId = booking.id;
	};

	const requireNoActivePending = (): boolean => {
		if (!activeBooking) return true;
		conflictData = buildConflict(activeBooking);
		conflictOpen = true;
		return false;
	};

	const closeDialog = () => {
		conflictOpen = false;
	};

	return {
		get activeBooking() {
			return activeBooking;
		},
		get hasActivePending() {
			return hasActivePending;
		},
		get conflictOpen() {
			return conflictOpen;
		},
		get conflictData() {
			return conflictData;
		},
		requireNoActivePending,
		openWith,
		closeDialog
	};
};
