<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import Icon from '@iconify/svelte';
	import {
		computePosition,
		autoUpdate,
		offset,
		flip,
		shift
	} from '@floating-ui/dom';

	export interface SelectOption {
		label: string;
		value: string | number;
		icon?: string;
		disabled?: boolean;
	}

	interface Props {
		label?: string;
		mode?: 'multiple' | 'tags';
		options?: SelectOption[];
		value?: string | number | Array<string | number>;
		defaultValue?: Array<string | number>;
		placeholder?: string;
		allowClear?: boolean;
		disabled?: boolean;
		showSearch?: boolean;
		loading?: boolean;
		error?: string;
		required?: boolean;
		style?: string | Record<string, string>;
		onChange?: (values: Array<string | number>) => void;
		optionRender?: Snippet<[SelectOption]>;
		valueRender?: Snippet<[SelectOption]>;
		dropdownFooter?: Snippet;
		onSearch?: (query: string) => void;
		capitalizeSearch?: boolean;
	}

	const DROPDOWN_MAX_HEIGHT = 256;

	const toStyleString = (
		s: string | Record<string, string> | undefined
	): string => {
		if (!s) return '';
		if (typeof s === 'string') return s;
		return Object.entries(s)
			.map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
			.join(';');
	};

	let {
		label,
		mode,
		options = [],
		value = $bindable(undefined),
		defaultValue = [],
		placeholder = 'Выберите...',
		allowClear = false,
		disabled = false,
		showSearch = false,
		loading = false,
		error,
		required = false,
		style = '',
		onChange,
		optionRender,
		valueRender,
		dropdownFooter,
		onSearch,
		capitalizeSearch = false
	}: Props = $props();

	const labelId = $derived(
		label ? `select-label-${Math.random().toString(36).slice(2)}` : undefined
	);

	const isMultiple = $derived(mode === 'multiple' || mode === 'tags');

	const toArray = (
		v: string | number | Array<string | number> | undefined
	): Array<string | number> => {
		if (v === undefined || v === '') return [];
		if (Array.isArray(v)) return v;
		return [v];
	};

	let selected = $state<Array<string | number>>(
		untrack(() => toArray(value) ?? defaultValue)
	);
	let isOpen = $state(false);
	let searchQuery = $state('');
	let containerRef: HTMLDivElement | null = $state(null);
	let dropdownRef: HTMLDivElement | null = $state(null);
	let searchInputRef: HTMLInputElement | null = $state(null);
	let dropdownPlacement = $state<'bottom' | 'top'>('bottom');
	let cleanupAutoUpdate: (() => void) | null = null;

	const dropdownId = `select-dropdown-${Math.random().toString(36).slice(2)}`;

	const filteredOptions = $derived<SelectOption[]>(
		onSearch || !searchQuery.trim()
			? options
			: options.filter((opt) =>
					opt.label.toLowerCase().includes(searchQuery.toLowerCase())
				)
	);

	$effect(() => {
		if (value !== undefined) {
			selected = toArray(value);
		}
	});

	$effect(() => {
		if (isOpen && searchInputRef) {
			requestAnimationFrame(() => searchInputRef?.focus());
		}
	});

	const applyPosition = async () => {
		if (!containerRef || !dropdownRef) return;

		const { x, y, placement } = await computePosition(
			containerRef,
			dropdownRef,
			{
				strategy: 'absolute',
				placement: 'bottom-start',
				middleware: [offset(5), flip(), shift({ padding: 10 })]
			}
		);

		dropdownPlacement = placement.startsWith('top') ? 'top' : 'bottom';

		const zoom = parseFloat(document.documentElement.style.zoom || '1') || 1;
		const referenceWidth = containerRef.getBoundingClientRect().width / zoom;

		dropdownRef.style.position = 'absolute';
		dropdownRef.style.left = `${x}px`;
		dropdownRef.style.top = `${y}px`;
		dropdownRef.style.width = `${referenceWidth}px`;
		dropdownRef.style.maxHeight = `${DROPDOWN_MAX_HEIGHT}px`;
		dropdownRef.style.zIndex = '9999';
		dropdownRef.style.pointerEvents = 'auto';
	};

	$effect(() => {
		if (isOpen && containerRef && dropdownRef) {
			cleanupAutoUpdate = autoUpdate(containerRef, dropdownRef, applyPosition);
		} else {
			cleanupAutoUpdate?.();
			cleanupAutoUpdate = null;
		}

		return () => {
			cleanupAutoUpdate?.();
			cleanupAutoUpdate = null;
		};
	});

	const portal = (node: HTMLElement) => {
		const target = containerRef?.closest('.modal-positioner') || document.body;
		target.appendChild(node);
		return {
			destroy() {
				if (target.contains(node)) target.removeChild(node);
			}
		};
	};

	const capitalizeWords = (s: string) =>
		s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());

	const handleSearchInput = (e: Event) => {
		const raw = (e.target as HTMLInputElement).value;
		const next = capitalizeSearch ? capitalizeWords(raw) : raw;
		if (next !== raw) (e.target as HTMLInputElement).value = next;
		searchQuery = next;
		onSearch?.(next);
	};

	const close = () => {
		isOpen = false;
		searchQuery = '';
		onSearch?.('');
	};

	const handleSelectorMousedown = (e: MouseEvent) => {
		if (disabled) return;
		e.preventDefault();
		if (!isOpen) isOpen = true;
	};

	const handleArrowMousedown = (e: MouseEvent) => {
		if (disabled) return;
		e.preventDefault();
		e.stopPropagation();
		isOpen ? close() : (isOpen = true);
	};

	const handleClearMousedown = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (disabled) return;
		selected = [];
		value = isMultiple ? [] : '';
		onChange?.([]);
	};

	const handleTagRemoveMousedown = (val: string | number, e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (disabled) return;
		const next = selected.filter((v: string | number) => v !== val);
		selected = next;
		value = next;
		onChange?.(next);
	};

	const handleOptionMousedown = (e: MouseEvent) => {
		e.preventDefault();
	};

	const selectOption = (val: string | number) => {
		if (disabled) return;

		if (isMultiple) {
			const next = selected.includes(val)
				? selected.filter((v: string | number) => v !== val)
				: [...selected, val];
			selected = next;
			value = next;
			searchQuery = '';
			onChange?.(next);
			requestAnimationFrame(() => searchInputRef?.focus());
		} else {
			selected = [val];
			value = val;
			close();
			onChange?.([val]);
		}
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			close();
			return;
		}
		if ((e.key === 'Enter' || e.key === ' ') && !isOpen) {
			e.preventDefault();
			isOpen = true;
		}
	};

	const handleSearchKeydown = (e: KeyboardEvent) => {
		if (
			e.key === 'Backspace' &&
			searchQuery === '' &&
			selected.length > 0 &&
			isMultiple
		) {
			const next = selected.slice(0, -1);
			selected = next;
			value = next;
			onChange?.(next);
		}
		if (e.key === 'Escape') {
			close();
		}
	};

	const handleClickOutside = (e: MouseEvent) => {
		const path = e.composedPath();
		const inContainer = containerRef ? path.includes(containerRef) : false;
		const inDropdown = dropdownRef ? path.includes(dropdownRef) : false;
		if (!inContainer && !inDropdown) {
			close();
		}
	};

	const getOptionByValue = (val: string | number): SelectOption =>
		options.find((o: SelectOption) => o.value === val) ?? {
			label: String(val),
			value: val
		};

	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	});
