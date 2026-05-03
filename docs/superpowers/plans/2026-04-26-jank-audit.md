# Jank Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Аудит client-side кода и глобальных стилей ZeroWaiting на CSS-паттерны (`box-shadow`, `filter: blur()`, `backdrop-filter: blur()`), вызывающие jank сейчас или потенциально в будущем; починить безопасно фиксящиеся места (lossless T1, по согласованию — T2); зафиксировать всё в `docs/perf/jank-audit-2026-04-26.md` с future-proof checklist.

**Architecture:** Discovery (grep) → Classification (P × C → severity матрица из spec §4) → Approval gate → Per-fix loop с pixel-perfect верификацией через Chrome DevTools MCP screenshots → финальный документ + future-proof checklist. Spec: `docs/superpowers/specs/2026-04-26-jank-audit-design.md`.

**Tech Stack:** SvelteKit 2 + Svelte 5, SCSS (scoped + `:global`), Bun, Chrome DevTools MCP для скриншотов, `bun run check` для типов, `bun run dev` для dev-сервера.

---

## File Structure

**Создаётся:**
- `docs/perf/jank-audit-2026-04-26.md` — финальный артефакт аудита

**Модифицируется (точные файлы определяются в Task 2-4 после discovery):**
- Файлы в scope из spec §3: `src/routes/(client)/**`, `src/routes/t/**`, `src/routes/scanner/**`, `src/components/{client,booking,ui}/**`, `app.scss`, `tokens.scss`, любые `:global`

**Не трогается:**
- Все `src/routes/admin/**` и `src/components/admin/**` — кроме случаев, когда HIGH-find в `:global`/токенах протекает в admin

**Working files (не коммитятся как отдельный артефакт):**
- Промежуточные findings ведутся прямо в `docs/perf/jank-audit-2026-04-26.md`. Файл создаётся в Task 1, наполняется по ходу, коммитится один раз в Task 11.

---

## Task 1: Setup и скелет working-документа

**Files:**
- Create: `docs/perf/jank-audit-2026-04-26.md` (скелет)

- [ ] **Step 1: Проверить чистый git state**

```bash
git status
```

Expected: `working tree clean` или только локальные изменения от brainstorming. Если есть несвязанные изменения — остановиться, спросить пользователя.

- [ ] **Step 2: Создать рабочую ветку**

```bash
git checkout -b perf/jank-audit-2026-04-26
git status
```

Expected: `On branch perf/jank-audit-2026-04-26`.

- [ ] **Step 3: Создать скелет working-документа**

Записать в `docs/perf/jank-audit-2026-04-26.md`:

