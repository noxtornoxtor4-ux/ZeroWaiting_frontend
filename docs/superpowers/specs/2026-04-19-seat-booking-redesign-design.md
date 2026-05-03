# Редизайн выбора мест и бронирования

**Дата:** 2026-04-19
**Статус:** утверждено, готово к плану реализации
**Скоуп:** фронт `ZeroWaiting_frontend` + бекенд `ZeroWaiting_backend`

---

## 1. Задача и цели

### 1.1 Проблемы текущей реализации

Страница выбора мест (`/screenings/:id`) шлёт отдельный `POST /seat-holds` на каждый клик по месту, после каждого запроса делает `seatsQuery.refetch()`. Deselect вообще не вызывает `DELETE`. Клиентский таймер захардкодил 10 минут и игнорирует серверный `expiresAt` в ответе. Стор `booking-flow.svelte.ts` существует, но фактически не используется. Нет механизма «возобновить незавершённую бронь».

Следствия: избыточная нагрузка на бекенд (N запросов вместо 1), гонки между параллельными `POST /seat-holds`, расхождение клиентского и серверного TTL, потеря мест при случайном закрытии вкладки.

### 1.2 Целевое поведение

1. Выбор мест — **только локально**, ни одного серверного запроса на клик.
2. По нажатию «Продолжить» — **один bulk-запрос**, создающий `PENDING Booking`.
3. Если какие-то места заняли другие — ответ с конкретным списком `seatIds`, авто-снятие с выбора, остальное остаётся.
4. `PENDING Booking` автоматически блокирует места на TTL (10 минут). Таймер синхронизирован с сервером и переживает перезагрузку страницы.
5. Кнопка «Отменить бронь» освобождает места bulk-запросом.
6. При возвращении пользователя на сайт с незавершённой бронью — глобальный баннер с CTA «Оплатить» / «Отменить».
7. По истечении TTL бронь автоматически отменяется и места освобождаются.
8. **Одна активная `PENDING` бронь на пользователя** (архитектурное ограничение).

### 1.3 Non-goals

- Real-time обновления карты мест через SSE/WebSocket (polling 15 сек + focus-refetch покрывают требования).
- Гостевая онлайн-бронь (неавторизованные пользователи).
- Idempotency-key для `POST /bookings` при потере сети (перенесено в follow-up).
- Мгновенная синхронизация между вкладками одного пользователя через `BroadcastChannel` (nice-to-have, не MVP).

---

## 2. Архитектурный сдвиг

Текущая модель держит два параллельных механизма резервации: `SeatHold` (soft, TTL 10 мин) и `BookingSeat` через `PENDING Booking` (TTL от `createdAt`). Это дублирование приводит к рассинхронизации и сложному коду.

**Новая модель: единый источник правды — `Booking`.**

| Статус места в UI | Источник на бекенде                                               |
| ----------------- | ----------------------------------------------------------------- |
| `AVAILABLE`       | нет активных `BookingSeat` для этого `(seatId, screeningId)`      |
| `HELD`            | `BookingSeat` в `PENDING Booking`, `userId != me`                 |
| `HELD_BY_YOU`     | `BookingSeat` в `PENDING Booking`, `userId == me`                 |
| `BOOKED`          | `BookingSeat` в `Booking` со статусом `CONFIRMED` или `COMPLETED` |

Сущность `SeatHold` удаляется полностью. Все race-conditions по-прежнему закрыты существующим `SELECT FOR UPDATE` на `BookingSeat` в `booking.service.create()`.

### 2.1 Жизненный цикл

