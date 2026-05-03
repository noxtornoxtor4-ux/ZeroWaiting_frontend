---
name: dates
description: 'Use when handling dates/times — sending to API, displaying, or rendering date inputs. Triggers: @/lib/utils/datetime, toBackendCivilDate, toBackendInstant, toBackendStartOfLocalDay, toBackendEndOfLocalDay, fromBackendInstant, fromBackendCivilDate, formatCivilDate, formatDate, formatTime, formatDateTime, formatWeekday, formatShortDate, DatePicker, DateRangeFilter, releaseDate, startDate, endDate, expiresAt, createdAt, updatedAt, publishedAt, publishDate, expiryDate, startTime, endTime, dateFrom, dateTo, UTC, .toISOString(), datetime-local.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Dates & Times (UTC contract)

Все даты/времена через границу frontend↔backend — ISO-8601 в UTC (суффикс `Z`). Никаких сырых local-строк без зоны.

## Two semantic types — never mix

### Civil date — «календарный день»

Поля: `releaseDate`, `startDate` / `endDate` (promotion), `expiresAt` (promoCode), `publishDate` / `expiryDate` (announcement).

- **Send**: `toBackendCivilDate("2026-04-19")` → `"2026-04-19T00:00:00.000Z"`
- **Read**: `fromBackendCivilDate(iso)` → `"2026-04-19"`
- **Display**: `formatCivilDate(iso, locale)` (внутри `timeZone: 'UTC'`).

### Instant — «момент времени»

Поля: `createdAt`, `updatedAt`, `publishedAt`, screening `startTime` / `endTime`, filter `dateFrom` / `dateTo`, token `expiresAt`.

- **Send**: `toBackendInstant(local)` / `toBackendStartOfLocalDay` / `toBackendEndOfLocalDay`
- **Read** (в `<DatePicker withTime>` / `datetime-local`): `fromBackendInstant(iso)`
- **Display**: `formatDate` / `formatTime` / `formatDateTime` / `formatWeekday` / `formatShortDate` (локаль пользователя).

## Single entrypoint

Все утилиты — в `@/lib/utils/datetime`. **Не импортируй** из `@/lib/utils/date` (удалено). **Никогда** `.toISOString()` на датах, которые уходят на бэк — всегда через `toBackendInstant` / `toBackendCivilDate`, чтобы контракт был греппаемым.

## Date input components

**Никогда** native `<input type="date">`. В `@/components/ui`:

- **`DateRangeFilter`** — двухмесячный calendar popover для filter bars. API: `from`, `to` (ISO), `labelFrom`, `labelTo`, `placeholder`, `widthFull`, `onchange(from, to)`. `widthFull` default `false` (`inline-flex`, `width: fit-content`) — передавай только когда фильтр должен растягиваться.
- **`DatePicker`** — single-date с typeable masked input (`дд/мм/гггг`, auto `/`, cascading clamps: month ≤ 12, day ≤ 31). API: `value` (ISO `YYYY-MM-DD`), `label`, `placeholder`, `required`, `disabled`, `widthFull` (default `true`), `error`, `onchange(value)`. Для всех дат в admin form modals (movies releaseDate, promo/announcement/promotion date ranges).

Оба — calendar через Floating UI portal, двухмесячный дизайн, weekday order (Пн-Вс), display `DD/MM/YYYY`. `datetime-local` (screening startTime) остаётся native — там нужно время, не только дата.

## Future work — screening timezone

Screening `startTime`/`endTime` концептуально — **zoned instant**, привязанный к branch timezone (14:25 в Бишкеке = 14:25 Asia/Bishkek для всех зрителей, не local пользователя). Поле `timezone` на бэке и хелпер `formatInBranchTz(iso, tz)` — tracked отдельно, не в scope текущего playbook.
