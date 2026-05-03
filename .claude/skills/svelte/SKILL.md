---
name: svelte
description: 'Use when working with Svelte 5 runes, component patterns, or SvelteKit page state. Triggers: $app/state, $app/stores, $state, $derived, $derived.by, $effect, $props, $bindable, Snippet, runes, {@const}, .svelte.ts.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Svelte 5 Patterns

Проект использует **Svelte 5 runes** эксклюзивно.

## Page state from `$app/state`

```ts
import { page } from '$app/state';

const movieId = $derived(page.params.id);
const path = page.url.pathname;
```

**Never use `$app/stores`** — всегда `$app/state`.

## Props + Snippet

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'ghost' | 'outline';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		children?: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		children
	}: Props = $props();
</script>

{@render children?.()}
```

## State & Derived

```ts
let count = $state(0);
let selectedItems = $state<string[]>([]);

const isActive = $derived(count > 0);
```

Для многострочных выражений — `$derived.by(() => { ... })`. Обычный `$derived(() => ...)` вернёт функцию, а не значение.

## Bindable props

```ts
let { value = $bindable('') }: Props = $props();
```

## Effects

```ts
$effect(() => {
	if (browser) {
		document.documentElement.lang = $locale;
	}
});
```

## `{@const}` placement

`{@const}` должен быть **прямым потомком** `{#if}`, `{#each}`, `{:else}`, `{#snippet}` — **не** внутри `<div>` или других элементов. Инлайнь выражение вместо этого:

```svelte
<!-- Bad -->
<div>
	{@const cfg = CONFIG[status]}
	<Badge text={cfg?.label} />
</div>

<!-- Good -->
<div>
	<Badge text={CONFIG[status]?.label} />
</div>
```

## Reserved names

Не называй `$state`/`$derived` переменную `state` — конфликт с runes-scope в `svelte-check`. Используй `urgency`, `status`, и т.д.
