# Effective Ticket Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute ticket "effective status" (`VALID + screening.endTime < now → 'EXPIRED'`) on every read and reject scan endpoints when the screening has ended, closing both the display and security gaps in the existing hourly cron.

**Architecture:** A pure helper `effectiveTicketStatus(rawStatus, screeningEndTime, now)` lives in `src/ticket/utils/`. Backend read endpoints (`getPublicMaster`, `getPublicTicket`, `validateMaster`, `validateTicket`, `BookingService.findOne`) wrap every outbound `ticket.status` through it. Scan endpoints (`scanMaster`, `scanTicket`) check `endTime < now` before mutation and throw `GoneException` (HTTP 410) if expired. Cron `expireTickets` and frontend remain functionally unchanged.

**Tech Stack:** NestJS + Prisma + vitest (backend), SvelteKit 2 + Svelte 5 + svelte-i18n (frontend, conditional).

**Spec:** `~/Desktop/ZeroWaiting_frontend/docs/superpowers/specs/2026-04-26-effective-ticket-status-design.md`

---

## File Structure

**Backend (`~/Desktop/ZeroWaiting_backend`):**
- Create: `src/ticket/utils/effective-ticket-status.ts`
- Create: `src/ticket/utils/effective-ticket-status.spec.ts`
- Modify: `src/ticket/ticket.service.ts` — apply helper in 4 read endpoints; add `endTime` precondition to 2 scan endpoints.
- Modify: `src/ticket/ticket.service.spec.ts` — extend fixtures with `endTime`; new test cases for expired scenarios.
- Modify: `src/booking/booking.service.ts` — apply helper in `findOne`.
- Modify: `src/booking/booking.service.spec.ts` — new test case for expired scenario.

**Frontend (`~/Desktop/ZeroWaiting_frontend`, conditional, see Task 7):**
- Possibly modify: `src/lib/i18n/locales/{ru,en,ky,kz,uz}.json` — add `scanner.ticketExpired` if missing.
- Possibly modify: scanner error handler — add 410 branch.

**Out of scope (verified during brainstorm):**
- `findAll` / `findByScreening` / `findByUser` — they include `seats: { include: { seat: true } }` only (no ticket) and never expose `ticket.status`.
- `getActivePending` — only PENDING bookings, no tickets generated yet.
- `cancelOwnPending` — same.
- `group-booking.service.ts` — only `BookingStatus`, never `TicketStatus`.

---

## Test Runner Note

