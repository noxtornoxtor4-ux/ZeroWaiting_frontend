# Partial Ticket Redemption — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести модель «один билет = вся бронь» на «один билет = одно место», добавить частичное погашение, индивидуальные QR на места, общий QR-просмотрщик, откат за 60 сек и share через `navigator.share`.

**Architecture:** `BookingSeat` остаётся записью «место удержано», `Ticket` становится 1:1 с `BookingSeat` (credential per место), `Booking.viewerCode` — публичный токен-просмотрщик (не credential). Master scan через `viewerCode` → модалка с чекбоксами, partial PATCH. Per-seat scan через `qrCode` → мгновенное гашение с 60-сек revert окном.

**Tech Stack:** Frontend — SvelteKit 2 (Svelte 5 runes), TanStack Query, Orval API, svelte-i18n. Backend — NestJS, Prisma, PostgreSQL, EventEmitter, Resend (email). Cross-repo: `~/Desktop/ZeroWaiting_frontend` + `~/Desktop/ZeroWaiting_backend`.

**Spec:** `docs/superpowers/specs/2026-04-26-partial-redeem-design.md` (commit `7400a8b`).

**Branch:** Reuse current `feat/single-ticket-multi-seat` (already off `main`, has WIP commits). All work continues on this branch in both repos. If backend is on a different branch — sync to `feat/single-ticket-multi-seat` first.

---

## File Structure Overview

### Backend (`~/Desktop/ZeroWaiting_backend`)

**Modify:**
- `prisma/schema.prisma` — add `Booking.viewerCode`, change `Ticket.bookingId @unique` → `Ticket.bookingSeatId @unique`, add `BookingSeat.ticket` back-relation, add `@@index([scannedAt])` on Ticket
- `src/ticket/ticket.service.ts` — rewrite: per-seat creation, master/per-seat validate/scan, revert, public viewers
- `src/ticket/ticket.controller.ts` — new endpoints (master + per-seat + revert)
- `src/ticket/public-ticket.controller.ts` — add master public endpoint
- `src/ticket/dto/validated-ticket.dto.ts` — refactor to single-seat shape
- `src/ticket/ticket.service.spec.ts` — rewrite
- `src/booking/listeners/booking-paid.listener.ts` — call new `generateTicketsForBooking`, pass `viewerCode` to mail
- `src/mail/mail.service.ts` — `sendTicketEmail` uses `viewerCode` URL + lists per-seat URLs

**Create:**
- `src/ticket/dto/validated-master-ticket.dto.ts`
- `src/ticket/dto/public-master-ticket.dto.ts`
- `src/ticket/dto/scan-master.dto.ts`

### Frontend (`~/Desktop/ZeroWaiting_frontend`)

**Modify:**
- `src/lib/utils/parse-ticket-url.ts` — return discriminated union
- `src/lib/utils/parse-ticket-url.test.ts` — new cases
- `src/routes/(client)/booking/[bookingId]/confirmation/+page.svelte` — use `<TicketViewer>`
- `src/routes/t/[qrCode]/+page.svelte` + `+page.ts` — single-seat view
- `src/routes/scanner/+page.svelte` — extended state machine
- `src/lib/i18n/locales/{en,ky,kz,ru,uz}.json` — new keys

**Create:**
- `src/components/booking/TicketViewer.svelte`
- `src/components/booking/TicketTabsMaster.svelte`
- `src/components/booking/TicketTabsIndividual.svelte`
- `src/components/booking/SeatTicketCard.svelte`
- `src/components/booking/ShareButton.svelte`
- `src/routes/t/m/[viewerCode]/+page.svelte` + `+page.ts`
- `src/routes/scanner/components/MasterScanModal.svelte`
- `src/routes/scanner/components/SeatRedeemedView.svelte`
- `src/routes/scanner/components/RevertCountdown.svelte`

**Delete:**
- `src/routes/scanner/components/ScannerResult.svelte`

---

## Phase 1 — Backend Schema & Migration

### Task 1: Update Prisma schema

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/prisma/schema.prisma` (Booking, BookingSeat, Ticket models)

- [ ] **Step 1: Add `viewerCode` to Booking**

In `Booking` model, after the existing `id`/`screeningId` fields, add:

```prisma
model Booking {
  id          String        @id @default(uuid())
  screeningId String
  type        BookingType   @default(ONLINE)
  status      BookingStatus @default(PENDING)
  totalPrice  Decimal       @db.Decimal(10, 2)
  viewerCode  String        @unique @default(uuid())   // NEW

  // ... rest unchanged
```

- [ ] **Step 2: Update `BookingSeat` with back-relation**

```prisma
model BookingSeat {
  id        String @id @default(uuid())
  bookingId String
  seatId    String

  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  seat    Seat    @relation(fields: [seatId], references: [id])
  ticket  Ticket?                                       // NEW

  @@unique([bookingId, seatId])
  @@index([seatId])
}
```

- [ ] **Step 3: Rewrite `Ticket` model**

```prisma
model Ticket {
  id            String       @id @default(uuid())
  bookingSeatId String       @unique
  qrCode        String       @unique @default(uuid())
  status        TicketStatus @default(VALID)
  scannedAt     DateTime?
  scannedById   String?

  /// @DtoEntityHidden
  bookingSeat BookingSeat @relation(fields: [bookingSeatId], references: [id], onDelete: Cascade)
  /// @DtoEntityHidden
  scannedBy   User?       @relation("TicketScannedBy", fields: [scannedById], references: [id])

  /// @DtoCreateHidden
  createdAt DateTime @default(now())

  @@index([status])
  @@index([scannedAt])
}
```

Note: the existing `bookingId` field/relation/index on `Ticket` is removed.

- [ ] **Step 4: Verify schema is valid**

```bash
cd ~/Desktop/ZeroWaiting_backend && bunx prisma format && bunx prisma validate
```

Expected: `The schema is valid`.

- [ ] **Step 5: Reset DB and reseed (development branch)**

```bash
cd ~/Desktop/ZeroWaiting_backend && bunx prisma migrate reset --force
```

Expected: migration applied, seed runs, no errors. (Spec authorized reset+reseed because project is in development.)

- [ ] **Step 6: Generate Prisma client**

```bash
cd ~/Desktop/ZeroWaiting_backend && bunx prisma generate
```

Expected: `Generated Prisma Client (...) to ./node_modules/@prisma/client`.

- [ ] **Step 7: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): per-seat tickets and booking viewerCode"
```

---

## Phase 2 — Backend Service Layer

Each task in this phase follows TDD: failing test → implementation → passing test → commit.

### Task 2: `generateTicketsForBooking` — fan-out per BookingSeat

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`

- [ ] **Step 1: Wipe and re-scaffold `ticket.service.spec.ts`**

Replace entire file with this scaffold (keeps existing testing harness pattern):

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { TicketService } from './ticket.service';
import { PrismaService } from '../prisma.service';

const mockPrisma = () => ({
  ticket: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  booking: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  bookingSeat: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('TicketService', () => {
  let service: TicketService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(TicketService);
  });

  // tests added in subsequent tasks
});
```

- [ ] **Step 2: Add failing test for `generateTicketsForBooking`**

Append inside the `describe`:

```ts
  describe('generateTicketsForBooking', () => {
    it('creates one Ticket per BookingSeat', async () => {
      prisma.bookingSeat.findMany.mockResolvedValue([
        { id: 'bs-1' },
        { id: 'bs-2' },
        { id: 'bs-3' },
      ]);
      prisma.ticket.createMany.mockResolvedValue({ count: 3 });
      prisma.ticket.findMany.mockResolvedValue([
        { id: 't-1', bookingSeatId: 'bs-1' },
        { id: 't-2', bookingSeatId: 'bs-2' },
        { id: 't-3', bookingSeatId: 'bs-3' },
      ]);

      const tickets = await service.generateTicketsForBooking('b-1');

      expect(prisma.bookingSeat.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'b-1' },
        select: { id: true },
      });
      expect(prisma.ticket.createMany).toHaveBeenCalledWith({
        data: [
          { bookingSeatId: 'bs-1' },
          { bookingSeatId: 'bs-2' },
          { bookingSeatId: 'bs-3' },
        ],
      });
      expect(tickets).toHaveLength(3);
    });
  });
```

- [ ] **Step 3: Run failing test**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/ticket/ticket.service.spec.ts
```

Expected: FAIL — `service.generateTicketsForBooking is not a function` (or similar).

- [ ] **Step 4: Implement in `ticket.service.ts`**

Replace the existing `generateTicket` method with:

```ts
async generateTicketsForBooking(bookingId: string) {
  const seats = await this.prisma.bookingSeat.findMany({
    where: { bookingId },
    select: { id: true },
  });
  if (seats.length === 0) return [];

  await this.prisma.ticket.createMany({
    data: seats.map((s) => ({ bookingSeatId: s.id })),
  });

  return this.prisma.ticket.findMany({
    where: { bookingSeatId: { in: seats.map((s) => s.id) } },
  });
}
```

- [ ] **Step 5: Run test — passes**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/ticket/ticket.service.spec.ts -t generateTicketsForBooking
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend
git add src/ticket/ticket.service.ts src/ticket/ticket.service.spec.ts
git commit -m "feat(ticket): generateTicketsForBooking creates per-seat tickets"
```

---

### Task 3: `validateMaster` — return all tickets of a booking by viewerCode

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`

- [ ] **Step 1: Add failing test**

Append:

```ts
  describe('validateMaster', () => {
    const baseBooking = {
      id: 'b-1',
      screening: {
        id: 's-1',
        startTime: new Date('2026-05-01T19:00:00Z'),
        movie: { title: { ru: 'Дюна' }, posterUrl: null, ageRating: '12+', duration: 150 },
        hall: { name: 'Зал 1', branch: { name: { ru: 'ZeroWaiting Бишкек' } } },
      },
      seats: [
        {
          id: 'bs-1',
          seat: { id: 'seat-1', rowNumber: 5, seatNumber: 3 },
          ticket: { id: 't-1', qrCode: 'qr-1', status: 'VALID', scannedAt: null, scannedById: null },
        },
        {
          id: 'bs-2',
          seat: { id: 'seat-2', rowNumber: 5, seatNumber: 4 },
          ticket: {
            id: 't-2',
            qrCode: 'qr-2',
            status: 'USED',
            scannedAt: new Date(Date.now() - 30_000),
            scannedById: 'user-staff',
          },
        },
      ],
    };

    it('returns booking with seats + tickets and canRevert flag', async () => {
      prisma.booking.findUnique.mockResolvedValue(baseBooking);

      const result = await service.validateMaster('viewer-1', 'user-staff');

      expect(prisma.booking.findUnique).toHaveBeenCalledWith({
        where: { viewerCode: 'viewer-1' },
        include: expect.objectContaining({
          seats: expect.objectContaining({
            include: expect.objectContaining({ seat: true, ticket: true }),
          }),
        }),
      });
      expect(result.seats).toHaveLength(2);
      expect(result.seats[0].canRevert).toBe(false);
      expect(result.seats[1].canRevert).toBe(true); // USED, <60s, same staff
    });

    it('canRevert=false when scanned by other staff', async () => {
      prisma.booking.findUnique.mockResolvedValue(baseBooking);
      const result = await service.validateMaster('viewer-1', 'other-user');
      expect(result.seats[1].canRevert).toBe(false);
    });

    it('canRevert=false when older than 60s', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...baseBooking,
        seats: [
          {
            ...baseBooking.seats[1],
            ticket: {
              ...baseBooking.seats[1].ticket,
              scannedAt: new Date(Date.now() - 61_000),
            },
          },
        ],
      });
      const result = await service.validateMaster('viewer-1', 'user-staff');
      expect(result.seats[0].canRevert).toBe(false);
    });

    it('throws NotFound when viewerCode missing', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.validateMaster('missing', 'user-staff')).rejects.toThrow();
    });
  });
