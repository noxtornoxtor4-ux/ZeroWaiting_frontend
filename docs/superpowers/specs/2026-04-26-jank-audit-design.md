# Jank audit — design spec (2026-04-26)

## 1. Цель

Провести полный аудит client-side кода и глобальных стилей ZeroWaiting на наличие
CSS-паттернов (`box-shadow`, `filter: blur()`, `backdrop-filter: blur()`),
которые могут вызвать jank при скролле/анимации сейчас или в будущем при
изменении layout. По результатам — починить безопасно фиксящиеся места,
зафиксировать в документе всё остальное (включая «future-proof checklist»),
не сломав визуал.

Контекст: недавние perf-фиксы (rAF-throttle ScrollProgress, mobile-skip
HomeAmbient, sparkle-grid) — это реактивная починка регрессий. Этот аудит
проактивный: ловим то, что **может** вызвать jank, до того как пользователь
заметит.

## 2. Primary constraint

**«Не сломать»** — приоритет №1. Оптимизация максимальная, но через
**lossless** техники в первую очередь. Любой фикс, меняющий визуал хоть на
пиксель, требует явного одобрения пользователя.

## 3. Scope

### В scope

- `src/routes/(client)/**`
- `src/routes/t/**`
- `src/routes/scanner/**`
- `src/components/client/**`
- `src/components/booking/**`
- `src/components/ui/**`
- Глобальные стили: `app.scss`, `tokens.scss`, любые `:global` определения
- Свойства: `box-shadow`, `filter: blur(...)`, `backdrop-filter: blur(...)`

### Не в scope

- `src/routes/admin/**`, `src/components/admin/**` (admin desktop-only,
  jank менее критичен — кроме случая, когда стиль протекает через `:global`
  или токен)
- Оптимизация изображений (`*.png`, `*.webp`, `*.jpg`)
- JS/TS-перформанс (мемоизация, `$derived`, ре-рендеры)
- Глобальное `will-change` на всё подряд (анти-паттерн — создаёт лишние
  GPU-слои)
- Замена `backdrop-filter` на Canvas/WebGL (over-engineering)
- Любые архитектурные рефакторы — только локальные CSS/Svelte изменения

## 4. Методология

### 4.1 Классификация по свойству (P)

| Класс | Условие |
|---|---|
| **P-CRIT** | `backdrop-filter: blur(>= 12px)` ИЛИ `filter: blur(>= 8px)` |
| **P-HEAVY** | `box-shadow` с blur ≥ 24px ИЛИ spread ≥ 8px ИЛИ ≥ 3 stacked shadows |
| **P-MED** | `backdrop-filter: blur(4–11px)` ИЛИ `filter: blur(1–7px)` ИЛИ `box-shadow` blur 12–23px |
| **P-LOW** | `box-shadow` ≤ 8px blur, ≤ 2px spread, одна тень |

### 4.2 Классификация по контексту (C)

Признак определяется чтением самого файла (или родительского компонента).

| Класс | Признак |
|---|---|
| **C-HOT** | Элемент анимируется (`animation`, `transition` на `transform`/`opacity`), скроллится (внутри `overflow: auto/scroll`), `position: fixed/sticky`, или рендерится в `#each` с >10 элементов |
| **C-WARM** | Static, но в портале / модалке / dropdown / popover (открывается по клику и попадает в анимированный layout) |
| **C-COLD** | Чистый static UI, не анимируется и не множится |

### 4.3 Severity матрица

|  | C-HOT | C-WARM | C-COLD |
|---|---|---|---|
| **P-CRIT** | HIGH | HIGH | MED |
| **P-HEAVY** | HIGH | MED | LOW |
| **P-MED** | MED | LOW | LOW |
| **P-LOW** | LOW | LOW | safe |

**Модификаторы:**

- `:global` / `app.scss` / токены → **+1 ступень** (стиль протекает везде).
- Внутри `@media (max-width: 768px)` или в компоненте, целиком прячущемся
  на mobile → **−1 ступень**.

### 4.4 Тиры оптимизации (применяем в порядке)

| Тир | Техники | Визуальный риск |
|---|---|---|
| **T1 — lossless** | `will-change: transform`, `transform: translateZ(0)`, `backface-visibility: hidden`, `contain: paint/layout/style`, вынос blur/shadow в `::before`/`::after` с `will-change`, rAF-throttle, mobile-skip через `matchMedia`, `@media (prefers-reduced-motion)`, разделение animated/static слоёв | **Ноль** |
| **T2 — subtly lossy** | Уменьшение blur ≤ 25%, дроп одной из stacked shadows, swap `backdrop-filter` на pre-rendered blurred PNG | Незаметно (проверяем визуально) |
| **T3 — visually lossy** | Удаление эффекта, значительные уменьшения значений | Требует явного `да` от пользователя |

### 4.5 Severity → действие

| Severity | Действие в этом сеансе |
|---|---|
| **HIGH** | Чиним. T1, если решает; иначе T2 после визуальной проверки. T3 — спрашиваем. |
| **MED** | Чиним только если T1 решает. T2/T3 → watchlist в документе. |
| **LOW** | Не трогаем, документируем как «безопасно». |
| **safe** | Не упоминаем. |

## 5. Процесс верификации

Каждый фикс проходит через эту воронку (см. Phase F в §7):

**Before fix**
1. Прочитать **весь** компонент/SCSS, понять контекст эффекта.
2. `grep` по `.svelte` — где используется этот класс.
3. Проверить — есть ли уже `will-change`/`transform`/`contain`. Если да —
   возможно, фикс не нужен.

**Apply fix**
4. Применить **только T1**. Если T1 не решает — отложить место в
   «требует T2», не делать сразу.