```
┌─────────────────────────────┐
│ /screenings/:id (SeatMap)  │
│ selection: local state      │◀─────────┐
└──────────────┬──────────────┘          │
               │ click «Продолжить»       │
               ▼                          │
┌─────────────────────────────┐          │
│ POST /v1/bookings (bulk)    │          │
└──────┬──────────────┬───────┘          │
       │ 201          │ 409              │
       ▼              │                  │
┌──────────────┐      ├── ACTIVE_       │  dialog:
│ /booking/:id │      │   BOOKING_      │  «оплатить» /
│ PENDING      │      │   EXISTS         │  «отменить и
│ timer 10:00  │      │                  │   забронировать»
└──┬─────┬──┬──┘      └── SEATS_        │
  оплата│откр│expire      UNAVAILABLE    │  snap selection,
        │    │                           │  toast, invalidate
        ▼    ▼    ▼                      │
    CONFIRMED CANC. CANC.                │
        │    │    │                      │
        │    └────┴──────────────────────┘
        ▼
  /confirmation
```

---

## 3. Бекенд: изменения

### 3.1 Prisma-схема

**Удаляется:**

- модель `SeatHold`
- relation `seatHolds SeatHold[]` в `Screening` и `Seat`

**Добавляется:**

```prisma
model Booking {
  // ...существующие поля...
  @@index([userId, status])  // для быстрого GET /bookings/active
}
```

Миграция: `prisma migrate dev --name drop-seat-holds-and-index-active-booking`. Выполняется **на шаге 3 релиза** (после подтверждения, что фронт больше не обращается к `/seat-holds`).

### 3.2 Эндпоинты

#### `POST /v1/bookings` — существует, дорабатывается

Внутрь существующей `prisma.$transaction` добавляются две проверки:

**A. Одна активная PENDING на пользователя** (только для `userId && type === ONLINE`):

```typescript
const existingPending = await tx.booking.findFirst({
	where: { userId, status: 'PENDING' },
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
```

**B. Обогащение ошибки «места заняты»:**

```typescript
if (bookedSeats.length > 0) {
	throw new ConflictException({
		code: 'SEATS_UNAVAILABLE',
		message: 'Некоторые места уже забронированы',
		unavailableSeatIds: bookedSeats.map((b) => b.seatId)
	});
}
```

Проверка `SeatHold` удаляется вместе с модулем. Остаётся только проверка `BookingSeat` с `FOR UPDATE`.

Swagger-описание 409-ответов использует `oneOf` через `@ApiResponse` — Orval генерирует дискриминированный union на фронте.

#### `GET /v1/bookings/active` — новый

```typescript
@Get('active')
@UseGuards(JwtAuthGuard)
@ApiResponse({ status: 200, type: ActiveBookingEntity })
@ApiResponse({ status: 204, description: 'No active booking' })
async getActive(@Req() req: Request, @Res() res: Response) {
  const booking = await this.bookingService.getActivePending(req.user.id);
  if (!booking) return res.status(204).send();
  return res.json(booking);
}
```

Сервис:

```typescript
async getActivePending(userId: string) {
  const ttlMs = this.pendingTtlMinutes * 60_000;
  const booking = await this.prisma.booking.findFirst({
    where: {
      userId,
      status: 'PENDING',
      createdAt: { gte: new Date(Date.now() - ttlMs) }
    },
    include: {
      seats: { include: { seat: true } },
      screening: { include: { movie: true, hall: { include: { branch: true } } } }
    }
  });
  if (!booking) return null;
  const expiresAt = new Date(booking.createdAt.getTime() + ttlMs);
  return { ...booking, expiresAt };
}
```

`ActiveBookingEntity` = `BookingEntity` + поле `expiresAt: string` (ISO UTC). Клиент считает `remainingMs = Date.parse(expiresAt) - Date.now()`.

#### `DELETE /v1/bookings/:id/self` — новый

Параллельный self-cancel маршрут, чтобы не трогать существующий менеджерский `DELETE /v1/bookings/:id`.

```typescript
@Delete(':id/self')
@UseGuards(JwtAuthGuard)
async cancelOwn(@Param('id') id: string, @Req() req: Request) {
  return this.bookingService.cancelOwnPending(id, req.user.id);
}
```

Сервис:

