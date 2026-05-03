# Seat Booking Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite seat selection & booking flow end-to-end: locally buffered selection, atomic bulk Continue, global pending-booking banner, self-cancel, and full removal of the `SeatHold` subsystem.

**Architecture:** Drop `SeatHold` as the source of truth. `PENDING Booking` + `BookingSeat` become the only reservation mechanism, already protected by `SELECT FOR UPDATE` transactions. Frontend selection is local-only; one bulk `POST /bookings` per user action. A new `GET /bookings/active` + floating banner surface unfinished bookings across all client pages.

**Tech Stack:** SvelteKit 2 (Svelte 5 runes) + TanStack Svelte Query + Orval; NestJS + Prisma + Vitest. Design spec: `docs/superpowers/specs/2026-04-19-seat-booking-redesign-design.md` (commit `0062a8d`).

**Release model:** 3-phase zero-downtime.

- **Phase 1** — backend compatible additions (new endpoints, enriched 409, envelope field).
- **Phase 2** — frontend rewrite + deploy.
- **Phase 3** — backend cleanup (delete `SeatHold` module, migration).

---

## File Structure

### Backend — Phase 1 (new / modified, all backward-compatible)

**New files:**

- `~/Desktop/ZeroWaiting_backend/src/booking/dto/booking-conflict-response.dto.ts` — two Swagger DTOs: `ActiveBookingExistsErrorDto`, `SeatsUnavailableErrorDto`.
- `~/Desktop/ZeroWaiting_backend/src/booking/entities/active-booking.entity.ts` — `ActiveBookingEntity extends BookingEntity { expiresAt }`.

**Modified files:**

- `~/Desktop/ZeroWaiting_backend/prisma/schema.prisma` — add `@@index([userId, status])` on `Booking`.
- `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts` — add `getActivePending`, `cancelOwnPending`; enrich `create` with one-PENDING check + structured 409 bodies; add `pendingTtlMinutes` reader via new `BOOKING_PENDING_TTL_MINUTES` env (fallback to `SEAT_HOLD_TTL_MINUTES`).
- `~/Desktop/ZeroWaiting_backend/src/booking/booking.controller.ts` — add `GET /active`, `DELETE /:id/self` endpoints; Swagger `@ApiExtraModels` for 409 `oneOf`.
- `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.spec.ts` — unit tests for new methods and conflict behaviour.
- `~/Desktop/ZeroWaiting_backend/src/hall/entities/available-seats-envelope.entity.ts` — add `holdTtlMinutes: number`.
- `~/Desktop/ZeroWaiting_backend/src/screening/screening.service.ts` — return `holdTtlMinutes` in envelope.
- `~/Desktop/ZeroWaiting_backend/src/screening/public-screenings.controller.ts` — apply `OptionalJwtAuthGuard`, pass `req.user?.id` to `findAvailableSeats` (enables `HELD_BY_YOU` for new flow).
- `~/Desktop/ZeroWaiting_backend/src/screening/screening.controller.ts` — pass `req.user.id` to `findAvailableSeats`.
- `~/Desktop/ZeroWaiting_backend/.env.example` — introduce `BOOKING_PENDING_TTL_MINUTES=10`.

### Frontend — Phase 2 (rewrite)

**New files:**

- `src/lib/utils/pending-timer.svelte.ts` — reactive timer factory shared by banner + booking page.
- `src/lib/utils/pending-timer.spec.ts` — Vitest unit tests for timer formatting / edge cases.
- `src/lib/utils/seat-label.ts` — `mapSeatIdsToLabels(seatIds, seatsData)` pure function.
- `src/lib/utils/seat-label.spec.ts` — Vitest unit tests.
- `src/lib/stores/active-booking.svelte.ts` — TanStack query provider via Svelte context.
- `src/lib/constants/booking-conflict.ts` — type guards for 409 conflict discriminated union.
- `src/components/booking/ActiveBookingBanner.svelte` — floating pending-booking banner.
- `src/components/booking/ActiveBookingConflictDialog.svelte` — modal for `ACTIVE_BOOKING_EXISTS`.
- `src/components/booking/PendingBookingTimer.svelte` — visual timer widget with threshold colors.
- `src/components/booking/ExpiredBookingView.svelte` — view shown after TTL expiry.

**Rewritten files:**

- `src/lib/stores/seat-selection.svelte.ts` — strip holds/timer; keep only local selection.
- `src/routes/(client)/screenings/[id]/+page.svelte` — remove `holdMutation` path; Continue handler only.
- `src/routes/(client)/booking/[bookingId]/+page.svelte` — add timer, self-cancel, expired polling.
- `src/routes/(client)/+layout.svelte` — provide active-booking context, render banner.

**Deleted files:**

- `src/lib/stores/booking-flow.svelte.ts` — dead code.

**Modified:**

- `src/lib/i18n/locales/ru.json`, `en.json`, `ky.json`, `kz.json`, `uz.json` — new `booking.*` keys.

### Backend — Phase 3 (cleanup)

**Deleted:**

- `src/seat-hold/**/*`
- `SeatHoldModule` import from `src/app.module.ts`

**Modified:**

- `prisma/schema.prisma` — remove `SeatHold` model + `seatHolds` relations on `Screening`, `Seat`.
- `src/screening/screening.service.ts` — drop `activeHolds` query + `holdMap` composition; seat status derived only from `BookingSeat`.
- `.env.example` — remove `SEAT_HOLD_TTL_MINUTES`, keep `BOOKING_PENDING_TTL_MINUTES`.

---

# PHASE 1 — Backend compatible additions

Deploys in one release. Old frontend continues working (still calls `/seat-holds`). New endpoints and fields are additive.

## Task 1.1: Add index for active-booking lookup

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/prisma/schema.prisma`

- [ ] **Step 1: Add composite index on Booking**

Open `prisma/schema.prisma`, locate `model Booking` and add the index alongside existing ones:

```prisma
model Booking {
  // ...existing fields unchanged...

  @@index([screeningId, status])
  @@index([userId, createdAt])
  @@index([createdAt, status])
  @@index([userId, status])  // NEW: fast lookup for GET /bookings/active
}
```

- [ ] **Step 2: Generate migration**

Run: `cd ~/Desktop/ZeroWaiting_backend && npm run prisma:migrate -- --name booking_user_status_index`

Expected: new folder `prisma/migrations/<timestamp>_booking_user_status_index/migration.sql` with a single `CREATE INDEX` statement. Prisma client regenerates automatically.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(booking): index (userId, status) for active booking lookup"
```

---

## Task 1.2: Introduce BOOKING_PENDING_TTL_MINUTES env var with fallback

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/.env.example`
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts`

- [ ] **Step 1: Add new env key to `.env.example`**

```diff
+ BOOKING_PENDING_TTL_MINUTES=10
  SEAT_HOLD_TTL_MINUTES=10
```

Keep old key as fallback during transition. Comment above:

```
# Minutes a PENDING booking stays valid before cron cancels it.
# SEAT_HOLD_TTL_MINUTES is the legacy alias kept until Phase 3.
```

- [ ] **Step 2: Update `pendingTtlMinutes` reader**

In `booking.service.ts` constructor (currently reads `SEAT_HOLD_TTL_MINUTES`):

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly config: ConfigService,
  // ...existing deps...
) {
  this.pendingTtlMinutes =
    this.config.get<number>('BOOKING_PENDING_TTL_MINUTES') ??
    this.config.get<number>('SEAT_HOLD_TTL_MINUTES', 10);
}
```

- [ ] **Step 3: Also update `seat-hold.service.ts` to same fallback pattern**

Same one-liner change so both services agree on TTL during Phase 1/2.

- [ ] **Step 4: Run existing tests to confirm no regression**

```bash
cd ~/Desktop/ZeroWaiting_backend
npm run test -- booking
```

Expected: all existing booking tests pass (env change is additive with fallback).

- [ ] **Step 5: Commit**

```bash
git add .env.example src/booking/booking.service.ts src/seat-hold/seat-hold.service.ts
git commit -m "feat(booking): rename TTL env to BOOKING_PENDING_TTL_MINUTES (fallback to old)"
```

---

## Task 1.3: Add BookingConflict DTO union

**Files:**

- Create: `~/Desktop/ZeroWaiting_backend/src/booking/dto/booking-conflict-response.dto.ts`

- [ ] **Step 1: Create the DTO file**

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class ActiveBookingExistsErrorDto {
	@ApiProperty({
		enum: ['ACTIVE_BOOKING_EXISTS'],
		example: 'ACTIVE_BOOKING_EXISTS'
	})
	code!: 'ACTIVE_BOOKING_EXISTS';

	@ApiProperty({ example: 'У вас есть неоплаченная бронь' })
	message!: string;

	@ApiProperty({ type: 'string', format: 'uuid' })
	bookingId!: string;

	@ApiProperty({ type: 'string', format: 'uuid' })
	screeningId!: string;
}

export class SeatsUnavailableErrorDto {
	@ApiProperty({ enum: ['SEATS_UNAVAILABLE'], example: 'SEATS_UNAVAILABLE' })
	code!: 'SEATS_UNAVAILABLE';

	@ApiProperty({ example: 'Некоторые места уже забронированы' })
	message!: string;

	@ApiProperty({
		type: [String],
		description: 'IDs of seats that are no longer available'
	})
	unavailableSeatIds!: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/booking/dto/booking-conflict-response.dto.ts
git commit -m "feat(booking): add conflict response DTOs"
```

---

## Task 1.4: Add ActiveBookingEntity

**Files:**

- Create: `~/Desktop/ZeroWaiting_backend/src/booking/entities/active-booking.entity.ts`

- [ ] **Step 1: Create the entity**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { BookingEntity } from '../../generated/nestjs-dto';