```

- [ ] **Step 2: Run, expect FAIL**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/ticket/ticket.service.spec.ts -t validateMaster
```

- [ ] **Step 3: Implement in `ticket.service.ts`**

Add a private helper at the top of the class:

```ts
private canRevert(ticket: { status: string; scannedAt: Date | null; scannedById: string | null }, actorId: string) {
  if (ticket.status !== 'USED') return false;
  if (ticket.scannedById !== actorId) return false;
  if (!ticket.scannedAt) return false;
  return Date.now() - ticket.scannedAt.getTime() < 60_000;
}
```

Add method:

```ts
async validateMaster(viewerCode: string, actorId: string) {
  const booking = await this.prisma.booking.findUnique({
    where: { viewerCode },
    include: {
      screening: { include: { movie: true, hall: { include: { branch: true } } } },
      seats: { include: { seat: true, ticket: true } },
    },
  });
  if (!booking) throw new NotFoundException('Booking not found');

  return {
    booking: {
      id: booking.id,
      screening: {
        id: booking.screening.id,
        startTime: booking.screening.startTime.toISOString(),
        movie: {
          title: booking.screening.movie.title,
          posterUrl: booking.screening.movie.posterUrl ?? null,
          ageRating: booking.screening.movie.ageRating,
          duration: booking.screening.movie.duration,
        },
        hall: {
          name: booking.screening.hall.name,
          branch: { name: booking.screening.hall.branch.name },
        },
      },
    },
    seats: booking.seats
      .filter((bs) => bs.ticket !== null)
      .map((bs) => ({
        ticketId: bs.ticket!.id,
        qrCode: bs.ticket!.qrCode,
        seatId: bs.seat.id,
        row: bs.seat.rowNumber,
        seat: bs.seat.seatNumber,
        status: bs.ticket!.status,
        scannedAt: bs.ticket!.scannedAt ? bs.ticket!.scannedAt.toISOString() : null,
        scannedById: bs.ticket!.scannedById,
        canRevert: this.canRevert(bs.ticket!, actorId),
      })),
  };
}
```

- [ ] **Step 4: Run — passes**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/ticket/ticket.service.spec.ts -t validateMaster
```

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend
git add src/ticket/ticket.service.ts src/ticket/ticket.service.spec.ts
git commit -m "feat(ticket): validateMaster returns booking seats with canRevert"
```

---

### Task 4: `scanMaster` — partial redeem with idempotent split

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`

- [ ] **Step 1: Add failing tests**

```ts
  describe('scanMaster', () => {
    it('splits into redeemed and skipped (already-USED stay skipped)', async () => {
      // booking has 3 tickets: t-1 VALID, t-2 USED, t-3 VALID
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b-1',
        seats: [
          { ticket: { id: 't-1', status: 'VALID' } },
          { ticket: { id: 't-2', status: 'USED' } },
          { ticket: { id: 't-3', status: 'VALID' } },
        ],
      });

      // updateMany returns count of rows actually updated
      prisma.ticket.updateMany.mockResolvedValue({ count: 2 });
      prisma.ticket.findMany
        .mockResolvedValueOnce([
          // post-update fetch — those that became USED now
          { id: 't-1', status: 'USED' },
          { id: 't-3', status: 'USED' },
        ])
        .mockResolvedValueOnce([
          // skipped fetch
          { id: 't-2', status: 'USED' },
        ]);

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

      const result = await service.scanMaster(
        'viewer-1',
        ['t-1', 't-2', 't-3'],
        'user-staff',
      );

      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['t-1', 't-2', 't-3'] }, status: 'VALID' },
        data: expect.objectContaining({ status: 'USED', scannedById: 'user-staff' }),
      });
      expect(result.redeemed.map((t: any) => t.id)).toEqual(['t-1', 't-3']);
      expect(result.skipped.map((t: any) => t.id)).toEqual(['t-2']);
    });

    it('rejects ticketIds not belonging to this booking', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b-1',
        seats: [{ ticket: { id: 't-1', status: 'VALID' } }],
      });
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

      await expect(
        service.scanMaster('viewer-1', ['t-1', 't-foreign'], 'user-staff'),
      ).rejects.toThrow();
    });

    it('throws NotFound when viewerCode missing', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      await expect(service.scanMaster('missing', ['t-1'], 'user-staff')).rejects.toThrow();
    });
  });
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

Add to `ticket.service.ts`:

```ts
async scanMaster(viewerCode: string, ticketIds: string[], actorId: string) {
  return this.prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { viewerCode },
      include: { seats: { include: { ticket: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const ownTicketIds = new Set(
      booking.seats.map((s) => s.ticket?.id).filter(Boolean) as string[],
    );
    for (const id of ticketIds) {
      if (!ownTicketIds.has(id)) {
        throw new BadRequestException(
          `Ticket ${id} does not belong to this booking`,
        );
      }
    }

    await tx.ticket.updateMany({
      where: { id: { in: ticketIds }, status: 'VALID' },
      data: { status: 'USED', scannedAt: new Date(), scannedById: actorId },
    });

    const redeemed = await tx.ticket.findMany({
      where: {
        id: { in: ticketIds },
        status: 'USED',
        scannedById: actorId,
        scannedAt: { gte: new Date(Date.now() - 5_000) },
      },
    });
    const redeemedIds = new Set(redeemed.map((t) => t.id));
    const skippedIds = ticketIds.filter((id) => !redeemedIds.has(id));
    const skipped = skippedIds.length
      ? await tx.ticket.findMany({ where: { id: { in: skippedIds } } })
      : [];

    return { redeemed, skipped };
  });
}
```

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/ZeroWaiting_backend
git add src/ticket/ticket.service.{ts,spec.ts}
git commit -m "feat(ticket): scanMaster idempotent partial redeem"
```

---

### Task 5: `validateTicket` and `scanTicket` (per-seat)

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`

- [ ] **Step 1: Add failing tests**

```ts
  describe('validateTicket (per-seat)', () => {
    it('returns single-seat ticket payload with canRevert', async () => {
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
              movie: { title: { ru: 'Дюна' }, posterUrl: null, ageRating: '12+', duration: 150 },
              hall: { name: 'Зал 1', branch: { name: { ru: 'ZeroWaiting' } } },
            },
          },
        },
      });

      const result = await service.validateTicket('qr-1', 'user-staff');
      expect(result.seat).toEqual({ row: 7, seat: 2 });
      expect(result.status).toBe('VALID');
      expect(result.canRevert).toBe(false);
    });

    it('throws NotFound when qrCode unknown', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);
      await expect(service.validateTicket('xxx', 'user-staff')).rejects.toThrow();
    });
  });

  describe('scanTicket (per-seat)', () => {
    it('marks VALID ticket as USED', async () => {
      prisma.ticket.update.mockResolvedValue({
        id: 't-1', qrCode: 'qr-1', status: 'USED',
      });
      const result = await service.scanTicket('qr-1', 'user-staff');
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { qrCode: 'qr-1', status: 'VALID' },
        data: expect.objectContaining({ status: 'USED', scannedById: 'user-staff' }),
      });
      expect(result.status).toBe('USED');
    });

    it('throws Conflict when ticket not VALID', async () => {
      const err: any = new Error('Record not found');
      err.code = 'P2025';
      prisma.ticket.update.mockRejectedValue(err);
      await expect(service.scanTicket('qr-1', 'user-staff')).rejects.toThrow();
    });
  });
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```ts
async validateTicket(qrCode: string, actorId: string) {
  const ticket = await this.prisma.ticket.findUnique({
    where: { qrCode },
    include: {
      bookingSeat: {
        include: {
          seat: true,
          booking: {
            include: {
              screening: { include: { movie: true, hall: { include: { branch: true } } } },
            },
          },
        },
      },
    },
  });
  if (!ticket) throw new NotFoundException('Ticket not found');
  const { bookingSeat } = ticket;
  return {
    ticketId: ticket.id,
    qrCode: ticket.qrCode,
    status: ticket.status,
    scannedAt: ticket.scannedAt ? ticket.scannedAt.toISOString() : null,
    canRevert: this.canRevert(ticket, actorId),
    seat: { row: bookingSeat.seat.rowNumber, seat: bookingSeat.seat.seatNumber },
    booking: {
      id: bookingSeat.booking.id,
      screening: {
        id: bookingSeat.booking.screening.id,
        startTime: bookingSeat.booking.screening.startTime.toISOString(),
        movie: {
          title: bookingSeat.booking.screening.movie.title,
          posterUrl: bookingSeat.booking.screening.movie.posterUrl ?? null,
          ageRating: bookingSeat.booking.screening.movie.ageRating,
          duration: bookingSeat.booking.screening.movie.duration,
        },
        hall: {
          name: bookingSeat.booking.screening.hall.name,
          branch: { name: bookingSeat.booking.screening.hall.branch.name },
        },
      },
    },
  };
}