```markdown
# Jank audit — 2026-04-26

## Scope

- Client: `src/routes/(client)/**`, `src/routes/t/**`, `src/routes/scanner/**`, `src/components/{client,booking,ui}/**`
- Globals: `app.scss`, `tokens.scss`, `:global` определения везде
- Properties: `box-shadow`, `filter: blur(...)`, `backdrop-filter: blur(...)`
- Excluded: admin (кроме globals/tokens)

## Methodology

См. `docs/superpowers/specs/2026-04-26-jank-audit-design.md` §4 (rubric P × C → severity матрица) и §5 (T1/T2/T3 тиры верификации).

## Findings (raw — заполняется в Task 2-4)

<!-- TASK 2 INSERTS RAW MATCHES HERE -->

## Severity buckets (заполняется в Task 4)

<!-- TASK 4 INSERTS HIGH/MED/LOW HERE -->

## HIGH — fixed (заполняется в Task 7)

<!-- TASK 7 INSERTS PER-FIX DETAILS HERE -->

## HIGH — deferred to user (T3)

<!-- TASK 7/9 -->

## MED — fixed via T1

<!-- TASK 8 -->

## MED — watchlist

<!-- TASK 8 -->

## LOW — safe-listed

<!-- TASK 4 -->

## How to measure jank

<!-- TASK 10 -->

## Future-proof checklist

<!-- TASK 10 -->

## Re-run instructions

<!-- TASK 10 -->
```

- [ ] **Step 4: Не коммитить** — файл WIP до Task 11. Убедиться что `git status` показывает его как untracked.

```bash
git status --short
```

Expected: `?? docs/perf/jank-audit-2026-04-26.md`.

---

## Task 2: Discovery — grep всех матчей в scope

**Files:**
- Modify: `docs/perf/jank-audit-2026-04-26.md` (вставить raw findings в секцию `## Findings (raw)`)

- [ ] **Step 1: Grep `filter: blur(...)`**

```bash
grep -rn --include='*.scss' --include='*.svelte' --include='*.css' -E 'filter:\s*blur\(' \
  src/routes/'(client)' src/routes/t src/routes/scanner \
  src/components/client src/components/booking src/components/ui \
  src/app.scss src/styles 2>/dev/null
```

Expected: список матчей вида `path:line:    filter: blur(Npx);`. Записать каждый в working-документ.

- [ ] **Step 2: Grep `backdrop-filter: blur(...)`**

```bash
grep -rn --include='*.scss' --include='*.svelte' --include='*.css' -E 'backdrop-filter:\s*blur\(' \
  src/routes/'(client)' src/routes/t src/routes/scanner \
  src/components/client src/components/booking src/components/ui \
  src/app.scss src/styles 2>/dev/null
```

- [ ] **Step 3: Grep `box-shadow`**

```bash
grep -rn --include='*.scss' --include='*.svelte' --include='*.css' -E 'box-shadow:' \
  src/routes/'(client)' src/routes/t src/routes/scanner \
  src/components/client src/components/booking src/components/ui \
  src/app.scss src/styles 2>/dev/null
```

- [ ] **Step 4: Grep globals (`:global` + `app.scss` + tokens)**

```bash
grep -rn --include='*.scss' --include='*.svelte' --include='*.css' -E ':global\([^)]*\)\s*\{[^}]*(box-shadow|filter:\s*blur|backdrop-filter)' src/ 2>/dev/null
find src -name 'tokens*.scss' -o -name 'app.scss' -o -name 'globals*.scss' 2>/dev/null
```

- [ ] **Step 5: Записать raw findings в working-документ**

В секцию `## Findings (raw)` working-документа вставить таблицу:

```markdown
| # | file:line | property snippet | scope tag |
|---|-----------|------------------|-----------|
| 1 | src/components/ui/Modal.svelte:42 | `backdrop-filter: blur(20px)` | client |
| 2 | ... | ... | ... |
```

`scope tag` = `client` / `globals` / (если случайно попал admin — `admin-leaked` через `:global`).

- [ ] **Step 6: Коммит не делать** — файл всё ещё WIP.

---

## Task 3: Классификация P × C для каждого матча

**Files:**
- Read: каждый файл из findings raw
- Modify: `docs/perf/jank-audit-2026-04-26.md` — добавить колонки `P` и `C` к raw таблице

Применить рубрику spec §4.1 (P-class) и §4.2 (C-class) к каждому матчу.

- [ ] **Step 1: Для каждого матча определить P-class**

Парсинг значения свойства:
- `backdrop-filter: blur(N)` → `N >= 12` → P-CRIT, `4 <= N <= 11` → P-MED, `N < 4` → P-LOW
- `filter: blur(N)` → `N >= 8` → P-CRIT, `1 <= N <= 7` → P-MED, `N < 1` → P-LOW
- `box-shadow` — распарсить blur-radius (3-я длина) и spread (4-я):
  - blur ≥ 24 ИЛИ spread ≥ 8 ИЛИ ≥ 3 stacked → P-HEAVY
  - blur 12–23 → P-MED
  - blur ≤ 8 И spread ≤ 2 И одна тень → P-LOW
  - между 8 и 12 → P-MED (по умолчанию)

- [ ] **Step 2: Для каждого матча определить C-class — прочитать файл, найти контекст**

Для матча `Foo.svelte:42`:

```bash
# Прочитать selector + окружающие правила
```

Использовать инструмент Read на полный файл (или диапазон ±50 строк вокруг матча). Искать:
- В этом же selector или родителе: `animation`, `transition` (с transform/opacity/filter), `position: fixed/sticky`, `overflow: auto/scroll` (для предков), `transform`
- В соответствующем `.svelte`-компоненте: рендерится ли элемент в `{#each}` (грепом класса по компоненту); используется ли в портале/модалке/dropdown/popover (по имени компонента — `Modal`, `Dropdown`, `Popover`, `Tooltip`, `Lightbox`, `BurgerMenu`)

Применить:
- C-HOT: animation/transition/fixed/sticky/scroll-parent ИЛИ `#each` >10
- C-WARM: static, но компонент — портал/модалка/popover/tooltip/lightbox
- C-COLD: всё остальное

- [ ] **Step 3: Применить модификаторы**

- Если файл = `app.scss` / `tokens*.scss` / `:global(...)` — пометить флагом `+global` (для шага severity = +1 ступень)
- Если матч внутри `@media (max-width: 768px)` или в компоненте, целиком прячущемся через `matchMedia('(min-width: ...)')` — пометить `mobile-only` (−1 ступень)

- [ ] **Step 4: Обновить findings таблицу**

```markdown
| # | file:line | property | P | C | flags | scope tag |
|---|-----------|----------|---|---|-------|-----------|
| 1 | ui/Modal.svelte:42 | `backdrop-filter: blur(20px)` | P-CRIT | C-WARM | — | client |
| 2 | app.scss:15 | `backdrop-filter: blur(14px)` | P-CRIT | C-COLD | +global | globals |
```

- [ ] **Step 5: Sanity-check**

Если P-class матча неоднозначен (например, blur(8px) — на границе P-CRIT/P-MED), отметить `*` и обработать как более тяжёлый класс. Лучше переоценить, чем недооценить.

---

## Task 4: Severity buckets — применить матрицу

**Files:**
- Modify: `docs/perf/jank-audit-2026-04-26.md` — секция `## Severity buckets`

Применить матрицу spec §4.3 + модификаторы.

- [ ] **Step 1: Для каждого матча вычислить severity**

Шаги (для каждого финдинга):
1. Базовая severity = матрица P × C (см. spec §4.3 таблицу)
2. Если `+global` — поднять на 1 ступень (`safe → LOW`, `LOW → MED`, `MED → HIGH`, `HIGH → HIGH`)
3. Если `mobile-only` — опустить на 1 ступень (`HIGH → MED`, `MED → LOW`, `LOW → safe`)

- [ ] **Step 2: Распределить по бакетам**

В `## Severity buckets` working-документа:

```markdown
### HIGH (n=X)
| # | file:line | property | P | C | flags | predicted T1 fix |
|---|-----------|----------|---|---|-------|------------------|
| 1 | ... | ... | ... | ... | ... | will-change на animated parent |

### MED (n=X)
| ... |

### LOW (n=X) — listed only, no action
| # | file:line | property |
|---|-----------|----------|
| ... | ... | ... |

### safe (n=X) — not documented further
(skipped)
```

- [ ] **Step 3: Предсказать T1 fix для каждого HIGH**

Для каждого HIGH вписать колонку `predicted T1 fix` — какой подход первой попытки. Шпаргалка:

| Симптом | T1 fix |
|---|---|
| Animated/transformed элемент с blur/shadow | `will-change: transform` на элемент или его animated ancestor |
| Scroll-контейнер с тенью на детях | `contain: layout paint` на контейнер (если нет popovers внутри) или `transform: translateZ(0)` на детей |
| `#each` с тенью на каждом item | вынести shadow в `::before` с `will-change: transform` (изоляция repaint) |
| `backdrop-filter` в портале/модалке | `will-change: backdrop-filter` ИЛИ изоляция через `contain: paint` родителя |
| Глобальный `:global` blur/shadow в анимированном контейнере | заменить на scoped с тем же эффектом + `will-change` |

- [ ] **Step 4: Если бакет HIGH пустой** — записать в документ «No HIGH findings — codebase clean wrt jank-prone CSS». Перейти к Task 11 (документ + commit), пропустив 6-9.

---

## Task 5: Approval gate — представить пользователю отчёт

- [ ] **Step 1: Скопировать таблицы HIGH + MED из working-документа в чат**

Формат:

```
## Jank audit — discovered findings

HIGH (n=X): X файлов, T1 plan на каждый.
| file:line | property | context | T1 fix |

MED (n=X): T1-only fixed if simple.
| ... |

LOW (n=X): listed only, no action — see doc.

Plan:
- Phase F: чиню HIGH (T1) с verify+commit на каждый — N коммитов
- Phase G: MED — T1 only, оппортунистически
- Phase H: T2 candidates — спрошу по каждому отдельно
- Phase I: финальный doc + commit
- Phase J: итог в чате

Approve plan to start fixes?
```

- [ ] **Step 2: ОЖИДАНИЕ ОТВЕТА ПОЛЬЗОВАТЕЛЯ**

**STOP.** Не двигаться к Task 6 без явного `да` / `go` / `start` от пользователя.

Если пользователь меняет приоритеты (например «не трогай UI-комплект, только маршруты») — обновить findings/buckets соответственно перед стартом.

---

## Task 6: Dev server + baseline screenshots

**Files:**
- Read-only — никаких изменений в коде

- [ ] **Step 1: Освободить порт 5173 если занят**

```bash
lsof -i :5173
```

Если процесс есть и это не то, что мы хотим — спросить пользователя перед `kill`. Если свободно — продолжить.

- [ ] **Step 2: Запустить dev server в фоне**

```bash
bun run dev
```

(через `run_in_background: true`)

Дождаться вывода `Local: http://localhost:5173/`. На SvelteKit обычно 3-5 секунд.

- [ ] **Step 3: Проверить, что сервер отвечает**

```bash
curl -sI http://localhost:5173/ | head -1
```

Expected: `HTTP/1.1 200 OK`. Если нет — стоп, разобраться.

- [ ] **Step 4: Снять baseline скриншоты затронутых страниц**

Для каждого HIGH-find определить, на какой странице рендерится файл. Открыть страницу в Chrome DevTools MCP и снять скриншот ДО любых изменений.

```
mcp__chrome-devtools__new_page url=http://localhost:5173/<route>
mcp__chrome-devtools__take_screenshot fullPage=true filePath=/tmp/jank-baseline-<task-id>-before.png
```

Routes для типичных HIGH areas (заполнить по фактическим файлам из findings):
- `/` — home (HomeAmbient)
- `/scanner` — scanner
- `/booking/...` — seat selection
- `/t/...` — public ticket
- `/cinemas/...` — cinema page

Если find в `:global` / токенах — снять скриншоты двух контрастных страниц (например home + booking).

Сохранить пути в working-документе как «baseline screenshots» для каждого find.

---

## Task 7: Per-HIGH fix loop (TEMPLATE — повторить для каждого HIGH find)

**Files:** различаются для каждого find — точный путь из findings.

> **ЭТО ШАБЛОН.** Повторить шаги 1-10 для **каждого** HIGH-финдинга индивидуально. Не делать batch — каждый фикс в своём коммите.

### Шаблон для одного HIGH-find: `<file:line>`, `<property>`, predicted T1 fix `<fix>`

- [ ] **Step 1: Прочитать весь файл (контекст)**

Использовать Read на full file. Проверить:
- Уже есть `will-change`/`transform: translateZ(0)`/`contain` на этом или родительском селекторе? Если да — возможно, фикс уже применён неявно. Записать в документ как «already promoted, no action», перейти к следующему find.
- Класс используется в каких компонентах? `grep -rn '<className>' src/`. Если в нескольких местах — фикс через scoped стиль, не глобально.

- [ ] **Step 2: Определить минимальный T1 fix**

Из шпаргалки в Task 4 + контекст файла. Цель — самое маленькое изменение, дающее GPU-promotion / containment.

- [ ] **Step 3: Применить fix**

Использовать Edit. Сохранить точный diff в working-документе как «applied change».

Примеры конкретных T1 patterns:

```scss
/* Pattern A: animated element, promote */
.fixed_card {
  box-shadow: 0 24px 48px rgba(0,0,0,0.4);
  transition: transform 200ms;
  will-change: transform;        /* ADD */
}