export class ActiveBookingEntity extends BookingEntity {
	@ApiProperty({
		type: 'string',
		format: 'date-time',
		description:
			'Absolute ISO 8601 UTC timestamp when the PENDING booking will be cancelled by cron'
	})
	expiresAt!: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/booking/entities/active-booking.entity.ts
git commit -m "feat(booking): add ActiveBookingEntity with expiresAt"
```

---

## Task 1.5: Test + implement `getActivePending`

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.spec.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts`

- [ ] **Step 1: Write failing tests**

Append to `booking.service.spec.ts`:

```typescript
describe('getActivePending', () => {
	it('returns PENDING booking within TTL with computed expiresAt', async () => {
		const createdAt = new Date(Date.now() - 2 * 60_000); // 2 min ago
		const bookingRow = {
			id: 'b1',
			userId: 'u1',
			status: 'PENDING',
			createdAt,
			seats: [],
			screening: {}
		};
		prismaMock.booking.findFirst.mockResolvedValue(bookingRow);

		const result = await service.getActivePending('u1');

		expect(result).not.toBeNull();
		expect(result!.id).toBe('b1');
		const expectedExpiry = createdAt.getTime() + 10 * 60_000;
		expect(new Date(result!.expiresAt).getTime()).toBe(expectedExpiry);
	});

	it('returns null when no PENDING booking exists', async () => {
		prismaMock.booking.findFirst.mockResolvedValue(null);
		const result = await service.getActivePending('u1');
		expect(result).toBeNull();
	});

	it('filters out expired PENDING bookings by createdAt cutoff', async () => {
		await service.getActivePending('u1');
		const call = prismaMock.booking.findFirst.mock.calls[0][0];
		expect(call.where.status).toBe('PENDING');
		expect(call.where.userId).toBe('u1');
		expect(call.where.createdAt.gte).toBeInstanceOf(Date);
	});
});
```

- [ ] **Step 2: Run tests — must fail**

Run: `cd ~/Desktop/ZeroWaiting_backend && npm run test -- booking.service`
Expected: `getActivePending is not a function` or similar — three failures.

- [ ] **Step 3: Implement the method**

Add to `booking.service.ts` (public method):

```typescript
async getActivePending(userId: string) {
  const ttlMs = this.pendingTtlMinutes * 60_000;
  const cutoff = new Date(Date.now() - ttlMs);
  const booking = await this.prisma.booking.findFirst({
    where: {
      userId,
      status: 'PENDING',
      createdAt: { gte: cutoff }
    },
    include: {
      seats: { include: { seat: true } },
      screening: {
        include: {
          movie: true,
          hall: { include: { branch: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (!booking) return null;
  const expiresAt = new Date(booking.createdAt.getTime() + ttlMs).toISOString();
  return { ...booking, expiresAt };
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `npm run test -- booking.service`
Expected: all three `getActivePending` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/booking/booking.service.ts src/booking/booking.service.spec.ts
git commit -m "feat(booking): add getActivePending with computed expiresAt"
```

---

## Task 1.6: Add GET /v1/bookings/active endpoint

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.controller.ts`

- [ ] **Step 1: Write failing e2e-style controller test**

Append to `booking.service.spec.ts` a controller-level test using NestJS `Test.createTestingModule`:

```typescript
describe('BookingController.getActive', () => {
	it('returns 200 with ActiveBookingEntity when PENDING exists', async () => {
		const req = { user: { id: 'u1' } } as unknown as Request;
		const res = {
			status: vi.fn().mockReturnThis(),
			send: vi.fn(),
			json: vi.fn()
		} as unknown as Response;

		vi.spyOn(service, 'getActivePending').mockResolvedValue({
			id: 'b1',
			expiresAt: '2026-04-19T10:10:00Z'
		} as any);
		await controller.getActive(req, res);
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'b1' })
		);
		expect(res.status).not.toHaveBeenCalledWith(204);
	});

	it('returns 204 when no PENDING booking', async () => {
		const req = { user: { id: 'u1' } } as unknown as Request;
		const res = {
			status: vi.fn().mockReturnThis(),
			send: vi.fn(),
			json: vi.fn()
		} as unknown as Response;
		vi.spyOn(service, 'getActivePending').mockResolvedValue(null);
		await controller.getActive(req, res);
		expect(res.status).toHaveBeenCalledWith(204);
		expect(res.send).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test — must fail with "getActive is not a function"**

Run: `npm run test -- booking`
Expected: 2 failures.

- [ ] **Step 3: Implement controller method**

Add to `booking.controller.ts` (before `findAll`):

```typescript
@Get('active')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Get current user active PENDING booking' })
@ApiResponse({ status: 200, type: ActiveBookingEntity })
@ApiResponse({ status: 204, description: 'No active PENDING booking' })
async getActive(@Req() req: Request, @Res() res: Response) {
  const booking = await this.bookingService.getActivePending(req.user.id);
  if (!booking) {
    res.status(204).send();
    return;
  }
  res.json(booking);
}
```

Add imports at file top:

```typescript
import { Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ActiveBookingEntity } from './entities/active-booking.entity';
```

- [ ] **Step 4: Run tests — must pass**

Run: `npm run test -- booking`
Expected: all pass.

- [ ] **Step 5: Manual smoke test**

```bash
cd ~/Desktop/ZeroWaiting_backend && npm run start:dev
# In another shell:
curl -H "Authorization: Bearer <valid-jwt>" http://localhost:3000/api/v1/bookings/active
```

Expected: `204 No Content` if no PENDING, otherwise JSON with `expiresAt`.

- [ ] **Step 6: Commit**

```bash
git add src/booking/booking.controller.ts src/booking/booking.service.spec.ts
git commit -m "feat(booking): add GET /bookings/active endpoint"
```

---

## Task 1.7: Test + implement `cancelOwnPending`

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.spec.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts`

- [ ] **Step 1: Write failing tests**

Append to `booking.service.spec.ts`:

```typescript
describe('cancelOwnPending', () => {
	it('transitions own PENDING booking to CANCELLED', async () => {
		const txMock = {
			booking: {
				findUnique: vi
					.fn()
					.mockResolvedValue({ userId: 'u1', status: 'PENDING' }),
				update: vi.fn().mockResolvedValue({ id: 'b1', status: 'CANCELLED' })
			}
		};
		prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));

		const result = await service.cancelOwnPending('b1', 'u1');
		expect(result.status).toBe('CANCELLED');
		expect(txMock.booking.update).toHaveBeenCalledWith({
			where: { id: 'b1' },
			data: { status: 'CANCELLED' }
		});
	});

	it('throws ForbiddenException when booking belongs to another user', async () => {
		const txMock = {
			booking: {
				findUnique: vi
					.fn()
					.mockResolvedValue({ userId: 'other', status: 'PENDING' }),
				update: vi.fn()
			}
		};
		prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));

		await expect(service.cancelOwnPending('b1', 'u1')).rejects.toThrow(
			ForbiddenException
		);
	});

	it('throws ConflictException when booking is not PENDING', async () => {
		const txMock = {
			booking: {
				findUnique: vi
					.fn()
					.mockResolvedValue({ userId: 'u1', status: 'CONFIRMED' }),
				update: vi.fn()
			}
		};
		prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));

		await expect(service.cancelOwnPending('b1', 'u1')).rejects.toThrow(
			ConflictException
		);
	});

	it('throws NotFoundException when booking does not exist', async () => {
		const txMock = {
			booking: {
				findUnique: vi.fn().mockResolvedValue(null),
				update: vi.fn()
			}
		};
		prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));

		await expect(service.cancelOwnPending('b1', 'u1')).rejects.toThrow(
			NotFoundException
		);
	});
});
```

- [ ] **Step 2: Run tests — must fail**

Run: `npm run test -- booking.service`
Expected: 4 failures.

- [ ] **Step 3: Implement method**

Add to `booking.service.ts`:

```typescript
async cancelOwnPending(id: string, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      select: { userId: true, status: true }
    });
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    if (booking.userId !== userId) {
      throw new ForbiddenException('Вы не можете отменить чужую бронь');
    }
    if (booking.status !== 'PENDING') {
      throw new ConflictException('Можно отменить только бронь в статусе PENDING');
    }
    return tx.booking.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });
  });
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `npm run test -- booking.service`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/booking/booking.service.ts src/booking/booking.service.spec.ts
git commit -m "feat(booking): add cancelOwnPending service method"
```

---

## Task 1.8: Add DELETE /v1/bookings/:id/self endpoint

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.controller.ts`

- [ ] **Step 1: Write failing controller test**

Append to `booking.service.spec.ts`:

```typescript
describe('BookingController.cancelOwn', () => {
	it('delegates to service.cancelOwnPending with user id and booking id', async () => {
		const req = { user: { id: 'u1' } } as unknown as Request;
		const spy = vi
			.spyOn(service, 'cancelOwnPending')
			.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
		await controller.cancelOwn('b1', req);
		expect(spy).toHaveBeenCalledWith('b1', 'u1');
	});
});
```

- [ ] **Step 2: Run — must fail (`cancelOwn is not a function`)**

- [ ] **Step 3: Implement controller method**

Add to `booking.controller.ts`. Insert BEFORE the existing MANAGER-only `@Delete(':id')` so route matching picks `/self` first:

```typescript
@Delete(':id/self')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Cancel own PENDING booking' })
@ApiParam({ name: 'id', type: 'string' })
@ApiResponse({ status: 200, type: BookingEntity })
@ApiResponse({ status: 403, description: 'Booking belongs to another user' })
@ApiResponse({ status: 404, description: 'Booking not found' })
@ApiResponse({ status: 409, description: 'Booking is not in PENDING status' })
cancelOwn(@Param('id') id: string, @Req() req: Request) {
  return this.bookingService.cancelOwnPending(id, req.user.id);
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `npm run test -- booking`
Expected: pass.

- [ ] **Step 5: Manual smoke test**

```bash
# create a PENDING booking, then:
curl -X DELETE -H "Authorization: Bearer <jwt>" \
  http://localhost:3000/api/v1/bookings/<booking-id>/self
```

Expected: 200 with `{ status: "CANCELLED" }`.

- [ ] **Step 6: Commit**

```bash
git add src/booking/booking.controller.ts src/booking/booking.service.spec.ts
git commit -m "feat(booking): add self-cancel endpoint DELETE /:id/self"
```

---

## Task 1.9: Enrich `findOne` with `expiresAt` for PENDING bookings

Keeps `GET /bookings/:id` consistent with `GET /bookings/active` — the `/booking/:id` page needs a source of truth for the countdown, not a frontend hardcode.

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.spec.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/generated/nestjs-dto/booking.entity.ts` OR create a wrapper DTO (prefer non-generated file).

- [ ] **Step 1: Add `expiresAt?: string` to BookingEntity Swagger surface**

If `BookingEntity` is auto-generated (`src/generated/...`), do not edit it directly. Instead, add a method-local override in controller Swagger by declaring a new `BookingWithExpiryEntity` in a non-generated file:

```typescript
// src/booking/entities/booking-with-expiry.entity.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingEntity } from '../../generated/nestjs-dto';

export class BookingWithExpiryEntity extends BookingEntity {
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		description:
			'ISO UTC timestamp when a PENDING booking will be auto-cancelled. Absent for non-PENDING bookings.'
	})
	expiresAt?: string;
}
```

- [ ] **Step 2: Share enrichment helper in the service**

In `booking.service.ts`, add a private helper and refactor both `getActivePending` and `findOne` to use it:

```typescript
private withExpiryIfPending<T extends { createdAt: Date; status: string }>(
  booking: T
): T & { expiresAt?: string } {
  if (booking.status !== 'PENDING') return booking;
  const expiresAt = new Date(
    booking.createdAt.getTime() + this.pendingTtlMinutes * 60_000
  ).toISOString();
  return { ...booking, expiresAt };
}
```

Update `getActivePending` to use the helper (replaces the inline `{ ...booking, expiresAt }` emission).

Update `findOne` (currently in `booking.service.ts`) to:

```typescript
async findOne(id: string) {
  const booking = await this.prisma.booking.findUnique({
    where: { id },
    include: { seats: { include: { seat: true } }, screening: { ... } }
  });
  if (!booking) throw new NotFoundException(`Booking ${id} not found`);
  return this.withExpiryIfPending(booking);
}
```