This repo uses **vitest** (not Bun's bundled test runner). Always run tests with:

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test <file>
```

**Do NOT use `bun test`** — it uses Bun's built-in runner which fails on files that `import { vi } from 'vitest'`.

---

## Task 1: Pure helper `effectiveTicketStatus` (TDD)

**Files:**
- Create: `~/Desktop/ZeroWaiting_backend/src/ticket/utils/effective-ticket-status.ts`
- Create: `~/Desktop/ZeroWaiting_backend/src/ticket/utils/effective-ticket-status.spec.ts`

- [ ] **Step 1: Verify branch is correct**

```bash
cd ~/Desktop/ZeroWaiting_backend && git status && git branch --show-current
```

If not on `feat/effective-ticket-status`, create and switch:
```bash
cd ~/Desktop/ZeroWaiting_backend && git checkout main && git pull && git checkout -b feat/effective-ticket-status
```

- [ ] **Step 2: Write the failing test file**

Create `~/Desktop/ZeroWaiting_backend/src/ticket/utils/effective-ticket-status.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { TicketStatus } from '@prisma/client';
import { effectiveTicketStatus } from './effective-ticket-status';

const NOW = new Date('2026-04-26T22:57:00.000Z');
const ENDED = new Date('2026-04-26T22:50:00.000Z');   // 7 minutes ago
const FUTURE = new Date('2026-04-26T23:30:00.000Z');  // 33 minutes ahead

describe('effectiveTicketStatus', () => {
	it('keeps VALID when screening is still ongoing', () => {
		expect(effectiveTicketStatus('VALID' as TicketStatus, FUTURE, NOW)).toBe('VALID');
	});

	it('returns EXPIRED when VALID and screening has ended', () => {
		expect(effectiveTicketStatus('VALID' as TicketStatus, ENDED, NOW)).toBe('EXPIRED');
	});

	it('preserves USED across screening end (terminal)', () => {
		expect(effectiveTicketStatus('USED' as TicketStatus, ENDED, NOW)).toBe('USED');
	});

	it('preserves CANCELLED across screening end (terminal)', () => {
		expect(effectiveTicketStatus('CANCELLED' as TicketStatus, ENDED, NOW)).toBe('CANCELLED');
	});

	it('preserves EXPIRED when screening is in the future (cron already ran)', () => {
		expect(effectiveTicketStatus('EXPIRED' as TicketStatus, FUTURE, NOW)).toBe('EXPIRED');
	});

	it('treats screening end at the exact instant as still ongoing', () => {
		expect(effectiveTicketStatus('VALID' as TicketStatus, NOW, NOW)).toBe('VALID');
	});
});
```

- [ ] **Step 3: Run the test — confirm it fails**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test src/ticket/utils/effective-ticket-status.spec.ts
```

Expected: FAIL — `effective-ticket-status.ts` not found.

- [ ] **Step 4: Implement the helper**

Create `~/Desktop/ZeroWaiting_backend/src/ticket/utils/effective-ticket-status.ts`:

```ts
import type { TicketStatus } from '@prisma/client';

/**
 * Returns 'EXPIRED' when ticket is structurally VALID but its screening
 * has already ended. Other states (USED, CANCELLED, EXPIRED) are
 * preserved — they are terminal and time cannot move them.
 */
export const effectiveTicketStatus = (
	rawStatus: TicketStatus,
	screeningEndTime: Date,
	now: Date = new Date()
): TicketStatus =>
	rawStatus === 'VALID' && screeningEndTime.getTime() < now.getTime()
		? 'EXPIRED'
		: rawStatus;
```

- [ ] **Step 5: Run the test — confirm it passes**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test src/ticket/utils/effective-ticket-status.spec.ts
```

Expected: 6/6 PASS.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend && git add src/ticket/utils/effective-ticket-status.ts src/ticket/utils/effective-ticket-status.spec.ts && git commit -m "feat(ticket): add effectiveTicketStatus helper"
```

---

## Task 2: Apply helper to `ticket.service.ts` read endpoints (TDD)

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`

This task covers four read endpoints that each return `ticket.status` to clients/staff: `getPublicMaster`, `getPublicTicket`, `validateMaster`, `validateTicket`. All four already have `screening` in their Prisma `include`, so we don't need to widen any query — just need `endTime` to be one of the scalars returned (Prisma `include` returns all scalars by default).

- [ ] **Step 1: Update existing test fixtures to include `endTime`**

Open `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`. Find every existing `screening: { ... }` mock object that's used by `validateMaster`, `validateTicket`, `getPublicMaster`, `getPublicTicket` test blocks. Add `endTime: new Date('2026-05-01T21:30:00Z')` (a value clearly in the future for the chosen `startTime`) to each.

Locations (approximate):
- `validateMaster` `baseBooking.screening` (~line 100): add `endTime: new Date('2026-05-01T21:30:00Z')`.
- `validateTicket (per-seat)` mock screening (~line 273): add `endTime`.
- `getPublicMaster` `prisma.booking.findUnique.mockResolvedValue({ ... screening: {...} })` (~line 320): add `endTime`.
- `getPublicTicket` mock screening (~line 357): add `endTime`.

This must happen FIRST: existing tests would otherwise break once the helper requires `endTime` to be defined.

- [ ] **Step 2: Add new failing tests for expired scenarios**

Append inside `describe('getPublicMaster', ...)`:

```ts
it('returns EXPIRED for VALID seats when screening has already ended', async () => {
	prisma.booking.findUnique.mockResolvedValue({
		viewerCode: 'v-2',
		screening: {
			startTime: new Date('2026-05-01T19:00:00Z'),
			endTime: new Date('2026-05-01T20:30:00Z'),  // already ended in real time
			format: 'TWO_D' as const,
			movie: { title: { ru: 'X' }, posterUrl: null, ageRating: '12+', duration: 90 },
			hall: { name: 'Зал 1', branch: { name: { ru: 'IK' } } },
		},
		seats: [
			{
				seat: { rowNumber: 1, seatNumber: 1 },
				ticket: { qrCode: 'qr-A', status: 'VALID', scannedAt: null },
			},
			{
				seat: { rowNumber: 1, seatNumber: 2 },
				ticket: { qrCode: 'qr-B', status: 'USED', scannedAt: new Date() },
			},
		],
	});
	const result = await service.getPublicMaster('v-2');
	expect(result.seats[0].status).toBe('EXPIRED');
	expect(result.seats[1].status).toBe('USED'); // terminal preserved
});
```

Append inside `describe('getPublicTicket', ...)`:

```ts
it('returns EXPIRED when VALID and screening has ended', async () => {
	prisma.ticket.findUnique.mockResolvedValue({
		qrCode: 'qr-A', status: 'VALID', scannedAt: null,
		bookingSeat: {
			seat: { rowNumber: 7, seatNumber: 2 },
			booking: {
				screening: {
					startTime: new Date('2026-05-01T19:00:00Z'),
					endTime: new Date('2026-05-01T20:30:00Z'),
					format: 'TWO_D' as const,
					movie: { title: { ru: 'X' }, posterUrl: null, ageRating: '12+', duration: 90 },
					hall: { name: 'Зал 1', branch: { name: { ru: 'IK' } } },
				},
			},
		},
	});
	const r = await service.getPublicTicket('qr-A');
	expect(r.status).toBe('EXPIRED');
});
```

Append inside `describe('validateMaster', ...)`:

```ts
it('returns EXPIRED status for VALID seats when screening has ended', async () => {
	const endedBooking = {
		...baseBooking,
		screening: {
			...baseBooking.screening,
			endTime: new Date('2026-05-01T20:30:00Z'),  // far past
		},
	};
	prisma.booking.findUnique.mockResolvedValue(endedBooking);
	const result = await service.validateMaster('viewer-1', 'user-staff');
	// seats[0] was VALID raw → effective EXPIRED; seats[1] was USED → preserved
	expect(result.seats[0].status).toBe('EXPIRED');
	expect(result.seats[1].status).toBe('USED');
});
```

Append inside `describe('validateTicket (per-seat)', ...)`:

```ts
it('returns EXPIRED when VALID and screening has ended', async () => {
	prisma.ticket.findUnique.mockResolvedValue({
		id: 't-1',
		qrCode: 'qr-1',
		status: 'VALID',
		scannedAt: null,
		scannedById: null,
		bookingSeat: {
			seat: { id: 'seat-1', rowNumber: 7, seatNumber: 2 },
			booking: {
				id: 'b-1',
				screening: {
					id: 's-1',
					startTime: new Date('2026-05-01T19:00:00Z'),
					endTime: new Date('2026-05-01T20:30:00Z'),
					movie: { title: { ru: 'X' }, posterUrl: null, ageRating: '12+', duration: 90 },
					hall: { name: 'Зал 1', branch: { name: { ru: 'IK' } } },
				},
			},
		},
	});
	const r = await service.validateTicket('qr-1', 'user-staff');
	expect(r.status).toBe('EXPIRED');
});
```

- [ ] **Step 3: Run tests — confirm new tests fail, existing tests still pass**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test src/ticket/ticket.service.spec.ts
```

Expected: existing test cases pass (because we already updated their fixtures with `endTime`); the 4 new test cases FAIL (status currently returned raw, not expired).

- [ ] **Step 4: Apply helper in `ticket.service.ts`**

Open `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`. Add import at the top, alongside existing imports:

```ts
import { effectiveTicketStatus } from './utils/effective-ticket-status';
```

Modify `validateMaster` (lines ~60–89). The seats mapping currently:

```ts
seats: booking.seats
	.filter((bs) => bs.ticket !== null)
	.map((bs) => ({
		ticketId: bs.ticket!.id,
		qrCode: bs.ticket!.qrCode,
		seatId: bs.seat.id,
		row: bs.seat.rowNumber,
		seat: bs.seat.seatNumber,
		status: bs.ticket!.status,
		scannedAt: bs.ticket!.scannedAt?.toISOString() ?? null,
		scannedById: bs.ticket!.scannedById,
		canRevert: this.canRevert(bs.ticket!, actorId),
	})),
```

Replace `status: bs.ticket!.status,` with:

```ts
status: effectiveTicketStatus(bs.ticket!.status, booking.screening.endTime),
```

Modify `validateTicket` (lines ~140–170). Replace `status: ticket.status,` with:

```ts
status: effectiveTicketStatus(ticket.status, bookingSeat.booking.screening.endTime),
```

Modify `getPublicMaster` (lines ~223–242). The seats mapping currently:

```ts
seats: booking.seats
	.filter((bs) => bs.ticket !== null)
	.map((bs) => ({
		row: bs.seat.rowNumber,
		seat: bs.seat.seatNumber,
		qrCode: bs.ticket!.qrCode,
		status: bs.ticket!.status,
		scannedAt: bs.ticket!.scannedAt?.toISOString() ?? null,
	})),
```

Replace `status: bs.ticket!.status,` with:

```ts
status: effectiveTicketStatus(bs.ticket!.status, booking.screening.endTime),
```

Modify `getPublicTicket` (lines ~244–269). Replace `status: ticket.status,` with:

```ts
status: effectiveTicketStatus(ticket.status, bookingSeat.booking.screening.endTime),
```

- [ ] **Step 5: Run tests — confirm all pass**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test src/ticket/ticket.service.spec.ts
```

Expected: all tests pass (24 existing + 4 new = 28).

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend && git add src/ticket/ticket.service.ts src/ticket/ticket.service.spec.ts && git commit -m "feat(ticket): apply effective status to read endpoints"
```

---

## Task 3: Apply helper to `BookingService.findOne` (TDD)

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.spec.ts`

`findOne` already includes `screening` after the previous unified-ticket-header work (or in the base — verify), so `screening.endTime` is available. We need to mutate `bs.ticket.status` for each seat before returning.

- [ ] **Step 1: Update existing `mockBooking` fixture in `booking.service.spec.ts`**

Open `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.spec.ts`. Find the file-scoped `mockBooking` object (around line 36) and the `mockScreening` object (around line 24).

`mockScreening` should have an `endTime`. Add it if missing:

```ts
const mockScreening = {
	id: 'screening-1',
	movieId: 'movie-1',
	hallId: 'hall-1',
	startTime: new Date('2026-05-01T19:00:00Z'),
	endTime: new Date('2026-05-01T21:30:00Z'),  // ← add this
	// ... existing fields
};
```

Make sure `mockBooking.screening` (or its constructor) carries this `endTime`. If `mockBooking` has its own inline screening, add `endTime` there too.

Critically: the existing `mockBooking.seats` likely has at least one seat with a `ticket` object whose `status` is `VALID`. Don't change that — but make sure `mockScreening.endTime` is in the FUTURE relative to the mocked `now` so the existing test passes unmodified.

If `mockBooking.seats` does NOT have any `ticket` field on its seats, no migration is needed for existing tests — but we'll still add `endTime` to the mock screening for new tests below.

- [ ] **Step 2: Add a failing test for the expired scenario**

Append inside `describe('findOne', ...)` (around line 215), AFTER the existing tests (preserve the include-shape test added in the previous unified-header work):

```ts
it('returns EXPIRED status for VALID seats when screening has ended', async () => {
	prisma.booking.findUnique.mockResolvedValue({
		...mockBooking,
		screening: {
			...mockScreening,
			endTime: new Date('2026-04-01T20:30:00Z'),  // far past
		},
		seats: [
			{
				...mockBooking.seats[0],
				ticket: { id: 't-1', qrCode: 'qr-1', status: 'VALID', scannedAt: null, scannedById: null },
			},
		],
	});
	const result = await service.findOne('booking-1');
	expect(result.seats?.[0].ticket?.status).toBe('EXPIRED');
});

it('preserves USED status for terminal-state seats even when screening has ended', async () => {
	prisma.booking.findUnique.mockResolvedValue({
		...mockBooking,
		screening: {
			...mockScreening,
			endTime: new Date('2026-04-01T20:30:00Z'),  // far past
		},
		seats: [
			{
				...mockBooking.seats[0],
				ticket: { id: 't-2', qrCode: 'qr-2', status: 'USED', scannedAt: new Date(), scannedById: 'staff' },
			},
		],
	});
	const result = await service.findOne('booking-1');
	expect(result.seats?.[0].ticket?.status).toBe('USED');
});
```

If `mockBooking.seats[0]` doesn't exist or has a different shape, adjust the fixture inline to provide minimum `seat: { ... }` and `ticket: { ... }` objects.

- [ ] **Step 3: Run tests — confirm new tests fail**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test src/booking/booking.service.spec.ts
```

Expected: existing tests pass; the 2 new tests FAIL — `result.seats[0].ticket.status` is currently raw `VALID` instead of `EXPIRED`.

- [ ] **Step 4: Apply helper in `findOne`**

Open `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts`. Add import at the top:

```ts
import { effectiveTicketStatus } from '../ticket/utils/effective-ticket-status';
```

Modify `findOne` (around line 333). Replace:

```ts
async findOne(id: string) {
	const booking = await this.prisma.booking.findUnique({
		where: { id },
		include: {
			seats: { include: { seat: true, ticket: true } },
			screening: {
				include: {
					movie: true,
					hall: { include: { branch: true } }
				}
			},
			payment: true,
			user: true
		}
	});
	if (!booking) throw new NotFoundException(`Booking ${id} not found`);
	return this.withExpiryIfPending(booking);
}
```

with:

```ts
async findOne(id: string) {
	const booking = await this.prisma.booking.findUnique({
		where: { id },
		include: {
			seats: { include: { seat: true, ticket: true } },
			screening: {
				include: {
					movie: true,
					hall: { include: { branch: true } }
				}
			},
			payment: true,
			user: true
		}
	});
	if (!booking) throw new NotFoundException(`Booking ${id} not found`);

	if (booking.screening) {
		for (const bs of booking.seats) {
			if (bs.ticket) {
				bs.ticket.status = effectiveTicketStatus(
					bs.ticket.status,
					booking.screening.endTime
				);
			}
		}
	}

	return this.withExpiryIfPending(booking);
}
```

Note: this mutates the Prisma-returned object in place. Acceptable here because it's a fresh query result, not a cached entity.

- [ ] **Step 5: Run tests — confirm all pass**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test src/booking/booking.service.spec.ts
```

Expected: all tests pass (existing 30 + 2 new).

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend && git add src/booking/booking.service.ts src/booking/booking.service.spec.ts && git commit -m "feat(booking): apply effective ticket status in findOne"
```

---

## Task 4: Reject expired tickets in `scanMaster` (TDD, security)

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`

`scanMaster` currently only loads `seats: { include: { ticket: true } }` from the booking — it does NOT have `screening` in its include. We add `screening: { select: { endTime: true } }` and the precondition.

- [ ] **Step 1: Add a failing test for expired-screening rejection**

Append inside `describe('scanMaster', ...)` (around line 173):

```ts
it('throws GoneException and does not call updateMany when screening has ended', async () => {
	prisma.booking.findUnique.mockResolvedValue({
		id: 'b-1',
		screening: { endTime: new Date('2026-04-01T20:30:00Z') },  // far past
		seats: [{ ticket: { id: 't-1', status: 'VALID' } }],
	});
	prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

	await expect(
		service.scanMaster('viewer-1', ['t-1'], 'user-staff'),
	).rejects.toThrow(GoneException);

	expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
});
```

Also import `GoneException` at the top of the test file if not already imported. Check the existing imports (line ~3-9) and add to the destructure from `@nestjs/common`.

Update existing `scanMaster` test fixtures so they include `screening: { endTime: <future date> }`. The existing tests at lines 173–257 have `prisma.booking.findUnique.mockResolvedValue({ id: 'b-1', seats: [...] })` — extend each to include `screening: { endTime: new Date('2099-12-31T00:00:00Z') }` so they don't trip the new precondition.

- [ ] **Step 2: Run tests — confirm new test fails**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test src/ticket/ticket.service.spec.ts -t scanMaster
```

Expected: existing scanMaster tests still pass (with the future-endTime fixture extension); the new GoneException test FAILS — there's no precondition yet.

- [ ] **Step 3: Implement the precondition**

Open `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`. Find `scanMaster` (around line 91).

Add `GoneException` to the existing `@nestjs/common` import line at the top of the file (it's likely already imported alongside `NotFoundException`/`BadRequestException`/`ConflictException`/`ForbiddenException`/`Injectable`).

Modify `scanMaster`. The current shape:

```ts
async scanMaster(viewerCode: string, ticketIds: string[], actorId: string) {
	return this.prisma.$transaction(async (tx) => {
		const booking = await tx.booking.findUnique({
			where: { viewerCode },
			include: { seats: { include: { ticket: true } } },
		});
		if (!booking) throw new NotFoundException('Booking not found');
		// ...
```

Change the include to also pull `screening.endTime`, and add the precondition right after the not-found check:

```ts
async scanMaster(viewerCode: string, ticketIds: string[], actorId: string) {
	return this.prisma.$transaction(async (tx) => {
		const booking = await tx.booking.findUnique({
			where: { viewerCode },
			include: {
				seats: { include: { ticket: true } },
				screening: { select: { endTime: true } },
			},
		});
		if (!booking) throw new NotFoundException('Booking not found');

		if (booking.screening.endTime.getTime() < Date.now()) {
			throw new GoneException('Screening already ended; tickets are expired');
		}

		// ... rest of existing scan logic unchanged
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test src/ticket/ticket.service.spec.ts
```

Expected: all pass (28 + 1 new = 29 total in this file).

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend && git add src/ticket/ticket.service.ts src/ticket/ticket.service.spec.ts && git commit -m "feat(ticket): reject scanMaster after screening end"
```

---

## Task 5: Reject expired tickets in `scanTicket` (TDD, security)

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`

`scanTicket` currently does a single `tx.ticket.update` against `qrCode` + `status: 'VALID'` filter, with no preceding read. We add a precondition lookup (same transaction).

- [ ] **Step 1: Add a failing test for expired-screening rejection**

Append inside `describe('scanTicket (per-seat)', ...)` (around line 294):

```ts
it('throws GoneException and does not call update when screening has ended', async () => {
	prisma.ticket.findUnique.mockResolvedValue({
		bookingSeat: {
			booking: {
				screening: { endTime: new Date('2026-04-01T20:30:00Z') },  // far past
			},
		},
	});
	prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

	await expect(service.scanTicket('qr-1', 'user-staff')).rejects.toThrow(GoneException);
	expect(prisma.ticket.update).not.toHaveBeenCalled();
});

it('throws NotFound when qrCode does not exist', async () => {
	prisma.ticket.findUnique.mockResolvedValue(null);
	prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
	await expect(service.scanTicket('xxx', 'user-staff')).rejects.toThrow(NotFoundException);
});
```

Also adjust the existing happy-path test (`scans VALID ticket and returns USED` or similar — search for the existing `scanTicket` it block). It probably calls `prisma.ticket.update.mockResolvedValue(...)` directly. We need to also mock `prisma.ticket.findUnique.mockResolvedValue({ bookingSeat: { booking: { screening: { endTime: <future> } } } })` so the new precondition passes:

```ts
// in the existing happy-path test, add BEFORE prisma.ticket.update.mockResolvedValue:
prisma.ticket.findUnique.mockResolvedValue({
	bookingSeat: {
		booking: { screening: { endTime: new Date('2099-12-31T00:00:00Z') } },
	},
});
prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
```

And the `throws Conflict when ticket not VALID` test similarly needs the new findUnique mock for the precondition path.

- [ ] **Step 2: Run tests — confirm new tests fail**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test src/ticket/ticket.service.spec.ts -t scanTicket
```

Expected: existing scanTicket tests still pass (after fixture updates); the new tests FAIL — precondition missing.

- [ ] **Step 3: Implement the precondition**

Open `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`. Find `scanTicket` (around line 172).

Replace the entire method:

```ts
async scanTicket(qrCode: string, actorId: string) {
	return this.prisma.$transaction(async (tx) => {
		const found = await tx.ticket.findUnique({
			where: { qrCode },
			select: {
				bookingSeat: {
					select: {
						booking: { select: { screening: { select: { endTime: true } } } },
					},
				},
			},
		});
		if (!found) throw new NotFoundException('Ticket not found');

		const endTime = found.bookingSeat.booking.screening.endTime;
		if (endTime.getTime() < Date.now()) {
			throw new GoneException('Screening already ended; ticket is expired');
		}

		try {
			const result = await tx.ticket.update({
				where: { qrCode, status: 'VALID' },
				data: { status: 'USED', scannedAt: new Date(), scannedById: actorId },
			});
			await this.auditLog.log('TICKET_SCAN', 'Ticket', result.id, actorId, { qrCode });
			return result;
		} catch (e) {
			if ((e as { code?: string }).code === 'P2025') {
				throw new ConflictException('Ticket cannot be scanned in current state');
			}
			throw e;
		}
	});
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test src/ticket/ticket.service.spec.ts
```

Expected: all pass.

- [ ] **Step 5: Run full backend suite to catch any cross-file regressions**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend && git add src/ticket/ticket.service.ts src/ticket/ticket.service.spec.ts && git commit -m "feat(ticket): reject scanTicket after screening end"
```

---

## Task 6: Frontend — `scanner.ticketExpired` i18n + 410 handler (conditional)

**Files (conditional on investigation result):**
- Modify: `~/Desktop/ZeroWaiting_frontend/src/lib/i18n/locales/{ru,en,ky,kz,uz}.json`
- Modify: scanner error handler (TBD by investigation)

This task is conditional. Investigate first, then act only if needed.

- [ ] **Step 1: Branch check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && git branch --show-current
```

Should be `feat/effective-ticket-status`. If not:
```bash
cd ~/Desktop/ZeroWaiting_frontend && git checkout feat/effective-ticket-status
```

- [ ] **Step 2: Check if `scanner.ticketExpired` already exists in any locale**

```bash
cd ~/Desktop/ZeroWaiting_frontend && grep -rn "ticketExpired\|410\|Сеанс уже" src/lib/i18n/locales/ src/routes/scanner/ 2>/dev/null
```

If `ticketExpired` is already defined and there's already a 410 branch in the scanner — skip remaining steps and report Task 6 as DONE (nothing to do).

If only one of the two is defined, complete only the missing piece.

If neither exists, continue.

- [ ] **Step 3: Find the scanner error handler**

```bash
cd ~/Desktop/ZeroWaiting_frontend && grep -rn "status === 4\|response.status\|err.status\|HttpErrorResponse" src/routes/scanner/ src/api/mutator/ 2>/dev/null | head -10
```

Identify the file that maps HTTP status codes to user-facing UI messages. It's most likely `~/Desktop/ZeroWaiting_frontend/src/routes/scanner/+page.svelte` or a scanner component.

If no specific 409 handler exists (i.e., the scanner relies on a generic toast / error fallback), then we don't need a 410 branch either — the same fallback will fire. Skip the handler step but still add the i18n key for future use.

- [ ] **Step 4: Add `scanner.ticketExpired` to all 5 locales**

In each of `ru.json`, `en.json`, `ky.json`, `kz.json`, `uz.json`, find the existing `"scanner": { ... }` block (or create one if missing). Add a `ticketExpired` key inside.

Per-locale values:
- `ru.json`: `"ticketExpired": "Сеанс уже закончился, билет истёк"`
- `en.json`: `"ticketExpired": "Screening has ended; ticket is expired"`
- `ky.json`: `"ticketExpired": "Сеанс бүттү, билеттин мөөнөтү өттү"`
- `kz.json`: `"ticketExpired": "Сеанс аяқталды, билет мерзімі өтті"`
- `uz.json`: `"ticketExpired": "Seans tugadi, chiptaning muddati o'tdi"`

If the `scanner` namespace doesn't exist in some locale, create the minimum structure:

```json
"scanner": {
	"ticketExpired": "<localized>"
}
```

- [ ] **Step 5: Validate JSON**

```bash
cd ~/Desktop/ZeroWaiting_frontend && for f in src/lib/i18n/locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f OK" || echo "$f FAIL"; done
```

Expected: all five `OK`.

- [ ] **Step 6: If a specific scanner error-status handler exists, add a 410 branch**

If Step 3 found a file like `~/Desktop/ZeroWaiting_frontend/src/routes/scanner/+page.svelte` with a switch/if-else on HTTP status (e.g., handling 409 specifically), add a 410 branch:

```ts
// example pattern — adapt to actual handler shape:
} else if (status === 410) {
	toast.error($_('scanner.ticketExpired'));
}
```

Place it adjacent to the existing 409 branch. If the handler is in a `try/catch` that already calls a generic error toast, you may instead want a small `if (e?.response?.status === 410)` branch that uses the i18n key. Adapt to the actual shape.

Skip this step entirely if Step 3 showed no specific status handling — the generic fallback will already display the backend's `GoneException` message.

- [ ] **Step 7: Typecheck**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
cd ~/Desktop/ZeroWaiting_frontend && git add src/lib/i18n/locales src/routes/scanner 2>/dev/null && git commit -m "feat(scanner): localize 410 expired-ticket response"
```

If only locales were touched (no scanner change), use:
```bash
cd ~/Desktop/ZeroWaiting_frontend && git add src/lib/i18n/locales && git commit -m "feat(i18n): add scanner.ticketExpired key (5 locales)"
```

---

## Task 7: Build + smoke + regression

**Files:** none modified — verification only.

- [ ] **Step 1: Backend test suite**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run test
```

Expected: all pass, including the 6 new helper-only cases, the 4 new read-endpoint cases, the 2 new findOne cases, and the 2 new scan-rejection cases.

- [ ] **Step 2: Backend build/typecheck**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run build
```

Expected: 0 errors.

- [ ] **Step 3: Frontend typecheck and build**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check && bun run build
```

Expected: 0 errors. (No frontend behavior change unless Task 6 made one.)

- [ ] **Step 4: Manual smoke — read path**

Start backend (`cd ~/Desktop/ZeroWaiting_backend && bun run start:dev`) and frontend (`cd ~/Desktop/ZeroWaiting_frontend && VITE_API_BASE_URL=http://localhost:5000 bun run dev`).

Find a booking whose screening already ended (or temporarily edit one in DB):
```sql
UPDATE "Screening" SET "endTime" = '2020-01-01T00:00:00Z' WHERE id = '<some_id>';
```

Hit the public master URL for that booking — `http://localhost:5173/t/m/<viewerCode>`. Verify:
- Per-seat status badge reads "Истёк" (i18n for `EXPIRED`).
- Master tab status badge logic also shows expired (it depends on `seats[].status` aggregate).

Hit `http://localhost:5173/booking/<id>/confirmation` (auth required). Verify the same.

Restore the screening's `endTime` after the check.

- [ ] **Step 5: Manual smoke — scanner path**

In the scanner UI (`http://localhost:5173/scanner`), attempt to scan a master QR or a per-seat QR for a booking whose screening already ended. Verify:
- Backend returns 410.
- Scanner UI shows the expired-ticket message (either the new i18n key or the generic fallback).

Or via curl with a staff JWT:
```bash
curl -X POST http://localhost:5000/api/v1/tickets/master/<viewerCode>/scan \
	-H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
	-d '{"ticketIds":["<ticket_id>"]}'
```

Expected: HTTP 410, body contains "Screening already ended".

- [ ] **Step 6: Regression sweep — `ticket.status` consumers in frontend**

```bash
cd ~/Desktop/ZeroWaiting_frontend && grep -rn "ticket\.status\|ticket\?.status\|status: 'VALID'\|status === 'VALID'" src --include="*.svelte" --include="*.ts" 2>/dev/null | head -30
```

For each result, verify it doesn't choke on receiving `EXPIRED` (it shouldn't — `TICKET_STATUS_CONFIG` already handles all four enum values; `i18n.booking.ticketStatus.EXPIRED` exists).

- [ ] **Step 7: Regression sweep — backend ticket.status consumers**

```bash
cd ~/Desktop/ZeroWaiting_backend && grep -rn "ticket\.status\|status: 'VALID'\|status === 'VALID'" src --include="*.ts" | grep -v ".spec.ts" | head -20
```

Verify each is either:
- Already wrapped via `effectiveTicketStatus` (Task 2 / 3 / 4 / 5).
- A write path (cron, scan, status assignment) — these intentionally remain canonical.
- Not consumed by clients (internal helper).

- [ ] **Step 8: No commit needed if smoke passed clean**

If smoke uncovered a small fixup, commit it now:

```bash
cd ~/Desktop/ZeroWaiting_backend && git add -p && git commit -m "fix(ticket): <specific fix from smoke>"
```

Otherwise — done.

---

## Self-Review

**Spec coverage check:**
- ✅ Pure helper `effectiveTicketStatus` with 5 + 1 boundary cases → Task 1.
- ✅ `getPublicMaster`, `getPublicTicket`, `validateMaster`, `validateTicket` apply helper → Task 2.
- ✅ `BookingService.findOne` applies helper → Task 3.
- ✅ `scanMaster` rejects after screening end → Task 4.
- ✅ `scanTicket` rejects after screening end → Task 5.
- ✅ Cron unchanged → no task (intentionally).
- ✅ API contract unchanged → no task (no DTO change).
- ✅ Frontend i18n + 410 branch → Task 6 (conditional).
- ✅ `findAll` / group-bookings / `revertTicket` skipped → confirmed in spec Out of Scope.
- ✅ Build + smoke + regression → Task 7.

**Placeholder scan:** No `TODO`, no `TBD`. Task 6 has explicit conditional branches (skip / partial / full) tied to a concrete grep — that's not a placeholder, that's an honest branch on observed state. The locale strings in Task 6 are concrete per-locale values, not stubs.

**Type consistency check:**
- `effectiveTicketStatus(rawStatus, screeningEndTime, now?)` — same signature in Task 1 (definition), Task 2 (4 call sites), Task 3 (1 call site). Default `now: Date = new Date()` consistent across uses.
- `GoneException` — imported and used in Task 4 and Task 5; thrown class is the same `@nestjs/common` symbol.
- `screening.endTime: Date` — Prisma scalar; same shape across all backend touches.
- TicketStatus enum values (`VALID | USED | CANCELLED | EXPIRED`) — referenced consistently.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-effective-ticket-status.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