```typescript
async cancelOwnPending(id: string, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      select: { userId: true, status: true }
    });
    if (!booking) throw new NotFoundException();
    if (booking.userId !== userId) throw new ForbiddenException();
    if (booking.status !== 'PENDING') {
      throw new ConflictException('Можно отменить только PENDING бронь');
    }
    return tx.booking.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });
  });
}
```

#### `GET /v1/screenings/:id/available-seats` — переписать источник данных

Было: чтение `SeatHold` + `BookingSeat`. Стало: только `BookingSeat`, join на `Booking.status` и `Booking.userId`:

```typescript
const ttlMs = this.pendingTtlMinutes * 60_000;
const records = await this.prisma.bookingSeat.findMany({
	where: {
		booking: {
			screeningId,
			OR: [
				{ status: { in: ['CONFIRMED', 'COMPLETED'] } },
				{ status: 'PENDING', createdAt: { gte: new Date(Date.now() - ttlMs) } }
			]
		}
	},
	select: { seatId: true, booking: { select: { status: true, userId: true } } }
});
```

Маппинг:

- `booking.status === 'PENDING' && booking.userId === currentUserId` → `HELD_BY_YOU`
- `booking.status === 'PENDING' && booking.userId !== currentUserId` → `HELD`
- `booking.status in ('CONFIRMED', 'COMPLETED')` → `BOOKED`

В envelope добавляется поле `holdTtlMinutes: number` — фронт больше ничего не хардкодит.

### 3.3 Удаление модуля SeatHold

Полностью удаляются (шаг 3 релиза):

- `src/seat-hold/seat-hold.controller.ts`
- `src/seat-hold/seat-hold.service.ts`
- `src/seat-hold/seat-hold.module.ts`
- `src/seat-hold/dto/*`
- `src/seat-hold/entities/*`
- импорт `SeatHoldModule` из `app.module.ts`
- cron `cleanupExpiredHolds`

Env-переменная `SEAT_HOLD_TTL_MINUTES` переименовывается в `BOOKING_PENDING_TTL_MINUTES` с fallback на старое имя на один релиз.

### 3.4 Race conditions

Все критические пути остаются в `prisma.$transaction({ timeout: 10_000 })`:

- `POST /bookings` — `SELECT FOR UPDATE` на `BookingSeat` + unique `(bookingId, seatId)` как финальный барьер.
- `cancelOwnPending` — read + update в одной транзакции.
- `cancelExpiredPendingBookings` (cron каждую минуту) — `updateMany`, атомарно.

Проверка «одна PENDING» живёт внутри той же транзакции, что и создание — двойной клик по «Продолжить» не создаст две брони.

---

## 4. Фронт: изменения

### 4.1 Сторы

#### `src/lib/stores/seat-selection.svelte.ts` — переписать

Только локальное состояние. Никаких мутаций.

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
	removeMany: (seatIds: string[]) => {
		const set = new Set(seatIds);
		selectedIds = selectedIds.filter((id) => !set.has(id));
	},
	clear: () => {
		selectedIds = [];
	}
};
```

#### `src/lib/stores/active-booking.svelte.ts` — новый

Провайдер + хук на базе Svelte context. Один инстанс в `(client)/+layout.svelte`.

```typescript
import { crmQueryApi } from '@/api/endpoints';
import { setContext, getContext } from 'svelte';

const KEY = Symbol('active-booking');

export const provideActiveBooking = () => {
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

export const useActiveBooking = () =>
	getContext<ReturnType<typeof provideActiveBooking>>(KEY);
```

Инвалидация: точечный `queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] })` после каждого `POST /bookings` (успех) и `DELETE /bookings/:id/self`.

#### `src/lib/stores/booking-flow.svelte.ts` — удалить

Мёртвый код.

### 4.2 Утилита таймера

`src/lib/utils/pending-timer.svelte.ts`:

```typescript
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

	const remainingMs = $derived.by(() => {
		const iso = expiresAtIso();
		if (!iso) return 0;
		return Math.max(0, Date.parse(iso) - now);
	});

	const formatted = $derived.by(() => {
		const total = Math.ceil(remainingMs / 1000);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	});

	const isExpired = $derived(remainingMs === 0);

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

