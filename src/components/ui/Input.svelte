<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Icon from '@iconify/svelte';
	import {
		computePosition,
		autoUpdate,
		offset,
		flip,
		shift
	} from '@floating-ui/dom';

	interface Country {
		code: string;
		flag: string;
		dialCode: string;
		name: string;
		mask: string;
	}

	interface Currency {
		code: string;
		flag: string;
		symbol: string;
		name: string;
	}

	interface Props {
		id?: string;
		name?: string;
		type?:
			| 'text'
			| 'tel'
			| 'email'
			| 'time'
			| 'date'
			| 'password'
			| 'number'
			| 'datetime-local'
			| 'search'
			| 'currency';
		value?: string | number;
		currency?: string;
		placeholder?: string;
		label?: string;
		error?: string;
		icon?: string;
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
		autocomplete?: AutoFill;
		oninput?: (e: Event) => void;
		onchange?: (e: Event) => void;
		onblur?: () => void;
	}

	let {
		id,
		name,
		type = 'text',
		value = $bindable(''),
		currency = $bindable('KGS'),
		placeholder,
		label,
		error,
		icon,
		disabled = false,
		readonly = false,
		required = false,
		autocomplete = 'off' as AutoFill,
		oninput,
		onchange,
		onblur
	}: Props = $props();

	const COUNTRIES: Country[] = [
		{
			code: 'KG',
			flag: 'circle-flags:kg',
			dialCode: '+996',
			name: 'Кыргызстан',
			mask: '### ### ###'
		},
		{
			code: 'KZ',
			flag: 'circle-flags:kz',
			dialCode: '+7',
			name: 'Казахстан',
			mask: '### ###-##-##'
		},
		{
			code: 'RU',
			flag: 'circle-flags:ru',
			dialCode: '+7',
			name: 'Россия',
			mask: '### ###-##-##'
		},
		{
			code: 'UZ',
			flag: 'circle-flags:uz',
			dialCode: '+998',
			name: 'Узбекистан',
			mask: '## ###-##-##'
		},
		{
			code: 'US',
			flag: 'circle-flags:us',
			dialCode: '+1',
			name: 'USA',
			mask: '### ###-####'
		}
	];

	const CURRENCIES: Currency[] = [
		{
			code: 'KGS',
			flag: 'circle-flags:kg',
			symbol: 'сом',
			name: 'Кыргызский сом'
		},
		{
			code: 'RUB',
			flag: 'circle-flags:ru',
			symbol: '₽',
			name: 'Российский рубль'
		},
		{ code: 'USD', flag: 'circle-flags:us', symbol: '$', name: 'US Dollar' },
		{
			code: 'KZT',
			flag: 'circle-flags:kz',
			symbol: '₸',
			name: 'Казахский тенге'
		},
		{
			code: 'UZS',
			flag: 'circle-flags:uz',
			symbol: 'сум',
			name: 'Узбекский сум'
		}
	];

	let passwordVisible = $state(false);
	let selectedCountry = $state<Country>(COUNTRIES[0]);
	let localPhone = $state('');
	let dropdownOpen = $state(false);
	let selectorRef = $state<HTMLDivElement | null>(null);
	let dropdownRef = $state<HTMLDivElement | null>(null);
	let cleanupAutoUpdate: (() => void) | null = null;

	const selectedCurrency = $derived(
		CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]
	);

	const formatCurrencyDigits = (digits: string): string => {
		if (!digits) return '';
		return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
	};

	let localCurrency = $state(
		untrack(() => formatCurrencyDigits(String(value ?? '').replace(/\D/g, '')))
	);

	$effect(() => {
		if (type !== 'currency') return;
		const digits = String(value ?? '').replace(/\D/g, '');
		const formatted = formatCurrencyDigits(digits);
		if (localCurrency !== formatted) {
			untrack(() => {
				localCurrency = formatted;
			});
		}
	});

	const onCurrencyInput = (e: Event) => {
		const input = e.target as HTMLInputElement;
		const digits = input.value.replace(/\D/g, '');
		const formatted = formatCurrencyDigits(digits);
		localCurrency = formatted;
		value = digits;
		input.value = formatted;
	};

	const fallbackId = `input-${Math.random().toString(36).slice(2, 8)}`;
	const inputId = $derived(id ?? name ?? fallbackId);

	const maskDigitCount = $derived(
		selectedCountry.mask.split('').filter((c) => c === '#').length
	);

	const applyMask = (digits: string, mask: string) => {
		let result = '';
		let dIdx = 0;
		for (const char of mask) {
			if (dIdx >= digits.length) break;
			if (char === '#') result += digits[dIdx++];
			else result += char;
		}
		return result;
	};

	$effect(() => {
		const externalValue = String(value || '');
		if (!externalValue) {
			localPhone = '';
			return;
		}

		const found = [...COUNTRIES]
			.sort((a, b) => b.dialCode.length - a.dialCode.length)
			.find((c) => externalValue.startsWith(c.dialCode));

		if (found) {
			const digits = externalValue
				.replace(found.dialCode, '')
				.replace(/\D/g, '');
			const masked = applyMask(digits.slice(0, maskDigitCount), found.mask);

			untrack(() => {
				selectedCountry = found;
				localPhone = masked;
			});
		}
	});

	const applyPosition = async () => {
		if (!selectorRef || !dropdownRef) return;

		const { x, y } = await computePosition(selectorRef, dropdownRef, {
			strategy: 'absolute',
			placement: 'bottom-start',
			middleware: [offset(5), flip(), shift({ padding: 10 })]
		});

		dropdownRef.style.position = 'absolute';
		dropdownRef.style.left = `${x}px`;
		dropdownRef.style.top = `${y}px`;
		dropdownRef.style.zIndex = '9999';
		dropdownRef.style.pointerEvents = 'auto';
	};

	$effect(() => {
		if (dropdownOpen && selectorRef && dropdownRef) {
			cleanupAutoUpdate = autoUpdate(selectorRef, dropdownRef, applyPosition);
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
		const target = selectorRef?.closest('.modal-positioner') || document.body;
		target.appendChild(node);
		return {
			destroy() {
				if (target.contains(node)) target.removeChild(node);
			}
		};
	};

	const onPhoneInput = (e: Event) => {
		const input = e.target as HTMLInputElement;
		const digits = input.value.replace(/\D/g, '').slice(0, maskDigitCount);

		localPhone = applyMask(digits, selectedCountry.mask);
		value = digits ? `${selectedCountry.dialCode}${digits}` : '';
		input.value = localPhone;
	};

	const handleClickOutside = (e: MouseEvent) => {
		const path = e.composedPath();
		const inSelector = selectorRef ? path.includes(selectorRef) : false;
		const inDropdown = dropdownRef ? path.includes(dropdownRef) : false;
		if (!inSelector && !inDropdown) {
			dropdownOpen = false;
		}
	};

	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	});