/* Pattern B: scrolled container, isolate paint */
.scroll_list {
  overflow-y: auto;
  contain: layout paint;         /* ADD — but ONLY if no popovers escape this container */
}

/* Pattern C: #each item, push shadow to pseudo */
.item {
  position: relative;
  /* box-shadow: ... REMOVED */
}
.item::before {
  content: '';
  position: absolute; inset: 0;
  box-shadow: 0 8px 16px rgba(0,0,0,0.3);
  pointer-events: none;
  will-change: transform;
  /* проверить, не занят ли ::before в этом селекторе уже */
}

/* Pattern D: backdrop-filter в портале */
.modal_panel {
  backdrop-filter: blur(20px);
  will-change: backdrop-filter;   /* ADD */
  /* НЕ добавлять contain: paint — обрежет popovers */
}

/* Pattern E: mobile-skip через media query */
@media (max-width: 768px) {
  .ambient_glow { display: none; }   /* if effect not critical on mobile */
}
```

- [ ] **Step 4: Проверить занятость `::before`/`::after`** (если используется Pattern C)

```bash
grep -A5 '<className>' <file> | grep -E '::before|::after'
```

Если уже занят — переразметить как «требует T2», перейти к Task 9. Не пытаться сразу.

- [ ] **Step 5: HMR refresh + AFTER скриншот**

Vite обычно HMR'ит автоматически. Подождать 1 секунду:

```
mcp__chrome-devtools__navigate_page url=<same route as baseline>
mcp__chrome-devtools__take_screenshot fullPage=true filePath=/tmp/jank-<task-id>-after.png
```

- [ ] **Step 6: Pixel-perfect diff**

Открыть оба скриншота (`mcp__chrome-devtools__take_screenshot` возвращает image, либо открыть локально). Сравнить визуально — должны быть идентичными для T1.

Если есть **любая** разница — откатить, переразметить как T2:

```bash
git checkout -- <file>
```

И записать в working-документ: «T1 lossless attempt failed visually — moved to T2 batch (Task 9)». Перейти к следующему find.

- [ ] **Step 7: TypeScript / Svelte check**

```bash
bun run check 2>&1 | tail -20
```

Expected: `0 errors`. Если ошибки — скорее всего, нужен импорт `matchMedia` или что-то подобное; разобраться. Не двигаться дальше с красным.

- [ ] **Step 8: Hover/focus state check (для интерактивных элементов)**

Если файл — кнопка / link / interactive: смоделировать hover.

```
mcp__chrome-devtools__hover selector=<element>
mcp__chrome-devtools__take_screenshot filePath=/tmp/jank-<task-id>-hover-after.png
```

И сравнить с hover до фикса (если снимали baseline в hover). Для большинства HIGH find это не нужно (тени обычно на static контейнерах).

- [ ] **Step 9: Commit**

```bash
git add <only the file touched>
git commit -m "perf(<scope>): <one-line change>