Требует расширения `.svelte.ts` (обязательно для runes вне компонентов).

Используется на странице `/booking/:id` и внутри `ActiveBookingBanner`.

### 4.3 Страница `/screenings/[id]/+page.svelte`

Удаляется: `holdMutation`, `seatSelection.addHeldSeat/removeHeldSeat`, `seatsQuery.refetch()` после клика.

`handleSelectSeat` и `handleDeselectSeat` схлопываются в `onseatclick(seatId) → seatSelection.toggle(seatId)`. Запросов нет.

`available-seats` query: `refetchInterval: 15_000` оставляем + добавляем `refetchOnWindowFocus: true`.

Новый `handleContinue`:

```typescript
const bookingMutation = crmQueryApi.createPostBookingsV1Mutation();

const handleContinue = async () => {
	if (!requireAuth(authGuard, `/screenings/${screeningId}`)) return;
	if (seatSelection.isEmpty) return;
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

const handleBookingConflict = (error: unknown) => {
	const data = (error as AxiosError<BookingConflictBody>).response?.data;

	if (data?.code === 'SEATS_UNAVAILABLE') {
		const labels = mapSeatIdsToLabels(data.unavailableSeatIds, seatsQuery.data);
		seatSelection.removeMany(data.unavailableSeatIds);
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

	if (data?.code === 'ACTIVE_BOOKING_EXISTS') {
		openActiveBookingConflictDialog({
			existingBookingId: data.bookingId,
			existingScreeningId: data.screeningId,
			isSameScreening: data.screeningId === screeningId
		});
		return;
	}

	toast.error(getErrorMessage(error, $_('booking.errors.generic')));
};
```

Утилита `mapSeatIdsToLabels(seatIds, seatsData)` строит формат `"5-3"` (`rowNumber-seatNumber`) из `AvailableSeatEntity[]`.

### 4.4 Страница `/booking/[bookingId]/+page.svelte`

- Читает `expiresAt` из ответа `GET /bookings/:id` (бекенд отдаёт вычисленное `createdAt + TTL`).
- Подписывается через `createPendingTimer(() => booking?.expiresAt)`.
- Виджет с таймером сверху: крупно, центр, под названием фильма.
- Кнопка «Отменить бронь» в футере:

```typescript
const cancelMutation = crmQueryApi.createDeleteBookingsByIdSelfV1Mutation();

const handleCancel = async () => {
	if (!(await confirm($_('booking.cancel_confirm')))) return;
	try {
		await cancelMutation.mutateAsync({ id: bookingId });
		queryClient.invalidateQueries({ queryKey: ['/api/v1/bookings/active'] });
		queryClient.invalidateQueries({
			queryKey: [
				`/api/v1/public/screenings/${booking.screeningId}/available-seats`
			]
		});
		toast.success($_('booking.cancel_success'));
		goto(`/screenings/${booking.screeningId}`);
	} catch (error) {
		toast.error(getErrorMessage(error, $_('booking.errors.cancel_failed')));
	}
};
```

- Реакция на `timer.isExpired`: запускается поллинг `/bookings/:id` каждые 10 сек до получения `status !== 'PENDING'`. При `CANCELLED` показывается expired view.
- Если `booking.status !== 'PENDING'` при первом рендере: `CONFIRMED` → редирект на `/confirmation`; `CANCELLED`/`NO_SHOW` → expired view.

### 4.5 `ActiveBookingBanner.svelte`

