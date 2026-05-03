export const computeRemaining = (
	expiresAtIso: string | null | undefined,
	nowMs = Date.now()
): number => {
	if (!expiresAtIso) return 0;
	return Math.max(0, Date.parse(expiresAtIso) - nowMs);
};

export const formatRemaining = (remainingMs: number): string => {
	const clamped = Math.max(0, remainingMs);
	const total = Math.ceil(clamped / 1000);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
};