</script>

<div class="field">
	{#if label}
		<label class="label" for={inputId}>
			{label}
			{#if required}<span class="required">*</span>{/if}
		</label>
	{/if}

	{#if type === 'tel'}
		<div class="phone-wrapper" class:phone-wrapper--error={!!error}>
			<div class="country-selector" bind:this={selectorRef}>
				<button
					class="country-btn"
					type="button"
					{disabled}
					onclick={(e) => {
						e.stopPropagation();
						dropdownOpen = !dropdownOpen;
					}}
				>
					<span class="flag">
						<Icon icon={selectedCountry.flag} width={18} />
					</span>
					<span class="dial-code">{selectedCountry.dialCode}</span>
					<span class="chevron" class:chevron--open={dropdownOpen}>
						<Icon icon="lucide:chevron-down" width={12} />
					</span>
				</button>
			</div>

			<input
				id={inputId}
				type="tel"
				value={localPhone}
				placeholder={selectedCountry.mask.replace(/#/g, '0')}
				{disabled}
				{readonly}
				{autocomplete}
				class="input"
				oninput={onPhoneInput}
				{onblur}
			/>
		</div>

		{#if dropdownOpen}
			<div use:portal bind:this={dropdownRef} class="phone_dropdown">
				{#each COUNTRIES as country}
					<button
						class="dropdown-item"
						class:dropdown-item--active={selectedCountry.code === country.code}
						type="button"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => {
							selectedCountry = country;
							localPhone = '';
							value = '';
							dropdownOpen = false;
						}}
					>
						<Icon icon={country.flag} width={18} />
						<span class="country-name">{country.name}</span>
						<span class="dial-code">{country.dialCode}</span>
					</button>
				{/each}
			</div>
		{/if}
	{:else if type === 'currency'}
		<div class="currency-wrapper" class:currency-wrapper--error={!!error}>
			<div class="country-selector" bind:this={selectorRef}>
				<button
					class="country-btn"
					type="button"
					{disabled}
					onclick={(e) => {
						e.stopPropagation();
						dropdownOpen = !dropdownOpen;
					}}
				>
					<span class="flag">
						<Icon icon={selectedCurrency.flag} width={18} />
					</span>
					<span class="currency-code">{selectedCurrency.code}</span>
					<span class="chevron" class:chevron--open={dropdownOpen}>
						<Icon icon="lucide:chevron-down" width={12} />
					</span>
				</button>
			</div>

			<input
				id={inputId}
				type="text"
				inputmode="numeric"
				value={localCurrency}
				{placeholder}
				{disabled}
				{readonly}
				{autocomplete}
				class="input"
				oninput={onCurrencyInput}
				{onblur}
			/>

			<span class="currency-suffix">{selectedCurrency.symbol}</span>
		</div>

		{#if dropdownOpen}
			<div use:portal bind:this={dropdownRef} class="phone_dropdown">
				{#each CURRENCIES as c (c.code)}
					<button
						class="dropdown-item"
						class:dropdown-item--active={currency === c.code}
						type="button"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => {
							currency = c.code;
							dropdownOpen = false;
						}}
					>
						<Icon icon={c.flag} width={18} />
						<span class="country-name">{c.name}</span>
						<span class="dial-code">{c.symbol}</span>
					</button>
				{/each}
			</div>
		{/if}
	{:else if type === 'password'}
		<div class="password-wrapper" class:password-wrapper--error={!!error}>
			<input
				id={inputId}
				type={passwordVisible ? 'text' : 'password'}
				{placeholder}
				{disabled}
				{readonly}
				{autocomplete}
				class="input"
				bind:value
				{oninput}
				{onchange}
				{onblur}
			/>
			<button
				type="button"
				class="toggle"
				onclick={() => (passwordVisible = !passwordVisible)}
				tabindex="-1"
			>
				<Icon
					icon={passwordVisible ? 'lucide:eye-off' : 'lucide:eye'}
					width={18}
				/>
			</button>
		</div>
	{:else}
		<div class="input-wrapper">
			{#if icon}
				<span class="input-icon">
					<Icon {icon} width={18} />
				</span>
			{/if}
			<input
				id={inputId}
				{type}
				{placeholder}
				{disabled}
				{readonly}
				{required}
				{name}
				{autocomplete}
				class="input"
				class:input--error={!!error}
				class:input--with-icon={!!icon}
				bind:value
				{oninput}
				{onchange}
				{onblur}
			/>
		</div>
	{/if}

	{#if error}
		<span class="error-msg">{error}</span>
	{/if}
</div>

<style lang="scss">
	$border-radius: 8px;
	$border-color: var(--border-color);
	$border-color-focus: var(--primary);
	$border-color-error: var(--danger);
	$text-color: var(--foreground);
	$label-color: var(--muted-fg);
	$placeholder-color: var(--muted-fg);
	$bg: var(--surface);
	$disabled-opacity: 0.5;
	$transition: border-color 0.15s;

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		.label {
			font-size: 13px;
			color: $label-color;
		}

		.required {
			color: $border-color-error;
		}

		.input-wrapper {
			position: relative;
			display: flex;
			align-items: center;
		}

		.input-icon {
			position: absolute;
			left: 12px;
			color: $label-color;
			pointer-events: none;
			display: flex;
			align-items: center;
		}

		.input {
			width: 100%;
			height: 38px;
			padding: 0 12px;
			border: 1px solid $border-color;
			border-radius: $border-radius;
			font-size: 14px;
			color: $text-color;
			background: $bg;
			outline: none;
			box-sizing: border-box;
			transition: $transition;

			&::placeholder {
				color: $placeholder-color;
			}

			&:focus {
				border-color: $border-color-focus;
			}

			&--error {
				border-color: $border-color-error;
			}

			&--with-icon {
				padding-left: 38px;
			}

			&:disabled {
				opacity: $disabled-opacity;
				pointer-events: none;
			}
		}

		.phone-wrapper {
			display: flex;
			align-items: center;
			border: 1px solid $border-color;
			border-radius: $border-radius;
			background: $bg;
			transition: $transition;
			position: relative;

			&:focus-within {
				border-color: $border-color-focus;
			}

			&--error {
				border-color: $border-color-error;
			}

			.country-selector {
				flex-shrink: 0;

				.country-btn {
					display: flex;
					align-items: center;
					gap: 4px;
					height: 36px;
					padding: 0 8px 0 10px;
					background: none;
					border: none;
					border-right: 1px solid $border-color;
					cursor: pointer;
					border-radius: $border-radius 0 0 $border-radius;
					color: $text-color;

					.flag {
						display: flex;
						align-items: center;
					}

					.dial-code {
						font-size: 13px;
						font-weight: 500;
						color: $text-color;
					}

					.chevron {
						display: flex;
						color: $label-color;
						transition: transform 0.15s;

						&--open {
							transform: rotate(180deg);
						}
					}
				}
			}

			.input {
				border: none;
				height: 36px;
				flex: 1;

				&:focus {
					border-color: transparent;
				}
			}
		}

		.currency-wrapper {
			display: flex;
			align-items: center;
			border: 1px solid $border-color;
			border-radius: $border-radius;
			background: $bg;
			transition: $transition;
			position: relative;

			&:focus-within {
				border-color: $border-color-focus;
			}

			&--error {
				border-color: $border-color-error;
			}

			.country-selector {
				flex-shrink: 0;

				.country-btn {
					display: flex;
					align-items: center;
					gap: 8px;
					height: 36px;
					padding: 0 8px 0 10px;
					background: none;
					border: none;
					border-right: 1px solid $border-color;
					cursor: pointer;
					border-radius: $border-radius 0 0 $border-radius;
					color: $text-color;

					.flag {
						display: flex;
						align-items: center;
					}

					.currency-code {
						font-size: 13px;
						font-weight: 500;
						color: $text-color;
						font-variant-numeric: tabular-nums;
					}

					.chevron {
						display: flex;
						color: $label-color;
						transition: transform 0.15s;

						&--open {
							transform: rotate(180deg);
						}
					}
				}
			}

			.input {
				border: none;
				height: 36px;
				flex: 1;
				min-width: 0;
				font-variant-numeric: tabular-nums;
				text-align: right;

				&:focus {
					border-color: transparent;
				}
			}

			.currency-suffix {
				padding: 0 12px 0 6px;
				font-size: 13px;
				color: $label-color;
				flex-shrink: 0;
			}
		}

		.password-wrapper {
			display: flex;
			align-items: center;
			border: 1px solid $border-color;
			border-radius: $border-radius;
			background: $bg;
			padding-right: 10px;
			transition: $transition;

			&:focus-within {
				border-color: $border-color-focus;
			}

			&--error {
				border-color: $border-color-error;
			}

			.input {
				border: none;
				flex: 1;
			}

			.toggle {
				background: none;
				border: none;
				cursor: pointer;
				color: $label-color;
				display: flex;
				transition: color 0.15s;

				&:hover {
					color: $text-color;
				}
			}
		}

		.error-msg {
			font-size: 12px;
			color: $border-color-error;
		}
	}

	:global(.phone_dropdown) {
		background: var(--surface);
		border: 1px solid var(--border-color);
		border-radius: $border-radius;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		min-width: 200px;
		max-height: 200px;
		overflow-y: auto;
		box-sizing: border-box;
	}

	:global(.phone_dropdown .dropdown-item) {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		box-sizing: border-box;
		color: var(--foreground);

		&:hover {
			background: var(--surface-hover);
		}

		&.dropdown-item--active {
			background: var(--primary-subtle);

			.country-name {
				color: var(--primary-light);
			}
		}

		.country-name {
			flex: 1;
			font-size: 13px;
			color: var(--foreground);
		}

		.dial-code {
			font-size: 12px;
			color: var(--muted-fg);
		}
	}
</style>