Путь: `src/components/booking/ActiveBookingBanner.svelte`. Монтируется в `(client)/+layout.svelte`.

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { useActiveBooking } from '@/lib/stores/active-booking.svelte';
	import { createPendingTimer } from '@/lib/utils/pending-timer.svelte';
	import Button from '@/components/ui/Button.svelte';

	const query = useActiveBooking();
	const booking = $derived(query.data);

	const hidden = $derived(
		page.url.pathname.startsWith('/booking/') ||
			page.url.pathname.startsWith('/admin') ||
			!booking
	);

	const timer = createPendingTimer(() => booking?.expiresAt);
</script>

{#if !hidden && booking}
	<div
		class="ActiveBookingBanner"
		class:warning={timer.remainingMs < 120_000}
		class:critical={timer.remainingMs < 30_000}
	>
		<div class="info">
			<div class="title">{$_('booking.active_banner.title')}</div>
			<div class="meta">
				{booking.screening.movie.title} · {timer.formatted}
			</div>
		</div>
		<div class="actions">
			<Button href="/booking/{booking.id}" size="sm">
				{$_('booking.active_banner.pay_cta')}
			</Button>
			<Button variant="ghost" size="sm" onclick={handleCancel}>
				{$_('booking.active_banner.cancel_cta')}
			</Button>
		</div>
	</div>
{/if}
```

Стили:

- Desktop: `position: fixed; right: 24px; bottom: 24px; max-width: 360px`; glass-фон `rgba(139, 92, 246, 0.12)` + `backdrop-filter: blur(10px)`; border `rgba(139, 92, 246, 0.2)`; `z-index` ниже модалов.
- Mobile (`< 640px`): `inset: auto 16px 16px 16px` (во всю ширину).
- Slide-in справа 200 мс при появлении.
- `.warning` — янтарный акцент; `.critical` — красный + пульс 1 раз/сек.

### 4.6 `ActiveBookingConflictDialog.svelte`

Модал с двумя CTA. Разные тексты для «тот же сеанс» и «другой сеанс» (см. секцию 6.2 этого документа).

### 4.7 Инвалидация кеша

Правило: только `queryClient.invalidateQueries`, никаких `.refetch()`.

| Действие                                    | Инвалидировать                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `POST /v1/bookings` (201)                   | `/api/v1/bookings/active`, `/api/v1/public/screenings/:id/available-seats`, `/api/v1/profile/me/bookings` |
| `POST /v1/bookings` (409 SEATS_UNAVAILABLE) | `/api/v1/public/screenings/:id/available-seats`                                                           |
| `DELETE /v1/bookings/:id/self` (200)        | те же + `/api/v1/bookings/:id`                                                                            |
| `timer.isExpired` → получен `CANCELLED`     | те же                                                                                                     |

### 4.8 Удаляется на фронте

- `src/lib/stores/booking-flow.svelte.ts`
- `src/api/endpoints/seat-holds.ts` (исчезнет после `bun run generate:api` на шаге 2 релиза)
- Импорты/использования `holdMutation`, `createPostScreeningsByScreeningIdSeatHoldsV1Mutation`

---

## 5. State-машины

### 5.1 Страница выбора мест

```
┌──────────┐  toggle       ┌──────────────┐
│  empty   │ ────────────▶ │  selecting   │
└──────────┘ ◀──────────── └──────┬───────┘
             toggle last           │ Continue
                                   ▼
                           ┌──────────────┐
                           │  submitting  │
                           │  (disabled)  │
                           └─┬────┬────┬──┘
                      201│   409│    │network err
                         ▼      ▼    ▼
                       goto   dispatch toast,
                      /booking  409    вернуться
                              handlers в selecting
```

- `submitting` блокирует SeatMap и disabled кнопку «Продолжить».
- `SEATS_UNAVAILABLE` → авто-снятие, возврат в `selecting` с меньшим выбором.
- `ACTIVE_BOOKING_EXISTS` → модал, выбор не очищается.

### 5.2 Страница оплаты

```
       загрузка
          ▼
   ┌────────────┐
   │  loading   │
   └─────┬──────┘
         │ booking.status
    ┌────┴────┐
    ▼         ▼
 PENDING   CONFIRMED/COMPLETED
    │       → redirect /confirmation
    │
    ▼
 ┌─────────────────────────────────────┐
 │ pending (> 2:00)    — neutral       │
 │ pending (0:30–2:00) — warning       │
 │ pending (< 0:30)    — critical      │
 │ expired (= 0:00)    — poll + view   │
 └─────────────────────────────────────┘
    │         │            │
    оплата    отмена       таймаут
    ▼         ▼            ▼
 CONFIRMED CANCELLED    CANCELLED
                        (cron ≤ 60с)
```

`expired` — локальное состояние между «таймер на 0» и «сервер подтвердил `CANCELLED`». Запросы оплаты/отмены в этом состоянии блокируются.

---

## 6. Edge-cases и UX

### 6.1 Race conditions

| Сценарий                                     | Защита                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Двойной клик «Продолжить» в одной вкладке    | `bookingMutation.isPending` disables кнопку                                        |
| Два разных юзера на одни места               | `SELECT FOR UPDATE` → один 201, второй 409 `SEATS_UNAVAILABLE`                     |
| Юзер с PENDING в tab A жмёт Continue в tab B | Проверка «одна PENDING» в транзакции → 409 `ACTIVE_BOOKING_EXISTS`                 |
| Отмена в баннере параллельно с оплатой       | `cancelOwnPending` выбросит 409, если `status !== PENDING`; фронт показывает toast |
| Таймер истёк, юзер кликает «Оплатить»        | Платёжный сервис атомарно проверит `status === PENDING` и TTL; откажет             |
| Крон снял бронь между рендером и кликом      | То же: атомарная проверка в транзакции оплаты                                      |

### 6.2 Диалог `ACTIVE_BOOKING_EXISTS`

**Тот же сеанс** (`existing.screeningId === currentScreeningId`):

- Заголовок: «У вас уже есть бронь на этот сеанс»
- Тело: «Места {seats} (осталось {time})»
- CTA: [Вернуться к оплате] [Отменить бронь и выбрать другие места]

**Другой сеанс:**

- Заголовок: «У вас есть неоплаченная бронь»
- Тело: «{movie}, зал {hall}, {time_screening} — осталось {time_remaining}. Система позволяет одну активную бронь одновременно.»
- CTA: [Вернуться к оплате] [Отменить её и забронировать эти места]

Действие «Отменить и забронировать»: `DELETE /bookings/:oldId/self` → `POST /bookings`. Сбой на любом шаге — toast, выбор сохраняется.

### 6.3 Таймер: пороги

| Порог       | Состояние | Визуал                        |
| ----------- | --------- | ----------------------------- |
| `> 2:00`    | normal    | `var(--primary)` фиолетовый   |
| `0:30–2:00` | warning   | янтарный `#f59e0b` + glow     |
| `< 0:30`    | critical  | красный `#ef4444` + pulse 1/с |
| `= 0:00`    | expired   | серый, текст «Истекло»        |

### 6.4 Мульти-вкладка

Оба таба держат `active-booking` query с `refetchOnWindowFocus + 60s interval`. Отмена в одном → второй увидит в ≤60 сек (или мгновенно на фокус). `BroadcastChannel` — follow-up, не MVP.

### 6.5 Клок-скью

Таймер считается только от серверного `expiresAt`. Окно расхождения локального 0 и серверного `CANCELLED` (до 60 сек) — `expired view` с disabled кнопками. Корректно во всех направлениях скью.

### 6.6 Сетевые сбои

- `POST /bookings` network fail → toast + возможность повтора. Если бронь создалась, ловим `ACTIVE_BOOKING_EXISTS` при повторе → модал «Вернуться к оплате».
- `GET /bookings/active` network fail → `retry: false`, баннер скрыт до следующего refetch.
- `DELETE /bookings/:id/self` network fail → toast + retry. Идемпотентно (повторная отмена вернёт 409 с понятным сообщением).

### 6.7 Пользователь с PENDING возвращается на `/screenings/:id`

- `available-seats` покажет его места как `HELD_BY_YOU` (подсвечены).
- Баннер виден (скрыт только на `/booking/*`).
- Клик по `HELD_BY_YOU` — не делает ничего (SeatMap уже игнорирует клики на не-AVAILABLE).
- Попытка Continue с новыми местами → 409 `ACTIVE_BOOKING_EXISTS` → диалог с подсказкой «сначала оплатите или отмените текущую».

### 6.8 OFFLINE/RECEPTION брони

Проверка «одна PENDING» только при `userId && type === ONLINE`. Кассовые брони (`type: RECEPTION`, `userId: null`) не блокируются.

### 6.9 Гости

Не в скоупе. `requireAuth` на странице выбора мест редиректит неавторизованных на `/sign-in` до клика «Продолжить».

---

## 7. Локализация

Новые ключи (5 локалей: `ru`, `en`, `ky`, `kz`, `uz`):

```yaml
booking:
  active_banner:
    title                  # «Незавершённая бронь»
    pay_cta                # «Оплатить»
    cancel_cta             # «Отменить»
  expired_view:
    title                  # «Время оплаты истекло»
    subtitle               # «Ваши места стали доступны другим»
    select_again_cta       # «Выбрать места заново»
  conflict_dialog:
    same_screening_title
    same_screening_body
    other_screening_title
    other_screening_body
    return_to_payment_cta
    cancel_and_rebook_cta
  cancel_confirm           # «Отменить бронь? Места станут доступны другим»
  cancel_success           # «Бронь отменена»
  errors:
    seats_unavailable      # «Места {seats} уже заняты — сняты с выбора»
    generic                # «Не удалось создать бронь»
    cancel_failed          # «Не удалось отменить бронь»
```

Интерполяция через стандартный `svelte-i18n` синтаксис (`{seats}`, `{movie}`, `{time}`).

---

## 8. План релиза (zero-downtime)

### Шаг 1 — бекенд, совместимые изменения

1. Добавить `GET /v1/bookings/active`.
2. Добавить `DELETE /v1/bookings/:id/self`.
3. В `POST /v1/bookings`: добавить проверку «одна PENDING», обогатить 409-ответы новыми полями (`code`, `bookingId`, `unavailableSeatIds`). Старое поле `message` сохраняется для совместимости со старым фронтом.
4. В `GET /available-seats` добавить поле `holdTtlMinutes` в envelope.
5. Deploy бекенда.

Старый фронт продолжает работать (всё ещё шлёт `/seat-holds`).

### Шаг 2 — фронт

1. `bun run generate:api` — получить новые типы.
2. Переписать `seat-selection.svelte.ts`.
3. Переписать `/screenings/[id]/+page.svelte` (удалить holdMutation, обновить handlers).
4. Обновить `/booking/[bookingId]/+page.svelte` (таймер, cancel).
5. Добавить `ActiveBookingBanner` + `ActiveBookingConflictDialog` + `createPendingTimer`.
6. Провайдер `active-booking` в `(client)/+layout.svelte`.
7. Локализация 5 языков.
8. Удалить `booking-flow.svelte.ts`.
9. Deploy фронта. Новая система активна.

### Шаг 3 — бекенд, финализация

Только после подтверждения по логам (≥24ч нулевой трафик на `/seat-holds/*`):

1. Удалить `src/seat-hold/*`.
2. Миграция `DROP TABLE "SeatHold"`.
3. Убрать relations `seatHolds` из `Screening`/`Seat`.
4. Переименовать `SEAT_HOLD_TTL_MINUTES` → `BOOKING_PENDING_TTL_MINUTES` (fallback на старое имя на один релиз).
5. Удалить cron `cleanupExpiredHolds`.
6. На фронте — повторный `bun run generate:api` (уйдёт сгенерированный `seat-holds.ts`).

### Фичефлаги

Не нужны. Разбиение на 3 шага гарантирует совместимость.

### Откат

- Шаг 1 ломается — откатить бекенд, фронт не пострадал.
- Шаг 2 ломается — откатить фронт, бекенд совместим с обеими версиями.
- Шаг 3 — только после стабилизации; revert-миграция остаётся в git.

---

## 9. Тестирование

### 9.1 Бекенд (Jest)

`booking.service.spec.ts`:

- `create`: отсутствует PENDING → 201.
- `create`: есть PENDING на любой сеанс → 409 `ACTIVE_BOOKING_EXISTS` с корректным `bookingId`, `screeningId`.
- `create`: места в PENDING другого юзера → 409 `SEATS_UNAVAILABLE` с массивом `unavailableSeatIds`.
- `create`: места в CONFIRMED → 409 `SEATS_UNAVAILABLE`.
- `cancelOwnPending`: success → `CANCELLED`; чужая → 403; не-PENDING → 409; несуществующая → 404.
- `getActivePending`: PENDING в рамках TTL → объект с `expiresAt`; PENDING старше TTL → `null`; отсутствие брони → `null`.
- Parallel test (`Promise.all` на 10 одинаковых `create`) → ровно один 201, девять 409. Подтверждает row-locks.

`screening.service.spec.ts` (available-seats):

- PENDING «моего» юзера → `HELD_BY_YOU`.
- PENDING другого → `HELD`.
- `CONFIRMED` → `BOOKED`.
- Истекший PENDING (старше TTL, ещё не очищен) → `AVAILABLE`.

### 9.2 Фронт (manual)

Golden path:

- Выбрать 3 места → Continue → `/booking/:id` с таймером 10:00 → Оплатить → `/confirmation`.

Cancel:

- Выбрать → Continue → Отмена на `/booking/:id` → редирект на `/screenings/:id`, места `AVAILABLE`.

Конфликты:

- `SEATS_UNAVAILABLE`: два браузерных контекста (incognito + обычный), оба выбирают те же места, оба Continue → второй видит тост с `row-seat`, эти места снялись, остальные сохранены.
- `ACTIVE_BOOKING_EXISTS`: создать PENDING, пойти на другой `/screenings/:id` → Continue → модал с двумя CTA; обе ветки (вернуться / отменить и забронировать) проверить.

Таймер:

- Цвет меняется на 2:00, 0:30, 0:00.
- Обновление страницы в середине → таймер продолжается с корректного значения.

Баннер:

- Виден на `/`, `/movies`, `/screenings/другой_сеанс`.
- Скрыт на `/booking/*`, `/admin/*`.
- Клик «Оплатить» → navigates.
- Клик «Отменить» → исчезает.

Истечение:

- Оставить `/booking/:id` на 11+ минут → expired view появляется в пределах минуты после отметки истечения.

Мульти-таб:

- Отмена в табе A → баннер пропадает в табе B в течение 60 сек (или мгновенно на focus).

### 9.3 Метрики мониторинга (после шага 2)

- Доля 409 `SEATS_UNAVAILABLE` / всех `POST /bookings` — ожидается <1%.
- Доля 409 `ACTIVE_BOOKING_EXISTS` — ожидается 0.5–2%.
- `p95 POST /bookings` — должно упасть (один запрос вместо N хольдов + booking).
- Трафик на `/seat-holds/*` — должен упасть до 0. Если нет — остался неудалённый вызов на фронте.

---

## 10. Follow-ups (не в скоупе)

- `Idempotency-Key` для `POST /bookings` (восстановление после потери сети без 409-пинга).
- `BroadcastChannel` для мгновенной синхронизации между вкладками одного пользователя.
- SSE/WebSocket для real-time обновления карты мест.
- E2E-тесты на Playwright: golden path + SEATS_UNAVAILABLE через параллельные контексты.
- Гостевая онлайн-бронь (email + phone вместо userId, проверка «одна PENDING» по guestEmail).
