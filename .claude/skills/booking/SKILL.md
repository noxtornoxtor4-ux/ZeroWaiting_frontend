---
name: booking
description: 'Use when working with the seat-selection / booking flow: PENDING booking lifecycle, active-booking banner, conflict dialog, pending timer, self-cancel. Triggers: /screenings/:id, /booking/:bookingId, SeatMap, ActiveBookingBanner, ActiveBookingConflictDialog, PendingBookingTimer, ExpiredBookingView, createPendingTimer, active-booking-guard, createActiveBookingGuard, requireNoActivePending, mapSeatIdsToLabels, getBookingConflict, isSeatsUnavailable, isActiveBookingExists, bookings/active, bookings/:id/self, ACTIVE_BOOKING_EXISTS, SEATS_UNAVAILABLE, HELD_BY_YOU.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Booking Flow

## Architecture (single source of truth)

Seat status is derived **only** from `Booking` on the backend:

| UI status     | Backend meaning                                         |
| ------------- | ------------------------------------------------------- |
| `AVAILABLE`   | No active `BookingSeat` for `(seatId, screeningId)`     |
| `HELD`        | `BookingSeat` in someone else's `PENDING Booking`       |
| `HELD_BY_YOU` | `BookingSeat` in the current user's `PENDING Booking`   |
| `BOOKED`      | `BookingSeat` in a `CONFIRMED` / `COMPLETED` booking    |

The legacy `SeatHold` entity was removed in Phase 3 of the redesign (commits `43b1324` → `b4b715e`).

## Lifecycle

```
/screenings/:id (local selection)
      │  «Продолжить»
      ▼
POST /v1/bookings  (bulk, atomic)
      │ 201 → /booking/:id (PENDING, timer 10 min)
      │ 409 ACTIVE_BOOKING_EXISTS → ActiveBookingConflictDialog
      │ 409 SEATS_UNAVAILABLE → auto-remove + toast
      ▼
Pay → CONFIRMED → /booking/:id/confirmation
Cancel → DELETE /v1/bookings/:id/self → back to /screenings/:id
TTL expire → cron marks CANCELLED → ExpiredBookingView
```

**One active PENDING booking per user.** Enforced in `booking.service.create` transaction.

## Components (`src/components/booking/`)

- `PendingBookingTimer` — `expiresAt` prop (ISO), size sm/md/lg. Colors: normal purple, warning (<2m amber), critical (<30s red pulse), expired grey. Uses `createPendingTimer` internally.
- `ActiveBookingBanner` — floating bottom-right card on all client pages; hidden on `/booking/*` and `/admin/*`. Reads `useActiveBooking()` context. CTAs: «Оплатить» (navigates) / «Отменить» (DELETE /self + invalidate).
- `ActiveBookingConflictDialog` — modal with same-screening vs other-screening variants. Two CTAs: return to payment / cancel-and-rebook. On rebook: runs DELETE /self then `onRebook()` callback.
- `ExpiredBookingView` — full-card view with «Выбрать места заново» button routing back to `/screenings/{screeningId}`.

## Utilities (`src/lib/utils/`)

- `pending-timer.ts` — pure helpers: `computeRemaining(iso, nowMs)`, `formatRemaining(ms)`. Unit-tested. Plain TS, no runes.
- `pending-timer.svelte.ts` — `createPendingTimer(() => expiresAtIso)` factory using `$state`/`$effect`/`$derived.by`. Returns `{ remainingMs, formatted, isExpired }` with reactive getters. Must be called in a `.svelte.ts`/component context (runes).
- `seat-label.ts` — `mapSeatIdsToLabels(seatIds, seats)` → `['5-3', '5-4']` for 409 toast.
- `active-booking-guard.svelte.ts` — `createActiveBookingGuard(() => screeningId)`. See section below.

## Constants (`src/lib/constants/`)

- `booking-conflict.ts` — type guards for 409 responses:
  - `getBookingConflict(error)` — returns discriminated `BookingConflictBody | null` from AxiosError
  - `isSeatsUnavailable(body)`, `isActiveBookingExists(body)` — narrow the union

## Active-booking guard (the cornerstone)

Mirror of `auth-guard.ts` pattern. `createActiveBookingGuard(getScreeningId)` instance owns all dialog state + autoopen on booking-appeared.