Was: <old value/property>
Now: <new value/property>
Why: <why this fixes jank — 1 sentence>"
```

Conventional types: `perf` для perf-улучшений; scope из CLAUDE.md (booking, scanner, home, ui, etc.). Без футеров `Co-Authored-By` / `Generated with`.

- [ ] **Step 10: Записать fix в working-документ**

В секцию `## HIGH — fixed`:

```markdown
### #N: <file:line>
- **Before:** `<property>`
- **After:** `<property after fix>`
- **Tier:** T1 (`<technique>`)
- **Verification:** baseline ↔ after pixel-perfect; `bun run check` clean
- **Commit:** `<short-sha>` `<commit subject>`
```

- [ ] **Step 11: Перейти к следующему HIGH find**

Повторить Task 7 целиком. Когда HIGH бакет пуст — двигаться к Task 8.

---

## Task 8: Per-MED fix loop (TEMPLATE — T1 only, oportunistic)

**Files:** различаются для каждого MED find.

> **ЭТО ШАБЛОН.** Повторить для каждого MED. Если T1 не подходит — пропустить, добавить в watchlist. Никогда T2 в этой задаче (T2 только в Task 9 после явного approval).

### Шаблон для одного MED-find: `<file:line>`

- [ ] **Step 1: Прочитать файл, оценить — решает ли T1?**

