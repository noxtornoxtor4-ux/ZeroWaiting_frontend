import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addMinutes,
	formatCivilDate,
	formatCivilDateShort,
	fromBackendCivilDate,
	fromBackendInstant,
	matchPreset,
	presetRange,
	toBackendCivilDate,
	toBackendEndOfLocalDay,
	toBackendInstant,
	toBackendStartOfLocalDay
} from './datetime';

describe('toBackendCivilDate', () => {
	it('converts YYYY-MM-DD to UTC midnight ISO', () => {
		expect(toBackendCivilDate('2026-04-19')).toBe('2026-04-19T00:00:00.000Z');
	});

	it('returns empty string for malformed input', () => {
		expect(toBackendCivilDate('')).toBe('');
		expect(toBackendCivilDate('19/04/2026')).toBe('');
		expect(toBackendCivilDate('2026-4-9')).toBe('');
	});
});

describe('fromBackendCivilDate', () => {
	it('reads UTC components (never shifts the day, even in sub-UTC zones)', () => {
		expect(fromBackendCivilDate('2026-04-19T00:00:00.000Z')).toBe('2026-04-19');
	});

	it('returns empty string for nullish input', () => {
		expect(fromBackendCivilDate(null)).toBe('');
		expect(fromBackendCivilDate(undefined)).toBe('');
		expect(fromBackendCivilDate('')).toBe('');
	});

	it('returns empty string for invalid iso', () => {
		expect(fromBackendCivilDate('not-a-date')).toBe('');
	});
});

describe('formatCivilDate', () => {
	it('formats in ru-RU by default with UTC timezone', () => {
		expect(formatCivilDate('2026-04-19T00:00:00.000Z')).toBe(
			'19 апреля 2026 г.'
		);
	});

	it('formats in en-US', () => {
		expect(formatCivilDate('2026-04-19T00:00:00.000Z', 'en-US')).toBe(
			'April 19, 2026'
		);
	});
});

describe('formatCivilDateShort', () => {
	it('returns short form in ru-RU', () => {
		expect(formatCivilDateShort('2026-04-19T00:00:00.000Z')).toBe('19 апр.');
	});
});

describe('toBackendInstant', () => {
	it('accepts a Date and returns UTC ISO with Z', () => {
		const d = new Date('2026-04-19T14:25:00Z');
		expect(toBackendInstant(d)).toBe('2026-04-19T14:25:00.000Z');
	});

	it('accepts a string parseable by Date constructor', () => {
		expect(toBackendInstant('2026-04-19T14:25:00Z')).toBe(
			'2026-04-19T14:25:00.000Z'
		);
	});

	it('returns empty string for invalid input', () => {
		expect(toBackendInstant('nope')).toBe('');
	});
});

describe('toBackendStartOfLocalDay / toBackendEndOfLocalDay', () => {
	it('start returns ISO with Z suffix', () => {
		const out = toBackendStartOfLocalDay(new Date());
		expect(out.endsWith('Z')).toBe(true);
	});

	it('end is later than start for the same day', () => {
		const base = new Date();
		expect(
			new Date(toBackendEndOfLocalDay(base)).getTime() >
				new Date(toBackendStartOfLocalDay(base)).getTime()
		).toBe(true);
	});

	it('end minus start equals 23h 59m 59.999s', () => {
		const base = new Date();
		const diff =
			new Date(toBackendEndOfLocalDay(base)).getTime() -
			new Date(toBackendStartOfLocalDay(base)).getTime();
		expect(diff).toBe(86_399_999);
	});
});

describe('fromBackendInstant', () => {
	it('returns YYYY-MM-DDTHH:mm in local time', () => {
		const d = new Date(2026, 3, 19, 14, 25);
		const iso = d.toISOString();
		expect(fromBackendInstant(iso)).toBe('2026-04-19T14:25');
	});

	it('returns empty string for nullish / invalid input', () => {
		expect(fromBackendInstant(null)).toBe('');
		expect(fromBackendInstant(undefined)).toBe('');
		expect(fromBackendInstant('nope')).toBe('');
	});
});