5. Минимальное изменение: `will-change: transform` лучше, чем
   over-promotion (`translateZ(0) + backface-visibility + will-change`).

**Verify (обязательно)**
6. Dev server: `bun run dev` (через `run_in_background`), Chrome DevTools
   MCP — открыть страницу, скриншот ДО и ПОСЛЕ фикса.
7. Визуальный diff — pixel-perfect для T1.
8. `bun run check` — TS/Svelte диагностика.
9. Если хоть что-то выглядит иначе на T1 — **откат**, переместить в
   watchlist (значит, фикс не был lossless).

**Commit**
10. Один фикс = один коммит. Conventional: `perf(<scope>): <change>`.
    Без футеров (`Co-Authored-By` / `Generated with`).

**T2 batch (после T1 прохода)**
11. Возвращаемся к отложенным «требует T2». На каждый — отдельное
    одобрение пользователя (показываю текущее значение, предлагаемое,
    как будет выглядеть на скриншоте).
12. T3 — никогда без явного `да, удаляй`.

### Failure modes

- **`bun run check` упал** → откат фикса, разобраться в причине, не
  двигаться дальше.
- **Скриншот отличается на T1** → значит, фикс не lossless. Откат,
  переразметка как T2 или watchlist.
- **Dev-сервер не стартует** → стоп. Не пытаться продолжать без визуальной
  проверки.

## 6. Артефакты

### 6.1 Отчёт в чате (Phase D)

Markdown-таблицы по severity:

```
HIGH (n=X)
| file:line              | property                  | context              | tier | planned fix              |
|------------------------|---------------------------|----------------------|------|--------------------------|
| Foo.svelte:42          | filter: blur(12px)        | scroll fixed header  | T1   | will-change + contain    |

MED (n=X) — fixed only if T1 works
LOW (n=X) — listed only, no action
```

После каждой группы — summary («планируем починить N из M»).

### 6.2 Документ — `docs/perf/jank-audit-2026-04-26.md`

```markdown
# Jank audit — 2026-04-26

## Scope
## Methodology (рубрика T1/T2/T3 + severity матрица)
## Findings summary (counts: HIGH / MED / LOW / safe)
## HIGH — fixed (детально: было → стало → проверка)
## HIGH — deferred to user (требует T3, описана причина)
## MED — fixed via T1
## MED — watchlist (не трогали, объяснено почему)
## LOW — safe-listed
## How to measure jank (DevTools Performance tab, Chrome FPS meter,
   Layers panel, Paint flashing) — короткий how-to с конкретными шагами
## Future-proof checklist — список «красных флагов» для будущих PR,
   с конкретными примерами файлов из этого репо (не абстрактные правила)
## Re-run instructions (как повторить аудит через полгода)
```

### 6.3 Коммиты

- Один фикс = один коммит, тип `perf(<scope>):`.
- Документ → отдельный коммит `docs(perf): add jank audit 2026-04-26`.
- Этот spec → отдельный коммит `docs(specs): add jank audit design`.

## 7. Фазы сеанса

| Фаза | Что | Approval gate? |
|---|---|---|
| **A** | Discovery: grep всех `box-shadow`/`filter:blur`/`backdrop-filter` в scope | — |
| **B** | Контекстная классификация (читаем файлы, присваиваем P × C) | — |
| **C** | Severity matrix → buckets HIGH/MED/LOW/safe | — |
| **D** | Презентация отчёта в чате (таблица фиксов) | **Да** — `go` перед фиксами |
| **E** | Dev server up + baseline screenshots ключевых страниц | — |
| **F** | Чиним HIGH (T1 only), цикл verify+commit для каждого | — |
| **G** | Чиним MED (T1 only, оппортунистически) | — |
| **H** | T2-кандидаты — на каждый отдельный запрос | **Да** — на каждый T2-фикс |
| **I** | Пишу `docs/perf/jank-audit-2026-04-26.md` + commit | — |
| **J** | Итог в чате + список deferred T3 (если есть) | — |

## 8. Риски и митигации

| Риск | Митигация |
|---|---|
| T1-фикс pixel-perfect, но ломает edge-case в hover/focus | Скриншоты в hover/focus состояниях для интерактивных элементов |
| `contain: paint` обрезает overflow (popover, tooltip, dropdown) | Не применять `contain: paint` к контейнерам с поповерами; только `will-change` |
| Blur вынесен в `::before`, но `::before` уже занят `content` | Перед фиксом проверить `::before`/`::after` на занятость |
| Vite-процесс на 5173 занят другим запуском | `lsof -i :5173` перед стартом dev-сервера |
| Сессия упрётся в context limit при 15+ файлах | Промежуточный документ, остановка, остаток в follow-up |
| `will-change` забыт после удаления анимации | В future-proof checklist — правило «`will-change` живёт ровно столько, сколько активная анимация» |

## 9. Success criteria

- Все HIGH-места в scope либо починены (T1/T2 с одобрением), либо
  задокументированы с обоснованием отказа от починки.
- Ни одного визуального регресса (pixel-perfect для T1; одобренный
  компромисс для T2).
- `bun run check` зелёный после всех фиксов.
- Документ `docs/perf/jank-audit-2026-04-26.md` существует, содержит
  reproducible методику и future-proof checklist.
- Все фиксы в отдельных коммитах, revertable.

## 10. Open follow-ups (не блокируют этот аудит)

- JS/TS performance pass (мемоизация stores, `$derived` оптимизации).
- Image optimization audit.
- Layout-shift / CLS audit (отдельный артефакт jank).
- Stylelint-правило для запрета жирных blur/shadow без `will-change`
  в анимированных контекстах — может быть автоматизированной защитой
  поверх checklist'а.
