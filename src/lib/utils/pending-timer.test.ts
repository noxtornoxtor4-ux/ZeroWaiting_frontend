import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRemaining, computeRemaining } from './pending-timer';

describe('formatRemaining', () => {
	it('returns mm:ss with zero-padded seconds', () => {
		expect(formatRemaining(65_000)).toBe('1:05');
	});
	it('returns 0:00 for negative values', () => {
		expect(formatRemaining(-1000)).toBe('0:00');
	});
	it('rounds up seconds — 999ms shows 0:01', () => {
		expect(formatRemaining(999)).toBe('0:01');
	});
});

describe('computeRemaining', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('returns positive ms when expiresAt is in the future', () => {
		vi.setSystemTime(new Date('2026-04-19T10:00:00Z'));
		expect(computeRemaining('2026-04-19T10:05:00Z')).toBe(300_000);
	});
	it('clamps to 0 when expiresAt is in the past', () => {
		vi.setSystemTime(new Date('2026-04-19T10:00:00Z'));
		expect(computeRemaining('2026-04-19T09:55:00Z')).toBe(0);
	});
	it('returns 0 when expiresAt is null/undefined', () => {
		expect(computeRemaining(null)).toBe(0);
		expect(computeRemaining(undefined)).toBe(0);
	});
});
