---
name: styling
description: 'Use when working with SCSS, design tokens, colors, layout styling, brand logo, or scoped component styles. Triggers: .scss, SCSS, BEM, --primary, --background, --surface, --foreground, --muted-fg, --border-color, linear-gradient, #8b5cf6, #a855f7, #c084fc, :global, backdrop-filter, logo_icon, logo_text, postcss-pxtorem, glassmorphism, autoprefixer.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Styling Conventions

SCSS scoped per component + CSS custom properties (дизайн-токены в `src/app.scss`).

## SCSS Rules

- **No BEM** — никогда `Component__element` / `Component--modifier`.
- **Always nest selectors** mirroring the HTML DOM: `.ComponentName { .content { .title {} } }` = зеркало DOM.
- **Underscores** для многословных классов: `admin_link`, `cell_actions`, `logo_text` (не дефисы).
- `.container` — глобальный класс из `app.scss`, переиспользуется.
- Кастомизация: `.ComponentName { .container { .content {} } }`.
- `&` для модификаторов/псевдо: `&.active`, `&:hover`, `&::after`.
- State-модификаторы через Svelte `class:active={condition}`.
- **Никогда не хардкодить цвета** — только CSS custom properties.

```scss
// Good
.Header {
	.container {
		.content {
			.logo {
				.logo_icon {}
				.text {}
			}
			.nav {
				.link {
					&.active {}
				}
			}
		}
	}
}

// Bad — BEM
.Header {
	.Header__content {}
	.Header__nav {}
}
```

## Design Tokens (Dark Theme)

```css
--primary: var(--primary-500);       /* #a855f7 */
--background: var(--neutral-950);    /* #121216 */
--surface: var(--neutral-900);       /* #1a1a26 */
--foreground: var(--neutral-50);     /* #f8f8fb */
--muted-fg: var(--neutral-400);      /* #9494a5 */
--border-color: var(--neutral-700);  /* #2d2d3d */
```

## Brand Logo Pattern

Все инстансы логотипа (Header, Footer, AdminSidebar, Preloader) используют один паттерн:

```svelte
<a href="/" class="logo">
	<div class="logo_icon">
		<Icon icon="lucide:film" width={20} />
	</div>
	<span class="logo_text">ZeroWaiting</span>
</a>
```

```scss
.logo_icon {
	background: linear-gradient(45deg, #8b5cf6, #a855f7);
	border-radius: 8px;
}
.logo_text {
	background: linear-gradient(45deg, #ffffff, #c084fc);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
}
```

## Color Conventions

- **Primary purple gradient**: `linear-gradient(45deg, #8b5cf6, #a855f7)` — кнопки, active states, акценты.
- **Text gradient**: `linear-gradient(45deg, #ffffff, #c084fc)` — logo, section titles.
- **Purple borders**: `rgba(139, 92, 246, 0.1–0.2)` — subtle purple (не нейтральный серый).
- **Text colors**: `white`, `rgba(255, 255, 255, 0.8)` (secondary), `rgba(255, 255, 255, 0.7)` (muted), `rgba(255, 255, 255, 0.6)` (tertiary).
- **Glow shadows**: `rgba(139, 92, 246, 0.3)` / `rgba(168, 85, 247, 0.3)` — purple glow на hover.
- **Glass backgrounds**: `rgba(255, 255, 255, 0.08)` + `backdrop-filter: blur(10px)` — cards, inputs.

## Client Header (glassmorphism)

Контейнер: `backdrop-filter: blur(7px)`, `border-radius: 12px`, purple border `rgba(139, 92, 246, 0.15)`. Brand logo с gradient icon box + gradient text. На скролле `max-width` сужается, opacity фона растёт. Desktop: nav + actions; mobile: `BurgerToggle` + `BurgerMenu`. `LanguageSwitcher` использует `PopoverMenu` (floating-ui portal).

## PostCSS

Все `px` авто-конвертируются в `rem` (base 16px) через `postcss-pxtorem`. Vendor-префиксы — `autoprefixer`.

## `:global()` pitfalls

**Never** `:global(.dropdown)`, `:global(.item)`, `:global(.header)` — глобальный leak, конфликты стилей между компонентами. Всегда уникальные префиксы: `.user_menu`, `.phone_dropdown`, `.select-dropdown`.

## Portal + `:global()` styling

Компоненты через portal (`document.body.appendChild`) — вне Svelte-scoped CSS. Используй `:global(.unique_class)` с уникальными именами — `:global()` снимает scope-хэш, стили работают независимо от DOM-позиции.
