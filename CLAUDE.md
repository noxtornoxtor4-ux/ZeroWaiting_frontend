# ZeroWaiting — Frontend

SaaS-платформа для сетей кинотеатров. SvelteKit 2 (Svelte 5 runes), TanStack
Svelte Query, Orval API, Firebase OAuth → JWT, svelte-i18n (ru/en/ky/kz/uz).
Backend-репозиторий: `~/Desktop/ZeroWaiting_backend`.

## Absolute Rules

Применяются **везде**, в каждом файле. Нарушение = переделка.

- **No partial changes.** «everywhere / globally / across the project / completely»
  = просканировать весь репо, собрать список всех вхождений, изменить все.
  Никаких «фикс в двух файлах для примера».
- **Arrow functions only.** Никакого `function` — ни в колбэках, ни в хэндлерах,
  ни в модульных объявлениях.
- **No `any`.** Типы — из `@/api/model` или собственный `interface`.
- **No BEM.** `underscore_case` для классов, SCSS nesting = зеркало DOM.
- **`$app/state`, never `$app/stores`.**
- **Import via `@/` alias.** Никаких относительных `../`.
- **Dates across boundary → `@/lib/utils/datetime`.** Никаких `.toISOString()`
  на исходящих датах. См. skill `dates`.
- **No native `<input type="date">`.** Всегда `DatePicker` / `DateRangeFilter`.
- **Loading UI → `isLoading`, не `isFetching`.**
- **No `:global(.generic_class)`.** Всегда уникальный префикс.
- **Admin = русский hardcoded, Client = `$_()` i18n.** Не мешать.

## Commands

```bash
bun run dev
bun run build
bun run check
bun run generate:api   # regen Orval client from OpenAPI
bun run format
```

`VITE_API_BASE_URL` (default `https://api-zerowaiting.elcho.dev`) переопределяй
для локального backend: `VITE_API_BASE_URL=http://localhost:5000 bun run dev`.

## Git commits

`<type>(<scope>): <subject>` — conventional. Типы:
`feat|fix|refactor|perf|style|docs|test|chore|ci`.
**Без футеров:** никаких `Co-Authored-By`, `Signed-off-by`, `Generated with`.

## Skill map — куда идти за деталями

Skills содержат всю глубину. **Перед работой в домене обязательно
активируй соответствующий skill.**

| Работаешь над…                   | Skill     |
| -------------------------------- | --------- |
| Admin-панель, DataTable, cascade | `admin`   |
| API / TanStack / Orval / кэш     | `api`     |
| Auth, роли, RoleGuard            | `auth`    |
| Seat selection / booking flow    | `booking` |
| Переводы, локали, enum display   | `i18n`    |
| Stores, seat state               | `state`   |
| UI-компоненты, DatePicker        | `ui`      |
| Svelte 5 runes, `{@const}`       | `svelte`  |
| SCSS, токены, цвета, `:global`   | `styling` |
| Даты/время, UTC-контракт         | `dates`   |
| Backend changes (cross-repo)     | `backend` |

## Engineering standard

SOLID, DRY, KISS. Single responsibility. Composition over inheritance.
Refactor, don't patch. Никаких TODO-плейсхолдеров и «временных» хаков.
Если запрос ведёт к плохой архитектуре — объяснить и предложить правильный
подход **до** кода.
