# CLAUDE.md Slim — Design

**Date:** 2026-04-24
**Topic:** Сократить `CLAUDE.md` с 719 до ~80 строк, перенести детали в domain skills.
**Goal:** Чтобы Claude Code чётко видел главные правила (always-on) и не размывал
внимание на простыню, а детали подгружал по триггерам через skills.

---

## 1. Context & Problem

**Current state.** `CLAUDE.md` — 719 строк / ~3500 слов. Загружается в контекст
полностью при каждом разговоре. Содержит всё: critical rules, engineering
philosophy, project overview, tech stack, Svelte 5 patterns, styling conventions,
client layout, route structure, import aliases, env vars, scripts, git commit
guide, backend workflow, data flow patterns, dates/times UTC contract, common
pitfalls.

**Existing skills** в `.claude/skills/` (активируются по триггерам):
`admin`, `api`, `auth`, `booking`, `i18n`, `state`, `ui` — уже покрывают
значительную часть разделов «Data Flow Patterns» и «Common Pitfalls»
из CLAUDE.md (дубли).

**Problem.**

1. Много контента дублировано между CLAUDE.md и skills.
2. Always-on простыня размывает внимание — главные правила тонут среди
   справочных таблиц и примеров.
3. Route Structure, Styling Conventions, UTC contract и т.п. нужны только
   при работе в конкретных доменах — нет причин держать в always-on.

**Constraint.** Ничего не потерять. Все правила и знания должны остаться
доступными — но в правильном месте (always-on для универсального, skill
для локального).

---

## 2. Chosen Approach

**Hybrid (option C):**
- CLAUDE.md урезается до ~80 строк: only absolute rules + project identity +
  commands + git commits + **skill map** (таблица «работаешь над X → skill Y»).
- 4 новых skill: `svelte`, `styling`, `dates`, `backend`.
- Крупные разделы переезжают в соответствующие skills (новые или
  существующие).
- Route Structure (client) удаляется как деривируемо из `src/routes/`;
  admin route table с `minRole` переезжает в skill `admin`.

**Rejected alternatives:**
- **A (pure compression)** — оставляет дубли между CLAUDE.md и skills, не
  решает главную проблему «always-on перегружен».
- **B (pure migration without TOC)** — убирает always-on подсказку про
  существующие skills; модель может не активировать нужный skill, если
  триггер не сработает явно.
- **Single fat `conventions` skill** — активируется почти всегда (любой
  `.svelte` / `.scss` / дата), т.е. фактически «второй CLAUDE.md».
  Нарушает принцип узких триггеров.

---

## 3. Final CLAUDE.md (target)

```markdown
# ZeroWaiting — Frontend

SaaS-платформа для сетей кинотеатров. SvelteKit 2 (Svelte 5 runes), TanStack
Svelte Query, Orval API, Firebase OAuth → JWT, svelte-i18n (ru/en/ky/kz/uz).
Backend-репозиторий: `~/Desktop/ZeroWaiting_backend`.

## Absolute Rules

Применяются везде, в каждом файле. Нарушение = переделка.

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

    bun run dev
    bun run build
    bun run check
    bun run generate:api   # regen Orval client from OpenAPI
    bun run format

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
```

Target: ≤ 100 строк.

---

## 4. New Skills

| Skill     | Description (триггеры)                                                                                                                                              | Содержит                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `svelte`  | `$app/state`, `$app/stores`, `$state`, `$derived`, `$effect`, `$props`, `$bindable`, Snippet, runes, `{@const}`                                                     | Svelte 5 runes: `$app/state` vs `$app/stores`; Props + Snippet; State & Derived; Bindable; Effects; правило `{@const}` placement (direct child only). |
| `styling` | `.scss`, SCSS, BEM, `--primary`, `--background`, `--surface`, design tokens, `linear-gradient(45deg, #8b5cf6, #a855f7)`, `:global`, `backdrop-filter`, logo_icon    | SCSS rules (нет BEM, underscore_case, nesting = DOM), design tokens (dark theme), brand logo pattern, color conventions (purple gradient / text gradient / borders / glass), PostCSS pxtorem, `:global()` pitfalls + portal styling. |
| `dates`   | `@/lib/utils/datetime`, `toBackendCivilDate`, `toBackendInstant`, `fromBackendInstant`, `formatCivilDate`, `formatDate`, `DatePicker`, `DateRangeFilter`, UTC contract | Civil date vs Instant; все хелперы (`toBackend*`, `fromBackend*`, `format*`); когда что применять; таблица полей API по типам; DatePicker / DateRangeFilter API; future work про branch timezone. |
| `backend` | `~/Desktop/ZeroWaiting_backend`, `generate:api`, `PORT=5000`, `@DtoEntityHidden`, Prisma, NestJS, OptionalJwtAuthGuard, cross-repo                                     | Когда править backend vs frontend; cross-repo workflow (edit → build → local run → regen Orval); правило «типы только из `@/api/model`»; Backend-Driven State (`OptionalJwtAuthGuard` enrichment). |

Каждый skill — файл `.claude/skills/<name>/SKILL.md` с frontmatter
`name` / `description` / `metadata.author=zerowaiting` / `metadata.version=1.0.0`,
в том же формате что и существующие skills.

---

## 5. Migration Map — раздел → назначение

