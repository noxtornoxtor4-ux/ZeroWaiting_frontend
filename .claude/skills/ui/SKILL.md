---
name: ui
description: 'Use when working with UI components, creating new components, or need to know available components. Triggers: Button, Input, Select, Textarea, Modal, DataTable, Popconfirm, PopoverMenu, Badge, Chip, Skeleton, RatingStars, Pagination, EmptyState, SearchInput, SectionHeader, Tooltip, Preloader, FavoriteButton, MovieCarousel, components/ui/.'
metadata:
  author: zerowaiting
  version: '1.1.0'
---

# UI Components (`src/components/ui/`)

**Always reuse existing UI components before creating new ones.**

## Available Components

- `Button` — variants: primary, ghost, outline, success, danger, icon. Intent: default, danger. Sizes: sm, md, lg. Icon buttons are 32x32 with rounded hover
- `Input` — types: text, email, password, tel, number, date, time, datetime-local, search. Phone input with country selector + mask. Password toggle. Label, error, icon, required support. **Не используй `type="date"` — см. `DatePicker` / `DateRangeFilter` ниже.**
- `DatePicker` — single-date с typeable masked input (`дд/мм/гггг`, auto `/`, cascading clamps: month ≤ 12, day ≤ 31). Calendar через Floating UI portal. API: `value` (ISO `YYYY-MM-DD`), `label`, `placeholder`, `required`, `disabled`, `widthFull` (default `true`), `error`, `onchange(value)`. Единственный правильный выбор для date-полей в формах. См. skill `dates` для UTC-контракта.
- `DateRangeFilter` — двухмесячный calendar popover для filter bars. API: `from`, `to` (ISO), `labelFrom`, `labelTo`, `placeholder`, `widthFull` (default `false` = `inline-flex`), `onchange(from, to)`. Использовать в admin table toolbars.
- `Select` — single + multiple/tags modes. Portal dropdown with floating-ui. Search, clear, custom option/value render snippets. `bind:value` works with string (single) or array (multi)
- `Textarea` — label, required, error, maxlength counter, preset text dropdown
- `Modal` — portal-based with CSS enter/exit animations (scale + translateY). Gradient header. `maxWidth` prop. Footer snippet receives `close` callback
- `DataTable` — generic `<T>` with typed `Column<T>`. Cell snippet pattern. Built-in pagination (range, page numbers, page size selector). Loading spinner, empty state. Sticky header, row hover
- `Popconfirm` — floating-ui confirmation popover with portal. Title + description + confirm/cancel buttons. Replaces `confirm()` for destructive actions
- `PopoverMenu` — generic floating-ui popover with portal. Trigger + content snippets. `$bindable` open state. Click outside closes
- `Badge` — variants: filled, outline, subtle. Custom color via CSS var
- `Chip` — clickable/static, active state, removable
- `Skeleton` — loading placeholder with shimmer animation
- `RatingStars` — display/interactive star rating
- `Pagination` — page navigation with ellipsis (used in client pages)
- `EmptyState` — icon, title, description, actions slot
- `SearchInput` — debounced search with clear button
- `SectionHeader` — gradient title (white->purple, 40px), subtitle, actions slot, purple bottom border
- `Tooltip` — floating-ui positioned tooltip with placement variants and stretch mode
- `Preloader` — full-screen with brand logo (icon box + gradient text) + progress bar + fadeout
- `FavoriteButton` — heart toggle with optimistic update + cache invalidation. Props: `movieId`, `isFavorite?`, `size?`. Uses `useQueryClient` to invalidate movies and favorites queries on toggle. Only renders for authenticated users
- `MovieCarousel` — grid of movie cards with poster, title, duration, genre, age rating, RatingStars, and FavoriteButton. Props: `movies: MovieWithFavoriteEntity[]`, `limit?`. The single source of truth for movie card rendering — used on homepage, `/movies`, `/profile/favorites`

## Icon Convention

- **Admin tables**: `lucide:pencil` (edit), `lucide:trash-2` (delete with `intent="danger"`)
- **Navigation**: `lucide:chevron-down`, `lucide:chevron-left`, `lucide:chevron-right`
- **User menu**: `lucide:user`, `lucide:ticket`, `lucide:heart`, `lucide:bell`, `lucide:shield`, `lucide:log-out`
- **Flags**: `circle-flags:ru`, `circle-flags:gb`, `circle-flags:kg`, `circle-flags:kz`, `circle-flags:uz`
- **Brand logo**: `lucide:film` (inside gradient box)
- **Admin sidebar**: `lucide:*` icons