async scanTicket(qrCode: string, actorId: string) {
  try {
    return await this.prisma.ticket.update({
      where: { qrCode, status: 'VALID' },
      data: { status: 'USED', scannedAt: new Date(), scannedById: actorId },
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') {
      throw new ConflictException('Ticket cannot be scanned in current state');
    }
    throw e;
  }
}
```

Imports needed at top: add `ConflictException` to existing `@nestjs/common` import.

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Commit**

```bash
git add src/ticket/ticket.service.{ts,spec.ts}
git commit -m "feat(ticket): per-seat validate and scan endpoints"
```

---

### Task 6: `revertTicket` — 60-second window same staff

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`

- [ ] **Step 1: Add failing tests**

```ts
  describe('revertTicket', () => {
    it('reverts USED→VALID within 60s by same staff', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        qrCode: 'qr-1',
        status: 'USED',
        scannedAt: new Date(Date.now() - 30_000),
        scannedById: 'user-staff',
      });
      prisma.ticket.update.mockResolvedValue({
        id: 't-1', qrCode: 'qr-1', status: 'VALID',
        scannedAt: null, scannedById: null,
      });

      const result = await service.revertTicket('qr-1', 'user-staff');
      expect(result.status).toBe('VALID');
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { qrCode: 'qr-1' },
        data: { status: 'VALID', scannedAt: null, scannedById: null },
      });
    });

    it('forbidden when scannedById is different', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        status: 'USED',
        scannedAt: new Date(Date.now() - 30_000),
        scannedById: 'other-user',
      });
      await expect(service.revertTicket('qr-1', 'user-staff')).rejects.toThrow(/forbidden|403/i);
    });

    it('Gone when older than 60s', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        status: 'USED',
        scannedAt: new Date(Date.now() - 61_000),
        scannedById: 'user-staff',
      });
      await expect(service.revertTicket('qr-1', 'user-staff')).rejects.toThrow(/expired|gone|410/i);
    });

    it('NotFound when qrCode missing', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);
      await expect(service.revertTicket('xxx', 'user-staff')).rejects.toThrow();
    });

    it('Conflict when ticket not USED', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't-1', status: 'VALID', scannedAt: null, scannedById: null,
      });
      await expect(service.revertTicket('qr-1', 'user-staff')).rejects.toThrow();
    });
  });
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

Add `GoneException` and `ForbiddenException` to imports. Implement:

```ts
async revertTicket(qrCode: string, actorId: string) {
  const ticket = await this.prisma.ticket.findUnique({ where: { qrCode } });
  if (!ticket) throw new NotFoundException('Ticket not found');
  if (ticket.status !== 'USED') {
    throw new ConflictException('Only USED tickets can be reverted');
  }
  if (ticket.scannedById !== actorId) {
    throw new ForbiddenException('Only the original scanner can revert this ticket');
  }
  if (!ticket.scannedAt || Date.now() - ticket.scannedAt.getTime() >= 60_000) {
    throw new GoneException('Revert window has expired');
  }
  return this.prisma.ticket.update({
    where: { qrCode },
    data: { status: 'VALID', scannedAt: null, scannedById: null },
  });
}
```

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Commit**

```bash
git add src/ticket/ticket.service.{ts,spec.ts}
git commit -m "feat(ticket): revert within 60s window for same staff"
```

---

### Task 7: Public viewers (`getPublicMaster` + `getPublicTicket`)

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.spec.ts`

- [ ] **Step 1: Add failing tests**

```ts
  describe('getPublicMaster', () => {
    it('returns booking seats with per-seat status (no auth context)', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        viewerCode: 'v-1',
        screening: {
          startTime: new Date('2026-05-01T19:00:00Z'),
          movie: { title: { ru: 'Дюна' }, posterUrl: 'p.jpg', ageRating: '12+', duration: 150 },
          hall: { name: 'Зал 1', branch: { name: { ru: 'IK' } } },
        },
        seats: [
          {
            seat: { rowNumber: 5, seatNumber: 3 },
            ticket: { qrCode: 'qr-1', status: 'VALID', scannedAt: null },
          },
          {
            seat: { rowNumber: 5, seatNumber: 4 },
            ticket: { qrCode: 'qr-2', status: 'USED', scannedAt: new Date('2026-05-01T19:30:00Z') },
          },
        ],
      });
      const result = await service.getPublicMaster('v-1');
      expect(result.seats).toHaveLength(2);
      expect(result.seats[0]).toMatchObject({ row: 5, seat: 3, qrCode: 'qr-1', status: 'VALID' });
      expect(result.seats[1].scannedAt).toBeTruthy();
    });

    it('throws NotFound when viewerCode missing', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.getPublicMaster('xxx')).rejects.toThrow();
    });
  });

  describe('getPublicTicket', () => {
    it('returns single-seat public payload', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        qrCode: 'qr-1', status: 'VALID', scannedAt: null,
        bookingSeat: {
          seat: { rowNumber: 7, seatNumber: 2 },
          booking: {
            screening: {
              startTime: new Date('2026-05-01T19:00:00Z'),
              movie: { title: { ru: 'Дюна' }, posterUrl: null, ageRating: '12+', duration: 150 },
              hall: { name: 'Зал 1', branch: { name: { ru: 'IK' } } },
            },
          },
        },
      });
      const r = await service.getPublicTicket('qr-1');
      expect(r.seat).toEqual({ row: 7, seat: 2 });
      expect(r.status).toBe('VALID');
    });
  });
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement and replace old `getPublicByQr` with two methods**

Remove `getPublicByQr` (the old method), add:

```ts
async getPublicMaster(viewerCode: string) {
  const booking = await this.prisma.booking.findUnique({
    where: { viewerCode },
    include: {
      screening: { include: { movie: true, hall: { include: { branch: true } } } },
      seats: { include: { seat: true, ticket: true } },
    },
  });
  if (!booking) throw new NotFoundException('Booking not found');
  return {
    movie: {
      title: booking.screening.movie.title,
      posterUrl: booking.screening.movie.posterUrl ?? null,
      ageRating: booking.screening.movie.ageRating,
      duration: booking.screening.movie.duration,
    },
    branch: { name: booking.screening.hall.branch.name },
    hall: { name: booking.screening.hall.name },
    startTime: booking.screening.startTime.toISOString(),
    seats: booking.seats
      .filter((bs) => bs.ticket !== null)
      .map((bs) => ({
        row: bs.seat.rowNumber,
        seat: bs.seat.seatNumber,
        qrCode: bs.ticket!.qrCode,
        status: bs.ticket!.status,
        scannedAt: bs.ticket!.scannedAt ? bs.ticket!.scannedAt.toISOString() : null,
      })),
  };
}

async getPublicTicket(qrCode: string) {
  const ticket = await this.prisma.ticket.findUnique({
    where: { qrCode },
    include: {
      bookingSeat: {
        include: {
          seat: true,
          booking: {
            include: {
              screening: { include: { movie: true, hall: { include: { branch: true } } } },
            },
          },
        },
      },
    },
  });
  if (!ticket) throw new NotFoundException('Ticket not found');
  const { bookingSeat } = ticket;
  return {
    qrCode: ticket.qrCode,
    status: ticket.status,
    scannedAt: ticket.scannedAt ? ticket.scannedAt.toISOString() : null,
    seat: { row: bookingSeat.seat.rowNumber, seat: bookingSeat.seat.seatNumber },
    movie: {
      title: bookingSeat.booking.screening.movie.title,
      posterUrl: bookingSeat.booking.screening.movie.posterUrl ?? null,
      ageRating: bookingSeat.booking.screening.movie.ageRating,
      duration: bookingSeat.booking.screening.movie.duration,
    },
    branch: { name: bookingSeat.booking.screening.hall.branch.name },
    hall: { name: bookingSeat.booking.screening.hall.name },
    startTime: bookingSeat.booking.screening.startTime.toISOString(),
  };
}
```

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Commit**

```bash
git add src/ticket/ticket.service.{ts,spec.ts}
git commit -m "feat(ticket): public master and per-seat viewers"
```

---

### Task 8: Remove old `validateQr`/`scanTicket` aliases & finalize service

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`

- [ ] **Step 1: Delete dead methods**

In `ticket.service.ts`, delete the old `generateTicket`, `validateQr`, and old `scanTicket(qrCode, scannedById)` (the booking-level one). The new `scanTicket` from Task 5 stays.

Also delete any remaining `getPublicByQr` references if Task 7 left a stub.

- [ ] **Step 2: Run all ticket tests**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/ticket
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/ticket/ticket.service.ts
git commit -m "refactor(ticket): remove deprecated booking-level ticket methods"
```

---

## Phase 3 — Backend DTOs and Controllers

### Task 9: Define DTOs

**Files:**
- Create: `~/Desktop/ZeroWaiting_backend/src/ticket/dto/validated-master-ticket.dto.ts`
- Create: `~/Desktop/ZeroWaiting_backend/src/ticket/dto/public-master-ticket.dto.ts`
- Create: `~/Desktop/ZeroWaiting_backend/src/ticket/dto/scan-master.dto.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/dto/validated-ticket.dto.ts`

- [ ] **Step 1: Create `scan-master.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ScanMasterDto {
  @ApiProperty({ type: [String], description: 'Ticket IDs to redeem' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ticketIds!: string[];
}
```

- [ ] **Step 2: Create `validated-master-ticket.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import type { TicketStatus } from '@prisma/client';

class MovieDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  title!: Record<string, unknown>;
  @ApiProperty({ type: 'string', nullable: true }) posterUrl!: string | null;
  @ApiProperty() ageRating!: string;
  @ApiProperty() duration!: number;
}
class BranchDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  name!: Record<string, unknown>;
}
class HallDto {
  @ApiProperty() name!: string;
  @ApiProperty({ type: BranchDto }) branch!: BranchDto;
}
class ScreeningDto {
  @ApiProperty() id!: string;
  @ApiProperty() startTime!: string;
  @ApiProperty({ type: MovieDto }) movie!: MovieDto;
  @ApiProperty({ type: HallDto }) hall!: HallDto;
}
class BookingDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: ScreeningDto }) screening!: ScreeningDto;
}
class MasterSeatDto {
  @ApiProperty() ticketId!: string;
  @ApiProperty() qrCode!: string;
  @ApiProperty() seatId!: string;
  @ApiProperty() row!: number;
  @ApiProperty() seat!: number;
  @ApiProperty({ enum: ['VALID', 'USED', 'CANCELLED', 'EXPIRED'] })
  status!: TicketStatus;
  @ApiProperty({ type: 'string', nullable: true }) scannedAt!: string | null;
  @ApiProperty({ type: 'string', nullable: true }) scannedById!: string | null;
  @ApiProperty() canRevert!: boolean;
}
export class ValidatedMasterTicketDto {
  @ApiProperty({ type: BookingDto }) booking!: BookingDto;
  @ApiProperty({ type: [MasterSeatDto] }) seats!: MasterSeatDto[];
}
```

- [ ] **Step 3: Create `public-master-ticket.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import type { TicketStatus } from '@prisma/client';

class MovieDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  title!: Record<string, unknown>;
  @ApiProperty({ type: 'string', nullable: true }) posterUrl!: string | null;
  @ApiProperty() ageRating!: string;
  @ApiProperty() duration!: number;
}
class BranchDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  name!: Record<string, unknown>;
}
class HallDto {
  @ApiProperty() name!: string;
}
class PublicSeatDto {
  @ApiProperty() row!: number;
  @ApiProperty() seat!: number;
  @ApiProperty() qrCode!: string;
  @ApiProperty({ enum: ['VALID', 'USED', 'CANCELLED', 'EXPIRED'] })
  status!: TicketStatus;
  @ApiProperty({ type: 'string', nullable: true }) scannedAt!: string | null;
}
export class PublicMasterTicketDto {
  @ApiProperty({ type: MovieDto }) movie!: MovieDto;
  @ApiProperty({ type: BranchDto }) branch!: BranchDto;
  @ApiProperty({ type: HallDto }) hall!: HallDto;
  @ApiProperty() startTime!: string;
  @ApiProperty({ type: [PublicSeatDto] }) seats!: PublicSeatDto[];
}
```

- [ ] **Step 4: Rewrite `validated-ticket.dto.ts`**

Replace the file content with the per-seat shape:

```ts
import { ApiProperty } from '@nestjs/swagger';
import type { TicketStatus } from '@prisma/client';

class MovieDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  title!: Record<string, unknown>;
  @ApiProperty({ type: 'string', nullable: true }) posterUrl!: string | null;
  @ApiProperty() ageRating!: string;
  @ApiProperty() duration!: number;
}
class BranchDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  name!: Record<string, unknown>;
}
class HallDto {
  @ApiProperty() name!: string;
  @ApiProperty({ type: BranchDto }) branch!: BranchDto;
}
class ScreeningDto {
  @ApiProperty() id!: string;
  @ApiProperty() startTime!: string;
  @ApiProperty({ type: MovieDto }) movie!: MovieDto;
  @ApiProperty({ type: HallDto }) hall!: HallDto;
}
class BookingDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: ScreeningDto }) screening!: ScreeningDto;
}
class SeatDto {
  @ApiProperty() row!: number;
  @ApiProperty() seat!: number;
}
export class ValidatedTicketDto {
  @ApiProperty() ticketId!: string;
  @ApiProperty() qrCode!: string;
  @ApiProperty({ enum: ['VALID', 'USED', 'CANCELLED', 'EXPIRED'] })
  status!: TicketStatus;
  @ApiProperty({ type: 'string', nullable: true }) scannedAt!: string | null;
  @ApiProperty() canRevert!: boolean;
  @ApiProperty({ type: SeatDto }) seat!: SeatDto;
  @ApiProperty({ type: BookingDto }) booking!: BookingDto;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/ticket/dto
git commit -m "feat(ticket): DTOs for partial-redeem endpoints"
```

---

### Task 10: Rewrite `ticket.controller.ts`

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.controller.ts`

- [ ] **Step 1: Replace controller content**

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { TicketService } from './ticket.service';
import { TicketEntity } from '../generated/nestjs-dto';
import { ValidatedTicketDto } from './dto/validated-ticket.dto';
import { ValidatedMasterTicketDto } from './dto/validated-master-ticket.dto';
import { ScanMasterDto } from './dto/scan-master.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Tickets')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('tickets/master/:viewerCode/validate')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: '[STAFF+] Validate master (booking) ticket by viewerCode' })
  @ApiParam({ name: 'viewerCode', type: 'string' })
  @ApiResponse({ status: 200, type: ValidatedMasterTicketDto })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  validateMaster(@Param('viewerCode') viewerCode: string, @Req() req: Request) {
    return this.ticketService.validateMaster(viewerCode, req.user.id);
  }

  @Patch('tickets/master/:viewerCode/scan')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: '[STAFF+] Partial-redeem selected tickets of a booking' })
  @ApiParam({ name: 'viewerCode', type: 'string' })
  @ApiResponse({ status: 200, description: '{ redeemed, skipped }' })
  @ApiResponse({ status: 400, description: 'ticketIds not in booking' })
  scanMaster(
    @Param('viewerCode') viewerCode: string,
    @Body() dto: ScanMasterDto,
    @Req() req: Request,
  ) {
    return this.ticketService.scanMaster(viewerCode, dto.ticketIds, req.user.id);
  }

  @Get('tickets/:qrCode/validate')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: '[STAFF+] Validate single-seat ticket by qrCode' })
  @ApiParam({ name: 'qrCode', type: 'string' })
  @ApiResponse({ status: 200, type: ValidatedTicketDto })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  validateQr(@Param('qrCode') qrCode: string, @Req() req: Request) {
    return this.ticketService.validateTicket(qrCode, req.user.id);
  }

  @Patch('tickets/:qrCode/scan')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: '[STAFF+] Mark single-seat ticket USED' })
  @ApiParam({ name: 'qrCode', type: 'string' })
  @ApiResponse({ status: 200, type: TicketEntity })
  @ApiResponse({ status: 409, description: 'Ticket not VALID' })
  scanTicket(@Param('qrCode') qrCode: string, @Req() req: Request) {
    return this.ticketService.scanTicket(qrCode, req.user.id);
  }

  @Patch('tickets/:qrCode/revert')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: '[STAFF+] Revert ticket within 60s by same staff' })
  @ApiParam({ name: 'qrCode', type: 'string' })
  @ApiResponse({ status: 200, type: TicketEntity })
  @ApiResponse({ status: 403, description: 'Different staff' })
  @ApiResponse({ status: 410, description: 'Window expired' })
  revertTicket(@Param('qrCode') qrCode: string, @Req() req: Request) {
    return this.ticketService.revertTicket(qrCode, req.user.id);
  }
}
```

- [ ] **Step 2: Build and verify TypeScript compiles**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/ticket/ticket.controller.ts
git commit -m "feat(ticket): controller endpoints for partial redeem and revert"
```

---

### Task 11: Update `public-ticket.controller.ts`

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/public-ticket.controller.ts`

- [ ] **Step 1: Replace controller**

```ts
import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TicketService } from './ticket.service';
import { PublicMasterTicketDto } from './dto/public-master-ticket.dto';

@ApiTags('Public Tickets')
@Controller('public/tickets')
export class PublicTicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('master/:viewerCode')
  @ApiOperation({ summary: 'Public master ticket by viewerCode (no auth)' })
  @ApiParam({ name: 'viewerCode', type: 'string' })
  @ApiResponse({ status: 200, type: PublicMasterTicketDto })
  getMaster(@Param('viewerCode') viewerCode: string) {
    return this.ticketService.getPublicMaster(viewerCode);
  }

  @Get(':qrCode')
  @ApiOperation({ summary: 'Public single-seat ticket by qrCode (no auth)' })
  @ApiParam({ name: 'qrCode', type: 'string' })
  getTicket(@Param('qrCode') qrCode: string) {
    return this.ticketService.getPublicTicket(qrCode);
  }
}
```

- [ ] **Step 2: Build**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/ticket/public-ticket.controller.ts
git commit -m "feat(ticket): public master and per-seat viewer endpoints"
```

---

## Phase 4 — Backend Listener, Mail, Audit Log

### Task 12: Update `booking-paid.listener.ts`

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/booking/listeners/booking-paid.listener.ts`

- [ ] **Step 1: Switch to per-seat ticket generation + new mail signature**

Replace lines 22-118 (`@OnEvent('booking.paid') async handleTicketsAndEmail`) with:

```ts
  @OnEvent('booking.paid')
  async handleTicketsAndEmail(event: BookingPaidEvent) {
    this.logger.log(
      `[diag] booking.paid received bookingId=${event.bookingId} userId=${event.userId ?? 'null'} guestEmail=${event.guestEmail ?? 'null'}`,
    );

    let tickets;
    try {
      tickets = await this.ticketService.generateTicketsForBooking(event.bookingId);
      this.logger.log(`[diag] ${tickets.length} tickets created for booking ${event.bookingId}`);
    } catch (error) {
      this.logger.error(
        `Failed to generate tickets for booking ${event.bookingId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return;
    }

    try {
      const recipientEmail = event.userId
        ? (
            await this.prisma.user.findUnique({
              where: { id: event.userId },
              select: { email: true },
            })
          )?.email
        : event.guestEmail;

      if (!recipientEmail) return;

      const booking = await this.prisma.booking.findUnique({
        where: { id: event.bookingId },
        include: {
          seats: { include: { seat: true, ticket: true } },
          screening: {
            include: {
              movie: true,
              hall: { include: { branch: true } },
            },
          },
        },
      });
      if (!booking) return;

      await this.mailService.sendTicketEmail(
        recipientEmail,
        {
          id: booking.id,
          totalPrice: booking.totalPrice.toNumber(),
          seats: booking.seats.map((bs) => ({
            seat: {
              rowNumber: bs.seat.rowNumber,
              seatNumber: bs.seat.seatNumber,
            },
            ticket: bs.ticket ? { qrCode: bs.ticket.qrCode } : null,
          })),
          screening: {
            startTime: booking.screening.startTime,
            endTime: booking.screening.endTime,
            format: booking.screening.format,
            movie: {
              title: booking.screening.movie.title,
              posterUrl: booking.screening.movie.posterUrl,
              duration: booking.screening.movie.duration,
              genres: booking.screening.movie.genres,
              ageRating: booking.screening.movie.ageRating,
            },
            hall: {
              name: booking.screening.hall.name,
              branch: { name: booking.screening.hall.branch.name },
            },
          },
        },
        { viewerCode: booking.viewerCode },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ticket email for booking ${event.bookingId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
```

- [ ] **Step 2: Build**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run build
```

(Will fail on mail signature — fixed in Task 13.)

- [ ] **Step 3: Commit**

```bash
git add src/booking/listeners/booking-paid.listener.ts
git commit -m "feat(booking): generate per-seat tickets and pass viewerCode to mail"
```

---

### Task 13: Update `mail.service.ts` `sendTicketEmail`

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/mail/mail.service.ts`

- [ ] **Step 1: Update the seats type and signature**

Find the `TicketEmailBooking` type (top of file) and update:

```ts
type TicketEmailBooking = {
  id: string;
  totalPrice: number;
  seats: Array<{
    seat: { rowNumber: number; seatNumber: number };
    ticket: { qrCode: string } | null;
  }>;
  screening: { /* unchanged */ };
};
```

Then change the method signature on line 47 from:

```ts
async sendTicketEmail(
  to: string,
  booking: TicketEmailBooking,
  ticket: { qrCode: string },
) {
```

to:

```ts
async sendTicketEmail(
  to: string,
  booking: TicketEmailBooking,
  master: { viewerCode: string },
) {
```

Then on line 73 change:

```ts
const qrUrl = `${appUrl}/t/${ticket.qrCode}`;
```

to:

```ts
const qrUrl = `${appUrl}/t/m/${master.viewerCode}`;
```

- [ ] **Step 2: Add per-seat URLs list to the HTML body**

In the same file, locate where `seatsHtml` is built (`const seatsHtml = seatsLines.join('<br/>');`). After that variable, add per-seat URL list:

```ts
const perSeatLinks = booking.seats
  .filter((bs) => bs.ticket)
  .map((bs) => {
    const url = `${appUrl}/t/${bs.ticket!.qrCode}`;
    return `<a href="${url}" style="color:#a855f7; text-decoration:none; font-size:12px;">Ряд ${bs.seat.rowNumber}, место ${bs.seat.seatNumber}</a>`;
  })
  .join('<br/>');
```

In the HTML body, find the row that displays "Места" (around line 129) and after the existing block, append a section:

```ts
const perSeatBlock = perSeatLinks
  ? `<div style="margin-top:14px; padding-top:14px; border-top:1px dashed #2d2d3d;">
      <div style="color:#9494a5; font-size:12px; margin-bottom:6px;">Индивидуальные QR-билеты:</div>
      ${perSeatLinks}
    </div>`
  : '';
```

Then inject `${perSeatBlock}` into the HTML where appropriate (right before the perforation `<table>`). Preserve all existing markup.

- [ ] **Step 3: Build**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run build
```

Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/mail/mail.service.ts
git commit -m "feat(mail): use viewerCode QR + per-seat ticket links in email"
```

---

### Task 14: Wire audit-log into mutations

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.module.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`

- [ ] **Step 1: Inject `AuditLogService` into `TicketService`**

In `ticket.module.ts`, add `AuditLogModule` to imports:

```ts
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [PrismaModule, AuditLogModule],
  // ...
})
```

In `ticket.service.ts`, modify the constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLog: AuditLogService,
) {}
```

Add import: `import { AuditLogService } from '../audit-log/audit-log.service';`

- [ ] **Step 2: Log in mutations**

After successful return in `scanMaster`, before returning add:

```ts
await this.auditLog.log(
  'TICKET_SCAN_MASTER',
  'Ticket',
  booking.id,
  actorId,
  { redeemedIds: redeemed.map((t) => t.id), skippedIds: skipped.map((t) => t.id) },
);
```

In `scanTicket` after the update succeeds:

```ts
await this.auditLog.log('TICKET_SCAN', 'Ticket', result.id, actorId, { qrCode });
```

(rename the `update` return to `result` if needed.)

In `revertTicket` after the update:

```ts
await this.auditLog.log('TICKET_REVERT', 'Ticket', updated.id, actorId, { qrCode });
```

(name the return `updated`.)

- [ ] **Step 3: Update spec mocks if needed**

Tests don't assert audit-log calls, but the constructor changed. In `ticket.service.spec.ts` add mock provider:

```ts
const mockAudit = { log: jest.fn() };
// in providers:
{ provide: AuditLogService, useValue: mockAudit },
```

And add the import.

- [ ] **Step 4: Run tests**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/ticket
```

- [ ] **Step 5: Commit**

```bash
git add src/ticket
git commit -m "feat(ticket): audit-log entries for scan/revert/scan-master"
```

---

### Task 15: Cron — `expireTickets` for past screenings

**Files:**
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.service.ts`
- Modify: `~/Desktop/ZeroWaiting_backend/src/ticket/ticket.module.ts`

Locate any existing scheduler (search the codebase for `@Cron` or `ScheduleModule`):

```bash
cd ~/Desktop/ZeroWaiting_backend && grep -rn "ScheduleModule\|@Cron" src --include='*.ts' | head
```

If a scheduler exists in another module — replicate that pattern. If `@nestjs/schedule` isn't yet wired anywhere, this task adds it. The steps below assume it isn't.

- [ ] **Step 1: Install dependency (if missing)**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun add @nestjs/schedule
```

- [ ] **Step 2: Wire `ScheduleModule` in `app.module.ts`**

Add to imports of `AppModule`:

```ts
import { ScheduleModule } from '@nestjs/schedule';
// ...
imports: [
  ScheduleModule.forRoot(),
  // ...other modules
],
```

- [ ] **Step 3: Add `expireTickets` to `TicketService`**

```ts
import { Cron, CronExpression } from '@nestjs/schedule';

// inside the class:
@Cron(CronExpression.EVERY_HOUR)
async expireTickets() {
  const now = new Date();
  await this.prisma.ticket.updateMany({
    where: {
      status: 'VALID',
      bookingSeat: { booking: { screening: { endTime: { lt: now } } } },
    },
    data: { status: 'EXPIRED' },
  });
}
```

- [ ] **Step 4: Add unit test**

```ts
  describe('expireTickets', () => {
    it('marks VALID tickets EXPIRED for ended screenings', async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 5 });
      await service.expireTickets();
      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ status: 'VALID' }),
        data: { status: 'EXPIRED' },
      });
    });
  });