T1-fixable, если:
- Достаточно добавить `will-change` / `contain` без побочек
- Или вынести в `::before` свободный от `content`
- Или mobile-skip уместен

T1-NOT-fixable:
- Требует уменьшения значения (T2)
- Требует структурных изменений компонента
- Требует удаления эффекта (T3)

- [ ] **Step 2A: Если T1-fixable — применить (полный цикл из Task 7 шаги 3-10)**

Те же verify steps. Один фикс = один коммит. Записать в `## MED — fixed via T1` в документе.

- [ ] **Step 2B: Если T1-NOT-fixable — добавить в watchlist**

В working-документе, секция `## MED — watchlist`:

```markdown
### <file:line>
- **Property:** `<value>`
- **Context:** `<P×C summary>`
- **Why not fixed:** T1 техники недостаточно (обоснование). Кандидат на T2: `<предложение>` — но не делаем без отдельного запроса.
- **Recommendation:** оставить как есть OR создать follow-up issue
```

- [ ] **Step 3: Перейти к следующему MED find**

Когда MED бакет пуст — двигаться к Task 9.

---

## Task 9: T2 batch — отдельный запрос на каждый

**Files:** различаются.

> Все T2-кандидаты, отложенные из Task 7 (HIGH без T1-решения) и Task 8. Если их 0 — пропустить Task 9, перейти к Task 10.

