---
name: api
description: 'Use when working with API calls, endpoints, TanStack Query, Axios, Orval, or mutations. Triggers: crmQueryApi, createGet*, createPost*Mutation, api/endpoints, api/model, api/mutator, custom-instance, TanStack Query, QueryClient, useQuery, useMutation, Axios interceptor, token refresh, generate:api.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# API Layer

## Architecture

- **Orval** auto-generates API client from OpenAPI spec at `${API_BASE_URL}/api/docs/json`
- Generated code lives in `src/api/endpoints/` and `src/api/model/` — **never edit manually**
- All endpoints exported as namespace: `crmQueryApi`
- Uses TanStack Svelte Query for caching, refetching, mutations
- Naming: `createGetPublicMoviesV1`, `createPostBookingsV1Mutation` (version at end, Mutation suffix for POST/PUT/PATCH/DELETE)

## Usage Pattern

```ts
import { crmQueryApi } from '@/api/endpoints';

// Queries
const moviesQuery = crmQueryApi.createGetPublicMoviesV1(() => ({
	status: 'NOW_SHOWING' as const
}));
const movies = $derived(moviesQuery.data?.data ?? []);

// Mutations
const mutation = crmQueryApi.createPostBookingsV1Mutation();
await mutation.mutateAsync({ data: payload });
```

## User Profile — Always from API

**Never read user data from `authStore`**. Always use `crmQueryApi.createGetProfileMeV1()`:

```ts
const profileQuery = crmQueryApi.createGetProfileMeV1();
const profile = $derived(profileQuery.data ?? null);
const isAuthenticated = $derived(profile !== null);
const isAdmin = $derived(hasMinRole(profile?.role, UserRole.STAFF));
```

`authStore` is used **only** for token storage and checking `accessToken !== null`.

## Axios Interceptor

- Located at `src/api/mutator/custom-instance.ts`
- Auto-injects Bearer token from localStorage/sessionStorage
- Auto-refreshes on 401 with request queue to prevent race conditions

## Regenerating API Client

```bash
bun run generate:api
```

## API Types — always generated

Всегда использовать типы из `@/api/model`. **Никогда** не создавать ручные интерфейсы, дублирующие API-форму. Если backend возвращает поле, которого нет в сгенерированном типе — чинить backend (см. skill `backend`), не хардкодить интерфейс на фронте.

## Cache Invalidation — not refetch

Используй `queryClient.invalidateQueries({ queryKey: [...] })` вместо `query.refetch()`. TanStack Query рефетчит только если активный query с этим key есть на текущей странице — никаких лишних запросов.

```ts
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ['/api/v1/public/movies'] });
queryClient.invalidateQueries({ queryKey: ['/api/v1/profile/me/favorites'] });
```

## Optimistic Updates

Для toggle-действий (избранное) используй `updateMovieFavoriteCache` из `@/lib/utils/favorite` — моментальное обновление TanStack-кэша. Откат на ошибке.

```ts
import { updateMovieFavoriteCache } from '@/lib/utils/favorite';

const prev = fav;
fav = !prev;
updateMovieFavoriteCache(queryClient, movieId, fav);
try {
	await mutation.mutateAsync({ movieId });
	queryClient.invalidateQueries({ queryKey: ['/api/v1/profile/me/favorites'] });
} catch (error) {
	fav = prev;
	updateMovieFavoriteCache(queryClient, movieId, prev);
}
```

Предпочитай `queryClient.setQueriesData` для мгновенного UI-апдейта тех же данных. `invalidateQueries` — только для связанных queries, которым нужна server-truth (favorites list после toggle).

## Loading states — `isLoading`, not `isFetching`

Для initial-render skeletons и first-load UI используй `query.isLoading` — он `true` только пока нет кэша. `query.isFetching` `true` **на каждом** refetch (window focus, invalidation, background refresh) — использование его в шаблоне приводит к тому, что skeleton мигает поверх уже отрисованного контента.

```svelte
<!-- Good -->
{#if repertoireQuery.isLoading}
	<Skeleton height="120px" />
{:else if screenings.length > 0}
	...
{/if}

<!-- Bad — skeleton мигает на каждом фоновом refetch -->
{#if repertoireQuery.isFetching}
	<Skeleton height="120px" />
{/if}
```

`isFetching` резервируй под вторичные индикаторы (inline-спиннер возле «Refreshing…»), никогда под первичный skeleton/empty-state gate.

## Error Handling

Во всех catch-блоках — `getErrorMessage(error, 'fallback')` из `@/lib/utils/error` вместе с `toast.error`. Достаёт реальное message из `AxiosError.response.data.message`.

```ts
import { getErrorMessage } from '@/lib/utils/error';
import toast from 'svelte-french-toast';

try {
	await mutation.mutateAsync(payload);
} catch (error) {
	toast.error(getErrorMessage(error, 'Не удалось сохранить'));
}
```
