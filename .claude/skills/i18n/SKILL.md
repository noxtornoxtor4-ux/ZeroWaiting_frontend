---
name: i18n
description: 'Use when working with internationalization, translations, locales, or localized API fields. Triggers: svelte-i18n, $_(), $locale, getLocalizedValue, I18nField, locale files, i18n-field.ts, locales/, LanguageSwitcher, translations.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# i18n Rules (STRICT)

## Setup

- Library: `svelte-i18n` v4
- 5 locale files: `src/lib/i18n/locales/{ru,en,ky,kz,uz}.json`
- Russian is the primary/fallback language
- Locale saved to `localStorage`

## Client Pages (public + profile)

- All text through `$_('namespace.key')`
- 5 locales supported

## Admin Panel

- **Russian only, hardcoded** — no `$_()` calls
- No locale files for admin

## i18n JSON Fields from API

Backend returns i18n fields as `{ ru?: string, en?: string, kg?: string, kz?: string, uz?: string }`.

```ts
import { getLocalizedValue } from '@/lib/utils/i18n-field';
import { locale } from 'svelte-i18n';

const title = getLocalizedValue(movie.title, $locale);
```


## Never mix admin and client i18n

- **Client-страницы** (`/movies`, `/booking`, `/profile`) — всегда `svelte-i18n` (`$_()`) для user-facing текста.
- **Admin-страницы** (`/admin/`) — русский только, hardcoded, без `$_()`.
- Никаких миксов: не импортируй `$_` в admin, не хардкоды русский в client.

## Status & Enum Display

**Client-страницы** (мульти-язычные) используют i18n-конфиг-объекты, маппящие enum-значения → translation-keys и цвета:

- `BOOKING_STATUS_CONFIG` — `@/lib/constants/booking-status`
- `TICKET_STATUS_CONFIG` — `@/lib/constants/ticket-status`
- `MOVIE_STATUS_CONFIG` — `@/lib/constants/movie-status`
- Прочие enums через `$_('common.bookingType.ONLINE')`, `$_('common.giftCardStatus.ACTIVE')` и т.д.

**Admin-страницы** — inline label-maps (см. skill `admin`).

**Никогда не показывай raw enum-значения** (NOW_SHOWING, PENDING, PERCENTAGE) пользователю — ни в client, ни в admin.