```

- [ ] **Step 5: Run, build**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun test src/ticket && bun run build
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(ticket): hourly cron expires VALID tickets for past screenings"
```

---

### Task 16: Verify backend smoke flow

- [ ] **Step 1: Start backend**

```bash
cd ~/Desktop/ZeroWaiting_backend && bun run dev
```

- [ ] **Step 2: Hit endpoints**

In another terminal:

```bash
# Get a booking from seed/db (adjust id)
curl -s http://localhost:5000/api/v1/public/tickets/master/<viewerCode> | jq
```

Expected: `seats: [...]` array with per-seat status fields.

- [ ] **Step 3: Stop server, commit any logs cleanup**

If nothing changed, no commit needed.

---

## Phase 5 — Frontend API Regen and Utility Updates

### Task 17: Regenerate Orval API client

**Files:**
- Modify (auto-generated): `~/Desktop/ZeroWaiting_frontend/src/api/...`

- [ ] **Step 1: Run generator**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run generate:api
```

Expected: typings updated, including new endpoints `getTicketsMasterByViewerCodeValidateV1`, `patchTicketsMasterByViewerCodeScanV1Mutation`, `patchTicketsByQrCodeRevertV1Mutation`, `getPublicTicketsMasterByViewerCodeV1`, and updated `getTicketsByQrCodeValidateV1` shape.

- [ ] **Step 2: Verify build still works**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

Expected: type errors in places that still call the old shapes (these are fixed in subsequent tasks). If errors mention only old usages we'll touch — proceed.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/ZeroWaiting_frontend
git add src/api
git commit -m "chore(api): regenerate client for partial-redeem endpoints"
```

---

### Task 18: Update `parse-ticket-url.ts` to discriminated union

**Files:**
- Modify: `~/Desktop/ZeroWaiting_frontend/src/lib/utils/parse-ticket-url.ts`
- Modify: `~/Desktop/ZeroWaiting_frontend/src/lib/utils/parse-ticket-url.test.ts`

- [ ] **Step 1: Read current implementation**

```bash
cat /Users/elcho/Desktop/ZeroWaiting_frontend/src/lib/utils/parse-ticket-url.ts
```

- [ ] **Step 2: Update tests first (TDD)**

Replace `parse-ticket-url.test.ts` content:

```ts
import { describe, it, expect } from 'vitest';
import { parseTicketQr } from './parse-ticket-url';

describe('parseTicketQr', () => {
  it('parses master URL', () => {
    expect(parseTicketQr('https://zerowaiting.app/t/m/abc-123')).toEqual({
      kind: 'master',
      token: 'abc-123',
    });
  });

  it('parses per-seat URL', () => {
    expect(parseTicketQr('https://zerowaiting.app/t/abc-123')).toEqual({
      kind: 'seat',
      token: 'abc-123',
    });
  });

  it('parses raw token as per-seat', () => {
    expect(parseTicketQr('abc-123')).toEqual({ kind: 'seat', token: 'abc-123' });
  });

  it('returns null for unrelated URLs', () => {
    expect(parseTicketQr('https://google.com')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseTicketQr('')).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests — FAIL**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun test src/lib/utils/parse-ticket-url.test.ts
```

- [ ] **Step 4: Update `parse-ticket-url.ts`**

```ts
export type ParsedTicketQr =
  | { kind: 'master'; token: string }
  | { kind: 'seat'; token: string }
  | null;

const TOKEN_RE = /^[a-zA-Z0-9-]+$/;

export const parseTicketQr = (raw: string): ParsedTicketQr => {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Try URL form
  try {
    const url = new URL(trimmed);
    const masterMatch = url.pathname.match(/\/t\/m\/([^/]+)\/?$/);
    if (masterMatch) return { kind: 'master', token: masterMatch[1] };
    const seatMatch = url.pathname.match(/\/t\/([^/]+)\/?$/);
    if (seatMatch) return { kind: 'seat', token: seatMatch[1] };
    return null;
  } catch {
    // not a URL — treat as raw token
    if (TOKEN_RE.test(trimmed)) return { kind: 'seat', token: trimmed };
    return null;
  }
};
```

- [ ] **Step 5: Run — passes**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun test src/lib/utils/parse-ticket-url.test.ts
```

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/ZeroWaiting_frontend
git add src/lib/utils/parse-ticket-url.{ts,test.ts}
git commit -m "feat(utils): parseTicketQr returns discriminated master|seat union"
```

---

## Phase 6 — Frontend Shared Components

### Task 19: `ShareButton.svelte`

**Files:**
- Create: `~/Desktop/ZeroWaiting_frontend/src/components/booking/ShareButton.svelte`

- [ ] **Step 1: Create file**

```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Icon from '@iconify/svelte';
  import toast from 'svelte-french-toast';

  interface Props {
    url: string;
    title?: string;
    text?: string;
    iconOnly?: boolean;
  }

  const { url, title, text, iconOnly = false }: Props = $props();

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title, text });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success($_('ticket.shareCopied'));
    } catch {
      toast.error($_('scanner.errors.network'));
    }
  };
</script>

<button type="button" class="share_btn" class:icon_only={iconOnly} onclick={handleShare} aria-label={$_('ticket.share')}>
  <Icon icon="lucide:share-2" width={iconOnly ? 18 : 16} />
  {#if !iconOnly}<span>{$_('ticket.share')}</span>{/if}
</button>

<style lang="scss">
  .share_btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--foreground);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: border-color var(--duration-fast) var(--ease-default);

    &:hover { border-color: var(--primary); color: var(--primary-light); }

    &.icon_only {
      padding: var(--space-2);
      border-radius: 50%;
    }
  }
</style>
```

- [ ] **Step 2: Type-check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/ShareButton.svelte
git commit -m "feat(booking): ShareButton component with navigator.share + clipboard fallback"
```

---

### Task 20: `RevertCountdown.svelte`

**Files:**
- Create: `~/Desktop/ZeroWaiting_frontend/src/routes/scanner/components/RevertCountdown.svelte`

- [ ] **Step 1: Create file**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    durationMs: number;
    onExpire: () => void;
  }

  const { durationMs, onExpire }: Props = $props();

  let remaining = $state(durationMs);
  let interval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    const start = Date.now();
    interval = setInterval(() => {
      remaining = Math.max(0, durationMs - (Date.now() - start));
      if (remaining === 0 && interval) {
        clearInterval(interval);
        interval = null;
        onExpire();
      }
    }, 250);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  const seconds = $derived(Math.ceil(remaining / 1000));
</script>

<span class="revert_countdown">{seconds}</span>

<style lang="scss">
  .revert_countdown {
    display: inline-block;
    min-width: 20px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--muted-fg);
    font-size: var(--text-sm);
  }
</style>
```

- [ ] **Step 2: Type-check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/scanner/components/RevertCountdown.svelte
git commit -m "feat(scanner): RevertCountdown component with onExpire callback"
```

---

## Phase 7 — Ticket Viewer (Tabs + QR Grid)

### Task 21: `SeatTicketCard.svelte`

**Files:**
- Create: `~/Desktop/ZeroWaiting_frontend/src/components/booking/SeatTicketCard.svelte`

- [ ] **Step 1: Create file**

```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import QrCode from '@/components/ui/QrCode.svelte';
  import Badge from '@/components/ui/Badge.svelte';
  import ShareButton from '@/components/booking/ShareButton.svelte';
  import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';

  interface Props {
    row: number;
    seat: number;
    qrCode: string;
    status: string;
    origin: string;
  }

  const { row, seat, qrCode, status, origin }: Props = $props();

  const url = $derived(`${origin}/t/${qrCode}`);
  const statusConfig = $derived(
    TICKET_STATUS_CONFIG[status] ?? { labelKey: `booking.ticketStatus.${status}`, color: 'var(--muted-fg)' }
  );
</script>

<div class="seat_ticket_card">
  <QrCode value={url} size={140} />
  <div class="seat_label">{$_('ticket.rowSeat', { values: { row, seats: seat } })}</div>
  <Badge text={$_(statusConfig.labelKey)} color={statusConfig.color} />
  <ShareButton {url} iconOnly />
</div>

<style lang="scss">
  .seat_ticket_card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface);
    border: 1px solid var(--border-color);

    .seat_label {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--foreground);
    }
  }
</style>
```

- [ ] **Step 2: Type-check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/SeatTicketCard.svelte
git commit -m "feat(booking): SeatTicketCard for individual QR grid"
```

---

### Task 22: `TicketTabsMaster.svelte` and `TicketTabsIndividual.svelte`

**Files:**
- Create: `~/Desktop/ZeroWaiting_frontend/src/components/booking/TicketTabsMaster.svelte`
- Create: `~/Desktop/ZeroWaiting_frontend/src/components/booking/TicketTabsIndividual.svelte`

- [ ] **Step 1: Create `TicketTabsMaster.svelte`**

```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import QrCode from '@/components/ui/QrCode.svelte';
  import Badge from '@/components/ui/Badge.svelte';
  import SeatsSummary from '@/components/booking/SeatsSummary.svelte';
  import ShareButton from '@/components/booking/ShareButton.svelte';

  interface Seat {
    row: number;
    seat: number;
    status: string;
  }
  interface Props {
    viewerUrl: string;
    seats: Seat[];
  }

  const { viewerUrl, seats }: Props = $props();

  const usedCount = $derived(seats.filter((s) => s.status === 'USED').length);
  const total = $derived(seats.length);

  const summary = $derived(() => {
    if (usedCount === 0) return { key: 'booking.ticketStatus.VALID', color: 'var(--success)' };
    if (usedCount === total) return { key: 'booking.ticketStatus.USED', color: 'var(--muted-fg)' };
    return { key: 'ticket.statusPartiallyUsed', color: 'var(--warning)' };
  });

  const seatsForSummary = $derived(seats.map((s) => ({ rowNumber: s.row, seatNumber: s.seat })));
</script>

<div class="master_tab">
  <QrCode value={viewerUrl} size={240} />
  <SeatsSummary seats={seatsForSummary} />
  <Badge
    text={$_(summary().key, { values: { count: usedCount, total } })}
    color={summary().color}
  />
  <p class="hint">{$_('ticket.entryWithThisQr')}</p>
  <ShareButton url={viewerUrl} title={$_('ticket.share')} />
</div>

<style lang="scss">
  .master_tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);

    .hint {
      color: var(--muted-fg);
      font-size: var(--text-sm);
      text-align: center;
      margin: 0;
    }
  }
</style>
```

- [ ] **Step 2: Create `TicketTabsIndividual.svelte`**

```svelte
<script lang="ts">
  import SeatTicketCard from '@/components/booking/SeatTicketCard.svelte';

  interface Seat {
    row: number;
    seat: number;
    qrCode: string;
    status: string;
  }
  interface Props {
    seats: Seat[];
    origin: string;
  }

  const { seats, origin }: Props = $props();
</script>

<div class="grid">
  {#each seats as seat (seat.qrCode)}
    <SeatTicketCard
      row={seat.row}
      seat={seat.seat}
      qrCode={seat.qrCode}
      status={seat.status}
      {origin}
    />
  {/each}
</div>

<style lang="scss">
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-3);
  }
</style>
```

