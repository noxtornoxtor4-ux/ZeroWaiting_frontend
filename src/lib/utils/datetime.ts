const pad = (n: number): string => String(n).padStart(2, '0');

// ─────────────────────────────────────────────────────────────
// Civil date — "calendar day" (no timezone)
// ─────────────────────────────────────────────────────────────

export const toBackendCivilDate = (ymd: string): string => {
	const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return '';
	const [, y, mo, d] = m;
	const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
	if (Number.isNaN(date.getTime())) return '';
	return date.toISOString();
};

export const fromBackendCivilDate = (
	iso: string | null | undefined
): string => {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const formatCivilDate = (iso: string, locale = 'ru-RU'): string => {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(iso));
};

export const formatCivilDateShort = (iso: string, locale = 'ru-RU'): string => {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	}).format(new Date(iso));
};

// ─────────────────────────────────────────────────────────────
// Instant — "moment in time"
// ─────────────────────────────────────────────────────────────

const toDate = (input: Date | string): Date =>
	typeof input === 'string' ? new Date(input) : new Date(input.getTime());

export const toBackendInstant = (local: Date | string): string => {
	const d = toDate(local);
	if (Number.isNaN(d.getTime())) return '';
	return d.toISOString();
};

export const toBackendStartOfLocalDay = (local: Date | string): string => {
	const d = toDate(local);
	if (Number.isNaN(d.getTime())) return '';
	d.setHours(0, 0, 0, 0);
	return d.toISOString();
};

export const toBackendEndOfLocalDay = (local: Date | string): string => {
	const d = toDate(local);
	if (Number.isNaN(d.getTime())) return '';
	d.setHours(23, 59, 59, 999);
	return d.toISOString();
};

export const fromBackendInstant = (iso: string | null | undefined): string => {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const isInstantPast = (
	iso: string | Date | null | undefined,
	graceMinutes = 0,
	now: number = Date.now()
): boolean => {
	if (!iso) return false;
	const d = toDate(iso);
	if (Number.isNaN(d.getTime())) return false;
	return now >= d.getTime() + graceMinutes * 60_000;
};

// ─────────────────────────────────────────────────────────────
// Filter presets (Instant, anchored to user's local day)
// ─────────────────────────────────────────────────────────────

export type DatePreset = 'yesterday' | 'today' | 'tomorrow';

const presetBaseDate = (kind: DatePreset): Date => {
	const base = new Date();
	base.setHours(0, 0, 0, 0);
	if (kind === 'yesterday') base.setDate(base.getDate() - 1);
	else if (kind === 'tomorrow') base.setDate(base.getDate() + 1);
	return base;
};

export const presetRange = (
	kind: DatePreset
): { dateFrom: string; dateTo: string } => {
	const base = presetBaseDate(kind);
	return {
		dateFrom: toBackendStartOfLocalDay(base),
		dateTo: toBackendEndOfLocalDay(base)
	};
};

const PRESET_KINDS: readonly DatePreset[] = ['yesterday', 'today', 'tomorrow'];

export const matchPreset = (
	dateFrom: string,
	dateTo: string
): DatePreset | null => {
	if (!dateFrom || !dateTo) return null;
	for (const kind of PRESET_KINDS) {
		const expected = presetRange(kind);
		if (expected.dateFrom === dateFrom && expected.dateTo === dateTo) {
			return kind;
		}
	}
	return null;
};

// ─────────────────────────────────────────────────────────────
// Display formatters (Intl in user's locale, no timeZone override)
// ─────────────────────────────────────────────────────────────

export const formatDate = (date: string | Date, locale = 'ru-RU'): string => {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(new Date(date));
};

export const formatTime = (date: string | Date, locale = 'ru-RU'): string => {
	return new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(date));
};

export const formatDateTime = (
	date: string | Date,
	locale = 'ru-RU'
): string => {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(date));
};

export const formatShortDate = (
	date: string | Date,
	locale = 'ru-RU'
): string => {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short'
	}).format(new Date(date));
};

export const formatWeekday = (
	date: string | Date,
	locale = 'ru-RU'
): string => {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'short'
	}).format(new Date(date));
};

export const formatDuration = (minutes: number): string => {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m} мин`;
	if (m === 0) return `${h} ч`;
	return `${h} ч ${m} мин`;
};

export const addMinutes = (iso: string, minutes: number): string =>
	new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
