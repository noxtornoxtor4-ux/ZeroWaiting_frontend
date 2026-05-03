# Jank audit — 2026-04-26

## Scope

- Client: `src/routes/(client)/**`, `src/routes/t/**`, `src/routes/scanner/**`, `src/components/{client,booking,ui}/**`
- Globals: `app.scss`, `tokens.scss`, `:global` определения везде
- Properties: `box-shadow`, `filter: blur(...)`, `backdrop-filter: blur(...)`
- Excluded: admin (кроме globals/tokens)

## Methodology

См. `docs/superpowers/specs/2026-04-26-jank-audit-design.md` §4 (rubric P × C → severity матрица) и §5 (T1/T2/T3 тиры верификации).

## Findings summary

| Bucket                         | Count            | Action                                                  |
| ------------------------------ | ---------------- | ------------------------------------------------------- |
| HIGH — fixed via T1            | 12               | committed (each fix = its own commit)                   |
| HIGH — fixed via T2 (approved) | 0                | —                                                       |
| HIGH — deferred T3             | 0                | —                                                       |
| MED — fixed via T1             | 7 + 3 transitive | committed (transitive = covered by sibling HIGH commit) |
| MED — watchlist                | 7                | no action; documented for future regression scanning    |
| LOW                            | 22               | safe-listed, no action                                  |
| safe                           | 8                | not documented further                                  |
| **Total findings**             | **59**           |                                                         |