- [ ] **Step 3: Type-check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

- [ ] **Step 4: Commit**

```bash
git add src/components/booking/TicketTabs*.svelte
git commit -m "feat(booking): TicketTabsMaster and TicketTabsIndividual components"
```

---

### Task 23: `TicketViewer.svelte` — root with tabs

**Files:**
- Create: `~/Desktop/ZeroWaiting_frontend/src/components/booking/TicketViewer.svelte`

- [ ] **Step 1: Create file**

```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Icon from '@iconify/svelte';
  import TicketTabsMaster from '@/components/booking/TicketTabsMaster.svelte';
  import TicketTabsIndividual from '@/components/booking/TicketTabsIndividual.svelte';

  interface Seat {
    row: number;
    seat: number;
    qrCode: string;
    status: string;
  }
  interface Props {
    viewerUrl: string;
    origin: string;
    seats: Seat[];
  }

  const { viewerUrl, origin, seats }: Props = $props();

  type Tab = 'master' | 'individual';
  let active = $state<Tab>('master');
</script>

<div class="ticket_viewer glass-card">
  <div class="tabs">
    <button class:active={active === 'master'} onclick={() => (active = 'master')}>
      <Icon icon="lucide:qr-code" width={16} />
      {$_('ticket.tabs.master')}
    </button>
    <button class:active={active === 'individual'} onclick={() => (active = 'individual')}>
      <Icon icon="lucide:layout-grid" width={16} />
      {$_('ticket.tabs.individual')}
    </button>
  </div>

  <div class="tab_content">
    {#if active === 'master'}
      <TicketTabsMaster {viewerUrl} {seats} />
    {:else}
      <TicketTabsIndividual {seats} {origin} />
    {/if}
  </div>
</div>

<style lang="scss">
  .ticket_viewer {
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);

    .tabs {
      display: flex;
      gap: var(--space-2);
      border-bottom: 1px solid var(--border-color);

      button {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        background: transparent;
        border: 0;
        border-bottom: 2px solid transparent;
        color: var(--muted-fg);
        font-size: var(--text-sm);
        cursor: pointer;

        &.active {
          color: var(--primary-light);
          border-bottom-color: var(--primary);
        }
      }
    }

    .tab_content {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
  }
</style>
```

- [ ] **Step 2: Type-check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/TicketViewer.svelte
git commit -m "feat(booking): TicketViewer root with master/individual tabs"
```

---

## Phase 8 — Frontend Routes Update

### Task 24: Public viewer route `/t/m/[viewerCode]`

**Files:**
- Create: `~/Desktop/ZeroWaiting_frontend/src/routes/t/m/[viewerCode]/+page.ts`
- Create: `~/Desktop/ZeroWaiting_frontend/src/routes/t/m/[viewerCode]/+page.svelte`

- [ ] **Step 1: Create `+page.ts`**

```ts
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'https://api-zerowaiting.elcho.dev';
  const res = await fetch(`${apiBase}/api/v1/public/tickets/master/${params.viewerCode}`);
  if (!res.ok) throw error(res.status, 'Booking not found');
  return { master: await res.json(), viewerCode: params.viewerCode };
};
```

- [ ] **Step 2: Create `+page.svelte`**

```svelte
<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import { getLocalizedValue } from '@/lib/utils/i18n-field';
  import { formatDateTime } from '@/lib/utils/datetime';
  import TicketViewer from '@/components/booking/TicketViewer.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const movieTitle = $derived(getLocalizedValue(data.master.movie.title, $locale));
  const branchName = $derived(getLocalizedValue(data.master.branch.name, $locale));
  const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
  const viewerUrl = $derived(`${origin}/t/m/${data.viewerCode}`);
</script>

<svelte:head><title>{movieTitle} — ZeroWaiting</title></svelte:head>

<article class="public_master_card">
  <h1 class="title">{movieTitle}</h1>
  <p class="meta">{branchName} · {data.master.hall.name} · {formatDateTime(data.master.startTime)}</p>

  <TicketViewer {viewerUrl} {origin} seats={data.master.seats} />
</article>

<style lang="scss">
  .public_master_card {
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);

    .title { font-size: var(--text-xl); font-weight: var(--weight-bold); margin: 0; text-align: center; }
    .meta { color: var(--muted-fg); font-size: var(--text-sm); margin: 0; text-align: center; }
  }
</style>
```

- [ ] **Step 3: Type-check, browse**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/t/m
git commit -m "feat(routes): /t/m/[viewerCode] public master ticket viewer"
```

---

### Task 25: Update `/t/[qrCode]` to single-seat shape

**Files:**
- Modify: `~/Desktop/ZeroWaiting_frontend/src/routes/t/[qrCode]/+page.svelte`
- Check (likely create): `~/Desktop/ZeroWaiting_frontend/src/routes/t/[qrCode]/+page.ts`

- [ ] **Step 1: Verify or create `+page.ts`**

```bash
ls /Users/elcho/Desktop/ZeroWaiting_frontend/src/routes/t/[qrCode]/+page.ts 2>/dev/null || echo "missing"
```

If missing, create:

```ts
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'https://api-zerowaiting.elcho.dev';
  const res = await fetch(`${apiBase}/api/v1/public/tickets/${params.qrCode}`);
  if (!res.ok) throw error(res.status, 'Ticket not found');
  return { ticket: await res.json() };
};
```

If it exists, ensure it points to the per-seat endpoint above.

- [ ] **Step 2: Replace `+page.svelte` content** (single-seat shape)

```svelte
<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import Badge from '@/components/ui/Badge.svelte';
  import QrCode from '@/components/ui/QrCode.svelte';
  import ShareButton from '@/components/booking/ShareButton.svelte';
  import { getLocalizedValue } from '@/lib/utils/i18n-field';
  import { formatDateTime } from '@/lib/utils/datetime';
  import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const ticket = $derived(data.ticket);
  const movieTitle = $derived(getLocalizedValue(ticket.movie.title, $locale));
  const branchName = $derived(getLocalizedValue(ticket.branch.name, $locale));

  const url = $derived(typeof window !== 'undefined' ? window.location.href : '');

  const statusConfig = $derived(
    TICKET_STATUS_CONFIG[ticket.status] ?? {
      labelKey: `booking.ticketStatus.${ticket.status}`,
      color: 'var(--muted-fg)',
    }
  );
</script>

<svelte:head><title>{movieTitle} — ZeroWaiting</title></svelte:head>

<article class="public_ticket_card glass-card">
  {#if ticket.movie.posterUrl}
    <img class="poster" src={ticket.movie.posterUrl} alt="" />
  {/if}
  <h1 class="title">{movieTitle}</h1>
  <p class="meta">{branchName} · {ticket.hall.name} · {formatDateTime(ticket.startTime)}</p>

  <QrCode value={url} size={220} />
  <div class="seat">
    {$_('ticket.rowSeat', { values: { row: ticket.seat.row, seats: ticket.seat.seat } })}
  </div>

  <Badge text={$_(statusConfig.labelKey)} color={statusConfig.color} />
  {#if ticket.status === 'USED' && ticket.scannedAt}
    <p class="scanned_at">{$_('publicTicket.statusUsedAt', { values: { time: formatDateTime(ticket.scannedAt) } })}</p>
  {/if}

  <ShareButton {url} title={movieTitle} />
</article>

<style lang="scss">
  .public_ticket_card {
    max-width: 420px;
    margin: 0 auto;
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    text-align: center;

    .poster { max-width: 180px; border-radius: var(--radius-md); }
    .title { font-size: var(--text-xl); font-weight: var(--weight-bold); margin: 0; }
    .meta { color: var(--muted-fg); font-size: var(--text-sm); margin: 0; }
    .seat { font-weight: var(--weight-semibold); }
    .scanned_at { color: var(--muted-fg); font-size: var(--text-sm); margin: 0; }
  }
</style>
```

- [ ] **Step 3: Type-check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/t/\[qrCode\]
git commit -m "feat(routes): /t/[qrCode] is now a single-seat public ticket"
```

---

### Task 26: Update confirmation page

**Files:**
- Modify: `~/Desktop/ZeroWaiting_frontend/src/routes/(client)/booking/[bookingId]/confirmation/+page.svelte`

- [ ] **Step 1: Replace ticket block (lines 82-101) with TicketViewer**

Open the file and replace the `{#if ticket}...{/if}` block (lines 82-101) with:

```svelte
{#if booking.viewerCode && booking.seats}
  <div class="tickets">
    <h3 class="section_title">
      <Icon icon="lucide:qr-code" width={20} />
      {$_('booking.tickets')}
    </h3>
    <TicketViewer
      viewerUrl={`${origin}/t/m/${booking.viewerCode}`}
      {origin}
      seats={booking.seats.map((bs) => ({
        row: bs.seat.rowNumber,
        seat: bs.seat.seatNumber,
        qrCode: bs.ticket?.qrCode ?? '',
        status: bs.ticket?.status ?? 'VALID',
      })).filter((s) => s.qrCode)}
    />
  </div>
{/if}
```

Update imports at the top — replace `import QrCode from '@/components/ui/QrCode.svelte';` with `import TicketViewer from '@/components/booking/TicketViewer.svelte';` and remove unused imports (`SeatsSummary` if no longer referenced; verify by reading the rest of the file).

Add `origin` derived above the markup:

```ts
const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
```

Remove the now-unused `ticketQuery` (since tickets are embedded in `booking.seats[].ticket`), and the `ticketUrl` derivation.

- [ ] **Step 2: Type-check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

If `booking.viewerCode` or `booking.seats[].ticket` types missing — verify the API regen produced them. If not, run `bun run generate:api` again.

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(client\)/booking/\[bookingId\]/confirmation/+page.svelte
git commit -m "feat(booking): confirmation page uses TicketViewer with tabs"
```

---

## Phase 9 — Scanner Refactor

### Task 27: `MasterScanModal.svelte`

**Files:**
- Create: `~/Desktop/ZeroWaiting_frontend/src/routes/scanner/components/MasterScanModal.svelte`

- [ ] **Step 1: Create file**

```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Badge from '@/components/ui/Badge.svelte';
  import RevertCountdown from './RevertCountdown.svelte';
  import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';

  interface Seat {
    ticketId: string;
    row: number;
    seat: number;
    status: string;
    scannedAt: string | null;
    canRevert: boolean;
  }

  interface Props {
    seats: Seat[];
    pending: boolean;
    onSubmit: (ticketIds: string[]) => void;
    onRevert: (ticketId: string) => void;
    onCancel: () => void;
  }

  const { seats, pending, onSubmit, onRevert, onCancel }: Props = $props();

  const initialSelection = () =>
    new Set(seats.filter((s) => s.status === 'VALID').map((s) => s.ticketId));

  let selected = $state<Set<string>>(initialSelection());

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    selected = next;
  };

  const handleSubmit = () => onSubmit(Array.from(selected));

  const remainingMs = (scannedAt: string) =>
    Math.max(0, 60_000 - (Date.now() - new Date(scannedAt).getTime()));
</script>

