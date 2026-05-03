---
name: state
description: 'Use when working with stores, state management, or seat selection state. Triggers: authStore, sidebarOpen, burgerMenuOpen, seatSelection, activeBooking, stores/, writable, svelte/store, seat-selection.svelte.ts, active-booking.svelte.ts, provideActiveBooking, useActiveBooking.'
metadata:
  author: zerowaiting
  version: '2.0.0'
---

# State Management

## Svelte Writable Stores (`src/lib/stores/`)

| Store            | File                       | Purpose                                                 |
| ---------------- | -------------------------- | ------------------------------------------------------- |
| `authStore`      | `auth.ts`                  | JWT access/refresh tokens + remember-me (NO user data!) |
| `sidebarOpen`    | `sidebar.ts`               | Admin sidebar visibility                                |
| `burgerMenuOpen` | `burgerMenu.ts`            | Mobile burger menu open/close state                     |
| `seatSelection`  | `seat-selection.svelte.ts` | Local-only seat selection on `/screenings/:id` (runes)  |
| `activeBooking`  | `active-booking.svelte.ts` | TanStack query for user's active PENDING booking (context-based provider) |

## `seatSelection` — local selection only (no timer, no server)

API:
```ts
seatSelection.selectedIds   // string[]
seatSelection.count         // number
seatSelection.isEmpty       // boolean

seatSelection.bind(screeningId)   // must be called in $effect — resets on change
seatSelection.toggle(seatId)
seatSelection.remove(seatId)
seatSelection.removeMany(seatIds)
seatSelection.clear()
```

No server requests, no hold timer. The TTL countdown lives inside the `PENDING Booking` itself (via `createPendingTimer` util — see booking skill).

## `activeBooking` — TanStack query via context

Call `provideActiveBooking()` once at the top of the client layout (`(client)/+layout.svelte`). Consumers use `useActiveBooking()` to read the query.

```ts
// In layout:
import { provideActiveBooking } from '@/lib/stores/active-booking.svelte';
provideActiveBooking();

// In a component/page:
import { useActiveBooking } from '@/lib/stores/active-booking.svelte';
const query = useActiveBooking();
const booking = $derived(query.data);
```

The query auto-refetches every 60s + on window focus. `retry: false` — don't spam on failure.

Prefer the **active-booking guard** (`src/lib/utils/active-booking-guard.svelte.ts`) over raw access — it adds the auto-open-dialog and `requireNoActivePending()` semantics. See booking skill.

## Server State

Use **TanStack Svelte Query** for all server data. Do not duplicate API data in local stores.

## Important: User Data

User data (name, role, email, photo) — **always from API** via `crmQueryApi.createGetProfileMeV1()`. Never from `authStore`.

## Deprecated (removed)

- `booking-flow.svelte.ts` — deleted. The old multi-step booking store was unused; current flow is: local `seatSelection` → `POST /bookings` → `/booking/:id` page with `createPendingTimer`.