### Шаблон для одного T2-кандидата

- [ ] **Step 1: Сформулировать вопрос пользователю**

В чате:

```
T2 candidate #M: <file:line>

Current: `<current property>`
Proposed change: `<new property>`
Visual difference: <описание — например «blur 20px → 16px, незаметно для глаза, проверим»>
Reason: <почему T1 не подошёл>
Risk: <если что-то может отличаться — указать>

Approve this T2 fix? (да / нет / альтернатива)
```

- [ ] **Step 2: ОЖИДАНИЕ ОТВЕТА ПОЛЬЗОВАТЕЛЯ**

**STOP.** Не применять без явного `да`.

- [ ] **Step 3A: Если `да` — применить + verify**

Те же шаги 3-10 из Task 7, но визуальная проверка теперь — «незаметная разница, не pixel-perfect, но визуально ок». Скриншоты ДО/ПОСЛЕ остаются — приложить в документ.

- [ ] **Step 3B: Если `нет` или альтернатива** — учесть, повторить Step 1 с новым предложением, либо оставить в watchlist.

- [ ] **Step 4: Записать в документ**

В `## HIGH — fixed` (если был HIGH→T2) или новую секцию `## MED — fixed via T2 (approved)`:

```markdown
### <file:line>
- **Tier:** T2 (approved by user 2026-04-26)
- **Before/After:** ...
- **Visual diff:** ... (приложить ссылку на скриншоты)
- **Commit:** ...
```

- [ ] **Step 5: Перейти к следующему T2-кандидату**

---

## Task 10: Полировка документа (how-to-measure, future-proof checklist, re-run)

**Files:**
- Modify: `docs/perf/jank-audit-2026-04-26.md`

- [ ] **Step 1: Заполнить `## How to measure jank`**

Записать:

```markdown
## How to measure jank

### Chrome DevTools Performance tab
1. Открыть страницу в Chrome.
2. F12 → Performance tab.
3. Click record → выполнить взаимодействие (scroll, open modal, etc.) → stop.
4. Смотреть на:
   - **Frames** — красные/жёлтые кадры = пропущенные frames (jank)
   - **Main** — long tasks (>50ms) в JS
   - **Rendering** → **Paint** — большие painted regions
5. Цель: 60fps стабильно (< 16.6ms на frame).

### Chrome FPS meter
1. F12 → ⌘⇧P (Cmd+Shift+P) → "Show frames per second" / "Show frame rate"
2. Виджет в углу показывает текущий FPS и GPU memory.

### Layers panel (для проверки GPU promotion)
1. F12 → ⌘⇧P → "Show Layers"
2. Видно, какие элементы в отдельных compositor layers.
3. Цель: animated/scrolled элементы — на отдельном слое.

### Paint flashing (визуальная диагностика repaints)
1. F12 → ⌘⇧P → "Show paint flashing rectangles"
2. Зелёные мигающие области = repainted regions.
3. При scroll/animation — repaint должен быть **минимальный** (только изменяющийся элемент, не пол-экрана).

### Quick mobile sanity check
- Chrome DevTools → Device toolbar → throttle CPU 4× → проверить, не лагает.
```

- [ ] **Step 2: Заполнить `## Future-proof checklist`**

Структура:

```markdown
## Future-proof checklist

Перед PR с CSS-изменениями проверь:

### 🔴 Запрещено без замера

- [ ] `filter: blur(>= 8px)` или `backdrop-filter: blur(>= 12px)` на анимированном/scrolled/`#each` элементе
   - Пример из этого репо: <ref на исправленный find #N — file:line>