<div class="modal_root">
  <h3 class="title">{$_('scanner.markUsedCount', { values: { count: selected.size } })}</h3>

  <ul class="seat_list">
    {#each seats as seat (seat.ticketId)}
      {@const isSelectable = seat.status === 'VALID'}
      {@const cfg = TICKET_STATUS_CONFIG[seat.status] ?? { labelKey: `booking.ticketStatus.${seat.status}`, color: 'var(--muted-fg)' }}
      <li class="seat_row" class:disabled={!isSelectable}>
        <label>
          <input
            type="checkbox"
            disabled={!isSelectable}
            checked={selected.has(seat.ticketId)}
            onchange={() => toggle(seat.ticketId)}
          />
          <span class="seat_label">
            {$_('ticket.rowSeat', { values: { row: seat.row, seats: seat.seat } })}
          </span>
        </label>
        <Badge text={$_(cfg.labelKey)} color={cfg.color} />
        {#if seat.canRevert && seat.scannedAt}
          <button type="button" class="revert_btn" onclick={() => onRevert(seat.ticketId)}>
            {$_('scanner.revertCountdown', { values: { seconds: '' } })}
            <RevertCountdown durationMs={remainingMs(seat.scannedAt)} onExpire={() => {}} />
          </button>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="actions">
    <button type="button" class="secondary" onclick={onCancel}>{$_('scanner.next')}</button>
    <button type="button" class="primary" disabled={pending || selected.size === 0} onclick={handleSubmit}>
      {$_('scanner.markUsedCount', { values: { count: selected.size } })}
    </button>
  </div>
</div>

<style lang="scss">
  .modal_root {
    background: #12121c;
    border-radius: var(--radius-xl);
    padding: var(--space-5);
    margin: var(--space-4);
    color: var(--foreground);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);

    .title { font-size: var(--text-lg); margin: 0; }

    .seat_list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);

      .seat_row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: rgba(255,255,255,0.03);

        &.disabled { opacity: 0.6; }

        label {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex: 1;
          cursor: pointer;
        }
      }

      .revert_btn {
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--warning);
        border-radius: var(--radius-sm);
        padding: 4px 8px;
        font-size: var(--text-xs);
      }
    }

    .actions {
      display: flex;
      gap: var(--space-3);

      .primary, .secondary {
        flex: 1;
        padding: var(--space-3);
        border-radius: var(--radius-md);
        font-weight: var(--weight-semibold);
        cursor: pointer;
        border: 0;
      }
      .primary { background: var(--primary); color: #fff; &:disabled { opacity: 0.5; } }
      .secondary { background: transparent; border: 1px solid var(--border-color); color: inherit; }
    }
  }
</style>
```

- [ ] **Step 2: Type-check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/scanner/components/MasterScanModal.svelte
git commit -m "feat(scanner): MasterScanModal with checkboxes and inline revert"
```

---

### Task 28: `SeatRedeemedView.svelte`

**Files:**
- Create: `~/Desktop/ZeroWaiting_frontend/src/routes/scanner/components/SeatRedeemedView.svelte`

- [ ] **Step 1: Create file**

```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Icon from '@iconify/svelte';
  import RevertCountdown from './RevertCountdown.svelte';

  interface Props {
    row: number;
    seat: number;
    canRevertMs: number;
    pending: boolean;
    onRevert: () => void;
    onNext: () => void;
  }

  const { row, seat, canRevertMs, pending, onRevert, onNext }: Props = $props();

  let revertVisible = $state(canRevertMs > 0);
</script>

<div class="success">
  <Icon icon="lucide:check-circle-2" width={64} />
  <p class="seat_label">{$_('ticket.rowSeat', { values: { row, seats: seat } })}</p>
  <p class="ok_msg">{$_('scanner.scanSuccess')}</p>

  <div class="actions">
    {#if revertVisible}
      <button type="button" class="revert" disabled={pending} onclick={onRevert}>
        {$_('scanner.revertCountdown', { values: { seconds: '' } })}
        <RevertCountdown durationMs={canRevertMs} onExpire={() => (revertVisible = false)} />
      </button>
    {/if}
    <button type="button" class="next" onclick={onNext}>{$_('scanner.next')}</button>
  </div>
</div>

<style lang="scss">
  .success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-6);
    color: var(--success);
    text-align: center;

    .seat_label { font-size: var(--text-xl); font-weight: var(--weight-bold); margin: 0; color: var(--foreground); }
    .ok_msg { margin: 0; font-size: var(--text-base); }

    .actions { display: flex; gap: var(--space-3); margin-top: var(--space-3); }

    .revert, .next {
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: var(--weight-semibold);
    }
    .revert { background: transparent; border: 1px solid var(--warning); color: var(--warning); }
    .next { background: transparent; border: 1px solid var(--border-color); color: var(--foreground); }
  }
</style>
```

- [ ] **Step 2: Type-check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/scanner/components/SeatRedeemedView.svelte
git commit -m "feat(scanner): SeatRedeemedView with 60s revert button"
```

---

### Task 29: Refactor `scanner/+page.svelte`

**Files:**
- Modify: `~/Desktop/ZeroWaiting_frontend/src/routes/scanner/+page.svelte`
- Delete: `~/Desktop/ZeroWaiting_frontend/src/routes/scanner/components/ScannerResult.svelte`

- [ ] **Step 1: Replace `scanner/+page.svelte` content**

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
  import { _ } from 'svelte-i18n';
  import toast from 'svelte-french-toast';
  import { crmQueryApi } from '@/api/endpoints';
  import { parseTicketQr, type ParsedTicketQr } from '@/lib/utils/parse-ticket-url';
  import { getErrorMessage } from '@/lib/utils/error';
  import MasterScanModal from './components/MasterScanModal.svelte';
  import SeatRedeemedView from './components/SeatRedeemedView.svelte';

  type Phase =
    | 'scanning'
    | 'masterModal'
    | 'seatRedeemed'
    | 'error';

  let videoEl = $state<HTMLVideoElement | undefined>();
  let phase = $state<Phase>('scanning');
  let errorMsg = $state('');

  let parsed = $state<ParsedTicketQr>(null);

  // Master state
  let masterValidate = crmQueryApi.createGetTicketsMasterByViewerCodeValidateV1(
    () => (parsed?.kind === 'master' ? parsed.token : ''),
    () => ({ query: { enabled: parsed?.kind === 'master' } })
  );
  const masterScan = crmQueryApi.createPatchTicketsMasterByViewerCodeScanV1Mutation();
  const seatScan = crmQueryApi.createPatchTicketsByQrCodeScanV1Mutation();
  const revert = crmQueryApi.createPatchTicketsByQrCodeRevertV1Mutation();

  // Per-seat redeemed state
  let redeemedSeat = $state<{ row: number; seat: number; qrCode: string; scannedAt: number } | null>(null);

  const reader = new BrowserMultiFormatReader();
  let controls: IScannerControls | null = null;
  let scanningStarted = false;

  const stopControls = () => { controls?.stop(); controls = null; scanningStarted = false; };

  const startScanning = async () => {
    if (!videoEl || scanningStarted) return;
    scanningStarted = true;
    try {
      controls = await reader.decodeFromVideoDevice(undefined, videoEl, async (result) => {
        if (!result) return;
        const p = parseTicketQr(result.getText());
        if (!p) {
          errorMsg = $_('scanner.errors.notFound');
          setTimeout(() => { if (phase === 'scanning') errorMsg = ''; }, 2000);
          return;
        }
        parsed = p;
        stopControls();
        if (p.kind === 'master') {
          phase = 'masterModal';
        } else {
          // seat — instant scan
          await instantScanSeat(p.token);
        }
      });
    } catch {
      scanningStarted = false;
      phase = 'error';
      errorMsg = $_('scanner.noCamera');
    }
  };

  const instantScanSeat = async (qrCode: string) => {
    try {
      // Validate first to get seat info
      const v = await crmQueryApi.getTicketsByQrCodeValidateV1(qrCode);
      if (v.status !== 'VALID') {
        errorMsg = $_(`scanner.errors.${v.status.toLowerCase()}`);
        phase = 'error';
        return;
      }
      const ticket = await seatScan.mutateAsync({ qrCode });
      redeemedSeat = {
        row: v.seat.row,
        seat: v.seat.seat,
        qrCode,
        scannedAt: Date.now(),
      };
      phase = 'seatRedeemed';
    } catch (e) {
      errorMsg = getErrorMessage(e, $_('scanner.errors.network'));
      phase = 'error';
    }
  };

  const handleMasterSubmit = async (ticketIds: string[]) => {
    if (!parsed || parsed.kind !== 'master') return;
    try {
      const result = await masterScan.mutateAsync({
        viewerCode: parsed.token,
        data: { ticketIds },
      });
      toast.success(
        $_('scanner.partialResult', {
          values: { redeemed: result.redeemed.length, skipped: result.skipped.length },
        }),
      );
      next();
    } catch (e) {
      toast.error(getErrorMessage(e, $_('scanner.errors.network')));
    }
  };

  const handleRevert = async (qrCode: string) => {
    try {
      await revert.mutateAsync({ qrCode });
      toast.success($_('scanner.revertSuccess'));
      next();
    } catch (e) {
      toast.error(getErrorMessage(e, $_('scanner.errors.revertExpired')));
    }
  };

  const handleSeatRevert = async () => {
    if (!redeemedSeat) return;
    await handleRevert(redeemedSeat.qrCode);
  };

  const next = () => {
    parsed = null;
    redeemedSeat = null;
    errorMsg = '';
    phase = 'scanning';
  };

  $effect(() => { if (videoEl && phase === 'scanning') startScanning(); });
  onDestroy(() => stopControls());
</script>

<div class="scanner_viewport">
  {#if phase === 'scanning'}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={videoEl} autoplay playsinline muted></video>
    <p class="scanner_hint">{$_('scanner.scanHint')}</p>
    {#if errorMsg}<p class="scanner_hint warn">{errorMsg}</p>{/if}
  {:else if phase === 'masterModal' && masterValidate.data}
    <MasterScanModal
      seats={masterValidate.data.seats}
      pending={masterScan.isPending}
      onSubmit={handleMasterSubmit}
      onRevert={(ticketId) => {
        const s = masterValidate.data!.seats.find((x) => x.ticketId === ticketId);
        if (s) handleRevert(s.qrCode);
      }}
      onCancel={next}
    />
  {:else if phase === 'masterModal' && masterValidate.isLoading}
    <p class="scanner_hint">…</p>
  {:else if phase === 'seatRedeemed' && redeemedSeat}
    <SeatRedeemedView
      row={redeemedSeat.row}
      seat={redeemedSeat.seat}
      canRevertMs={Math.max(0, 60_000 - (Date.now() - redeemedSeat.scannedAt))}
      pending={revert.isPending}
      onRevert={handleSeatRevert}
      onNext={next}
    />
  {:else}
    <p class="scanner_hint err">{errorMsg}</p>
    <button type="button" class="scanner_btn" onclick={next}>{$_('scanner.next')}</button>
  {/if}
</div>

<style lang="scss">
  .scanner_viewport {
    flex: 1;
    display: flex;
    flex-direction: column;

    video { width: 100%; height: 60vh; object-fit: cover; background: #000; }

    .scanner_hint {
      text-align: center;
      padding: var(--space-4);
      color: var(--muted-fg);

      &.err { color: var(--danger); }
      &.warn { color: var(--warning); }
    }

    .scanner_btn {
      margin: var(--space-3) var(--space-4);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--foreground);
      cursor: pointer;
    }
  }
</style>
```

- [ ] **Step 2: Delete old `ScannerResult.svelte`**

```bash
rm /Users/elcho/Desktop/ZeroWaiting_frontend/src/routes/scanner/components/ScannerResult.svelte
```

- [ ] **Step 3: Type-check**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

If `crmQueryApi.getTicketsByQrCodeValidateV1` (direct call, not store) doesn't exist as a non-store helper, replace `instantScanSeat` to use the store version. Inspect the regenerated client at `src/api/endpoints/tickets.ts` and adapt — typical Orval generates both a store-creating function and a raw call. If only the store exists, refactor to use `queryClient.fetchQuery`. Adapt to the actual generated API.

