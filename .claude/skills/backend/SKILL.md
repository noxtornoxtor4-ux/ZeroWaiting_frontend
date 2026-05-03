---
name: backend
description: 'Use when frontend task requires backend changes (missing API fields, new endpoints, incorrect OpenAPI types, business logic) or when working cross-repo. Triggers: ~/Desktop/ZeroWaiting_backend, ZeroWaiting_backend, generate:api, PORT=5000, @DtoEntityHidden, Prisma, NestJS, OptionalJwtAuthGuard, Swagger, OpenAPI, VITE_API_BASE_URL, cross-repo, fix backend, enrich response, MovieWithFavoriteEntity, regen API client.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Backend (cross-repo workflow)

Backend-репо: `~/Desktop/ZeroWaiting_backend` (NestJS + Prisma).

Когда frontend-задача требует изменений, которые **принадлежат бэкенду** — править **там**. Не обходить лимитации бэка на фронте.

## Fix on backend

- Missing fields в API response (nested relations, computed поля типа `averageRating`) — снять `@DtoEntityHidden` в Prisma schema или enrich в сервисе.
- Missing endpoints / query params.
- Неправильные типы в Swagger/OpenAPI — чинить entity/DTO-декораторы, чтобы Orval генерировал корректные типы.
- Бизнес-логика (валидация, авторизация, агрегация).

## Fix on frontend

- UI state, layout, styling, анимации.
- Client-side derived/computed values из уже существующих API-данных.
- Caching strategy, optimistic updates.
- i18n, formatting, user interactions.

## Cross-repo workflow

1. Редактируй backend в `~/Desktop/ZeroWaiting_backend`.
2. `npm run build` — валидация.
3. Локальный запуск: `PORT=5000 node dist/src/main.js`.
4. Regen frontend API-клиента: `VITE_API_BASE_URL=http://localhost:5000 bun run generate:api`.
5. Обнови frontend-код под новые типы/эндпоинты.
6. Останови локальный backend, когда закончил.

## API types — всегда из `@/api/model`

Всегда использовать сгенерированные типы из `@/api/model` — **никогда** ручных интерфейсов, дублирующих API-форму. Если backend возвращает данные, которых нет в типах — чинить backend (снять `@DtoEntityHidden` в Prisma schema) и регенерировать `bun run generate:api`.

## Backend-Driven State

User-specific поля (`isFavorite`, `averageRating`, `reviewCount`) приходят из API через `MovieWithFavoriteEntity`. Backend обогащает ответы через `OptionalJwtAuthGuard` — извлекает пользователя из токена если есть, возвращает базовые данные если нет. Не дублируй enrichment на фронте.