- [ ] **Step 3: Write test**

```typescript
describe('findOne expiry enrichment', () => {
	it('attaches expiresAt for PENDING booking', async () => {
		const createdAt = new Date('2026-04-19T10:00:00Z');
		prismaMock.booking.findUnique.mockResolvedValue({
			id: 'b1',
			status: 'PENDING',
			createdAt,
			seats: [],
			screening: {}
		} as any);
		const result = await service.findOne('b1');
		expect(result.expiresAt).toBe('2026-04-19T10:10:00.000Z');
	});

	it('omits expiresAt for CONFIRMED booking', async () => {
		prismaMock.booking.findUnique.mockResolvedValue({
			id: 'b1',
			status: 'CONFIRMED',
			createdAt: new Date(),
			seats: [],
			screening: {}
		} as any);
		const result = await service.findOne('b1');
		expect(result.expiresAt).toBeUndefined();
	});
});
```

- [ ] **Step 4: Update controller Swagger**

In `booking.controller.ts` `findOne`:

```typescript
@Get(':id')
@ApiResponse({ status: 200, type: BookingWithExpiryEntity })
findOne(@Param('id') id: string) {
  return this.bookingService.findOne(id);
}
```

Import `BookingWithExpiryEntity`.

- [ ] **Step 5: Run tests and build**

Run: `npm run test -- booking` and `npm run build`
Expected: pass + clean build.

- [ ] **Step 6: Commit**

```bash
git add src/booking/booking.service.ts src/booking/booking.service.spec.ts \
        src/booking/booking.controller.ts src/booking/entities/booking-with-expiry.entity.ts
git commit -m "feat(booking): expose expiresAt on GET /bookings/:id for PENDING"
```

---

## Task 1.10: Enrich POST /v1/bookings with one-PENDING check and structured 409

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.spec.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.controller.ts`

- [ ] **Step 1: Write failing tests**

Append:

```typescript
describe('create — conflict enrichment', () => {
	it('returns SEATS_UNAVAILABLE code + unavailableSeatIds when a seat is booked', async () => {
		// arrange: tx.$queryRawUnsafe for bookedSeats returns 2 ids
		const bookedRows = [{ seatId: 'seat-a' }, { seatId: 'seat-b' }];
		mockTransactionReturning({ bookedSeats: bookedRows, activeHolds: [] });

		await expect(
			service.create(
				{
					screeningId: 's1',
					seatIds: ['seat-a', 'seat-b', 'seat-c'],
					type: BookingType.ONLINE
				} as any,
				'u1'
			)
		).rejects.toMatchObject({
			response: {
				code: 'SEATS_UNAVAILABLE',
				unavailableSeatIds: ['seat-a', 'seat-b']
			}
		});
	});

	it('returns ACTIVE_BOOKING_EXISTS with bookingId+screeningId when user already has PENDING', async () => {
		mockTransactionReturning({
			existingPending: { id: 'b-old', screeningId: 's-other' },
			bookedSeats: [],
			activeHolds: []
		});

		await expect(
			service.create(
				{
					screeningId: 's1',
					seatIds: ['seat-x'],
					type: BookingType.ONLINE
				} as any,
				'u1'
			)
		).rejects.toMatchObject({
			response: {
				code: 'ACTIVE_BOOKING_EXISTS',
				bookingId: 'b-old',
				screeningId: 's-other'
			}
		});
	});

	it('skips one-PENDING check for RECEPTION bookings (offline)', async () => {
		mockTransactionReturning({
			existingPending: { id: 'b-old' },
			bookedSeats: [],
			activeHolds: []
		});
		// expect no throw — RECEPTION path creates booking
		await expect(
			service.create(
				{
					screeningId: 's1',
					seatIds: ['seat-x'],
					type: BookingType.RECEPTION
				} as any,
				'u1'
			)
		).resolves.toBeTruthy();
	});
});
```

(Helper `mockTransactionReturning({ ... })` — implement at top of spec file to build an inline tx mock; see existing test utilities for the file.)

- [ ] **Step 2: Run tests — must fail**

Run: `npm run test -- booking.service`
Expected: 3 failures.

- [ ] **Step 3: Modify `create` to include the checks**

Inside the existing `prisma.$transaction` callback, BEFORE the current `FOR UPDATE` queries:

```typescript
if (userId && type === BookingType.ONLINE) {
	const ttlMs = this.pendingTtlMinutes * 60_000;
	const existingPending = await tx.booking.findFirst({
		where: {
			userId,
			status: 'PENDING',
			createdAt: { gte: new Date(Date.now() - ttlMs) }
		},
		select: { id: true, screeningId: true }
	});
	if (existingPending) {
		throw new ConflictException({
			code: 'ACTIVE_BOOKING_EXISTS',
			message: 'У вас есть неоплаченная бронь',
			bookingId: existingPending.id,
			screeningId: existingPending.screeningId
		});
	}
}
```

Replace the current generic `throw new ConflictException('Some seats are already booked...')` with the structured body:

```typescript
if (bookedSeats.length > 0) {
	throw new ConflictException({
		code: 'SEATS_UNAVAILABLE',
		message: 'Некоторые места уже забронированы',
		unavailableSeatIds: bookedSeats.map((b) => b.seatId)
	});
}
```

Same replacement pattern for the `activeHolds` (SeatHold) branch during Phase 1 (keeps compatibility):

```typescript
if (activeHolds.length > 0) {
	throw new ConflictException({
		code: 'SEATS_UNAVAILABLE',
		message: 'Некоторые места забронированы другим пользователем',
		unavailableSeatIds: activeHolds.map((h) => h.seatId) // requires returning seatId from the FOR UPDATE query
	});
}
```

Update the `$queryRawUnsafe` SELECT to also return `seatId`:

```typescript
const activeHolds = await tx.$queryRawUnsafe<{ id: string; seatId: string }[]>(
	`SELECT sh."id", sh."seatId" FROM "SeatHold" sh
   WHERE sh."screeningId"::text = $1
     AND sh."seatId"::text = ANY($2::text[])
     AND sh."expiresAt" > NOW()
     ${userId ? 'AND sh."userId"::text != $3' : ''}
   FOR UPDATE`,
	screeningId,
	seatIds,
	...(userId ? [userId] : [])
);

const bookedSeats = await tx.$queryRawUnsafe<{ id: string; seatId: string }[]>(
	`SELECT bs."id", bs."seatId" FROM "BookingSeat" bs
   JOIN "Booking" b ON b."id" = bs."bookingId"
   WHERE bs."seatId"::text = ANY($1::text[])
     AND b."screeningId"::text = $2
     AND b."status" != 'CANCELLED'
   FOR UPDATE`,
	seatIds,
	screeningId
);
```

- [ ] **Step 4: Update Swagger on controller's `@Post()`**

Wrap both 409 variants using `getSchemaPath`:

```typescript
import { getSchemaPath, ApiExtraModels } from '@nestjs/swagger';
import {
  ActiveBookingExistsErrorDto,
  SeatsUnavailableErrorDto
} from './dto/booking-conflict-response.dto';

@ApiExtraModels(ActiveBookingExistsErrorDto, SeatsUnavailableErrorDto)
@Post()
@ApiOperation({ summary: 'Create a booking' })
@ApiResponse({ status: 201, type: BookingEntity })
@ApiResponse({
  status: 409,
  schema: {
    oneOf: [
      { $ref: getSchemaPath(ActiveBookingExistsErrorDto) },
      { $ref: getSchemaPath(SeatsUnavailableErrorDto) }
    ]
  }
})
create(@Req() req: Request, @Body() dto: CreateBookingDto) {
  return this.bookingService.create(dto, req.user.id);
}
```

- [ ] **Step 5: Run tests — must pass**

Run: `npm run test -- booking`
Expected: all pass, including the 3 new cases.

- [ ] **Step 6: Commit**

```bash
git add src/booking/booking.service.ts src/booking/booking.service.spec.ts src/booking/booking.controller.ts
git commit -m "feat(booking): structured 409 codes + one-PENDING-per-user guard"
```

---

## Task 1.11: Add `holdTtlMinutes` to available-seats envelope

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/src/hall/entities/available-seats-envelope.entity.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/screening/screening.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/screening/screening.service.spec.ts`

- [ ] **Step 1: Write failing test**

Append to `screening.service.spec.ts`:

```typescript
it('includes holdTtlMinutes from config in envelope', async () => {
	prismaMock.screening.findUnique.mockResolvedValue({
		id: 's1',
		hallId: 'h1',
		hall: { id: 'h1', layoutRows: 10, layoutCols: 10 }
	});
	prismaMock.bookingSeat.findMany.mockResolvedValue([]);
	prismaMock.seatHold.findMany.mockResolvedValue([]);
	prismaMock.seat.findMany.mockResolvedValue([]);

	const result = await service.findAvailableSeats('s1');
	expect(result.holdTtlMinutes).toBe(10);
});
```

- [ ] **Step 2: Run — must fail (`holdTtlMinutes` is undefined)**

- [ ] **Step 3: Add field to entity**

`src/hall/entities/available-seats-envelope.entity.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { AvailableSeatEntity } from '../../screening/entities/available-seat.entity';

export class HallLayoutMetaEntity {
	@ApiProperty() layoutRows!: number;
	@ApiProperty() layoutCols!: number;
}

export class AvailableSeatsEnvelopeEntity {
	@ApiProperty({ type: HallLayoutMetaEntity }) hall!: HallLayoutMetaEntity;
	@ApiProperty({ type: [AvailableSeatEntity] }) seats!: AvailableSeatEntity[];
	@ApiProperty({
		type: 'integer',
		description:
			'Minutes a PENDING booking / hold stays valid on this screening'
	})
	holdTtlMinutes!: number;
}
```

- [ ] **Step 4: Return field from service**

In `screening.service.ts` `findAvailableSeats`, at the bottom `return` statement:

```typescript
return {
	hall: {
		layoutRows: screening.hall.layoutRows,
		layoutCols: screening.hall.layoutCols
	},
	seats,
	holdTtlMinutes: this.pendingTtlMinutes
};
```

Ensure the service constructor reads TTL (add if missing):

```typescript
private readonly pendingTtlMinutes: number;

constructor(
  private readonly prisma: PrismaService,
  private readonly config: ConfigService
) {
  this.pendingTtlMinutes =
    this.config.get<number>('BOOKING_PENDING_TTL_MINUTES') ??
    this.config.get<number>('SEAT_HOLD_TTL_MINUTES', 10);
}
```

- [ ] **Step 5: Run — must pass**

Run: `npm run test -- screening.service`

- [ ] **Step 6: Commit**

```bash
git add src/hall/entities/available-seats-envelope.entity.ts \
        src/screening/screening.service.ts \
        src/screening/screening.service.spec.ts
git commit -m "feat(screening): expose holdTtlMinutes in available-seats envelope"
```

---

## Task 1.12: Wire OptionalJwtAuthGuard on public available-seats