- [ ] **Step 4: Commit**

```bash
git add src/routes/scanner
git commit -m "feat(scanner): master modal + per-seat instant redeem with 60s revert"
```

---

## Phase 10 — i18n

### Task 30: Add new keys to all 5 locale files

**Files:**
- Modify: `~/Desktop/ZeroWaiting_frontend/src/lib/i18n/locales/{ru,en,ky,kz,uz}.json`

- [ ] **Step 1: Add to `ru.json`**

Insert these blocks under matching root keys (`ticket`, `scanner`):

```json
"ticket": {
  "tabs": { "master": "Общий QR", "individual": "По местам" },
  "share": "Поделиться",
  "shareCopied": "Ссылка скопирована",
  "statusPartiallyUsed": "Использовано {count} из {total}",
  "entryWithThisQr": "Покажите этот QR на входе",
  "rowSeat": "Ряд {row}, место {seats}",
  "rowSeats": "Ряд {row}, места {seats}"
},
"scanner": {
  "markUsedCount": "Погасить ({count})",
  "partialResult": "Погашено: {redeemed}, пропущено: {skipped}",
  "revertCountdown": "Отменить ({seconds})",
  "revertSuccess": "Отмена погашения",
  "errors": {
    "alreadyUsed": "Билет уже использован",
    "cancelled": "Билет отменён",
    "expired": "Билет просрочен",
    "revertExpired": "Окно отмены истекло",
    "revertForbidden": "Откат доступен только тому, кто погасил",
    "invalidTicket": "Билет не из этой брони",
    "notFound": "QR не распознан",
    "network": "Ошибка сети"
  }
}
```

(Merge with existing `ticket` and `scanner` blocks; do not duplicate root keys.)

- [ ] **Step 2: Translate to `en.json`**

```json
"ticket": {
  "tabs": { "master": "Combined QR", "individual": "Per seat" },
  "share": "Share",
  "shareCopied": "Link copied",
  "statusPartiallyUsed": "{count} of {total} used",
  "entryWithThisQr": "Show this QR at the entrance",
  "rowSeat": "Row {row}, seat {seats}",
  "rowSeats": "Row {row}, seats {seats}"
},
"scanner": {
  "markUsedCount": "Redeem ({count})",
  "partialResult": "Redeemed: {redeemed}, skipped: {skipped}",
  "revertCountdown": "Undo ({seconds})",
  "revertSuccess": "Redemption reverted",
  "errors": {
    "alreadyUsed": "Ticket already used",
    "cancelled": "Ticket cancelled",
    "expired": "Ticket expired",
    "revertExpired": "Revert window expired",
    "revertForbidden": "Only the original scanner can revert",
    "invalidTicket": "Ticket not in this booking",
    "notFound": "QR not recognized",
    "network": "Network error"
  }
}
```

- [ ] **Step 3: Add to `ky.json` (Kyrgyz)**

```json
"ticket": {
  "tabs": { "master": "Жалпы QR", "individual": "Орундар боюнча" },
  "share": "Бөлүшүү",
  "shareCopied": "Шилтеме көчүрүлдү",
  "statusPartiallyUsed": "{total}тын {count} колдонулду",
  "entryWithThisQr": "Бул QRди кирүүдө көрсөтүңүз",
  "rowSeat": "{row}-катар, {seats}-орун",
  "rowSeats": "{row}-катар, {seats}-орундар"
},
"scanner": {
  "markUsedCount": "Өчүрүү ({count})",
  "partialResult": "Өчүрүлдү: {redeemed}, өткөрүлдү: {skipped}",
  "revertCountdown": "Жокко чыгаруу ({seconds})",
  "revertSuccess": "Жокко чыгарылды",
  "errors": {
    "alreadyUsed": "Билет колдонулган",
    "cancelled": "Билет жокко чыгарылган",
    "expired": "Билет мөөнөтү бүткөн",
    "revertExpired": "Жокко чыгаруу мөөнөтү бүттү",
    "revertForbidden": "Сканерлеген кишиге гана жокко чыгарууга болот",
    "invalidTicket": "Билет бул бронддон эмес",
    "notFound": "QR таанылган жок",
    "network": "Тармак катасы"
  }
}
```

- [ ] **Step 4: Add to `kz.json` (Kazakh)**

```json
"ticket": {
  "tabs": { "master": "Жалпы QR", "individual": "Орындар бойынша" },
  "share": "Бөлісу",
  "shareCopied": "Сілтеме көшірілді",
  "statusPartiallyUsed": "{total}-нан {count} пайдаланылды",
  "entryWithThisQr": "Бұл QR-ды кірісте көрсетіңіз",
  "rowSeat": "{row}-қатар, {seats}-орын",
  "rowSeats": "{row}-қатар, {seats}-орындар"
},
"scanner": {
  "markUsedCount": "Өтеу ({count})",
  "partialResult": "Өтелді: {redeemed}, өткізілді: {skipped}",
  "revertCountdown": "Қайтару ({seconds})",
  "revertSuccess": "Өтеу қайтарылды",
  "errors": {
    "alreadyUsed": "Билет әлдеқашан пайдаланылған",
    "cancelled": "Билет тоқтатылған",
    "expired": "Билет мерзімі өткен",
    "revertExpired": "Қайтару терезесі жабылды",
    "revertForbidden": "Тек сканерлеген қызметкер қайтара алады",
    "invalidTicket": "Билет осы брондаудан емес",
    "notFound": "QR танылмады",
    "network": "Желі қатесі"
  }
}
```

- [ ] **Step 5: Add to `uz.json` (Uzbek)**

```json
"ticket": {
  "tabs": { "master": "Umumiy QR", "individual": "Joylar boʻyicha" },
  "share": "Ulashish",
  "shareCopied": "Havola nusxalandi",
  "statusPartiallyUsed": "{total} dan {count} ta ishlatildi",
  "entryWithThisQr": "Bu QR-ni kirishda koʻrsating",
  "rowSeat": "{row}-qator, {seats}-joy",
  "rowSeats": "{row}-qator, {seats}-joylar"
},
"scanner": {
  "markUsedCount": "Yopish ({count})",
  "partialResult": "Yopildi: {redeemed}, oʻtkazildi: {skipped}",
  "revertCountdown": "Bekor qilish ({seconds})",
  "revertSuccess": "Yopish bekor qilindi",
  "errors": {
    "alreadyUsed": "Chipta allaqachon ishlatilgan",
    "cancelled": "Chipta bekor qilingan",
    "expired": "Chipta muddati oʻtgan",
    "revertExpired": "Bekor qilish vaqti tugadi",
    "revertForbidden": "Faqat skanerlagan xodim bekor qila oladi",
    "invalidTicket": "Chipta bu bronga tegishli emas",
    "notFound": "QR aniqlanmadi",
    "network": "Tarmoq xatosi"
  }
}
```

- [ ] **Step 6: Type-check + run dev**

```bash
cd ~/Desktop/ZeroWaiting_frontend && bun run check
```

Expected: no missing-key errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/i18n/locales
git commit -m "feat(i18n): partial-redeem keys in all 5 locales"
```

---

## Phase 11 — Manual Verification

### Task 31: Smoke-test the complete flow

**No code in this task — manual verification per the spec's testing requirements.**

- [ ] **Step 1: Reset DB and seed both repos**

```bash
cd ~/Desktop/ZeroWaiting_backend && bunx prisma migrate reset --force
```

- [ ] **Step 2: Start both servers**

Terminal A:
```bash
cd ~/Desktop/ZeroWaiting_backend && bun run dev
```

Terminal B:
```bash
cd ~/Desktop/ZeroWaiting_frontend && VITE_API_BASE_URL=http://localhost:5000 bun run dev
```

- [ ] **Step 3: Buy a 4-seat booking**

Open `http://localhost:5173`. Pick a screening, select 4 seats, complete payment. Land on confirmation.

Expected: TicketViewer shows two tabs.

- [ ] **Step 4: Tab 1 (Combined QR)**

Verify: one large QR, list of all seats, status badge `Действителен`. Click "Поделиться" — system share sheet appears (mobile) or clipboard toast (desktop).

- [ ] **Step 5: Tab 2 (Per-seat)**

Verify: 4 cards, each with QR + seat label + share icon. Click share on one — works.

- [ ] **Step 6: Master scan (staff)**

Sign in as STAFF. Open `/scanner`. Aim at the **combined QR** from Tab 1.

Expected: modal opens with 4 checkboxes, all preselected. Uncheck 2 → click "Погасить (2)" → toast "Погашено: 2, пропущено: 0".

- [ ] **Step 7: Re-validate via per-seat scan**

Open one of the 2 unredeemed per-seat QRs (Tab 2 of confirmation). Aim scanner at it.

Expected: instant green check, "Ряд X, место Y", revert button with 60s countdown.

- [ ] **Step 8: Revert within 60s**

Click "Отменить" before timer reaches 0.

Expected: toast "Отмена погашения". Ticket back to VALID.

- [ ] **Step 9: Revert after 60s**

Scan the same per-seat QR again → wait 65 seconds → click "Отменить".

Expected: toast "Окно отмены истекло" (410 from server).

- [ ] **Step 10: Revert as different staff**

Sign out. Sign in as a different STAFF user. Scan a per-seat QR that was just scanned by another staff. Click "Отменить".

Expected: button hidden (canRevert=false from server). If forced via direct API call, toast "Откат доступен только тому, кто погасил".

- [ ] **Step 11: Re-scan an already-USED ticket**

Scan a USED per-seat QR.

Expected: error message "Билет уже использован".

- [ ] **Step 12: Verify email**

Check the Resend dashboard or test inbox for the booking confirmation email.

Expected: large QR points to `/t/m/{viewerCode}`; email body lists per-seat URLs.

- [ ] **Step 13: Commit smoke verification (no changes)**

If steps 4-12 all passed, no commit needed. If any step revealed a bug, fix and recommit.

---

## Self-Review

Re-read the spec (`docs/superpowers/specs/2026-04-26-partial-redeem-design.md`) and check coverage:

- **§1 Data Model** → Task 1 ✓
- **§2 API Contract** → Tasks 3-7 (services), 10-11 (controllers) ✓
- **§3 Frontend Confirmation & Public Viewer** → Tasks 21-26 ✓
- **§4 Frontend Scanner** → Tasks 27-29 ✓
- **§5 Backend Service/Mail/Listener** → Tasks 2-15 ✓
- **§6 Embedding Tickets in Booking response** → Task 17 (regen picks up via `BookingSeat.ticket?` Prisma relation) + Task 26 (consumes `booking.seats[].ticket`) ✓
- **§6 Error matrix** → mapped via `getErrorMessage` in Task 29 + i18n keys in Task 30 ✓
- **§6 Audit log** → Task 14 ✓
- **§6 Cron expireTickets** → Task 15 ✓
- **i18n 5 locales** → Task 30 ✓
- **Manual smoke** → Task 31 ✓

Type/method consistency:
- Service methods: `generateTicketsForBooking`, `validateMaster`, `scanMaster`, `validateTicket`, `scanTicket`, `revertTicket`, `getPublicMaster`, `getPublicTicket`, `expireTickets` — used consistently across Tasks 2-15.
- DTO names: `ValidatedMasterTicketDto`, `ValidatedTicketDto`, `PublicMasterTicketDto`, `ScanMasterDto` — consistent in Tasks 9-11.
- Frontend mutation names follow Orval pattern: `crmQueryApi.create<Verb><Path>V1Mutation()` — used consistently in Task 29.

No placeholders found.

---