```ts
import { createActiveBookingGuard } from '@/lib/utils/active-booking-guard.svelte';

const bookingGuard = createActiveBookingGuard(() => screeningId);

// Block an action if user has PENDING booking
const onSeatClick = (seatId: string) => {
  if (!bookingGuard.requireNoActivePending()) return;  // opens dialog
  seatSelection.toggle(seatId);
};

// Read reactive state for UI
bookingGuard.hasActivePending   // boolean
bookingGuard.activeBooking      // ActiveBookingEntity | null
bookingGuard.conflictOpen       // boolean
bookingGuard.conflictData       // ActiveBookingConflictState | null
bookingGuard.closeDialog()
bookingGuard.openWith(booking)  // force-open (e.g. from 409 cache hit)
```

The guard auto-opens the dialog once per unique `activeBooking.id` — deduplicated via internal `lastSeenActiveBookingId`, so 60s refetches don't re-trigger.

## 409 conflict handling on POST /v1/bookings

```ts
} catch (error) {
  const body = getBookingConflict(error);
  if (!body) { toast.error(getErrorMessage(error, 'generic')); return; }

  if (isSeatsUnavailable(body)) {
    const labels = mapSeatIdsToLabels(body.unavailableSeatIds, envelope?.seats);
    seatSelection.removeMany(body.unavailableSeatIds);
    queryClient.invalidateQueries({ queryKey: [`/api/v1/public/screenings/${screeningId}/available-seats`] });
    toast.error($_('booking.errors.seats_unavailable', { values: { seats: labels.join(', ') } }));
    return;
  }

  if (isActiveBookingExists(body)) {
    const cached = queryClient.getQueryData(['/api/v1/bookings/active']) as ActiveBookingEntity | undefined;
    if (cached) bookingGuard.openWith(cached);
    queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
  }
}
```

## Cache invalidation cheat sheet

| Event                           | Invalidate                                                           |
| ------------------------------- | -------------------------------------------------------------------- |
| `POST /bookings` success        | `/api/v1/bookings/active`, `…/available-seats`, optionally `me/bookings` |
| `POST /bookings` 409            | `…/available-seats` (+ `/bookings/active` on ACTIVE_BOOKING_EXISTS)   |
| `DELETE /bookings/:id/self`     | `/bookings/active`, `…/available-seats`, `/bookings/:id`              |
| Payment success                 | `/bookings/active`, `…/available-seats`, `/bookings/:id`              |
| Timer hit 0 while PENDING       | poll `/bookings/:id` every 10s until status changes                   |

Always use `queryClient.invalidateQueries({ queryKey: [...] })`. Never call `.refetch()`.

## Backend endpoints (Phase 1 additions)

| Method | Path                               | Notes                                                            |
| ------ | ---------------------------------- | ---------------------------------------------------------------- |
| POST   | `/v1/bookings`                     | Body: `CreateBookingDto`. 201 → `BookingEntity`. 409 → `oneOf(ActiveBookingExistsErrorDto, SeatsUnavailableErrorDto)`. |
| GET    | `/v1/bookings/active`              | 200 → `ActiveBookingEntity` (has `expiresAt`). 204 → no PENDING. Requires JWT. |
| DELETE | `/v1/bookings/:id/self`            | Own-user self-cancel. 200 / 403 (not owner) / 404 / 409 (not PENDING). |
| GET    | `/v1/bookings/:id`                 | Enriched with `expiresAt` when status is PENDING.                 |
| GET    | `/v1/public/screenings/:id/available-seats` | Includes `holdTtlMinutes`. Uses `OptionalJwtAuthGuard` — token surfaces `HELD_BY_YOU`. |

## Common pitfalls

- **Axios 204 → empty string**: `customInstance` on 204 resolves `data = ''`, not `undefined`. Never check `data !== null` on active-booking query; use `typeof data === 'object' && 'id' in data`.
- **`$derived(() => ...)` pitfall**: returns the function, not the value. Always `$derived.by(() => ...)` for multi-line.
- **`state` is reserved**: don't name a `$derived` / `$state` variable `state` — it conflicts with rune scope in svelte-check. Use `urgency`, `status`, etc.
- **Full disabled on SeatMap hides clicks**: if the guard lives in `onSeatClick`, SeatMap must NOT be `disabled` during active-PENDING — otherwise clicks are swallowed before the guard fires. Only disable on cutoff + mutation-in-flight.
- **`bookingGuard` must be called after `provideActiveBooking()`**: only inside client layout children. For admin or public-only pages, skip the guard entirely.

## Spec + plan

Source of truth for decisions: `docs/superpowers/specs/2026-04-19-seat-booking-redesign-design.md` and `docs/superpowers/plans/2026-04-19-seat-booking-redesign.md`.