describe('presetRange + matchPreset', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Fix "now" to 2026-04-19 12:00 local.
		vi.setSystemTime(new Date(2026, 3, 19, 12, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('today is start→end of the local current day', () => {
		const r = presetRange('today');
		expect(r.dateFrom).toBe(toBackendStartOfLocalDay(new Date(2026, 3, 19)));
		expect(r.dateTo).toBe(toBackendEndOfLocalDay(new Date(2026, 3, 19)));
	});

	it('yesterday is one day before today', () => {
		const r = presetRange('yesterday');
		expect(r.dateFrom).toBe(toBackendStartOfLocalDay(new Date(2026, 3, 18)));
		expect(r.dateTo).toBe(toBackendEndOfLocalDay(new Date(2026, 3, 18)));
	});

	it('tomorrow is one day after today', () => {
		const r = presetRange('tomorrow');
		expect(r.dateFrom).toBe(toBackendStartOfLocalDay(new Date(2026, 3, 20)));
		expect(r.dateTo).toBe(toBackendEndOfLocalDay(new Date(2026, 3, 20)));
	});

	it('matchPreset returns the kind when range matches exactly', () => {
		const t = presetRange('today');
		expect(matchPreset(t.dateFrom, t.dateTo)).toBe('today');
		const y = presetRange('yesterday');
		expect(matchPreset(y.dateFrom, y.dateTo)).toBe('yesterday');
		const tm = presetRange('tomorrow');
		expect(matchPreset(tm.dateFrom, tm.dateTo)).toBe('tomorrow');
	});

	it('matchPreset returns null for a custom range', () => {
		const custom = {
			dateFrom: toBackendStartOfLocalDay(new Date(2026, 3, 15)),
			dateTo: toBackendEndOfLocalDay(new Date(2026, 3, 22))
		};
		expect(matchPreset(custom.dateFrom, custom.dateTo)).toBeNull();
	});

	it('matchPreset returns null when either bound is empty', () => {
		expect(matchPreset('', '')).toBeNull();
		expect(matchPreset('2026-04-19T00:00:00.000Z', '')).toBeNull();
	});

	it('month-start: yesterday wraps to prior month', () => {
		vi.setSystemTime(new Date(2026, 2, 1, 12, 0, 0)); // noon local, March 1, 2026
		const r = presetRange('yesterday');
		expect(r.dateFrom).toBe(toBackendStartOfLocalDay(new Date(2026, 1, 28)));
		expect(r.dateTo).toBe(toBackendEndOfLocalDay(new Date(2026, 1, 28)));
	});

	it('month-end: tomorrow wraps to next month', () => {
		vi.setSystemTime(new Date(2026, 2, 31, 12, 0, 0)); // noon local, March 31, 2026
		const r = presetRange('tomorrow');
		expect(r.dateFrom).toBe(toBackendStartOfLocalDay(new Date(2026, 3, 1)));
		expect(r.dateTo).toBe(toBackendEndOfLocalDay(new Date(2026, 3, 1)));
	});
});

describe('addMinutes', () => {
	it('adds positive minutes to an ISO string and returns ISO', () => {
		expect(addMinutes('2026-04-28T19:30:00.000Z', 119)).toBe(
			'2026-04-28T21:29:00.000Z'
		);
	});

	it('handles minute crossing day boundary', () => {
		expect(addMinutes('2026-04-28T23:30:00.000Z', 60)).toBe(
			'2026-04-29T00:30:00.000Z'
		);
	});

	it('returns same instant when 0 minutes', () => {
		expect(addMinutes('2026-04-28T19:30:00.000Z', 0)).toBe(
			'2026-04-28T19:30:00.000Z'
		);
	});
});