- [ ] `box-shadow` blur ≥ 24px ИЛИ spread ≥ 8px на animated/list элементе
   - Пример: <ref>
- [ ] Стек из ≥ 3 box-shadow на одном элементе в `#each` или scroll-контейнере

### 🟡 Требует подтверждения GPU-promotion

- [ ] Любой transform/opacity transition на элементе с тенью/блюром → должен быть `will-change: transform`
- [ ] Sticky/fixed элемент с тенью → `will-change: transform`
- [ ] Scroll-контейнер с тенями на детях → `contain: paint` (если внутри нет popovers!) ИЛИ `transform: translateZ(0)` на детях

### 🟢 Обычно безопасно

- [ ] `box-shadow` ≤ 8px blur, ≤ 2px spread, одна тень на static UI
- [ ] Любой эффект, скрытый через `display: none` на mobile (`@media (max-width: 768px)` или matchMedia-guard)
- [ ] `prefers-reduced-motion: reduce` отключение анимаций

### ⚠️ Anti-patterns

- [ ] **НЕ** ставить `will-change` глобально (на `*` или большие селекторы) — создаёт лишние GPU-слои
- [ ] **НЕ** оставлять `will-change` после удаления анимации — он живёт ровно столько, сколько активная анимация
- [ ] **НЕ** ставить `contain: paint` на контейнер с popover/tooltip/dropdown — обрежет overflow
- [ ] **НЕ** комбинировать `translateZ(0) + backface-visibility + will-change` на одном элементе — over-promotion

### Проверка перед merge

1. Chrome Performance tab на затронутых страницах: 60fps?
2. Paint flashing: scroll/animation repaint минимален?
3. Layers panel: animated элементы в своих слоях?
4. Mobile (CPU throttle 4×): не лагает?
```

- [ ] **Step 3: Заполнить `## Re-run instructions`**

```markdown
## Re-run instructions

Чтобы повторить аудит через 6 месяцев:

1. `git checkout -b perf/jank-audit-<YYYY-MM-DD>`
2. Запустить grep'ы из Task 2 этого плана (см. `docs/superpowers/plans/2026-04-26-jank-audit.md` Task 2).
3. Применить рубрику P × C → severity (см. spec `docs/superpowers/specs/2026-04-26-jank-audit-design.md` §4).
4. Сравнить с findings этого аудита — какие места появились новые? Какие пофиксились?
5. Использовать future-proof checklist выше как референс.
```

- [ ] **Step 4: Заполнить findings summary в начале документа**

После `## Methodology`, добавить секцию `## Findings summary`:

```markdown
## Findings summary

| Bucket | Count | Action |
|---|---|---|
| HIGH (fixed T1) | N | committed |
| HIGH (fixed T2, approved) | N | committed |
| HIGH (deferred T3) | N | requires user decision |
| MED (fixed T1) | N | committed |
| MED (watchlist) | N | no action |
| LOW | N | safe-listed |
| safe | N | not documented |
| **Total findings** | **N** | |

**Commits:** N perf-fixes + 1 docs commit (this audit doc).
```

- [ ] **Step 5: Удалить промежуточные комментарии-плейсхолдеры**

Удалить все `<!-- TASK X INSERTS ... -->` HTML-комментарии, оставшиеся в документе.

---

## Task 11: Финальный check + commit документа

**Files:**
- `docs/perf/jank-audit-2026-04-26.md`

- [ ] **Step 1: Финальный type-check**

```bash
bun run check 2>&1 | tail -10
```

Expected: `0 errors`. Если что-то всплыло — стоп, разобраться.

- [ ] **Step 2: Format**

```bash
bun run format
```

Это пройдётся прettier'ом по всему репо. Изменения — должны быть только в файлах, которые мы трогали (если prettier что-то выровнял), плюс по самому документу.

```bash
git status
git diff --stat
```

Если prettier поменял что-то неожиданное (файлы, которые мы не трогали) — отдельный коммит `style: prettier pass` после основного.

- [ ] **Step 3: Прочитать готовый документ полностью**