Enables `HELD_BY_YOU` detection for unauthenticated public endpoint when a token is present.

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/src/screening/public-screenings.controller.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/screening/screening.controller.ts`

- [ ] **Step 1: Update public controller**

```typescript
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiBearerAuth
} from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
// ...existing imports...

@ApiTags('Public')
@Controller('public/screenings')
export class PublicScreeningsController {
	constructor(private readonly screeningService: ScreeningService) {}

	// ...existing findAll, findOne unchanged...

	@Get(':id/available-seats')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Get available seats for a screening (public, optional auth)'
	})
	@ApiParam({ name: 'id', type: 'string' })
	@ApiResponse({ status: 200, type: AvailableSeatsEnvelopeEntity })
	findAvailableSeats(@Param('id') id: string, @Req() req: Request) {
		return this.screeningService.findAvailableSeats(id, req.user?.id);
	}
}
```

- [ ] **Step 2: Update authenticated controller** (pass userId that's already available)

`screening.controller.ts`:

```typescript
@Get(':id/available-seats')
@ApiOperation({ summary: 'Get available seats for a screening' })
@ApiParam({ name: 'id', type: 'string' })
@ApiResponse({ status: 200, type: AvailableSeatsEnvelopeEntity })
findAvailableSeats(@Param('id') id: string, @Req() req: Request) {
  return this.screeningService.findAvailableSeats(id, req.user.id);
}
```

- [ ] **Step 3: Run existing screening tests — no regression**

Run: `npm run test -- screening`

- [ ] **Step 4: Commit**

```bash
git add src/screening/public-screenings.controller.ts src/screening/screening.controller.ts
git commit -m "feat(screening): optional auth on public available-seats to surface HELD_BY_YOU"
```

---

## Task 1.13: Phase 1 deploy gate (manual)

- [ ] **Step 1: Lint & type-check**

```bash
cd ~/Desktop/ZeroWaiting_backend
npm run build
```

Expected: clean build with zero TypeScript errors.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 3: Verify Swagger**

Start server: `npm run start:dev`. Open `http://localhost:3000/api/docs`. Confirm:

- `GET /bookings/active` present with 200/204 responses.
- `DELETE /bookings/:id/self` present.
- `POST /bookings` 409 shows `oneOf` with `ActiveBookingExistsErrorDto` / `SeatsUnavailableErrorDto`.
- `GET /public/screenings/:id/available-seats` response includes `holdTtlMinutes`.

- [ ] **Step 4: Deploy to production**

Follow standard deploy pipeline. Confirm the old frontend still works (it does not call any new endpoints).

- [ ] **Step 5: Monitor logs 24h**

Watch for unexpected 500s on `/bookings/active` or the enriched 409 paths.

---

# PHASE 2 — Frontend rewrite

Prerequisite: Phase 1 deployed and stable. Work happens in `/Users/elcho/Desktop/ZeroWaiting_frontend`.

## Task 2.1: Regenerate API client

- [ ] **Step 1: Point Orval to local or production**

```bash
cd /Users/elcho/Desktop/ZeroWaiting_frontend
VITE_API_BASE_URL=https://api-zerowaiting.elcho.dev bun run generate:api
```

Expected: new files appear in `src/api/endpoints/bookings.ts` with `createGetBookingsActiveV1`, `createDeleteBookingsByIdSelfV1Mutation`. New models appear in `src/api/model/`: `ActiveBookingEntity`, `ActiveBookingExistsErrorDto`, `SeatsUnavailableErrorDto`, updated `AvailableSeatsEnvelopeEntity`.

- [ ] **Step 2: Verify type-check**

Run: `bun run check`
Expected: no errors. Any errors indicate mismatch between backend Swagger and frontend usage — do not proceed until clean.

- [ ] **Step 3: Commit**

```bash
git add src/api/
git commit -m "chore(api): regenerate client with new booking endpoints"
```

---

## Task 2.2: Test + implement `createPendingTimer` utility

**Files:**

- Create: `src/lib/utils/pending-timer.svelte.ts`
- Create: `src/lib/utils/pending-timer.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/utils/pending-timer.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Pure helpers extracted from the timer factory — testable without Svelte runtime.
import { formatRemaining, computeRemaining } from './pending-timer.svelte';

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
```

- [ ] **Step 2: Run — must fail (module does not exist)**

Run: `bun run test -- pending-timer`
Expected: failure to resolve module.

- [ ] **Step 3: Implement the file**

Create `src/lib/utils/pending-timer.svelte.ts`:

```typescript
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
	const isExpired = $derived(
		remainingMs === 0 && expiresAtIso() !== null && expiresAtIso() !== undefined
	);

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
```

- [ ] **Step 4: Run tests — must pass**

Run: `bun run test -- pending-timer`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/pending-timer.svelte.ts src/lib/utils/pending-timer.spec.ts
git commit -m "feat(booking): add pending-timer utility with runes + pure helpers"
```

---

## Task 2.3: Test + implement `mapSeatIdsToLabels`

**Files:**

- Create: `src/lib/utils/seat-label.ts`
- Create: `src/lib/utils/seat-label.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { mapSeatIdsToLabels } from './seat-label';
import type { AvailableSeatEntity } from '@/api/model';

const mk = (id: string, row: number, seat: number): AvailableSeatEntity =>
	({
		id,
		rowNumber: row,
		seatNumber: seat
	}) as AvailableSeatEntity;