| Раздел CLAUDE.md                         | Назначение                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Critical Rule: No Partial Changes        | **Остаётся** (сжато, 1 bullet)                                            |
| Engineering Philosophy                   | **Остаётся** сжато (секция Engineering standard, ~6 строк)                |
| Project Overview                         | **Остаётся** (1 абзац шапки)                                              |
| Tech Stack table                         | **Остаётся** (1 строка в шапке)                                           |
| Svelte 5 Patterns                        | → skill `svelte`                                                          |
| Styling Conventions                      | → skill `styling`                                                         |
| Client Layout / Header (glassmorphism)   | → skill `styling`                                                         |
| Route Structure (Public + Client tables) | **Удалить** (деривируемо из `src/routes/(client)/`)                       |
| Route Structure (Admin table с minRole)  | → skill `admin`                                                           |
| Import Aliases                           | **Остаётся** (1 bullet)                                                   |
| Environment Variables (`VITE_API_BASE_URL`) | **Остаётся** (1 строка рядом с Commands — нужен для `bun run dev`)     |
| Scripts                                  | **Остаётся** (Commands)                                                   |
| Git Commit Guidelines                    | **Остаётся** сжато                                                        |
| Backend block                            | → skill `backend`                                                         |
| Data Flow → API Types                    | → `api` (+ ref в `backend`)                                               |
| Data Flow → Backend-Driven State         | → `backend` (где) + `api` (как читать)                                    |
| Data Flow → Cache Invalidation           | → `api`                                                                   |
| Data Flow → Optimistic Updates           | → `api`                                                                   |
| Data Flow → isLoading vs isFetching      | → `api` (+ bullet в Absolute Rules)                                       |
| Data Flow → Error Handling               | → `api`                                                                   |
| Data Flow → `useTableQuery` + DataTable  | → `admin` (проверить, нет ли уже)                                         |
| Data Flow → Date inputs                  | → `dates` (глубина) + `ui` (component API-reference)                      |
| Data Flow → Cascade filters              | → `admin`                                                                 |
| Data Flow → Status & Enum Display        | → `i18n` (client CONFIG) + `admin` (inline Russian label maps)            |
| Dates & Times (UTC contract)             | → `dates`                                                                 |
| Pitfalls → No `:global()` generic        | → `styling` (+ bullet в Absolute Rules)                                   |
| Pitfalls → Portal + `:global()`          | → `styling`                                                               |
| Pitfalls → `{@const}` placement          | → `svelte`                                                                |
| Pitfalls → Booking flow seat statuses    | → `booking` (проверить, нет ли уже)                                       |
| Pitfalls → Admin vs Client i18n          | → `i18n` (+ bullet в Absolute Rules)                                      |
| Pitfalls → Modal + ViewportScale         | → `admin` (проверить, нет ли уже)                                         |

---

## 6. Verification

Чтобы гарантировать «0 потерь»:

1. **Grep-чек терминов.** Для каждого уникального термина из старого
   CLAUDE.md (`useTableQuery`, `ViewportScale`, `toBackendCivilDate`,
   `@DtoEntityHidden`, `updateMovieFavoriteCache`, `ROLE_HIERARCHY`,
   `PENDING booking`, `HELD`, `glassmorphism`, `postcss-pxtorem` и т.д.) —
   `grep -r` по `CLAUDE.md` + `.claude/skills/`. Каждое вхождение должно
   найтись хотя бы в одном из двух.
2. **Section diff.** Чек-лист по всем секциям старого CLAUDE.md:
   каждая в одном из статусов — `kept` / `moved to <skill>` /
   `deleted intentionally` (с обоснованием).
3. **Existing-skill dedup.** Перед добавлением куска в существующий skill
   (`admin` / `api` / `booking` / `i18n` / `ui`) — `grep` по его SKILL.md.
   Если уже есть — не дублировать, обновить если нужно.
4. **Trigger audit.** Для каждого нового skill: `description` содержит
   реальные триггеры (имена файлов / функций / типов / путей), которые
   модель увидит в коде или запросе. Иначе skill не активируется.
5. **Size smoke test.** CLAUDE.md ≤ 100 строк. Новые skills — 40–100
   строк каждый. Совокупный объём (CLAUDE.md + 11 skills) сопоставим
   или меньше старого CLAUDE.md с учётом того, что skills грузятся
   выборочно.
6. **Build sanity.** `bun run check` после миграции — чтобы никакое
   перемещение не сломало ссылки в коде (skills не влияют на билд,
   но всё равно — подстраховка).

---

## 7. Definition of Done

- [ ] `CLAUDE.md` ≤ 100 строк, содержит только absolute rules + identity +
      commands + git + skill map + engineering standard.
- [ ] Созданы skills: `svelte`, `styling`, `dates`, `backend`.
- [ ] Перемещённое содержимое присутствует в соответствующих skills.
- [ ] `grep` по каждому термину находит его в CLAUDE.md или skill.
- [ ] `bun run check` проходит.
- [ ] Один атомарный коммит: `docs(claude-md): slim always-on context, move
      details to domain skills`.

---

## 8. Out of Scope

- Рефакторинг контента существующих skills (`admin`, `api`, `auth`, `booking`,
  `i18n`, `state`, `ui`) — только добавление перенесённых кусков туда, где
  их ещё нет. Переписывание существующего контента — отдельная задача.
- Поддержка branch timezone для screenings — уже помечена future work,
  не трогаем.
- Перевод CLAUDE.md на чистый русский или чистый английский — сохраняем
  смешанный стиль (английские термины + русские комментарии), как в
  текущем файле.