Открыть `docs/perf/jank-audit-2026-04-26.md`, прочитать end-to-end. Проверить:
- Все секции заполнены (никаких `<!-- ... -->`, никаких `TBD`, `TODO`, пустых таблиц)
- Findings summary count'ы соответствуют реальному числу зафиксированных commits
- Future-proof checklist содержит конкретные ссылки на исправленные file:line из этого аудита (не абстрактные правила)
- Ссылки на коммиты — short-SHA каждый

- [ ] **Step 4: Stage + commit документ**

```bash
git add docs/perf/jank-audit-2026-04-26.md
git commit -m "docs(perf): add jank audit 2026-04-26"
```

- [ ] **Step 5: Если был prettier-pass с лишними изменениями — отдельный коммит**

```bash
git add -u
git diff --cached --stat
git commit -m "style: prettier pass after jank audit"
```

- [ ] **Step 6: Просмотр всех коммитов ветки**

```bash
git log main..HEAD --oneline
```

Expected: список вида:
```
<sha> docs(perf): add jank audit 2026-04-26
<sha> perf(<scope>): ... (один на каждый fix)
...
```

Проверить — каждый perf-коммит трогает один файл (revertable). Если коммит трогает несколько файлов из-за ошибки — оставить как есть, отметить в итоге, не пытаться rewrite-history.

- [ ] **Step 7: Остановить dev-сервер**

В фоновом процессе отправить SIGINT (или просто `kill <pid>`).

---

## Task 12: Финальный summary в чате

- [ ] **Step 1: Записать в чат итог**

Формат:

```
## Jank audit complete

Branch: `perf/jank-audit-2026-04-26`
Commits: <N>
- <N1> perf-fixes (HIGH+MED, T1)
- <N2> perf-fixes (T2, approved)
- 1 docs commit

Findings:
- HIGH: <X> total → <X1> fixed T1, <X2> fixed T2, <X3> deferred T3
- MED: <Y> total → <Y1> fixed T1, <Y2> watchlist
- LOW: <Z> listed, no action
- safe: <W> ignored

Document: `docs/perf/jank-audit-2026-04-26.md`
- Future-proof checklist готов
- How-to-measure готов
- Re-run instructions готовы

Deferred T3 (требуют твоего решения):
1. <file:line> — <предложение>
2. ...

Next steps:
- Review ветку `perf/jank-audit-2026-04-26`
- Merge в main (или открыть PR)
- Решить deferred T3 кандидатов отдельно
```

- [ ] **Step 2: Готово**

Дальше — пользователь решает: merge сейчас, открыть PR, или продолжить с deferred T3 в новой сессии.

---

## Self-Review checklist (для writing-plans skill)

После записи плана пробежался по spec'у:

**Spec coverage:**
- §1 цель → Task 11/12 (документ + summary)
- §2 primary constraint «не сломать» → Task 7 шаги 5-6 (pixel-perfect verify), Task 9 (T2 explicit approval)
- §3 scope → Task 1 (скелет с scope), Task 2 (grep на правильных папках)
- §4 методология (P, C, матрица) → Task 3, 4
- §5 процесс верификации → Task 7 целиком
- §6 артефакты → Task 5 (chat report), Task 11 (doc commit), Task 7 step 9 (per-fix commit)
- §7 фазы A-J → Task 1=A skeleton, Task 2=A discovery, Task 3=B, Task 4=C, Task 5=D, Task 6=E, Task 7=F, Task 8=G, Task 9=H, Task 10+11=I, Task 12=J ✓
- §8 риски → Task 7 step 4 (::before занят), Task 6 step 1 (port 5173), Task 7 step 2 «уже promoted»
- §9 success criteria → Task 11 step 3 (документ полный), Task 7 step 7 (`bun run check`), Task 7 step 9 (один фикс = один коммит)
- §10 follow-ups → не блокирующие, не часть плана

**Placeholder scan:** Проходился — TBD/TODO нет; все шаги имеют конкретные команды/код. «Per-fix template» в Task 7-9 — это явный шаблон, не плейсхолдер; повторяется N раз.

**Type consistency:** Имена T1/T2/T3, P-CRIT/P-HEAVY/P-MED/P-LOW, C-HOT/C-WARM/C-COLD, severity HIGH/MED/LOW/safe — последовательны во всём плане и spec'е. ✓