describe('mapSeatIdsToLabels', () => {
	it('returns labels in "row-seat" format', () => {
		const seats = [mk('a', 5, 3), mk('b', 5, 4), mk('c', 6, 1)];
		expect(mapSeatIdsToLabels(['a', 'b'], seats)).toEqual(['5-3', '5-4']);
	});
	it('skips ids not present in the seat list', () => {
		const seats = [mk('a', 5, 3)];
		expect(mapSeatIdsToLabels(['a', 'missing'], seats)).toEqual(['5-3']);
	});
	it('preserves the order of the input ids', () => {
		const seats = [mk('a', 5, 3), mk('b', 5, 4)];
		expect(mapSeatIdsToLabels(['b', 'a'], seats)).toEqual(['5-4', '5-3']);
	});
	it('returns empty array when seats undefined', () => {
		expect(mapSeatIdsToLabels(['a'], undefined)).toEqual([]);
	});
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Implement**

Create `src/lib/utils/seat-label.ts`:

```typescript
import type { AvailableSeatEntity } from '@/api/model';

export const mapSeatIdsToLabels = (
	seatIds: string[],
	seats: AvailableSeatEntity[] | undefined
): string[] => {
	if (!seats) return [];
	const byId = new Map(seats.map((s) => [s.id, s]));
	return seatIds
		.map((id) => byId.get(id))
		.filter((s): s is AvailableSeatEntity => Boolean(s))
		.map((s) => `${s.rowNumber}-${s.seatNumber}`);
};
```

- [ ] **Step 4: Run — must pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/seat-label.ts src/lib/utils/seat-label.spec.ts
git commit -m "feat(booking): add mapSeatIdsToLabels utility"
```

---

## Task 2.4: Type guards for booking conflict response

**Files:**

- Create: `src/lib/constants/booking-conflict.ts`

- [ ] **Step 1: Implement type guards**

```typescript
import { AxiosError } from 'axios';
import type {
	ActiveBookingExistsErrorDto,
	SeatsUnavailableErrorDto
} from '@/api/model';

export type BookingConflictBody =
	| ActiveBookingExistsErrorDto
	| SeatsUnavailableErrorDto;

export const getBookingConflict = (
	error: unknown
): BookingConflictBody | null => {
	if (!(error instanceof AxiosError)) return null;
	if (error.response?.status !== 409) return null;
	const data = error.response.data as Partial<BookingConflictBody> | undefined;
	if (!data || typeof data.code !== 'string') return null;
	if (
		data.code === 'ACTIVE_BOOKING_EXISTS' ||
		data.code === 'SEATS_UNAVAILABLE'
	) {
		return data as BookingConflictBody;
	}
	return null;
};

export const isSeatsUnavailable = (
	body: BookingConflictBody
): body is SeatsUnavailableErrorDto => body.code === 'SEATS_UNAVAILABLE';

export const isActiveBookingExists = (
	body: BookingConflictBody
): body is ActiveBookingExistsErrorDto => body.code === 'ACTIVE_BOOKING_EXISTS';
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants/booking-conflict.ts
git commit -m "feat(booking): add 409 conflict discriminator helpers"
```

---

## Task 2.5: Rewrite `seat-selection.svelte.ts`

**Files:**

- Modify: `src/lib/stores/seat-selection.svelte.ts`

- [ ] **Step 1: Replace entire contents**

```typescript
let screeningId = $state<string | null>(null);
let selectedIds = $state<string[]>([]);

export const seatSelection = {
	get selectedIds() {
		return selectedIds;
	},
	get count() {
		return selectedIds.length;
	},
	get isEmpty() {
		return selectedIds.length === 0;
	},

	bind: (id: string) => {
		if (screeningId !== id) {
			screeningId = id;
			selectedIds = [];
		}
	},

	toggle: (seatId: string) => {
		selectedIds = selectedIds.includes(seatId)
			? selectedIds.filter((id) => id !== seatId)
			: [...selectedIds, seatId];
	},

	remove: (seatId: string) => {
		selectedIds = selectedIds.filter((id) => id !== seatId);
	},

	removeMany: (seatIds: string[]) => {
		if (seatIds.length === 0) return;
		const set = new Set(seatIds);
		selectedIds = selectedIds.filter((id) => !set.has(id));
	},

	clear: () => {
		selectedIds = [];
	}
};
```

- [ ] **Step 2: Check that no consumer outside `/screenings/[id]/+page.svelte` imports the old API**

Run: `bun run check`

If errors in other files — they reference `heldSeatIds`, `addHeldSeat`, `removeHeldSeat`, `holdSeats`, `releaseAll`, `isExpired`, `formattedTime`, `remainingSeconds`. Apart from the screening page (Task 2.8), delete those references — the new timer lives in `booking/[bookingId]/+page.svelte` and the banner.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/seat-selection.svelte.ts
git commit -m "refactor(booking): strip holds from seat-selection store"
```

---

## Task 2.6: Delete dead booking-flow store

**Files:**

- Delete: `src/lib/stores/booking-flow.svelte.ts`

- [ ] **Step 1: Confirm no imports**

Run: `grep -r "booking-flow" src/` (no matches expected; this store was not used).

- [ ] **Step 2: Delete file**

```bash
rm src/lib/stores/booking-flow.svelte.ts
```

- [ ] **Step 3: Type-check**

Run: `bun run check` — expect no new errors.

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/stores/booking-flow.svelte.ts
git commit -m "refactor(booking): remove unused booking-flow store"
```

---

## Task 2.7: Create active-booking store provider

**Files:**

- Create: `src/lib/stores/active-booking.svelte.ts`

- [ ] **Step 1: Implement**

```typescript
import { getContext, setContext } from 'svelte';
import { crmQueryApi } from '@/api/endpoints';

const KEY = Symbol('zerowaiting-active-booking');

type ActiveBookingQuery = ReturnType<
	typeof crmQueryApi.createGetBookingsActiveV1
>;

export const provideActiveBooking = (): ActiveBookingQuery => {
	const query = crmQueryApi.createGetBookingsActiveV1(undefined, () => ({
		query: {
			refetchOnWindowFocus: true,
			refetchInterval: 60_000,
			staleTime: 30_000,
			retry: false
		}
	}));
	setContext(KEY, query);
	return query;
};

export const useActiveBooking = (): ActiveBookingQuery => {
	const query = getContext<ActiveBookingQuery | undefined>(KEY);
	if (!query) {
		throw new Error(
			'useActiveBooking must be called inside provideActiveBooking'
		);
	}
	return query;
};
```

> **Note:** The exact name of the generated query hook (`createGetBookingsActiveV1`) must match Orval's output. Confirm with `grep "BookingsActive" src/api/endpoints/bookings.ts` after Task 2.1.

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/active-booking.svelte.ts
git commit -m "feat(booking): active-booking store with context provider"
```

---

## Task 2.8: Implement `PendingBookingTimer.svelte`

**Files:**

- Create: `src/components/booking/PendingBookingTimer.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
	import { createPendingTimer } from '@/lib/utils/pending-timer.svelte';

	interface Props {
		expiresAt: string | null | undefined;
		size?: 'sm' | 'md' | 'lg';
	}

	let { expiresAt, size = 'md' }: Props = $props();

	const timer = createPendingTimer(() => expiresAt);

	const state = $derived.by(() => {
		if (timer.isExpired) return 'expired';
		if (timer.remainingMs < 30_000) return 'critical';
		if (timer.remainingMs < 120_000) return 'warning';
		return 'normal';
	});
</script>

<div
	class="PendingBookingTimer"
	class:sm={size === 'sm'}
	class:lg={size === 'lg'}
	class:expired={state === 'expired'}
	class:critical={state === 'critical'}
	class:warning={state === 'warning'}
>
	{#if state === 'expired'}
		<span class="label">Истекло</span>
	{:else}
		<span class="value">{timer.formatted}</span>
	{/if}
</div>

<style lang="scss">
	.PendingBookingTimer {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--primary);
		font-size: 1.125rem;

		&.sm {
			font-size: 0.875rem;
		}
		&.lg {
			font-size: 1.5rem;
		}

		&.warning {
			color: #f59e0b;
		}
		&.critical {
			color: #ef4444;
			animation: pulse 1s ease-in-out infinite;
		}
		&.expired {
			color: rgba(255, 255, 255, 0.5);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
</style>
```

> **IMPORTANT:** `state` must be a plain `$derived` — if lint complains about `() =>`, use `$derived.by(() => ...)`.

- [ ] **Step 2: Type-check**

Run: `bun run check`

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/PendingBookingTimer.svelte
git commit -m "feat(booking): add PendingBookingTimer widget with threshold colors"
```

---

## Task 2.9: Implement `ActiveBookingConflictDialog.svelte`

**Files:**

- Create: `src/components/booking/ActiveBookingConflictDialog.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { _ } from 'svelte-i18n';
	import Modal from '@/components/ui/Modal.svelte';
	import Button from '@/components/ui/Button.svelte';
	import PendingBookingTimer from './PendingBookingTimer.svelte';
	import { crmQueryApi } from '@/api/endpoints';
	import { getErrorMessage } from '@/lib/utils/error';
	import toast from 'svelte-french-toast';

	interface Props {
		open: boolean;
		existingBookingId: string;
		existingScreeningId: string;
		isSameScreening: boolean;
		expiresAt: string | null;
		existingSeatLabels: string[];
		onClose: () => void;
		onRebook: () => Promise<void>;
	}

	let {
		open,
		existingBookingId,
		existingScreeningId,
		isSameScreening,
		expiresAt,
		existingSeatLabels,
		onClose,
		onRebook
	}: Props = $props();

	let isCancelling = $state(false);
	const queryClient = useQueryClient();
	const cancelMutation = crmQueryApi.createDeleteBookingsByIdSelfV1Mutation();

	const handleReturn = () => {
		onClose();
		goto(`/booking/${existingBookingId}`);
	};

	const handleCancelAndRebook = async () => {
		if (isCancelling) return;
		isCancelling = true;
		try {
			await cancelMutation.mutateAsync({ id: existingBookingId });
			queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
			queryClient.invalidateQueries({
				queryKey: [
					`/api/v1/public/screenings/${existingScreeningId}/available-seats`
				]
			});
			onClose();
			await onRebook();
		} catch (error) {
			toast.error(getErrorMessage(error, $_('booking.errors.cancel_failed')));
		} finally {
			isCancelling = false;
		}
	};
</script>

<Modal
	{open}
	{onClose}
	title={isSameScreening
		? $_('booking.conflict_dialog.same_screening_title')
		: $_('booking.conflict_dialog.other_screening_title')}
>
	<div class="ActiveBookingConflictDialog">
		<p class="body">
			{isSameScreening
				? $_('booking.conflict_dialog.same_screening_body', {
						values: { seats: existingSeatLabels.join(', ') }
					})
				: $_('booking.conflict_dialog.other_screening_body')}
		</p>

		{#if expiresAt}
			<div class="timer_row">
				<span class="label">{$_('booking.conflict_dialog.remaining')}</span>
				<PendingBookingTimer {expiresAt} size="sm" />
			</div>
		{/if}

		<div class="actions">
			<Button variant="primary" onclick={handleReturn}>
				{$_('booking.conflict_dialog.return_to_payment_cta')}
			</Button>
			<Button
				variant="ghost"
				onclick={handleCancelAndRebook}
				disabled={isCancelling}
			>
				{$_('booking.conflict_dialog.cancel_and_rebook_cta')}
			</Button>
		</div>
	</div>
</Modal>

<style lang="scss">
	.ActiveBookingConflictDialog {
		display: flex;
		flex-direction: column;
		gap: 16px;

		.body {
			color: rgba(255, 255, 255, 0.8);
			line-height: 1.5;
		}

		.timer_row {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 12px 16px;
			background: rgba(139, 92, 246, 0.1);
			border: 1px solid rgba(139, 92, 246, 0.2);
			border-radius: 8px;

			.label {
				color: rgba(255, 255, 255, 0.7);
				font-size: 0.875rem;
			}
		}

		.actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}
	}
</style>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/ActiveBookingConflictDialog.svelte
git commit -m "feat(booking): add ActiveBookingConflictDialog modal"
```

---

## Task 2.10: Implement `ActiveBookingBanner.svelte`

**Files:**

- Create: `src/components/booking/ActiveBookingBanner.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { _, locale } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { useActiveBooking } from '@/lib/stores/active-booking.svelte';
	import { createPendingTimer } from '@/lib/utils/pending-timer.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { getErrorMessage } from '@/lib/utils/error';
	import Button from '@/components/ui/Button.svelte';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';

	const query = useActiveBooking();
	const queryClient = useQueryClient();
	const cancelMutation = crmQueryApi.createDeleteBookingsByIdSelfV1Mutation();

	const booking = $derived(query.data);
	const hidden = $derived(
		page.url.pathname.startsWith('/booking/') ||
			page.url.pathname.startsWith('/admin') ||
			!booking
	);

	const timer = createPendingTimer(() => booking?.expiresAt);

	const movieTitle = $derived(
		booking?.screening?.movie
			? getLocalizedValue(
					booking.screening.movie.title as Record<string, string>,
					$locale
				)
			: ''
	);

	const state = $derived.by(() => {
		if (timer.remainingMs < 30_000) return 'critical';
		if (timer.remainingMs < 120_000) return 'warning';
		return 'normal';
	});

	let isCancelling = $state(false);

	const handleCancel = async () => {
		if (!booking || isCancelling) return;
		isCancelling = true;
		try {
			await cancelMutation.mutateAsync({ id: booking.id });
			queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
			queryClient.invalidateQueries({
				queryKey: [
					`/api/v1/public/screenings/${booking.screeningId}/available-seats`
				]
			});
			toast.success($_('booking.cancel_success'));
		} catch (error) {
			toast.error(getErrorMessage(error, $_('booking.errors.cancel_failed')));
		} finally {
			isCancelling = false;
		}
	};

	const handlePay = () => {
		if (!booking) return;
		goto(`/booking/${booking.id}`);
	};
</script>

{#if !hidden && booking}
	<div
		class="ActiveBookingBanner"
		class:warning={state === 'warning'}
		class:critical={state === 'critical'}
	>
		<div class="info">
			<div class="title">
				<Icon icon="lucide:clock" width={16} />
				{$_('booking.active_banner.title')}
			</div>
			<div class="meta">
				{movieTitle} · <span class="timer">{timer.formatted}</span>
			</div>
		</div>
		<div class="actions">
			<Button size="sm" onclick={handlePay}>
				{$_('booking.active_banner.pay_cta')}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onclick={handleCancel}
				disabled={isCancelling}
			>
				{$_('booking.active_banner.cancel_cta')}
			</Button>
		</div>
	</div>
{/if}

<style lang="scss">
	.ActiveBookingBanner {
		position: fixed;
		right: 24px;
		bottom: 24px;
		max-width: 360px;
		z-index: 40;

		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;

		background: rgba(139, 92, 246, 0.12);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(139, 92, 246, 0.2);
		border-radius: 12px;
		box-shadow:
			0 12px 32px rgba(0, 0, 0, 0.35),
			inset 0 1px rgba(255, 255, 255, 0.05);

		animation: slide_in 200ms ease-out;

		.info {
			.title {
				display: flex;
				align-items: center;
				gap: 6px;
				font-size: 0.8125rem;
				color: rgba(255, 255, 255, 0.7);
				text-transform: uppercase;
				letter-spacing: 0.04em;
			}
			.meta {
				margin-top: 4px;
				font-size: 0.9375rem;
				color: white;
				.timer {
					font-variant-numeric: tabular-nums;
				}
			}
		}

		.actions {
			display: flex;
			gap: 8px;
		}

		&.warning {
			border-color: rgba(245, 158, 11, 0.4);
			.timer {
				color: #f59e0b;
			}
		}
		&.critical {
			border-color: rgba(239, 68, 68, 0.5);
			.timer {
				color: #ef4444;
				animation: pulse 1s ease-in-out infinite;
			}
		}

		@media (max-width: 640px) {
			inset: auto 16px 16px 16px;
			max-width: none;

			.actions {
				flex-direction: column;
			}
		}
	}

	@keyframes slide_in {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
</style>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/ActiveBookingBanner.svelte
git commit -m "feat(booking): add floating ActiveBookingBanner"
```

---

## Task 2.11: Wire active-booking + banner in `(client)/+layout.svelte`

**Files:**

- Modify: `src/routes/(client)/+layout.svelte`

- [ ] **Step 1: Replace script block**

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import Header from '@/components/client/layout/Header.svelte';
	import Footer from '@/components/client/layout/Footer.svelte';
	import ScrollProgress from '@/components/client/layout/ScrollProgress.svelte';
	import HomeAmbient from './(home)/components/HomeAmbient.svelte';
	import ActiveBookingBanner from '@/components/booking/ActiveBookingBanner.svelte';
	import { provideActiveBooking } from '@/lib/stores/active-booking.svelte';

	let { children } = $props();

	let headerHeight = $state(0);

	provideActiveBooking();
</script>
```

Append the banner outside `<main>`, inside `.layout`:

```svelte
<div class="layout">
	<Header bind:height={headerHeight} />
	<main
		class="main"
		class:active={page.url.pathname === '/'}
		style:--header-height="{headerHeight}px"
	>
		{@render children()}
	</main>
	<Footer />
	<ActiveBookingBanner />
</div>
```

- [ ] **Step 2: Type-check & smoke run**

```bash
bun run check
bun run dev
```

Open any client page (`/`, `/movies`). Confirm no runtime errors — banner is invisible when no PENDING booking.

- [ ] **Step 3: Commit**

```bash
git add src/routes/(client)/+layout.svelte
git commit -m "feat(booking): wire active-booking provider + banner in client layout"
```

---

## Task 2.12: Rewrite screenings page — remove holdMutation, Continue uses POST /bookings

**Files:**

- Modify: `src/routes/(client)/screenings/[id]/+page.svelte`

- [ ] **Step 1: Update `<script>` block (replace seat-selection logic)**

Find and replace the current handlers. Complete new script shape (only the parts that change; keep existing `screeningQuery`, `seatsQuery`, derived values, `isPastCutoff`, etc.):

```typescript
// REMOVE these imports / lines:
//   import { seatSelection } from '@/lib/stores/seat-selection.svelte';  // still import, but new API
//   const holdMutation = crmQueryApi.createPostScreeningsByScreeningIdSeatHoldsV1Mutation();
//   local `selectedSeatIds` + `totalPrice` derived from it

// ADD:
import { seatSelection } from '@/lib/stores/seat-selection.svelte';
import { useQueryClient } from '@tanstack/svelte-query';
import {
	getBookingConflict,
	isSeatsUnavailable,
	isActiveBookingExists
} from '@/lib/constants/booking-conflict';
import { mapSeatIdsToLabels } from '@/lib/utils/seat-label';
import ActiveBookingConflictDialog from '@/components/booking/ActiveBookingConflictDialog.svelte';

const queryClient = useQueryClient();
const bookingMutation = crmQueryApi.createPostBookingsV1Mutation();

$effect(() => {
	if (screeningId) seatSelection.bind(screeningId);
});

const totalPrice = $derived.by(() => {
	const price = screening?.price ? Number(screening.price) : 0;
	return seatSelection.count * price;
});

// Dialog state
let conflictOpen = $state(false);
let conflictData = $state<{
	existingBookingId: string;
	existingScreeningId: string;
	isSameScreening: boolean;
	expiresAt: string | null;
	existingSeatLabels: string[];
} | null>(null);

const onSeatClick = (seatId: string) => {
	if (isPastCutoff) {
		toast.error($_(cutoffMessageKey));
		return;
	}
	if (!requireAuth('Войдите в аккаунт, чтобы выбрать место')) return;
	seatSelection.toggle(seatId);
};

const handleBookingConflict = (error: unknown) => {
	const body = getBookingConflict(error);
	if (!body) {
		toast.error(getErrorMessage(error, $_('booking.errors.generic')));
		return;
	}

	if (isSeatsUnavailable(body)) {
		const labels = mapSeatIdsToLabels(body.unavailableSeatIds, envelope?.seats);
		seatSelection.removeMany(body.unavailableSeatIds);
		queryClient.invalidateQueries({
			queryKey: [`/api/v1/public/screenings/${screeningId}/available-seats`]
		});
		toast.error(
			$_('booking.errors.seats_unavailable', {
				values: { seats: labels.join(', ') }
			})
		);
		return;
	}

	if (isActiveBookingExists(body)) {
		const activeQueryData = queryClient.getQueryData([
			'/api/v1/bookings/active'
		]) as
			| {
					id: string;
					screeningId: string;
					expiresAt: string;
					seats?: Array<{ seat: { rowNumber: number; seatNumber: number } }>;
			  }
			| undefined;
		conflictData = {
			existingBookingId: body.bookingId,
			existingScreeningId: body.screeningId,
			isSameScreening: body.screeningId === screeningId,
			expiresAt: activeQueryData?.expiresAt ?? null,
			existingSeatLabels:
				activeQueryData?.seats?.map(
					(bs) => `${bs.seat.rowNumber}-${bs.seat.seatNumber}`
				) ?? []
		};
		conflictOpen = true;
		queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
	}
};

const handleContinue = async () => {
	if (seatSelection.isEmpty) return;
	if (isPastCutoff) {
		toast.error($_(cutoffMessageKey));
		return;
	}
	if (!requireAuth('Войдите в аккаунт, чтобы продолжить бронирование')) return;

	try {
		const booking = await bookingMutation.mutateAsync({
			data: {
				screeningId: screeningId!,
				type: 'ONLINE',
				seatIds: seatSelection.selectedIds
			}
		});
		queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
		queryClient.invalidateQueries({
			queryKey: [`/api/v1/public/screenings/${screeningId}/available-seats`]
		});
		seatSelection.clear();
		goto(`/booking/${booking.id}`);
	} catch (error) {
		handleBookingConflict(error);
	}
};

const handleRebookAfterConflict = async () => {
	await handleContinue();
};
```

- [ ] **Step 2: Update markup**

In the `<SeatMap>` usage, replace `selectedIds={selectedSeatIds}` with `selectedIds={seatSelection.selectedIds}`; replace `onselect={handleSelectSeat} ondeselect={handleDeselectSeat}` with `onseatclick={onSeatClick}`. The SeatMap's own `handleClick` will need updating too (Task 2.13).

In the bottom action bar, update:

```svelte
<Button
	onclick={handleContinue}
	disabled={seatSelection.isEmpty || bookingMutation.isPending || isPastCutoff}
>
	{$_('screening.continueCta')}
</Button>
```

At the bottom of the template add the dialog:

```svelte
{#if conflictData}
	<ActiveBookingConflictDialog
		open={conflictOpen}
		existingBookingId={conflictData.existingBookingId}
		existingScreeningId={conflictData.existingScreeningId}
		isSameScreening={conflictData.isSameScreening}
		expiresAt={conflictData.expiresAt}
		existingSeatLabels={conflictData.existingSeatLabels}
		onClose={() => (conflictOpen = false)}
		onRebook={handleRebookAfterConflict}
	/>
{/if}
```

- [ ] **Step 3: Type-check**

Run: `bun run check`
Expected: only the SeatMap.svelte errors (covered in next task) remain.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(client)/screenings/[id]/+page.svelte
git commit -m "refactor(screenings): local selection + bulk POST /bookings on Continue"
```

---

## Task 2.13: Update `SeatMap.svelte` to use single `onseatclick`

**Files:**

- Modify: `src/routes/(client)/screenings/[id]/components/SeatMap.svelte`

- [ ] **Step 1: Replace props**

```typescript
interface Props {
	seats: AvailableSeatEntity[];
	selectedIds: string[];
	disabled?: boolean;
	onseatclick: (seatId: string) => void;
}

let { seats, selectedIds, disabled = false, onseatclick }: Props = $props();
```

- [ ] **Step 2: Replace `handleClick`**

```typescript
const handleClick = (seat: AvailableSeatEntity) => {
	if (disabled) return;
	if (isDisabled(seat)) return;
	onseatclick(seat.id);
};
```

Delete `onselect`, `ondeselect` — the toggle logic now lives in the store.

- [ ] **Step 3: Type-check**

Run: `bun run check`

- [ ] **Step 4: Commit**

```bash
git add src/routes/(client)/screenings/[id]/components/SeatMap.svelte
git commit -m "refactor(screenings): SeatMap uses single onseatclick prop"
```

---

## Task 2.14: Implement `ExpiredBookingView.svelte`

**Files:**

- Create: `src/components/booking/ExpiredBookingView.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import Button from '@/components/ui/Button.svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		screeningId: string;
	}

	let { screeningId }: Props = $props();

	const handleSelectAgain = () => {
		goto(`/screenings/${screeningId}`);
	};
</script>

<div class="ExpiredBookingView">
	<div class="icon">
		<Icon icon="lucide:clock-x" width={48} />
	</div>
	<h2 class="title">{$_('booking.expired_view.title')}</h2>
	<p class="subtitle">{$_('booking.expired_view.subtitle')}</p>
	<Button onclick={handleSelectAgain}>
		{$_('booking.expired_view.select_again_cta')}
	</Button>
</div>

<style lang="scss">
	.ExpiredBookingView {
		max-width: 420px;
		margin: 80px auto;
		text-align: center;
		padding: 32px;

		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(139, 92, 246, 0.15);
		border-radius: 16px;
		backdrop-filter: blur(10px);

		.icon {
			color: rgba(255, 255, 255, 0.6);
			margin-bottom: 16px;
		}
		.title {
			font-size: 1.5rem;
			color: white;
			margin-bottom: 8px;
		}
		.subtitle {
			color: rgba(255, 255, 255, 0.7);
			line-height: 1.5;
			margin-bottom: 24px;
		}
	}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/booking/ExpiredBookingView.svelte
git commit -m "feat(booking): add ExpiredBookingView component"
```

---

## Task 2.15: Rewrite `/booking/[bookingId]/+page.svelte` — timer, cancel, expired polling

**Files:**

- Modify: `src/routes/(client)/booking/[bookingId]/+page.svelte`

- [ ] **Step 1: Update script imports and query options**

At top of `<script>`, add:

```typescript
import { useQueryClient } from '@tanstack/svelte-query';
import PendingBookingTimer from '@/components/booking/PendingBookingTimer.svelte';
import ExpiredBookingView from '@/components/booking/ExpiredBookingView.svelte';
import Popconfirm from '@/components/ui/Popconfirm.svelte';
import { createPendingTimer } from '@/lib/utils/pending-timer.svelte';

const queryClient = useQueryClient();

const bookingQuery = crmQueryApi.createGetBookingsByIdV1(
	() => bookingId!,
	() => ({ query: { refetchOnWindowFocus: true } })
);

const cancelMutation = crmQueryApi.createDeleteBookingsByIdSelfV1Mutation();

const expiresAt = $derived.by(() => {
	const b = bookingQuery.data;
	if (!b || b.status !== 'PENDING') return null;
	// Backend enriches PENDING booking with expiresAt (Task 1.9).
	return b.expiresAt ?? null;
});

const timer = createPendingTimer(() => expiresAt);

// Poll for status change after expiry
let pollInterval: ReturnType<typeof setInterval> | null = $state(null);

$effect(() => {
	if (timer.isExpired && bookingQuery.data?.status === 'PENDING') {
		if (pollInterval) return;
		pollInterval = setInterval(() => {
			queryClient.invalidateQueries({
				queryKey: [`/api/v1/bookings/${bookingId}`]
			});
		}, 10_000);
	} else if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
	return () => {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	};
});

const handleCancel = async () => {
	if (!booking) return;
	try {
		await cancelMutation.mutateAsync({ id: bookingId! });
		queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
		queryClient.invalidateQueries({
			queryKey: [
				`/api/v1/public/screenings/${booking.screeningId}/available-seats`
			]
		});
		queryClient.invalidateQueries({
			queryKey: [`/api/v1/bookings/${bookingId}`]
		});
		toast.success($_('booking.cancel_success'));
		goto(`/screenings/${booking.screeningId}`);
	} catch (error) {
		toast.error(getErrorMessage(error, $_('booking.errors.cancel_failed')));
	}
};
```

- [ ] **Step 2: Replace existing markup for PENDING + non-PENDING states**

Inside the main template, wrap the checkout UI with status branches:

```svelte
{#if !booking}
	<!-- existing skeleton -->
{:else if booking.status === 'CANCELLED' || booking.status === 'NO_SHOW'}
	<ExpiredBookingView screeningId={booking.screeningId} />
{:else if booking.status === 'CONFIRMED' || booking.status === 'COMPLETED'}
	<!-- Redirect to confirmation on first render -->
	{@const _redirect = (() => {
		goto(`/booking/${booking.id}/confirmation`);
		return null;
	})()}
{:else if timer.isExpired && booking.status === 'PENDING'}
	<ExpiredBookingView screeningId={booking.screeningId} />
{:else}
	<!-- existing PENDING checkout UI wrapped with header timer -->
	<header class="booking_header">
		<h1>{movieTitle}</h1>
		<PendingBookingTimer {expiresAt} size="lg" />
	</header>

	<!-- existing promo, food, payment sections -->

	<footer class="booking_footer">
		<Popconfirm
			title={$_('booking.cancel_confirm_title')}
			description={$_('booking.cancel_confirm_body')}
			confirmText={$_('booking.cancel_confirm_yes')}
			cancelText={$_('booking.cancel_confirm_no')}
			onConfirm={handleCancel}
		>
			<Button variant="ghost">{$_('booking.cancel_cta')}</Button>
		</Popconfirm>

		<!-- existing Pay button unchanged -->
	</footer>
{/if}
```

> **IMPORTANT:** the `{@const _redirect}` hack triggers the redirect once during render — if your codebase prefers `$effect(() => { ... })` for side-effects, use that instead, outside the template.

Preferred redirect pattern (safer, use this):

```svelte
<script>
	$effect(() => {
		if (
			booking &&
			(booking.status === 'CONFIRMED' || booking.status === 'COMPLETED')
		) {
			goto(`/booking/${booking.id}/confirmation`, { replaceState: true });
		}
	});
</script>
```

And in the template, when status is terminal non-cancelled, render a simple loading placeholder while redirecting.

- [ ] **Step 3: Type-check and smoke run**

```bash
bun run check
bun run dev
```

Create a PENDING booking, confirm timer renders, cancel button cancels, expired view shows after TTL.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(client)/booking/[bookingId]/+page.svelte
git commit -m "refactor(booking): timer + self-cancel + expired polling on /booking/:id"
```

---

## Task 2.16: Add i18n keys for all 5 locales

**Files:**

- Modify: `src/lib/i18n/locales/ru.json`
- Modify: `src/lib/i18n/locales/en.json`
- Modify: `src/lib/i18n/locales/ky.json`
- Modify: `src/lib/i18n/locales/kz.json`
- Modify: `src/lib/i18n/locales/uz.json`

- [ ] **Step 1: Add to `ru.json` — master copy**

Inside existing `"booking"` key (or create if missing):

```json
{
	"booking": {
		"active_banner": {
			"title": "Незавершённая бронь",
			"pay_cta": "Оплатить",
			"cancel_cta": "Отменить"
		},
		"expired_view": {
			"title": "Время оплаты истекло",
			"subtitle": "Ваши места стали доступны другим. Начните выбор заново.",
			"select_again_cta": "Выбрать места заново"
		},
		"conflict_dialog": {
			"same_screening_title": "У вас уже есть бронь на этот сеанс",
			"same_screening_body": "Вы уже забронировали места: {seats}. Завершите оплату или отмените бронь, чтобы выбрать другие места.",
			"other_screening_title": "У вас есть неоплаченная бронь",
			"other_screening_body": "Система позволяет одну активную бронь одновременно. Завершите оплату или отмените текущую бронь.",
			"remaining": "Осталось:",
			"return_to_payment_cta": "Вернуться к оплате",
			"cancel_and_rebook_cta": "Отменить и забронировать эти места"
		},
		"cancel_confirm_title": "Отменить бронь?",
		"cancel_confirm_body": "Места станут доступны другим пользователям.",
		"cancel_confirm_yes": "Да, отменить",
		"cancel_confirm_no": "Нет",
		"cancel_cta": "Отменить бронь",
		"cancel_success": "Бронь отменена",
		"errors": {
			"seats_unavailable": "Места {seats} уже заняты — сняты с выбора",
			"generic": "Не удалось создать бронь",
			"cancel_failed": "Не удалось отменить бронь"
		}
	}
}
```

- [ ] **Step 2: Translate for `en.json`**

```json
{
	"booking": {
		"active_banner": {
			"title": "Unfinished booking",
			"pay_cta": "Pay",
			"cancel_cta": "Cancel"
		},
		"expired_view": {
			"title": "Payment time expired",
			"subtitle": "Your seats are now available to others. Please start a new selection.",
			"select_again_cta": "Choose seats again"
		},
		"conflict_dialog": {
			"same_screening_title": "You already have a booking for this screening",
			"same_screening_body": "You have already booked seats: {seats}. Complete the payment or cancel the booking to choose different seats.",
			"other_screening_title": "You have an unpaid booking",
			"other_screening_body": "The system allows only one active booking at a time. Complete the payment or cancel the current booking.",
			"remaining": "Time left:",
			"return_to_payment_cta": "Return to payment",
			"cancel_and_rebook_cta": "Cancel it and book these seats"
		},
		"cancel_confirm_title": "Cancel booking?",
		"cancel_confirm_body": "Seats will become available to other users.",
		"cancel_confirm_yes": "Yes, cancel",
		"cancel_confirm_no": "No",
		"cancel_cta": "Cancel booking",
		"cancel_success": "Booking cancelled",
		"errors": {
			"seats_unavailable": "Seats {seats} are already taken — removed from selection",
			"generic": "Failed to create booking",
			"cancel_failed": "Failed to cancel booking"
		}
	}
}
```

- [ ] **Step 3: Translate for `ky.json` (Kyrgyz), `kz.json` (Kazakh), `uz.json` (Uzbek)**

Provide same structure with localized translations. If the project has a translations workflow (translators' spreadsheet etc.), stub with Russian placeholders and flag a PR comment for translators. Otherwise produce best-effort translations following the existing style in those files.

Minimal Kyrgyz example for one key (engineer to fill rest in similar style):

```json
"cancel_success": "Бронь жокко чыгарылды"
```

Kazakh:

```json
"cancel_success": "Брондау күшін жойдық"
```

Uzbek:

```json
"cancel_success": "Bron bekor qilindi"
```

- [ ] **Step 4: Merge each locale into existing file (preserve other keys)**

Hand-merge into every file — do not overwrite.

- [ ] **Step 5: Run dev server and switch locales manually**

```bash
bun run dev
# Open site, switch language via header switcher, confirm new strings render.
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/locales/
git commit -m "i18n(booking): translations for active-booking flow in 5 locales"
```

---

## Task 2.17: Phase 2 manual QA checklist

- [ ] **Step 1: Golden path**

1. Log in. Navigate to `/movies` → pick movie → pick screening → land on `/screenings/:id`.
2. Select 3 seats (confirm NO network requests in DevTools Network tab on seat clicks).
3. Click «Продолжить» → exactly one `POST /api/v1/bookings`. On success → redirect to `/booking/:id`.
4. Timer renders as `10:00`, counts down.
5. Click «Оплатить» → redirect to `/booking/:id/confirmation`.

- [ ] **Step 2: Self-cancel**

1. Create PENDING (steps 1-3 above).
2. On `/booking/:id` click «Отменить бронь» → Popconfirm → confirm.
3. Expect redirect to `/screenings/:id`. Seats previously held are `AVAILABLE` again.

- [ ] **Step 3: `SEATS_UNAVAILABLE` conflict**

1. Open Chrome normal + Incognito, log in as two different users.
2. Both select the same 2 seats on the same screening.
3. User A clicks Continue → success.
4. User B clicks Continue → toast: «Места 5-3, 5-4 уже заняты — сняты с выбора». Those 2 seats flip to BOOKED on B's SeatMap; B's other selections (if any) remain. Click Continue again → should succeed on remaining seats.

- [ ] **Step 4: `ACTIVE_BOOKING_EXISTS` conflict — other screening**

1. Create PENDING on screening X.
2. Navigate to `/screenings/Y` (different screening).
3. Select seats, click Continue → modal appears with «Вернуться к оплате / Отменить её и забронировать эти места».
4. Test both branches.

- [ ] **Step 5: `ACTIVE_BOOKING_EXISTS` conflict — same screening**

1. Create PENDING on screening X (seats A, B).
2. Navigate back to `/screenings/X`. Seats A, B appear as `HELD_BY_YOU`.
3. Select additional seat C, click Continue → modal with same-screening copy. Verify `existingSeatLabels` shows `[5-3, 5-4]` (or whatever A, B map to).

- [ ] **Step 6: Banner visibility**

1. Create PENDING.
2. Navigate to `/`, `/movies`, `/screenings/other`, `/profile` → banner visible.
3. Navigate to `/booking/:id`, `/admin` → banner hidden.

- [ ] **Step 7: Expired view**

1. Create PENDING. Leave `/booking/:id` open.
2. Wait ~10 min. Timer goes to 0:00. Within 60 seconds the view flips to `ExpiredBookingView`.

- [ ] **Step 8: Timer thresholds**

1. Use DevTools to temporarily patch `createPendingTimer` to speed up for testing (or book, wait, and visually confirm at 2:00, 0:30, 0:00).

- [ ] **Step 9: Network audit**

- Open DevTools Network, filter by `/seat-holds`. Click seats, click Continue — should see ZERO hits. If any appear, find and remove the stale call.

- [ ] **Step 10: Commit QA sign-off**

```bash
# Empty commit documenting QA pass
git commit --allow-empty -m "test(booking): phase 2 QA pass"
```

---

## Task 2.18: Phase 2 deploy

- [ ] **Step 1: Full type-check**

```bash
bun run check
```

Expected: 0 errors.

- [ ] **Step 2: Production build**

```bash
bun run build
```

Expected: clean build.

- [ ] **Step 3: Deploy**

Follow standard pipeline.

- [ ] **Step 4: Monitor 24-48h**

- `POST /api/v1/bookings` p95 — should drop vs pre-redesign baseline.
- `POST /api/v1/screenings/*/seat-holds` traffic — should drop to 0 (confirms no stale frontend calls remain).
- 409 `SEATS_UNAVAILABLE` rate — expect <1%.
- 409 `ACTIVE_BOOKING_EXISTS` rate — expect 0.5–2%.

---

# PHASE 3 — Backend cleanup

Prerequisite: Phase 2 deployed ≥24h with zero `/seat-holds` traffic.

## Task 3.1: Verify prerequisite

- [ ] **Step 1: Query access logs for `/seat-holds` hits in last 24h**

```bash
# example depending on log setup
grep "/seat-holds" /var/log/nginx/access.log | awk '$4 > "2026-04-20"'
```

Expected: 0 matches. If any appear, investigate the source (stale frontend cache, mobile app, etc.) before proceeding.

---

## Task 3.2: Switch available-seats to Booking-only source

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/src/screening/screening.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/screening/screening.service.spec.ts`

- [ ] **Step 1: Add test for Booking-only derivation**

```typescript
it('derives HELD status from PENDING booking of another user (no SeatHold)', async () => {
	prismaMock.bookingSeat.findMany.mockResolvedValue([
		{ seatId: 'a', booking: { status: 'PENDING', userId: 'other-user' } }
	]);
	prismaMock.seatHold.findMany.mockResolvedValue([]); // to be removed
	prismaMock.seat.findMany.mockResolvedValue([
		{ id: 'a', gridRow: 1, gridCol: 1, rowNumber: 1, seatNumber: 1 }
	]);
	prismaMock.screening.findUnique.mockResolvedValue({
		hall: { layoutRows: 1, layoutCols: 1 }
	});

	const result = await service.findAvailableSeats('s1', 'me');
	expect(result.seats[0].status).toBe('HELD');
});

it('derives HELD_BY_YOU from current user PENDING booking', async () => {
	prismaMock.bookingSeat.findMany.mockResolvedValue([
		{ seatId: 'a', booking: { status: 'PENDING', userId: 'me' } }
	]);
	prismaMock.seat.findMany.mockResolvedValue([
		{ id: 'a', gridRow: 1, gridCol: 1, rowNumber: 1, seatNumber: 1 }
	]);
	prismaMock.screening.findUnique.mockResolvedValue({
		hall: { layoutRows: 1, layoutCols: 1 }
	});

	const result = await service.findAvailableSeats('s1', 'me');
	expect(result.seats[0].status).toBe('HELD_BY_YOU');
});
```

- [ ] **Step 2: Refactor service**

Replace `findAvailableSeats` body:

```typescript
async findAvailableSeats(id: string, currentUserId?: string) {
  const screening = await this.prisma.screening.findUnique({
    where: { id },
    include: { hall: { select: { id: true, layoutRows: true, layoutCols: true } } }
  });
  if (!screening) throw new NotFoundException(`Screening ${id} not found`);

  const ttlMs = this.pendingTtlMinutes * 60_000;
  const pendingCutoff = new Date(Date.now() - ttlMs);

  const [bookingSeats, allSeats] = await Promise.all([
    this.prisma.bookingSeat.findMany({
      where: {
        booking: {
          screeningId: id,
          OR: [
            { status: { in: ['CONFIRMED', 'COMPLETED'] } },
            { status: 'PENDING', createdAt: { gte: pendingCutoff } }
          ]
        }
      },
      select: {
        seatId: true,
        booking: { select: { status: true, userId: true } }
      }
    }),
    this.prisma.seat.findMany({
      where: { hallId: screening.hallId, isActive: true },
      orderBy: [{ gridRow: 'asc' }, { gridCol: 'asc' }]
    })
  ]);

  const byId = new Map<string, { status: string; userId: string | null }>();
  for (const bs of bookingSeats) {
    byId.set(bs.seatId, { status: bs.booking.status, userId: bs.booking.userId });
  }

  const seats = allSeats.map((seat) => {
    const hit = byId.get(seat.id);
    let status: SeatAvailabilityStatus;
    if (!hit) status = SeatAvailabilityStatus.AVAILABLE;
    else if (hit.status === 'CONFIRMED' || hit.status === 'COMPLETED') {
      status = SeatAvailabilityStatus.BOOKED;
    } else {
      status = currentUserId && hit.userId === currentUserId
        ? SeatAvailabilityStatus.HELD_BY_YOU
        : SeatAvailabilityStatus.HELD;
    }
    return { ...seat, status };
  });

  return {
    hall: { layoutRows: screening.hall.layoutRows, layoutCols: screening.hall.layoutCols },
    seats,
    holdTtlMinutes: this.pendingTtlMinutes
  };
}
```

- [ ] **Step 3: Run tests — must pass**

Run: `npm run test -- screening`

- [ ] **Step 4: Commit**

```bash
git add src/screening/screening.service.ts src/screening/screening.service.spec.ts
git commit -m "refactor(screening): derive seat status from Booking only"
```

---

## Task 3.3: Remove SeatHold-check from `booking.service.create`

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts`

- [ ] **Step 1: Remove the `activeHolds` FOR-UPDATE block**

Delete the `$queryRawUnsafe` for `SeatHold`, the `tx.seatHold.deleteMany` calls for cleanup inside the transaction. Keep only `BookingSeat` checks.

Final `create` transaction body (diff, remove SeatHold-related statements):

```typescript
// REMOVE:
// const activeHolds = await tx.$queryRawUnsafe(...`SeatHold` ...);
// if (activeHolds.length > 0) { throw ... }
// await tx.seatHold.deleteMany({ where: { screeningId, userId } });
```

- [ ] **Step 2: Run tests — existing create tests must still pass**

Run: `npm run test -- booking.service`

- [ ] **Step 3: Commit**

```bash
git add src/booking/booking.service.ts
git commit -m "refactor(booking): stop consulting SeatHold in create path"
```

---

## Task 3.4: Remove SeatHold module

**Files:**

- Delete: `~/Desktop/ZeroWaiting_backend/src/seat-hold/` (entire folder)
- Modify: `~/Desktop/ZeroWaiting_backend/src/app.module.ts`

- [ ] **Step 1: Remove the import and `imports` entry**

In `app.module.ts`:

```typescript
// REMOVE:
// import { SeatHoldModule } from './seat-hold/seat-hold.module';
// ... inside imports array:
//   SeatHoldModule,
```

- [ ] **Step 2: Delete the folder**

```bash
rm -rf src/seat-hold
```

- [ ] **Step 3: Build to catch stale references**

Run: `npm run build`
Expected: clean build. Any error means a leftover import.

- [ ] **Step 4: Commit**

```bash
git add src/app.module.ts -A
git commit -m "refactor(seat-hold): remove deprecated module"
```

---

## Task 3.5: Drop SeatHold table and relations from Prisma

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/prisma/schema.prisma`

- [ ] **Step 1: Remove model + relations**

Delete the `model SeatHold { ... }` block entirely.
Remove `seatHolds SeatHold[]` lines from `model Screening` and `model Seat`.

- [ ] **Step 2: Create migration**

```bash
npm run prisma:migrate -- --name drop_seat_hold
```

Expected: migration SQL contains `DROP TABLE "SeatHold" CASCADE;`.

- [ ] **Step 3: Manual verification**

```bash
cat prisma/migrations/<timestamp>_drop_seat_hold/migration.sql
```

Confirm it ONLY drops SeatHold and its indexes — no unexpected data loss.

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: all pass. Any reference to SeatHold model compiles away.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "chore(db): drop SeatHold table"
```

---

## Task 3.6: Remove legacy env fallback

**Files:**

- Modify: `~/Desktop/ZeroWaiting_backend/.env.example`
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/booking.service.ts`

- [ ] **Step 1: Delete old env**

Remove `SEAT_HOLD_TTL_MINUTES=10` line from `.env.example`. Keep only `BOOKING_PENDING_TTL_MINUTES=10`.

- [ ] **Step 2: Simplify TTL reader**

```typescript
this.pendingTtlMinutes = this.config.get<number>(
	'BOOKING_PENDING_TTL_MINUTES',
	10
);
```

- [ ] **Step 3: Document**

Add a note to project README or deployment docs to rename the env var in production `.env` BEFORE deploying this commit. (If README has a config section, update it.)

- [ ] **Step 4: Commit**

```bash
git add .env.example src/booking/booking.service.ts README.md
git commit -m "chore(config): remove legacy SEAT_HOLD_TTL_MINUTES fallback"
```

---

## Task 3.7: Regenerate frontend API (clean up)

**Files:**

- Auto-regenerated: `src/api/endpoints/seat-holds.ts` → will disappear.

- [ ] **Step 1: Deploy Phase 3 backend first**

Coordinate with ops. After deploy, Swagger no longer advertises `/seat-holds/*`.

- [ ] **Step 2: On frontend, regenerate**

```bash
cd /Users/elcho/Desktop/ZeroWaiting_frontend
bun run generate:api
```

Expected: `src/api/endpoints/seat-holds.ts` is deleted by the clean step. Barrel export updated.

- [ ] **Step 3: Type-check**

Run: `bun run check`
Expected: clean. If errors appear, a frontend file still referenced the deprecated endpoints — remove the call.

- [ ] **Step 4: Commit**

```bash
git add src/api/
git commit -m "chore(api): regenerate — drop deprecated seat-holds endpoints"
```

---

## Task 3.8: Phase 3 deploy gate

- [ ] **Step 1: Full backend + frontend tests**

```bash
cd ~/Desktop/ZeroWaiting_backend && npm run test && npm run build
cd /Users/elcho/Desktop/ZeroWaiting_frontend && bun run check && bun run build
```

- [ ] **Step 2: Update production env var**

Rename `SEAT_HOLD_TTL_MINUTES` → `BOOKING_PENDING_TTL_MINUTES` in the production secrets manager / deploy config.

- [ ] **Step 3: Deploy backend**

Monitor `/bookings/active`, `/bookings/:id/self` success rates and `POST /bookings` latency.

- [ ] **Step 4: Deploy frontend**

- [ ] **Step 5: 24-hour watch**

- No 500s on `/bookings/active`.
- No regression in `POST /bookings` latency vs Phase 2 baseline.
- No stale `/seat-holds` traffic (should be 404 now; if clients still hit it, audit).

---

# Final checklist

- [ ] Phase 1 merged + deployed
- [ ] Phase 2 merged + deployed + QA passed
- [ ] Phase 3 merged + deployed
- [ ] Metrics stable for 48h after Phase 3
- [ ] Spec `docs/superpowers/specs/2026-04-19-seat-booking-redesign-design.md` referenced in post-mortem if any issues
- [ ] Follow-ups (see spec section 10) tracked as separate issues:
  - Idempotency-Key for `POST /bookings`
  - `BroadcastChannel` cross-tab sync
  - SSE for real-time seat map
  - E2E tests on Playwright
  - Guest online booking