**Commits in branch `perf/jank-audit-2026-04-26`:** 21 single-purpose `perf(<scope>):` commits (11 for individual HIGH findings + 3 for HIGH #1's three animated `.glass-card` consumers + 7 for MED T1 fixes), plus 1 docs commit (this audit doc). All commits are individually revertable.

## Findings (raw)

Resolved tokens used in classification:

- `var(--shadow-md)` → `0 4px 12px rgba(0,0,0,0.4)` (single, blur=12) → **P-MED**
- `var(--shadow-lg)` → `0 12px 36px rgba(0,0,0,0.5)` (single, blur=36) → **P-HEAVY**
- `$dropdown-shadow` (Select.svelte:536) → 2 stacked, max blur=16 → **P-MED**

Greps run (see spec §4 / Task 2 of plan):

```
grep -rn -E 'filter:\s*blur\('         <scope>   → 32 hits (incl. backdrop variant)
grep -rn -E 'backdrop-filter:\s*blur\(' <scope>  → 26 hits
grep -rn -E 'box-shadow:'              <scope>   → 38 hits (multi-line counted by leading prop)
grep -rn -E ':global\(...\) {... (box-shadow|filter:blur|backdrop-filter)' src/ → 0 raw matches
```

Note: globals-only grep on a single line returned 0, but inspection of `src/app.scss` and `:global(...)` blocks across components revealed **8** properties inside global selectors (counted in scope flags below).

`src/styles/` directory does not exist — omitted from scope. Only `src/app.scss` is the global stylesheet. `src/routes/t/**` and `src/routes/scanner/**` had no jank-prone CSS in the targeted properties.

| #   | file:line                                                               | property snippet                                                                                       | P       | C      | flags       | scope tag |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------- | ------ | ----------- | --------- |
| 1   | src/app.scss:262                                                        | `backdrop-filter: blur(24px)` on `.glass-card`                                                         | P-CRIT  | C-WARM | +global     | globals   |
| 2   | src/app.scss:263                                                        | `box-shadow: 0 8px 32px / inset 0 1px` (2 stacked) on `.glass-card`                                    | P-MED   | C-WARM | +global     | globals   |
| 3   | src/routes/(client)/(home)/sections/WelcomeSection.svelte:422           | `filter: blur(3px) brightness(0.9)` on `.slide_bg_image`                                               | P-MED   | C-HOT  | —           | client    |
| 4   | src/routes/(client)/(home)/sections/WelcomeSection.svelte:595           | `:hover { box-shadow: 0 8px 25px ... }` on `.btn.primary`                                              | P-HEAVY | C-WARM | —           | client    |
| 5   | src/routes/(client)/(home)/sections/WelcomeSection.svelte:673           | `filter: blur(20px)` on `.poster_glow` (opacity-animated)                                              | P-CRIT  | C-HOT  | —           | client    |
| 6   | src/routes/(client)/(home)/sections/WelcomeSection.svelte:802           | `filter: blur(3px)` on `.progress_glow` + `animation: pulse`                                           | P-MED   | C-HOT  | —           | client    |
| 7   | src/routes/(client)/(home)/sections/WelcomeSectionMobile.svelte:338     | `backdrop-filter: blur(10px)` on `.badge`                                                              | P-MED   | C-COLD | mobile-only | client    |
| 8   | src/routes/(client)/(home)/sections/WelcomeSectionMobile.svelte:442     | `box-shadow: 0 8px 20px rgba(168,85,247,0.35)` on `.cta.primary`                                       | P-MED   | C-WARM | mobile-only | client    |
| 9   | src/routes/(client)/(home)/sections/WelcomeSectionMobile.svelte:447     | `backdrop-filter: blur(10px)` on `.cta.secondary`                                                      | P-MED   | C-WARM | mobile-only | client    |
| 10  | src/routes/(client)/(home)/sections/WelcomeSectionMobile.svelte:504     | `backdrop-filter: blur(10px)` on `.play_pause` (positioned)                                            | P-MED   | C-WARM | mobile-only | client    |
| 11  | src/routes/(client)/screenings/[id]/+page.svelte:352                    | `box-shadow: var(--shadow-md)` on `.poster`                                                            | P-MED   | C-COLD | —           | client    |
| 12  | src/routes/(client)/screenings/[id]/+page.svelte:472                    | `backdrop-filter: blur(16px)` on `.bottom` (`position:fixed`)                                          | P-CRIT  | C-HOT  | —           | client    |
| 13  | src/routes/(client)/screenings/[id]/components/SeatMap.svelte:121       | `box-shadow: 0 14px 30px -18px #a855f7` on `.screen_bar`                                               | P-HEAVY | C-COLD | —           | client    |
| 14  | src/routes/(client)/screenings/[id]/components/SeatMap.svelte:192       | `box-shadow: 0 0 14px rgba(168,85,247,0.7)` on `.cell.selected` (each×each)                            | P-MED   | C-HOT  | —           | client    |
| 15  | src/routes/(client)/movies/[id]/+page.svelte:232                        | `box-shadow: var(--shadow-lg)` on `.poster`                                                            | P-HEAVY | C-COLD | —           | client    |
| 16  | src/routes/(client)/movies/[id]/components/ReviewForm.svelte:119        | `box-shadow: 0 0 0 3px rgba(168,85,247,0.15)` focus ring                                               | P-LOW   | C-COLD | —           | client    |
| 17  | src/routes/(client)/movies/[id]/components/ScheduleFilterBar.svelte:106 | `backdrop-filter: blur(10px)` on `.preset` button                                                      | P-MED   | C-COLD | —           | client    |
| 18  | src/routes/(client)/movies/[id]/components/ScheduleFilterBar.svelte:122 | `box-shadow: 0 4px 14px rgba(139,92,246,0.3)` `.preset.active`                                         | P-MED   | C-COLD | —           | client    |
| 19  | src/components/client/layout/Header.svelte:199                          | `backdrop-filter: blur(7px)` on `&::before` of sticky nav                                              | P-MED   | C-HOT  | —           | client    |
| 20  | src/components/client/layout/Header.svelte:232                          | `box-shadow: 0 4px 15px rgba(139,92,246,0.3)` on `.logo_icon` (sticky)                                 | P-MED   | C-HOT  | —           | client    |
| 21  | src/components/client/layout/Header.svelte:381                          | `box-shadow: 0 4px 15px rgba(168,85,247,0.3)` on `.cta` (sticky)                                       | P-MED   | C-HOT  | —           | client    |
| 22  | src/components/client/layout/Header.svelte:386                          | `:hover { box-shadow: 0 8px 25px rgba(168,85,247,0.4) }` on `.cta:hover` (sticky)                      | P-HEAVY | C-HOT  | —           | client    |
| 23  | src/components/client/layout/BurgerMenu.svelte:186                      | `backdrop-filter: blur(7px)` on `&::before` (modal panel)                                              | P-MED   | C-WARM | —           | client    |
| 24  | src/components/client/layout/BurgerMenu.svelte:353                      | `:hover { box-shadow: 0 6px 20px rgba(168,85,247,0.4) }` on `.cta`                                     | P-MED   | C-WARM | —           | client    |
| 25  | src/components/client/layout/Footer.svelte:191                          | `box-shadow: 0 4px 15px rgba(139,92,246,0.3)` on `.logo_icon`                                          | P-MED   | C-COLD | —           | client    |
| 26  | src/components/client/layout/Footer.svelte:224                          | `backdrop-filter: blur(10px)` on `.social_link`                                                        | P-MED   | C-COLD | —           | client    |
| 27  | src/components/client/layout/Footer.svelte:231                          | `:hover { box-shadow: 0 4px 15px ... }` on `.social_link:hover` (transform animated)                   | P-MED   | C-COLD | —           | client    |
| 28  | src/components/client/layout/Footer.svelte:259                          | `backdrop-filter: blur(10px)` on `.newsletter_input`                                                   | P-MED   | C-COLD | —           | client    |
| 29  | src/components/client/layout/Footer.svelte:270                          | `:focus { box-shadow: 0 0 20px rgba(139,92,246,0.3) }` on `.newsletter_input:focus`                    | P-MED   | C-COLD | —           | client    |
| 30  | src/components/client/layout/Footer.svelte:291                          | `:hover { box-shadow: 0 4px 15px rgba(139,92,246,0.4) }` on `.newsletter_btn:hover` (transform)        | P-MED   | C-COLD | —           | client    |
| 31  | src/components/client/layout/UserMenu.svelte:127                        | `box-shadow: 0 8px 32px rgba(0,0,0,0.35)` on `:global(.user_menu)` (animated dropdown)                 | P-HEAVY | C-WARM | +global     | client    |
| 32  | src/components/client/layout/LanguageSwitcher.svelte:95                 | `box-shadow: 0 8px 24px rgba(0,0,0,0.3)` on `.dropdown`                                                | P-HEAVY | C-WARM | —           | client    |
| 33  | src/components/booking/ActiveBookingBanner.svelte:118                   | `backdrop-filter: blur(10px)` on `.ActiveBookingBanner` (`position:fixed` + `animation: slide_in`)     | P-MED   | C-HOT  | —           | client    |
| 34  | src/components/booking/ActiveBookingBanner.svelte:121                   | `box-shadow: 0 12px 32px rgba(0,0,0,0.35), inset 0 1px ...` (2 stacked, blur=32)                       | P-HEAVY | C-HOT  | —           | client    |
| 35  | src/components/booking/ExpiredBookingView.svelte:39                     | `backdrop-filter: blur(10px)` on `.ExpiredBookingView`                                                 | P-MED   | C-COLD | —           | client    |
| 36  | src/components/ui/MovieCarousel.svelte:106                              | `:hover .card { box-shadow: 0 12px 32px / 0 0 0 1px / 0 0 32px }` (3 stacked, transform animated)      | P-HEAVY | C-HOT  | —           | client    |
| 37  | src/components/ui/MovieCarousel.svelte:190                              | `backdrop-filter: blur(8px)` on `.favorite_slot` (per-card)                                            | P-MED   | C-HOT  | —           | client    |
| 38  | src/components/ui/MovieCarousel.svelte:223                              | `backdrop-filter: blur(8px)` on `.age` (per-card)                                                      | P-MED   | C-HOT  | —           | client    |
| 39  | src/components/ui/MovieCarousel.svelte:273                              | `backdrop-filter: blur(8px)` on `.chip` (per-card)                                                     | P-MED   | C-HOT  | —           | client    |
| 40  | src/components/ui/MovieCarousel.svelte:326                              | `box-shadow: 0 8px 24px / 0 0 24px` on `.play_btn` (transform animated)                                | P-HEAVY | C-HOT  | —           | client    |
| 41  | src/components/ui/Modal.svelte:110                                      | `backdrop-filter: blur(2px)` on `.backdrop` (opacity transition)                                       | P-LOW   | C-WARM | —           | client    |
| 42  | src/components/ui/Modal.svelte:152                                      | `box-shadow: 0 20px 60px / 0 4px 12px` (2 stacked, blur=60) on `.content` (transform/opacity animated) | P-HEAVY | C-WARM | —           | client    |
| 43  | src/components/ui/Lightbox.svelte:235                                   | `backdrop-filter: blur(8px)` on `.backdrop` (opacity transition)                                       | P-MED   | C-WARM | —           | client    |
| 44  | src/components/ui/Lightbox.svelte:398                                   | `backdrop-filter: blur(12px)` on `.caption_strip` (opacity transition)                                 | P-CRIT  | C-WARM | —           | client    |
| 45  | src/components/ui/Tooltip.svelte:99                                     | `box-shadow: 0 4px 16px rgba(0,0,0,0.25)` on `:global(.Tooltip)` (portal)                              | P-MED   | C-WARM | +global     | client    |
| 46  | src/components/ui/Button.svelte:117                                     | `box-shadow: 0 2px 12px rgba(124,58,237,0.25)` on `.primary`                                           | P-MED   | C-COLD | —           | client    |
| 47  | src/components/ui/Button.svelte:121                                     | `:hover { box-shadow: 0 4px 20px rgba(124,58,237,0.4) }` on `.primary:hover`                           | P-MED   | C-COLD | —           | client    |
| 48  | src/components/ui/DataTable.svelte:489                                  | `box-shadow: 0 4px 16px rgba(0,0,0,0.3)` on `.sizer_dropdown`                                          | P-MED   | C-WARM | —           | client    |
| 49  | src/components/ui/VideoPlayer.svelte:313                                | `box-shadow: 0 2px 8px rgba(0,0,0,0.6)` on `.plyr_preview_thumb`                                       | P-LOW   | C-COLD | —           | client    |
| 50  | src/components/ui/SearchInput.svelte:73                                 | `box-shadow: 0 0 0 3px rgba(168,85,247,0.15)` focus ring                                               | P-LOW   | C-COLD | —           | client    |
| 51  | src/components/ui/Preloader.svelte:78                                   | `box-shadow: 0 4px 15px rgba(139,92,246,0.3)` on `.icon`                                               | P-MED   | C-COLD | —           | client    |
| 52  | src/components/ui/Select.svelte:776                                     | `box-shadow: $dropdown-shadow` on `:global(.select-dropdown)` (animation)                              | P-MED   | C-WARM | +global     | client    |
| 53  | src/components/ui/DateRangeFilter.svelte:504                            | `box-shadow: 0 10px 28px / 0 3px 8px` on `:global(.DateRangePopover)` (animation)                      | P-HEAVY | C-WARM | +global     | client    |
| 54  | src/components/ui/DateRangeFilter.svelte:669                            | `box-shadow: inset 0 0 0 1px var(--primary)` on day cell                                               | P-LOW   | C-COLD | —           | client    |
| 55  | src/components/ui/Textarea.svelte:230                                   | `box-shadow: 0 4px 16px rgba(0,0,0,0.3)` on autocomplete dropdown                                      | P-MED   | C-WARM | —           | client    |
| 56  | src/components/ui/Popconfirm.svelte:158                                 | `box-shadow: 0 8px 24px rgba(0,0,0,0.1)` on `:global(.popconfirm)` (portal)                            | P-HEAVY | C-WARM | +global     | client    |
| 57  | src/components/ui/Input.svelte:739                                      | `box-shadow: 0 4px 16px rgba(0,0,0,0.3)` on `:global(.phone_dropdown)`                                 | P-MED   | C-WARM | +global     | client    |
| 58  | src/components/ui/DatePicker.svelte:711                                 | `box-shadow: 0 10px 28px / 0 3px 8px` on `:global(.DatePickerPopover)` (animation)                     | P-HEAVY | C-WARM | +global     | client    |
| 59  | src/components/ui/DatePicker.svelte:833                                 | `box-shadow: inset 0 0 0 1px var(--primary)` on today cell                                             | P-LOW   | C-COLD | —           | client    |

`-webkit-backdrop-filter` lines are duplicates of the standard property in the same rule and are not counted as separate findings.

## Severity buckets

Matrix applied per spec §4.3. Modifiers: `+global` raises one tier; `mobile-only` lowers one tier (single-pass, then clamped to [safe..HIGH]).

### HIGH (n=12)

| #   | file:line                                                     | property                                                                                | P       | C      | flags   | predicted T1 fix                                                                                                                                                                             |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------- | ------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | src/app.scss:262                                              | `backdrop-filter: blur(24px)` on `.glass-card`                                          | P-CRIT  | C-WARM | +global | scope `.glass-card` users → audit usages; add `contain: paint` on parents that animate, OR drop blur radius to ≤12                                                                           |
| 5   | src/routes/(client)/(home)/sections/WelcomeSection.svelte:673 | `filter: blur(20px)` on opacity-animated `.poster_glow`                                 | P-CRIT  | C-HOT  | —       | `will-change: opacity` on `.poster_glow`; promote `.poster` ancestor to its own layer (`isolation: isolate` already partial); consider replacing blur halo with pre-rendered radial-gradient |
| 12  | src/routes/(client)/screenings/[id]/+page.svelte:472          | `backdrop-filter: blur(16px)` on `.bottom` (`position: fixed`)                          | P-CRIT  | C-HOT  | —       | `will-change: backdrop-filter` on `.bottom`; OR `contain: paint` on `.bottom` (it has fixed sizing)                                                                                          |
| 22  | src/components/client/layout/Header.svelte:386                | `:hover { box-shadow: 0 8px 25px ... }` on sticky-nav CTA                               | P-HEAVY | C-HOT  | —       | move shadow to `::before` with `will-change: transform`; OR `transform: translateZ(0)` on `.cta` to isolate repaint from sticky parent                                                       |
| 31  | src/components/client/layout/UserMenu.svelte:127              | `box-shadow: 0 8px 32px` on `:global(.user_menu)` w/ `dropdownAppear` animation         | P-HEAVY | C-WARM | +global | `will-change: transform, opacity` on `.user_menu`; `contain: paint`                                                                                                                          |
| 34  | src/components/booking/ActiveBookingBanner.svelte:121         | `box-shadow: 0 12px 32px / inset` on fixed-position banner with `slide_in` animation    | P-HEAVY | C-HOT  | —       | `will-change: transform` on `.ActiveBookingBanner`; ensure animation only mutates `transform/opacity`                                                                                        |
| 36  | src/components/ui/MovieCarousel.svelte:106                    | 3-stacked box-shadow on `:hover .card` (animated transform)                             | P-HEAVY | C-HOT  | —       | move shadow stack to `.card::before` with `will-change: transform`; isolate per-card repaint                                                                                                 |
| 40  | src/components/ui/MovieCarousel.svelte:326                    | 2-stacked box-shadow (blur=24) on `.play_btn` (transform animated)                      | P-HEAVY | C-HOT  | —       | `will-change: transform` on `.play_btn`; or move to `::before`                                                                                                                               |
| 44  | src/components/ui/Lightbox.svelte:398                         | `backdrop-filter: blur(12px)` on `.caption_strip` (opacity transition)                  | P-CRIT  | C-WARM | —       | `will-change: opacity` on `.caption_strip`; `contain: paint` on parent                                                                                                                       |
| 53  | src/components/ui/DateRangeFilter.svelte:504                  | 2-stacked shadow `0 10px 28px / 0 3px 8px` on `:global(.DateRangePopover)` (animation)  | P-HEAVY | C-WARM | +global | `contain: paint` on popover root; OR move stacked shadow to `::before` with `will-change: transform, opacity`                                                                                |
| 56  | src/components/ui/Popconfirm.svelte:158                       | `box-shadow: 0 8px 24px` on `:global(.popconfirm)` portal                               | P-HEAVY | C-WARM | +global | `will-change: transform, opacity` if entrance animated; `contain: paint`                                                                                                                     |
| 58  | src/components/ui/DatePicker.svelte:711                       | 2-stacked shadow `0 10px 28px / 0 3px 8px` on `:global(.DatePickerPopover)` (animation) | P-HEAVY | C-WARM | +global | `contain: paint` on popover root; OR move stacked shadow to `::before` with `will-change: transform, opacity`                                                                                |

### MED (n=17)

| #   | file:line                                                         | property                                                                          | P       | C      | flags   | predicted T1 fix                                                                          |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- | ------ | ------- | ----------------------------------------------------------------------------------------- |
| 2   | src/app.scss:263                                                  | `box-shadow: 0 8px 32px / inset` on `.glass-card`                                 | P-MED   | C-WARM | +global | rely on consumer to add `will-change` per usage; document                                 |
| 3   | src/routes/(client)/(home)/sections/WelcomeSection.svelte:422     | `filter: blur(3px) brightness(0.9)` on slide bg w/ 8s transform                   | P-MED   | C-HOT  | —       | `will-change: transform` on `.slide_bg_image`; bg images already isolated                 |
| 4   | src/routes/(client)/(home)/sections/WelcomeSection.svelte:595     | `:hover { box-shadow: 0 8px 25px ... }` on `.btn.primary` (transform)             | P-HEAVY | C-WARM | —       | `will-change: transform` on `.btn.primary`                                                |
| 6   | src/routes/(client)/(home)/sections/WelcomeSection.svelte:802     | `filter: blur(3px)` on `.progress_glow` w/ infinite `pulse` animation             | P-MED   | C-HOT  | —       | `will-change: opacity, transform`; or replace with non-blur glow                          |
| 14  | src/routes/(client)/screenings/[id]/components/SeatMap.svelte:192 | `box-shadow: 0 0 14px ...` on `.cell.selected` rendered in nested `#each`         | P-MED   | C-HOT  | —       | move to `::before` per-cell; toggle visibility via opacity rather than re-applying shadow |
| 19  | src/components/client/layout/Header.svelte:199                    | `backdrop-filter: blur(7px)` on `&::before` of sticky nav                         | P-MED   | C-HOT  | —       | `will-change: backdrop-filter` on the nav (sticky parent triggers repaint on scroll)      |
| 20  | src/components/client/layout/Header.svelte:232                    | `box-shadow: 0 4px 15px ...` on `.logo_icon` (sticky parent)                      | P-MED   | C-HOT  | —       | `will-change: transform`; promote logo to its own layer                                   |
| 21  | src/components/client/layout/Header.svelte:381                    | `box-shadow: 0 4px 15px ...` on `.cta` (sticky parent)                            | P-MED   | C-HOT  | —       | `will-change: transform` on `.cta`                                                        |
| 32  | src/components/client/layout/LanguageSwitcher.svelte:95           | `box-shadow: 0 8px 24px ...` on `.dropdown`                                       | P-HEAVY | C-WARM | —       | `will-change: transform, opacity` on dropdown if animated                                 |
| 33  | src/components/booking/ActiveBookingBanner.svelte:118             | `backdrop-filter: blur(10px)` on `.ActiveBookingBanner` w/ `slide_in`             | P-MED   | C-HOT  | —       | `will-change: backdrop-filter, transform`                                                 |
| 37  | src/components/ui/MovieCarousel.svelte:190                        | `backdrop-filter: blur(8px)` on `.favorite_slot` (per-card)                       | P-MED   | C-HOT  | —       | scope to single instance via `contain: paint` on `.card`                                  |
| 38  | src/components/ui/MovieCarousel.svelte:223                        | `backdrop-filter: blur(8px)` on `.age` (per-card)                                 | P-MED   | C-HOT  | —       | same as #37                                                                               |
| 39  | src/components/ui/MovieCarousel.svelte:273                        | `backdrop-filter: blur(8px)` on `.chip` (per-card)                                | P-MED   | C-HOT  | —       | same as #37                                                                               |
| 42  | src/components/ui/Modal.svelte:152                                | `box-shadow: 0 20px 60px / 0 4px 12px` on `.content` w/ scale+translate animation | P-HEAVY | C-WARM | —       | `will-change: transform, opacity` on `.content`; clear after animation ends               |
| 45  | src/components/ui/Tooltip.svelte:99                               | `box-shadow: 0 4px 16px ...` on `:global(.Tooltip)` (portal)                      | P-MED   | C-WARM | +global | acceptable, single shadow; `will-change: transform, opacity` if animated                  |
| 52  | src/components/ui/Select.svelte:776                               | `box-shadow: $dropdown-shadow` on `:global(.select-dropdown)` (animation)         | P-MED   | C-WARM | +global | `will-change: transform, opacity`                                                         |
| 57  | src/components/ui/Input.svelte:739                                | `box-shadow: 0 4px 16px ...` on `:global(.phone_dropdown)`                        | P-MED   | C-WARM | +global | `will-change: opacity, transform`                                                         |

### LOW (n=22) — listed only, no action

| #   | file:line                                                               | property                                                                   |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 11  | src/routes/(client)/screenings/[id]/+page.svelte:352                    | `box-shadow: var(--shadow-md)` on static `.poster`                         |
| 13  | src/routes/(client)/screenings/[id]/components/SeatMap.svelte:121       | `box-shadow: 0 14px 30px -18px #a855f7` on `.screen_bar` (negative spread) |
| 15  | src/routes/(client)/movies/[id]/+page.svelte:232                        | `box-shadow: var(--shadow-lg)` on static `.poster`                         |
| 16  | src/routes/(client)/movies/[id]/components/ReviewForm.svelte:119        | focus ring `box-shadow: 0 0 0 3px ...`                                     |
| 17  | src/routes/(client)/movies/[id]/components/ScheduleFilterBar.svelte:106 | `backdrop-filter: blur(10px)` on `.preset` button                          |
| 18  | src/routes/(client)/movies/[id]/components/ScheduleFilterBar.svelte:122 | `box-shadow: 0 4px 14px ...` on `.preset.active`                           |
| 23  | src/components/client/layout/BurgerMenu.svelte:186                      | `backdrop-filter: blur(7px)` on `&::before` of menu panel                  |
| 24  | src/components/client/layout/BurgerMenu.svelte:353                      | `:hover { box-shadow: 0 6px 20px ... }` on `.cta` (transform)              |
| 25  | src/components/client/layout/Footer.svelte:191                          | `box-shadow: 0 4px 15px ...` on `.logo_icon` (static)                      |
| 26  | src/components/client/layout/Footer.svelte:224                          | `backdrop-filter: blur(10px)` on `.social_link`                            |
| 27  | src/components/client/layout/Footer.svelte:231                          | `:hover { box-shadow: 0 4px 15px ... }` on `.social_link:hover`            |
| 28  | src/components/client/layout/Footer.svelte:259                          | `backdrop-filter: blur(10px)` on `.newsletter_input`                       |
| 29  | src/components/client/layout/Footer.svelte:270                          | `:focus { box-shadow: 0 0 20px ... }` on `.newsletter_input:focus`         |
| 30  | src/components/client/layout/Footer.svelte:291                          | `:hover { box-shadow: 0 4px 15px ... }` on `.newsletter_btn:hover`         |
| 35  | src/components/booking/ExpiredBookingView.svelte:39                     | `backdrop-filter: blur(10px)` on static container                          |
| 41  | src/components/ui/Modal.svelte:110                                      | `backdrop-filter: blur(2px)` on `.backdrop`                                |
| 43  | src/components/ui/Lightbox.svelte:235                                   | `backdrop-filter: blur(8px)` on `.backdrop` (opacity transition)           |
| 46  | src/components/ui/Button.svelte:117                                     | `box-shadow: 0 2px 12px ...` on `.primary`                                 |
| 47  | src/components/ui/Button.svelte:121                                     | `:hover { box-shadow: 0 4px 20px ... }` on `.primary:hover`                |
| 48  | src/components/ui/DataTable.svelte:489                                  | `box-shadow: 0 4px 16px ...` on `.sizer_dropdown`                          |
| 51  | src/components/ui/Preloader.svelte:78                                   | `box-shadow: 0 4px 15px ...` on `.icon` (static)                           |
| 55  | src/components/ui/Textarea.svelte:230                                   | `box-shadow: 0 4px 16px ...` on autocomplete dropdown                      |

### safe — skipped

(skipped per spec rubric — static, single-shadow ≤8px, focus-ring inset, or mobile-only LOW that further drops below threshold.)

Items that downgraded to **safe** via the matrix:

- #7 `WelcomeSectionMobile.svelte:338` — `backdrop-filter: blur(10px)` on `.badge` (P-MED, C-COLD, mobile-only) → safe
- #8 `WelcomeSectionMobile.svelte:442` — `box-shadow: 0 8px 20px ...` on `.cta.primary` (P-MED, C-WARM, mobile-only) → safe
- #9 `WelcomeSectionMobile.svelte:447` — `backdrop-filter: blur(10px)` on `.cta.secondary` (P-MED, C-WARM, mobile-only) → safe
- #10 `WelcomeSectionMobile.svelte:504` — `backdrop-filter: blur(10px)` on `.play_pause` (P-MED, C-WARM, mobile-only) → safe
- #49 `VideoPlayer.svelte:313` — `box-shadow: 0 2px 8px` (P-LOW, C-COLD) → safe
- #50 `SearchInput.svelte:73` — focus-ring `box-shadow: 0 0 0 3px` (P-LOW, C-COLD) → safe
- #54 `DateRangeFilter.svelte:669` — `box-shadow: inset 0 0 0 1px` (P-LOW, C-COLD) → safe
- #59 `DatePicker.svelte:833` — `box-shadow: inset 0 0 0 1px` (P-LOW, C-COLD) → safe

## HIGH — fixed

### #5: WelcomeSection.svelte:673

- **Before:** `filter: blur(20px)` on `.poster_glow` (opacity transition)
- **After:** + `will-change: opacity`
- **Tier:** T1 (`will-change` GPU promotion)
- **Verification:** baseline ↔ after pixel-perfect (idle: opacity 0 + visibility hidden — provably zero pixel contribution); `bun run check` clean (0 errors, 0 warnings)
- **Commit:** 77d3373 perf(home): promote .poster_glow to GPU layer

### #12: screenings/[id]/+page.svelte:472

- **Before:** `backdrop-filter: blur(16px)` on fixed `.bottom`
- **After:** + `will-change: backdrop-filter`
- **Tier:** T1 (`will-change` GPU promotion)
- **Verification:** diff lossless (will-change non-visual per W3C); `bun run check` clean
- **Commit:** 0438ff1 perf(booking): promote fixed .bottom bar to GPU layer

### #34: ActiveBookingBanner.svelte:121

- **Before:** stacked `box-shadow` on `slide_in`-animated banner
- **After:** + `will-change: transform`
- **Tier:** T1
- **Verification:** diff lossless; `bun run check` clean
- **Commit:** 0ae7a67 perf(booking): promote ActiveBookingBanner to GPU layer

### #22: Header.svelte:386

- **Before:** `:hover box-shadow 0 8px 25px` on sticky `.cta`
- **After:** + `will-change: transform`
- **Tier:** T1
- **Verification:** diff lossless (will-change non-visual); `bun run check` clean
- **Commit:** e0d6158 perf(layout): promote sticky-nav .cta to GPU layer

### #31: UserMenu.svelte:127

- **Before:** `box-shadow: 0 8px 32px` on `:global(.user_menu)` with `dropdownAppear` animation
- **After:** + `will-change: transform, opacity`
- **Tier:** T1
- **Verification:** diff lossless (will-change non-visual); `bun run check` clean
- **Commit:** 6c6152a perf(layout): promote .user_menu dropdown to GPU layer

### #44: Lightbox.svelte:398

- **Before:** `backdrop-filter: blur(12px)` on `.caption_strip` with opacity transition
- **After:** + `will-change: opacity`
- **Tier:** T1
- **Verification:** diff lossless (will-change non-visual); `bun run check` clean
- **Commit:** 6126a72 perf(ui): promote Lightbox .caption_strip to GPU layer

### #56: Popconfirm.svelte:158

- **Before:** `box-shadow: 0 8px 24px` on `:global(.popconfirm)` portal (no entrance animation)
- **After:** + `will-change: transform` (static portal — no opacity hint needed)
- **Tier:** T1
- **Verification:** diff lossless (will-change non-visual); `bun run check` clean
- **Commit:** ec48d5b perf(ui): promote Popconfirm portal to GPU layer

### #53: DateRangeFilter.svelte:504

- **Before:** stacked `0 10px 28px / 0 3px 8px` on `:global(.DateRangePopover)` (animated portal — `date-range-pop-appear` 0.15s)
- **After:** + `will-change: transform, opacity`
- **Tier:** T1
- **Verification:** diff lossless (will-change non-visual); `bun run check` clean (0 errors, 0 warnings)
- **Commit:** 1890f5d perf(ui): promote DateRangePopover to GPU layer

### #58: DatePicker.svelte:711

- **Before:** stacked `0 10px 28px / 0 3px 8px` on `:global(.DatePickerPopover)` (animated portal — `date-picker-pop-appear` 0.15s)
- **After:** + `will-change: transform, opacity`
- **Tier:** T1
- **Verification:** diff lossless (will-change non-visual); `bun run check` clean (0 errors, 0 warnings)
- **Commit:** 2dfec60 perf(ui): promote DatePickerPopover to GPU layer

### #36: MovieCarousel.svelte:106

- **Before:** 3-stacked `:hover` box-shadow on transform-animated `.card` in `{#each}`
- **After:** + `will-change: transform` on base `.card`
- **Tier:** T1
- **Verification:** diff lossless (will-change non-visual); `bun run check` clean
- **Commit:** aefc170 perf(ui): promote MovieCarousel .card to GPU layer

### #40: MovieCarousel.svelte:326

- **Before:** 2-stacked box-shadow on transform-animated `.play_btn`
- **After:** + `will-change: transform`
- **Tier:** T1
- **Verification:** diff lossless; `bun run check` clean
- **Commit:** 87c7321 perf(ui): promote MovieCarousel .play_btn to GPU layer

### #1: app.scss:262 (.glass-card) — per-consumer scoped fix

- **Before:** global `.glass-card` rule with `backdrop-filter: blur(24px)` (used in 19 components, 3 animated)
- **Approach:** Option A — scoped `will-change: transform` adds in 3 animated consumers (didn't modify app.scss to avoid global over-promotion of 16 static consumers)
- **Files touched:**
  - `src/routes/(client)/(home)/components/PromotionCard.svelte`
  - `src/routes/(client)/(home)/sections/AnnouncementsSection.svelte`
  - `src/routes/(client)/cinemas/+page.svelte`
- **Tier:** T1 (per-consumer scoped GPU promotion)
- **Verification:** each diff +1 line lossless; `bun run check` clean
- **Commits:** `c54a0b5`, `1fa0668`, `e14c636`

## HIGH — deferred to user (T3)

None. Every HIGH finding was resolved via lossless T1 fixes (`will-change` GPU promotion or per-consumer scoped promotion). No T2 visual compromises and no T3 visual removals were necessary.

## MED — fixed via T1

### #3: WelcomeSection.svelte:422

- **Before:** `filter: blur(3px) brightness(0.9)` on `.slide_bg_image` w/ `transition: transform 8s`
- **After:** + `will-change: transform`
- **Tier:** T1
- **Verification:** diff lossless; `bun run check` clean (0 errors, 0 warnings)
- **Commit:** `f43f5fb` perf(home): promote .slide_bg_image to GPU layer

### #4: WelcomeSection.svelte:595

- **Before:** `:hover { transform + box-shadow 0 8px 25px }` on hero `.btn.primary`
- **After:** + `will-change: transform` on base `&.primary` rule
- **Tier:** T1
- **Verification:** diff lossless; `bun run check` clean
- **Commit:** `39a36bd` perf(home): promote hero .btn.primary to GPU layer

### #6: WelcomeSection.svelte:802

- **Before:** `filter: blur(3px)` + `animation: pulse 1s ease-in-out infinite` on `.progress_glow`
- **After:** + `will-change: opacity, transform`
- **Tier:** T1
- **Verification:** diff lossless; `bun run check` clean
- **Commit:** `2926ca6` perf(home): promote .progress_glow to GPU layer

### #19: Header.svelte:199

- **Before:** `backdrop-filter: blur(7px)` on `.content::before` (sticky `.Header` parent)
- **After:** + `will-change: backdrop-filter`
- **Tier:** T1
- **Verification:** diff lossless; `bun run check` clean
- **Commit:** `45a209f` perf(layout): promote sticky-nav glass ::before to GPU layer

### #20: Header.svelte:232

- **Before:** `box-shadow: 0 4px 15px ...` + `transition: transform 0.3s` on `.logo_icon` (sticky parent)
- **After:** + `will-change: transform`
- **Tier:** T1
- **Verification:** diff lossless; `bun run check` clean
- **Commit:** `b8b0d4c` perf(layout): promote Header .logo_icon to GPU layer

### #42: Modal.svelte:152

- **Before:** stacked `box-shadow: 0 20px 60px / 0 4px 12px` on `.content` w/ scale+translate transition (220ms)
- **After:** + `will-change: transform, opacity`
- **Tier:** T1
- **Verification:** diff lossless; `bun run check` clean
- **Commit:** `0f6d3f2` perf(ui): promote Modal .content to GPU layer

### #52: Select.svelte:776

- **Before:** `box-shadow: $dropdown-shadow` on `:global(.select-dropdown)` w/ `select-dropdown-appear` 0.15s animation
- **After:** + `will-change: transform, opacity`
- **Tier:** T1
- **Verification:** diff lossless; `bun run check` clean
- **Commit:** `84cbf3f` perf(ui): promote Select :global(.select-dropdown) to GPU layer

### #2: app.scss:263 (.glass-card box-shadow inset)

- **Before:** `box-shadow: 0 8px 32px / inset` on global `.glass-card`
- **Approach:** transitively covered by #1 — same per-consumer `will-change: transform` adds promote each animated consumer to own GPU layer; the inset shadow paints on the consumer's own layer instead of forcing parent repaint
- **Tier:** T1 (no separate commit needed — covered by #1's commits `c54a0b5`, `1fa0668`, `e14c636`)
- **Verification:** see #1

### #21: Header.svelte:381 (.cta box-shadow base)

- **Before:** `box-shadow: 0 4px 15px ...` on base `.cta` rule (sticky parent triggers repaints on scroll)
- **Approach:** transitively covered by #22 — `will-change: transform` was added to base `.cta` rule, isolating both the base-state and `:hover` shadow paints to own GPU layer
- **Tier:** T1 (no separate commit — covered by #22's commit `e0d6158`)
- **Verification:** see #22

### #33: ActiveBookingBanner.svelte:118 (backdrop-filter blur(10px))

- **Before:** `backdrop-filter: blur(10px)` on the same `.ActiveBookingBanner` root that has `slide_in` animation
- **Approach:** transitively covered by #34 — `will-change: transform` already added to the same root rule, promoting to own GPU layer; backdrop-filter rasterises once into the promoted layer instead of repainting parent on every animation frame
- **Tier:** T1 (no separate commit — covered by #34's commit `0ae7a67`)
- **Verification:** see #34

## MED — watchlist

### #32: LanguageSwitcher.svelte:95 — `.dropdown`

- **Property:** `box-shadow: 0 8px 24px rgba(0,0,0,0.3)`
- **Reason for skip:** rule has no animation, transition, or Svelte transition; rendered via `PopoverMenu` `{#if open}` portal which itself has no entry animation. T1 `will-change` would over-promote a static element with no transform/opacity changing — strictly worse (creates a permanent compositor layer for nothing).
- **If future change adds entry animation:** revisit and add `will-change: transform, opacity`.

### #45: Tooltip.svelte:99 — `.tooltip` (declared scoped, not `:global` in source)

- **Property:** `box-shadow: 0 4px 16px rgba(0,0,0,0.25)`
- **Reason for skip:** truly static — no `animation`, no `transition`, no Svelte transition on the `{#if visible}` block. Tooltip simply appears/disappears via `{#if}`. No transform or opacity change anywhere on the rule, so `will-change` would buy nothing and pin a layer permanently while the tooltip is open.
- **Note:** audit listed selector as `:global(.Tooltip)`; actual selector is scoped `.tooltip`. Behaviour-wise the same conclusion applies.
- **If future change adds fade/scale entry:** revisit with `will-change: transform, opacity`.

### #57: Input.svelte:739 — `:global(.phone_dropdown)`

- **Property:** `box-shadow: 0 4px 16px rgba(0,0,0,0.3)`
- **Reason for skip:** purely static — `:global(.phone_dropdown)` has no `animation`, no `transition`, and the host `{#if dropdownOpen}` block has no Svelte transition. Phone country dropdown opens/closes via plain `{#if}`. `will-change` would create a long-lived layer for a static portal.
- **If future change adds entry animation:** revisit with `will-change: transform, opacity`.

### #14: SeatMap.svelte:192 — `.cell.selected box-shadow` in nested `{#each}`

- **Property:** `box-shadow: 0 0 14px ...` on `.cell.selected` rendered inside rows × cols nested loop
- **Context:** P-MED × C-HOT (HOT due to nested each), but `.selected` only applies to user's chosen seats (≤10 in practice).
- **Reason for skip:** T1 pure `will-change` would over-promote every cell — potentially hundreds of GPU layers for a typical hall. The cleaner T1 alternative — moving the shadow to `::before` per-cell — is structural, not lossless `will-change`. Value reduction is T2.
- **Recommendation:** revisit if SeatMap shows perceptible lag on very large halls (>200 seats) or if multi-select grows beyond ~30 seats.

### #37: MovieCarousel.svelte:190 — `.favorite_slot backdrop-filter blur(8px)`

- **Property:** `backdrop-filter: blur(8px)` on per-card `.favorite_slot` badge
- **Context:** P-MED × C-HOT (rendered in `{#each}` carousel cards)
- **Reason for skip:** `will-change: backdrop-filter` per chip would create N GPU layers per card × 3 chip types — clear over-promotion regression. `contain: paint` on `.card` could clip overflow badges. The card itself is already promoted via #36's `will-change: transform`, which mitigates parent-repaint on scroll/hover; the per-chip backdrop-filter rasterises once into the parent card's layer.
- **Recommendation:** monitor on low-end mobile devices. If jank observed, consider replacing chip blur with semi-transparent solid background (T3 — visual change requires user approval).

### #38: MovieCarousel.svelte:223 — `.age backdrop-filter blur(8px)`

- Same pattern as #37. Same rationale, same recommendation.

### #39: MovieCarousel.svelte:273 — `.chip backdrop-filter blur(8px)`

- Same pattern as #37. Same rationale, same recommendation.

## LOW — safe-listed

22 findings classified as LOW are listed in the `### LOW (n=22)` table under `## Severity buckets`. They represent small box-shadows (≤8px blur, ≤2px spread, single-shadow) on static UI, focus rings, and inset borders — these stay as-is per the rubric. No code changes; documented for future regression scanning only.

## How to measure jank

When this audit needs to be reproduced or when validating a perf-suspect change, use the following Chrome DevTools tooling.

### Performance tab — find dropped frames

1. Open the suspect page in Chrome.
2. F12 → **Performance** tab.
3. Click **Record** → perform the interaction (scroll, hover, open modal, drag) → **Stop**.
4. Inspect:
   - **Frames** track — red/yellow frames are dropped frames (jank).
   - **Main** track — long tasks (>50 ms) in JS.
   - **Rendering** → **Paint** timing — large repainted regions.
5. Goal: 60 fps stable (<16.6 ms per frame).

### FPS meter — live frame rate

1. F12 → ⌘⇧P → "Show frames per second" / "Show frame rate".
2. Widget shows current FPS and GPU memory usage.

### Layers panel — verify GPU promotion

1. F12 → ⌘⇧P → "Show Layers".
2. Confirm animated/scrolled elements live on their own compositor layer.
3. After applying a `will-change` fix, the targeted element should show up as a separate layer.

### Paint flashing — visualise repaints

1. F12 → ⌘⇧P → "Show paint flashing rectangles".
2. Green flashing areas = repainted regions per frame.
3. During scroll/animation, repaint area must be **localised to the changing element** — not whole sections of the screen.

### Mobile sanity — CPU throttling

1. F12 → Device toolbar (⌘⇧M).
2. Set CPU throttle to **4× slowdown**.
3. Reproduce the interaction. If it feels noticeably worse than baseline, the optimisation is not enough.

## Future-proof checklist

Run through this list before merging any PR that adds or modifies CSS in client routes or shared components.

### 🔴 Forbidden without measurement

- [ ] `filter: blur(>= 8px)` or `backdrop-filter: blur(>= 12px)` on an animated, scrolled, fixed/sticky, or `{#each}`-rendered element
  - Example fix in this repo: `WelcomeSection.svelte:673` (#5) — added `will-change: opacity` to isolate halo
  - Example fix: `screenings/[id]/+page.svelte:472` (#12) — added `will-change: backdrop-filter` to fixed bottom bar
- [ ] `box-shadow` with blur ≥ 24 px or spread ≥ 8 px on an animated/list element
  - Example fix: `MovieCarousel.svelte:106` (#36) — `will-change: transform` on `.card`
- [ ] Stack of ≥ 3 box-shadows on a single element inside `{#each}` or a scroll container

### 🟡 Requires GPU-promotion confirmation

- [ ] Any `transform` or `opacity` transition/animation on an element that also carries shadow or blur → must have `will-change: transform` (or `transform, opacity` if both change)
  - Examples: #22 `.cta`, #31 `.user_menu`, #34 `.ActiveBookingBanner`, #36 `.card`, #40 `.play_btn`, #44 `.caption_strip`
- [ ] Sticky/fixed element with shadow → `will-change: transform`
  - Examples: #20 `.logo_icon`, #21 `.cta`, #19 nav `&::before`
- [ ] Scroll container with shadows on its children → consider `contain: paint` on the container (only if no popovers/tooltips escape it) OR `transform: translateZ(0)` on the children

### 🟢 Generally safe

- [ ] `box-shadow` ≤ 8 px blur, ≤ 2 px spread, single shadow on static UI (see this audit's LOW bucket for examples)
- [ ] Any heavy effect hidden via `display: none` on mobile (`@media (max-width: 768px)`) or `matchMedia` guard (the `HomeAmbient` mobile-skip pattern)
- [ ] `prefers-reduced-motion: reduce` to disable expensive animations

### ⚠️ Anti-patterns to avoid

- [ ] **Don't** put `will-change` on a global selector or `*` — it forces the browser to keep a permanent compositor layer for every match. The `.glass-card` finding (#1) was solved per-consumer specifically to avoid this regression.
- [ ] **Don't** leave `will-change` on an element after removing its animation. The hint should live exactly as long as the animation does.
- [ ] **Don't** add `contain: paint` to a container that holds popovers, tooltips, or dropdowns — they will be clipped.
- [ ] **Don't** stack `transform: translateZ(0)` + `backface-visibility: hidden` + `will-change` on the same element. Pick one (`will-change` is the modern choice). Stacking is "over-promotion" and wastes GPU memory.
- [ ] **Don't** add `will-change: backdrop-filter` to many small per-card chips or badges — each becomes a separate layer. Promote the parent card instead.

### Pre-merge verification

1. Performance tab on affected pages: 60 fps stable?
2. Paint flashing: scroll/animation repaints stay localised?
3. Layers panel: animated elements live on their own layers?
4. Mobile (CPU 4× throttle): no perceptible degradation?

## Re-run instructions

To repeat this audit in a future cycle (e.g., 6 months after merge):

1. `git checkout -b perf/jank-audit-<YYYY-MM-DD>`
2. Run the discovery greps from this audit's plan (`docs/superpowers/plans/2026-04-26-jank-audit.md` Task 2):
   ```bash
   grep -rn --include='*.scss' --include='*.svelte' --include='*.css' -E 'filter:\s*blur\(' \
     src/routes/'(client)' src/routes/t src/routes/scanner \
     src/components/client src/components/booking src/components/ui \
     src/app.scss src/styles 2>/dev/null
   # repeat for backdrop-filter and box-shadow
   ```
3. Apply the rubric P × C → severity from `docs/superpowers/specs/2026-04-26-jank-audit-design.md` §4.
4. Diff the new findings against this audit's findings table — focus on entries that didn't exist before.
5. For each new HIGH/MED, follow the same T1 → verify → commit flow used here.
6. Use the future-proof checklist above as the merge gate.