</script>

<div
	class="select-container"
	class:is-disabled={disabled}
	class:is-open={isOpen}
	class:is-multiple={isMultiple}
	class:is-show-search={showSearch && !isMultiple}
	class:is-error={!!error}
	style={toStyleString(style)}
	bind:this={containerRef}
>
	{#if label}
		<span id={labelId} class="select-label">
			{label}
			{#if required}<span class="select-required">*</span>{/if}
		</span>
	{/if}

	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="select-selector"
		role="combobox"
		aria-controls={dropdownId}
		aria-expanded={isOpen}
		aria-haspopup="listbox"
		aria-disabled={disabled}
		aria-labelledby={labelId}
		tabindex={disabled ? -1 : 0}
		onmousedown={handleSelectorMousedown}
		onkeydown={handleKeydown}
	>
		<div class="select-selection">
			{#if isMultiple}
				{#each selected as val (val)}
					{@const opt = getOptionByValue(val)}
					<span class="select-tag">
						{#if opt.icon}
							<Icon icon={opt.icon} width={14} height={14} />
						{/if}
						<span class="select-tag-content">{opt.label}</span>
						{#if !disabled}
							<button
								class="select-tag-remove"
								onmousedown={(e) => handleTagRemoveMousedown(val, e)}
								tabindex="-1"
								aria-label="Remove"
							>
								<svg
									viewBox="0 0 10 10"
									fill="currentColor"
									width="10"
									height="10"
								>
									<path
										d="M5 4.293L8.146 1.146a.5.5 0 01.708.708L5.707 5l3.147 3.146a.5.5 0 01-.708.708L5 5.707 1.854 8.854a.5.5 0 01-.708-.708L4.293 5 1.146 1.854a.5.5 0 01.708-.708L5 4.293z"
									/>
								</svg>
							</button>
						{/if}
					</span>
				{/each}

				<span class="select-input-wrapper">
					<input
						bind:this={searchInputRef}
						class="select-search"
						type="text"
						value={searchQuery}
						oninput={handleSearchInput}
						placeholder={selected.length === 0 ? placeholder : ''}
						tabindex={disabled ? -1 : 0}
						aria-label="Search"
						aria-autocomplete="list"
						onkeydown={handleSearchKeydown}
					/>
				</span>
			{:else if showSearch && isOpen}
				<input
					bind:this={searchInputRef}
					class="select-search"
					type="text"
					value={searchQuery}
					oninput={handleSearchInput}
					placeholder={selected.length > 0
						? getOptionByValue(selected[0]).label
						: placeholder}
					tabindex={disabled ? -1 : 0}
					aria-label="Search"
					aria-autocomplete="list"
					onkeydown={handleSearchKeydown}
				/>
			{:else if selected.length > 0}
				{@const opt = getOptionByValue(selected[0])}
				<span class="select-value">
					{#if valueRender}
						{@render valueRender(opt)}
					{:else}
						{#if opt.icon}
							<Icon icon={opt.icon} width={16} height={16} />
						{/if}
						{opt.label}
					{/if}
				</span>
			{:else}
				<span class="select-placeholder">{placeholder}</span>
			{/if}
		</div>

		<span class="select-suffix">
			{#if allowClear && selected.length > 0 && !disabled}
				<button
					class="select-clear"
					onmousedown={handleClearMousedown}
					tabindex="-1"
					aria-label="Clear all"
				>
					<svg viewBox="0 0 12 12" fill="currentColor" width="12" height="12">
						<path
							d="M6 5.293L10.146 1.146a.5.5 0 01.708.708L6.707 6l4.147 4.146a.5.5 0 01-.708.708L6 6.707l-4.146 4.147a.5.5 0 01-.708-.708L5.293 6 1.146 1.854a.5.5 0 01.708-.708L6 5.293z"
						/>
					</svg>
				</button>
			{/if}
			<span
				class="select-arrow"
				class:is-rotated={isOpen}
				onmousedown={handleArrowMousedown}
				role="button"
				tabindex="-1"
				aria-label={isOpen ? 'Close' : 'Open'}
			>
				<svg viewBox="0 0 12 12" fill="currentColor" width="12" height="12">
					<path d="M6 8.5L1.5 4h9L6 8.5z" />
				</svg>
			</span>
		</span>
	</div>

	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		use:portal
		bind:this={dropdownRef}
		id={dropdownId}
		class="select-dropdown"
		class:is-open={isOpen}
		class:placement-top={dropdownPlacement === 'top'}
		role="listbox"
		aria-multiselectable={isMultiple}
	>
		{#if isOpen}
			{#if loading && filteredOptions.length === 0}
				<div class="select-loading">
					<Icon
						icon="svg-spinners:ring-resize"
						width={18}
						height={18}
						class="select-loading-icon"
					/>
				</div>
			{:else if loading}
				<div class="select-loading-bar">
					<Icon
						icon="svg-spinners:ring-resize"
						width={14}
						height={14}
						class="select-loading-icon"
					/>
				</div>
			{/if}
			{#each filteredOptions as option (option.value)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="select-option"
					class:is-selected={selected.includes(option.value)}
					class:is-option-disabled={option.disabled}
					role="option"
					aria-selected={selected.includes(option.value)}
					onmousedown={handleOptionMousedown}
					onclick={() => !option.disabled && selectOption(option.value)}
				>
					{#if isMultiple}
						<span
							class="select-option-checkbox"
							class:is-checked={selected.includes(option.value)}
						>
							{#if selected.includes(option.value)}
								<svg
									viewBox="0 0 12 12"
									fill="currentColor"
									width="10"
									height="10"
								>
									<path
										d="M10.28 2.28L4.5 8.06 1.72 5.28a.75.75 0 00-1.06 1.06l3.5 3.5a.75.75 0 001.06 0l6.5-6.5a.75.75 0 00-1.06-1.06z"
									/>
								</svg>
							{/if}
						</span>
					{/if}
					{#if optionRender}
						{@render optionRender(option)}
					{:else}
						{#if option.icon}
							<Icon
								icon={option.icon}
								width={16}
								height={16}
								class="select-option-icon"
							/>
						{/if}
						<span class="select-option-label">{option.label}</span>
					{/if}
				</div>
			{:else}
				{#if !loading}
					<div class="select-empty">Ничего не найдено</div>
				{/if}
			{/each}
			{#if dropdownFooter}
				<div class="select-dropdown-footer">
					{@render dropdownFooter()}
				</div>
			{/if}
		{/if}
	</div>

	{#if error}
		<span class="select-error">{error}</span>
	{/if}
</div>

<style lang="scss">
	$border-radius: 8px;
	$border-color: var(--border-color);
	$border-color-hover: var(--primary);
	$primary: var(--primary);
	$primary-bg: var(--primary-subtle);
	$text-color: var(--foreground);
	$placeholder-color: var(--muted-fg);
	$disabled-opacity: 0.5;
	$dropdown-shadow:
		0 6px 16px rgba(0, 0, 0, 0.3),
		0 2px 4px rgba(0, 0, 0, 0.15);
	$option-hover-bg: var(--surface-hover);
	$tag-bg: var(--primary-subtle);
	$transition: border-color 0.15s;

	.select-label {
		display: block;
		margin-bottom: 6px;
		font-size: 13px;
		color: var(--muted-fg);
	}

	.select-required {
		color: var(--danger);
	}

	.select-error {
		font-size: 12px;
		color: var(--danger);
		margin-top: 4px;
	}

	.select-container {
		position: relative;
		display: block;
		box-sizing: border-box;
		font-size: 14px;
		color: $text-color;

		&.is-open .select-selector {
			border-color: $primary;
			outline: none;
		}

		&.is-error .select-selector {
			border-color: var(--danger);
		}

		&.is-show-search .select-selector {
			cursor: text;
		}

		&.is-disabled .select-selector {
			opacity: $disabled-opacity;
			cursor: not-allowed;
			pointer-events: none;
		}
	}

	.select-selector {
		position: relative;
		display: flex;
		align-items: center;
		padding: 0 36px 0 12px;
		height: 38px;
		background: var(--surface);
		border: 1px solid $border-color;
		border-radius: $border-radius;
		cursor: pointer;
		transition: border-color 0.15s;
		box-sizing: border-box;
		user-select: none;

		&:hover {
			border-color: $border-color-hover;
		}

		&:focus-visible {
			border-color: $primary;
			outline: none;
		}

		.is-multiple & {
			padding: 4px 30px 4px 4px;
			height: auto;
			min-height: 38px;
			align-items: center;
			flex-wrap: wrap;
		}
	}

	.select-selection {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}

	.select-value {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.select-placeholder {
		flex: 1;
		color: $placeholder-color;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		pointer-events: none;
	}

	.select-tag {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 0 4px 0 8px;
		height: 22px;
		font-size: 12px;
		line-height: 20px;
		background: $tag-bg;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 4px;
		max-width: 100%;
		overflow: hidden;
	}

	.select-tag-content {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.select-tag-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--muted-fg);
		transition:
			color $transition,
			background $transition;
		border-radius: 50%;

		&:hover {
			color: var(--foreground);
			background: rgba(255, 255, 255, 0.1);
		}
	}

	.select-input-wrapper {
		flex: 1;
		min-width: 4px;
		display: flex;
		align-items: center;
		padding: 1px 0;
	}

	.select-search {
		width: 100%;
		min-width: 4px;
		border: none;
		outline: none;
		background: transparent;
		padding: 0 4px;
		font-size: 14px;
		font-family: inherit;
		color: $text-color;
		cursor: default;

		.is-show-search & {
			padding: 0;
			flex: 1;
			cursor: text;
		}

		&:focus {
			cursor: text;
		}

		&::placeholder {
			color: $placeholder-color;
		}
	}

	.select-suffix {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--muted-fg);
	}

	.select-clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--muted-fg);
		transition: color $transition;

		&:hover {
			color: var(--foreground);
		}
	}

	.select-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 12px;
		height: 12px;
		transition: transform $transition;
		cursor: pointer;
		pointer-events: auto;

		&.is-rotated {
			transform: rotate(180deg);
		}
	}

	:global(.select-dropdown) {
		display: none;
		box-sizing: border-box;
		background: var(--surface);
		border: 1px solid var(--border-color);
		border-radius: $border-radius;
		box-shadow: $dropdown-shadow;
		overflow-y: auto;
		padding: 4px 0;
		will-change: transform, opacity;

		&.is-open {
			display: block;
			animation: select-dropdown-appear 0.15s cubic-bezier(0.23, 1, 0.32, 1);

			&.placement-top {
				animation-name: select-dropdown-appear-top;
			}
		}

		&::-webkit-scrollbar {
			width: 6px;
		}

		&::-webkit-scrollbar-thumb {
			background: rgba(255, 255, 255, 0.15);
			border-radius: 3px;
		}
	}

	:global(.select-dropdown .select-option) {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px;
		cursor: pointer;
		transition: background 0.15s;
		line-height: 22px;
		font-weight: 400;
		color: var(--foreground);

		&:hover {
			background: var(--surface-hover);
		}

		&.is-selected {
			color: var(--primary-light);
			font-weight: 600;
			background: var(--primary-subtle);

			&:hover {
				background: var(--surface-hover);
			}
		}

		&.is-option-disabled {
			color: var(--muted-fg);
			cursor: not-allowed;
			opacity: 0.5;

			&:hover {
				background: none;
			}
		}
	}

	:global(.select-dropdown .select-option-checkbox) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		border: 1px solid var(--border-color);
		border-radius: 3px;
		background: var(--surface);
		transition: all 0.15s;

		&.is-checked {
			background: var(--primary);
			border-color: var(--primary);
			color: #fff;
		}
	}

	:global(.select-dropdown .select-option-label) {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.select-dropdown .select-empty) {
		padding: 10px 12px;
		color: var(--muted-fg);
		text-align: center;
		font-size: 14px;
	}

	:global(.select-dropdown .select-loading) {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px 12px;
		color: var(--muted-fg);
	}

	:global(.select-dropdown .select-loading-bar) {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px 12px;
		color: var(--muted-fg);
		border-bottom: 1px solid var(--border-color);
	}

	:global(.select-dropdown .select-dropdown-footer) {
		border-top: 1px solid var(--border-color);
		padding: 4px;
	}

	@keyframes select-dropdown-appear {
		from {
			opacity: 0;
			transform: scaleY(0.8);
			transform-origin: top center;
		}
		to {
			opacity: 1;
			transform: scaleY(1);
			transform-origin: top center;
		}
	}

	@keyframes select-dropdown-appear-top {
		from {
			opacity: 0;
			transform: scaleY(0.8);
			transform-origin: bottom center;
		}
		to {
			opacity: 1;
			transform: scaleY(1);
			transform-origin: bottom center;
		}
	}
</style>
