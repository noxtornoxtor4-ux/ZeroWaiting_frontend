import { computeRemaining, formatRemaining } from './pending-timer';

export { computeRemaining, formatRemaining } from './pending-timer';

export const createPendingTimer = (
	expiresAtIso: () => string | null | undefined
) => {
	let now = $state(Date.now());

	$effect(() => {
		const id = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(id);
	});

	const remainingMs = $derived.by(() => computeRemaining(expiresAtIso(), now));
	const formatted = $derived.by(() => formatRemaining(remainingMs));
	const hasExpiry = $derived(
		expiresAtIso() !== null && expiresAtIso() !== undefined
	);
	const isExpired = $derived(hasExpiry && remainingMs === 0);

	return {
		get remainingMs() {
			return remainingMs;
		},
		get formatted() {
			return formatted;
		},
		get isExpired() {
			return isExpired;
		}
	};
};
