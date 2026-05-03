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

	interface Props {
		value?: string;
		label?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		widthFull?: boolean;
		withTime?: boolean;
		error?: string;
		onchange?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		label,
		placeholder,
		required = false,
		disabled = false,
		widthFull = true,
		withTime = false,
		error,
		onchange
	}: Props = $props();

	const resolvedPlaceholder = $derived(
		placeholder ?? (withTime ? 'дд/мм/гггг чч:мм' : 'дд/мм/гггг')
	);

	const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
	const MONTH_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
		month: 'long',
		year: 'numeric'
	});

	const pad = (n: number) => String(n).padStart(2, '0');

	const parseValue = (
		v: string
	): { date: Date; hour: number; minute: number } | null => {
		if (!v) return null;
		const match = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
		if (match) {
			const [, y, m, d, hh, mm] = match;
			const date = new Date(Number(y), Number(m) - 1, Number(d));
			if (Number.isNaN(date.getTime())) return null;
			return {
				date,
				hour: hh ? Number(hh) : 0,
				minute: mm ? Number(mm) : 0
			};
		}
		const date = new Date(v);
		if (Number.isNaN(date.getTime())) return null;
		return { date, hour: date.getHours(), minute: date.getMinutes() };
	};

	const toDateKey = (d: Date) =>
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

	const toDateTimeKey = (d: Date, hour: number, minute: number) =>
		`${toDateKey(d)}T${pad(hour)}:${pad(minute)}`;

	const formatDisplay = (d: Date, hour: number, minute: number): string => {
		const base = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
		return withTime ? `${base} ${pad(hour)}:${pad(minute)}` : base;
	};

	const maskDateString = (raw: string): string => {
		const input = raw.replace(/\D/g, '');
		const digits: string[] = [];
		const maxDigits = withTime ? 12 : 8;
		for (let i = 0; i < input.length && digits.length < maxDigits; i++) {
			const d = input[i];
			const pos = digits.length;
			let accept = true;
			if (pos === 0 && d > '3') accept = false;
			if (pos === 1 && digits[0] === '3' && d > '1') accept = false;
			if (pos === 2 && d > '1') accept = false;
			if (pos === 3 && digits[2] === '1' && d > '2') accept = false;
			if (pos === 8 && d > '2') accept = false;
			if (pos === 9 && digits[8] === '2' && d > '3') accept = false;
			if (pos === 10 && d > '5') accept = false;
			if (accept) digits.push(d);
		}
		let result = '';
		for (let i = 0; i < digits.length; i++) {
			if (i === 2 || i === 4) result += '/';
			else if (i === 8) result += ' ';
			else if (i === 10) result += ':';
			result += digits[i];
		}
		return result;
	};

	const tryParseTyped = (text: string): string | null => {
		const pattern = withTime
			? /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/
			: /^(\d{2})\/(\d{2})\/(\d{4})$/;
		const m = text.match(pattern);
		if (!m) return null;
		const [, dd, mm, yyyy, hh, mi] = m;
		const day = Number(dd);
		const month = Number(mm);
		const year = Number(yyyy);
		if (year < 1900 || year > 2100) return null;
		if (month < 1 || month > 12) return null;
		const d = new Date(year, month - 1, day);
		if (
			d.getDate() !== day ||
			d.getMonth() !== month - 1 ||
			d.getFullYear() !== year
		)
			return null;
		if (withTime) {
			const hour = Number(hh);
			const minute = Number(mi);
			if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
			return toDateTimeKey(d, hour, minute);
		}
		return toDateKey(d);
	};

	const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

	const addMonths = (d: Date, delta: number) =>
		new Date(d.getFullYear(), d.getMonth() + delta, 1);

	const addYears = (d: Date, delta: number) =>
		new Date(d.getFullYear() + delta, d.getMonth(), 1);

	const compareDays = (a: Date, b: Date): number => {
		const av = a.getFullYear() * 10000 + (a.getMonth() + 1) * 100 + a.getDate();
		const bv = b.getFullYear() * 10000 + (b.getMonth() + 1) * 100 + b.getDate();
		return av - bv;
	};

	const isSameDay = (a: Date, b: Date) => compareDays(a, b) === 0;

	const buildMonthGrid = (anchor: Date): Date[] => {
		const first = startOfMonth(anchor);
		const weekday = (first.getDay() + 6) % 7;
		const gridStart = new Date(first);
		gridStart.setDate(first.getDate() - weekday);
		return Array.from({ length: 42 }, (_, i) => {
			const d = new Date(gridStart);
			d.setDate(gridStart.getDate() + i);
			return d;
		});
	};

	const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

	let isOpen = $state(false);
	let containerRef: HTMLDivElement | null = $state(null);
	let dropdownRef: HTMLDivElement | null = $state(null);
	let inputEl: HTMLInputElement | null = $state(null);
	let cleanupAutoUpdate: (() => void) | null = null;

	const today = new Date();
	const parsed = $derived(parseValue(value));
	const selectedDate = $derived(parsed?.date ?? null);
	const selectedHour = $derived(parsed?.hour ?? 0);
	const selectedMinute = $derived(parsed?.minute ?? 0);

	let inputText = $state(
		untrack(() => {
			const p = parseValue(value);
			return p ? formatDisplay(p.date, p.hour, p.minute) : '';
		})
	);

	$effect(() => {
		const p = parsed;
		const expected = p ? formatDisplay(p.date, p.hour, p.minute) : '';
		if (document.activeElement === inputEl) return;
		if (inputText !== expected) {
			untrack(() => {
				inputText = expected;
			});
		}
	});

	let viewMonth = $state(untrack(() => startOfMonth(selectedDate ?? today)));

	const HOURS = Array.from({ length: 24 }, (_, i) => i);
	const MINUTES = Array.from({ length: 60 }, (_, i) => i);
	const TIME_ITEM_HEIGHT = 30;

	let hoursColRef: HTMLDivElement | null = $state(null);
	let minutesColRef: HTMLDivElement | null = $state(null);

	const scrollTimeToSelected = (smooth: boolean) => {
		const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
		hoursColRef?.scrollTo({
			top: selectedHour * TIME_ITEM_HEIGHT,
			behavior
		});
		minutesColRef?.scrollTo({
			top: selectedMinute * TIME_ITEM_HEIGHT,
			behavior
		});
	};

	$effect(() => {
		if (isOpen && withTime) {
			requestAnimationFrame(() => scrollTimeToSelected(false));
		}
	});

	const monthLabel = $derived(capitalize(MONTH_FORMATTER.format(viewMonth)));
	const grid = $derived(buildMonthGrid(viewMonth));

	const applyPosition = async () => {
		if (!containerRef || !dropdownRef) return;
		const { x, y } = await computePosition(containerRef, dropdownRef, {
			strategy: 'absolute',
			placement: 'bottom-start',
			middleware: [offset(6), flip(), shift({ padding: 10 })]
		});
		dropdownRef.style.position = 'absolute';
		dropdownRef.style.left = `${x}px`;
		dropdownRef.style.top = `${y}px`;
		dropdownRef.style.zIndex = '9999';
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

	const openPopover = () => {
		if (disabled) return;
		viewMonth = startOfMonth(selectedDate ?? today);
		isOpen = true;
	};

	const closePopover = () => {
		isOpen = false;
	};

	const toggle = () => {
		if (isOpen) closePopover();
		else openPopover();
	};

	const commit = (day: Date, hour: number, minute: number) => {
		const next = withTime ? toDateTimeKey(day, hour, minute) : toDateKey(day);
		value = next;
		onchange?.(next);
	};

	const handleDayClick = (day: Date) => {
		commit(day, selectedHour, selectedMinute);
		if (!withTime) closePopover();
	};

	const handleHourPick = (h: number) => {
		commit(selectedDate ?? today, h, selectedMinute);
		hoursColRef?.scrollTo({
			top: h * TIME_ITEM_HEIGHT,
			behavior: 'smooth'
		});
	};

	const handleMinutePick = (m: number) => {
		commit(selectedDate ?? today, selectedHour, m);
		minutesColRef?.scrollTo({
			top: m * TIME_ITEM_HEIGHT,
			behavior: 'smooth'
		});
	};

	const handleNow = () => {
		const now = new Date();
		viewMonth = startOfMonth(now);
		commit(now, now.getHours(), now.getMinutes());
		if (withTime) {
			requestAnimationFrame(() => scrollTimeToSelected(true));
		}
	};

	const clear = (e: MouseEvent) => {
		e.stopPropagation();
		if (disabled) return;
		value = '';
		inputText = '';
		onchange?.('');
	};

	const handleInputChange = (e: Event) => {
		const el = e.target as HTMLInputElement;
		const raw = el.value;
		const masked = maskDateString(raw);
		if (el.value !== masked) el.value = masked;
		inputText = masked;
		if (masked === '') {
			value = '';
			onchange?.('');
			return;
		}
		const nextValue = tryParseTyped(masked);
		if (nextValue !== null && nextValue !== value) {
			value = nextValue;
			const p = parseValue(nextValue);
			if (p) viewMonth = startOfMonth(p.date);
			onchange?.(nextValue);
		}
	};

	const handleInputFocus = () => {
		if (disabled) return;
		if (!isOpen) openPopover();
	};

	const handleInputBlur = () => {
		const p = parsed;
		const expected = p ? formatDisplay(p.date, p.hour, p.minute) : '';
		if (inputText !== expected) inputText = expected;
	};

	const handleInputKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			const nextValue = tryParseTyped(inputText);
			if (nextValue !== null) {
				value = nextValue;
				const p = parseValue(nextValue);
				if (p) viewMonth = startOfMonth(p.date);
				onchange?.(nextValue);
				closePopover();
				inputEl?.blur();
			}
		}
	};

	const stepMonth = (delta: number) => {
		viewMonth = addMonths(viewMonth, delta);
	};

	const stepYear = (delta: number) => {
		viewMonth = addYears(viewMonth, delta);
	};

	const portal = (node: HTMLElement) => {
		const target = containerRef?.closest('.modal-positioner') || document.body;
		target.appendChild(node);
		return {
			destroy() {
				if (target.contains(node)) target.removeChild(node);
			}
		};
	};

	const handleClickOutside = (e: MouseEvent) => {
		if (!isOpen) return;
		const path = e.composedPath();
		const inContainer = containerRef ? path.includes(containerRef) : false;
		const inDropdown = dropdownRef ? path.includes(dropdownRef) : false;
		if (!inContainer && !inDropdown) closePopover();
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && isOpen) closePopover();
	};

	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div
	class="DatePicker"
	class:width_full={widthFull}
	class:is_disabled={disabled}
	bind:this={containerRef}
>
	{#if label}
		<span class="label">
			{label}
			{#if required}<span class="required">*</span>{/if}
		</span>
	{/if}

	<div
		class="trigger"
		class:is_open={isOpen}
		class:has_value={!!inputText}
		class:is_error={!!error}
	>
		<input
			bind:this={inputEl}
			type="text"
			class="input"
			placeholder={resolvedPlaceholder}
			{disabled}
			inputmode="numeric"
			autocomplete="off"
			value={inputText}
			oninput={handleInputChange}
			onfocus={handleInputFocus}
			onblur={handleInputBlur}
			onkeydown={handleInputKeydown}
		/>
		<div class="suffix">
			{#if inputText && !disabled}
				<button
					type="button"
					class="clear"
					onmousedown={(e) => e.preventDefault()}
					onclick={clear}
					aria-label="Очистить"
				>
					<Icon icon="lucide:x" width={14} />
				</button>
			{/if}
			<button
				type="button"
				class="calendar_btn"
				onmousedown={(e) => e.preventDefault()}
				onclick={toggle}
				aria-label="Открыть календарь"
				{disabled}
			>
				<Icon icon="lucide:calendar" width={16} />
			</button>
		</div>
	</div>

	{#if error}
		<span class="error_msg">{error}</span>
	{/if}

	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		use:portal
		bind:this={dropdownRef}
		class="DatePickerPopover"
		class:is_open={isOpen}
		role="dialog"
		aria-modal="false"
	>
		{#if isOpen}
			<div class="body" class:has_time={withTime}>
				<div class="calendar_side">
					<div class="header">
						<div class="nav_group">
							<button
								type="button"
								class="nav_btn"
								onclick={() => stepYear(-1)}
								aria-label="Предыдущий год"
							>
								<Icon icon="lucide:chevrons-left" width={16} />
							</button>
							<button
								type="button"
								class="nav_btn"
								onclick={() => stepMonth(-1)}
								aria-label="Предыдущий месяц"
							>
								<Icon icon="lucide:chevron-left" width={16} />
							</button>
						</div>
						<span class="month_title">{monthLabel}</span>
						<div class="nav_group">
							<button
								type="button"
								class="nav_btn"
								onclick={() => stepMonth(1)}
								aria-label="Следующий месяц"
							>
								<Icon icon="lucide:chevron-right" width={16} />
							</button>
							<button
								type="button"
								class="nav_btn"
								onclick={() => stepYear(1)}
								aria-label="Следующий год"
							>
								<Icon icon="lucide:chevrons-right" width={16} />
							</button>
						</div>
					</div>

					<div class="panel">
						<div class="weekdays">
							{#each WEEKDAYS as wd (wd)}
								<span class="weekday">{wd}</span>
							{/each}
						</div>
						<div class="days">
							{#each grid as day (toDateKey(day))}
								{@const inCurrent = day.getMonth() === viewMonth.getMonth()}
								{@const isSelected = selectedDate
									? isSameDay(day, selectedDate)
									: false}
								<button
									type="button"
									class="day"
									class:out_of_month={!inCurrent}
									class:is_selected={isSelected}
									class:is_today={isSameDay(day, today)}
									onclick={() => handleDayClick(day)}
								>
									<span class="day_label">{day.getDate()}</span>
								</button>
							{/each}
						</div>
					</div>
				</div>

				{#if withTime}
					<div class="time_side">
						<div class="time_header">
							{pad(selectedHour)}:{pad(selectedMinute)}
						</div>
						<div class="time_columns">
							<div class="time_column" bind:this={hoursColRef}>
								{#each HOURS as h (h)}
									<button
										type="button"
										class="time_cell"
										class:is_selected={h === selectedHour}
										onclick={() => handleHourPick(h)}
									>
										{pad(h)}
									</button>
								{/each}
							</div>
							<div class="time_column" bind:this={minutesColRef}>
								{#each MINUTES as m (m)}
									<button
										type="button"
										class="time_cell"
										class:is_selected={m === selectedMinute}
										onclick={() => handleMinutePick(m)}
									>
										{pad(m)}
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div class="footer">
				<button
					type="button"
					class="now_btn"
					onclick={handleNow}
					aria-label={withTime
						? 'Установить текущие дату и время'
						: 'Установить сегодняшнюю дату'}
				>
					Сейчас
				</button>
			</div>
		{/if}
	</div>
</div>

<style lang="scss">
	.DatePicker {
		display: inline-flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		width: fit-content;

		&.width_full {
			display: flex;
			width: 100%;
		}

		&.is_disabled {
			opacity: 0.5;
			pointer-events: none;
		}

		.label {
			font-size: 13px;
			color: var(--muted-fg);

			.required {
				color: var(--danger);
				margin-left: 2px;
			}
		}

		.trigger {
			display: flex;
			align-items: center;
			gap: 4px;
			height: 38px;
			min-width: 200px;
			padding: 0 8px 0 12px;
			background: var(--surface);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			color: var(--foreground);
			font-size: 14px;
			transition: border-color 0.15s;

			&:hover {
				border-color: var(--primary);
			}

			&:focus-within,
			&.is_open {
				border-color: var(--primary);
			}

			&.is_error {
				border-color: var(--danger);
			}

			.input {
				flex: 1;
				min-width: 0;
				height: 100%;
				padding: 0;
				background: none;
				border: none;
				outline: none;
				color: var(--foreground);
				font-family: inherit;
				font-size: 14px;

				&::placeholder {
					color: var(--muted-fg);
				}

				&:disabled {
					cursor: not-allowed;
				}
			}

			.suffix {
				display: flex;
				align-items: center;
				gap: 2px;
				flex-shrink: 0;
				color: var(--muted-fg);

				.clear,
				.calendar_btn {
					display: flex;
					align-items: center;
					justify-content: center;
					width: 22px;
					height: 22px;
					padding: 0;
					background: none;
					border: none;
					border-radius: 6px;
					color: var(--muted-fg);
					cursor: pointer;
					transition:
						color 0.15s,
						background 0.15s;

					&:hover {
						color: var(--foreground);
						background: rgba(255, 255, 255, 0.08);
					}

					&:disabled {
						cursor: not-allowed;
						opacity: 0.5;
					}
				}
			}
		}

		.error_msg {
			font-size: 12px;
			color: var(--danger);
		}
	}

	:global(.DatePickerPopover) {
		display: none;
		box-sizing: border-box;
		background: var(--surface);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		box-shadow:
			0 10px 28px rgba(0, 0, 0, 0.35),
			0 3px 8px rgba(0, 0, 0, 0.18);
		padding: 12px;
		color: var(--foreground);
		user-select: none;
		will-change: transform, opacity;

		&.is_open {
			display: block;
			animation: date-picker-pop-appear 0.15s cubic-bezier(0.23, 1, 0.32, 1);
		}
	}

	:global(.DatePickerPopover .header) {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 8px;
		padding: 2px 4px 10px;
	}

	:global(.DatePickerPopover .nav_group) {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	:global(.DatePickerPopover .nav_btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		background: none;
		border: none;
		border-radius: 6px;
		color: var(--muted-fg);
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s;

		&:hover {
			color: var(--foreground);
			background: rgba(255, 255, 255, 0.08);
		}
	}

	:global(.DatePickerPopover .month_title) {
		justify-self: center;
		font-size: 13px;
		font-weight: 600;
		color: var(--foreground);
	}

	:global(.DatePickerPopover .panel) {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	:global(.DatePickerPopover .weekdays) {
		display: grid;
		grid-template-columns: repeat(7, 32px);
		padding: 4px 0;
	}

	:global(.DatePickerPopover .weekday) {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 22px;
		font-size: 11px;
		font-weight: 500;
		color: var(--muted-fg);
	}

	:global(.DatePickerPopover .days) {
		display: grid;
		grid-template-columns: repeat(7, 32px);
		grid-auto-rows: 32px;
	}

	:global(.DatePickerPopover .day) {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: none;
		border: none;
		color: var(--foreground);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;

		.day_label {
			position: relative;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 26px;
			height: 26px;
			border-radius: 6px;
			transition:
				background 0.12s,
				color 0.12s;
		}

		&:hover .day_label {
			background: var(--surface-hover);
		}

		&.out_of_month {
			color: var(--muted-fg);
			opacity: 0.5;
		}

		&.is_today:not(.is_selected) .day_label {
			box-shadow: inset 0 0 0 1px var(--primary);
		}

		&.is_selected .day_label {
			background: var(--primary);
			color: #ffffff;
		}
	}

	:global(.DatePickerPopover .body) {
		display: flex;
		align-items: stretch;
		gap: 0;
	}

	:global(.DatePickerPopover .body.has_time .calendar_side) {
		padding-right: 10px;
		border-right: 1px solid var(--border-color);
	}

	:global(.DatePickerPopover .time_side) {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding-left: 10px;
	}

	:global(.DatePickerPopover .time_header) {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 30px;
		padding: 2px 4px 10px;
		font-size: 13px;
		font-weight: 600;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}

	:global(.DatePickerPopover .time_columns) {
		display: flex;
		gap: 4px;
		height: 230px;
	}

	:global(.DatePickerPopover .time_column) {
		display: flex;
		flex-direction: column;
		width: 48px;
		overflow-y: auto;
		padding-bottom: 200px;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.15) transparent;

		&::-webkit-scrollbar {
			width: 4px;
		}

		&::-webkit-scrollbar-thumb {
			background: rgba(255, 255, 255, 0.15);
			border-radius: 2px;
		}
	}

	:global(.DatePickerPopover .footer) {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		margin-top: 8px;
		padding: 8px 4px 0;
		border-top: 1px solid var(--border-color);
	}

	:global(.DatePickerPopover .now_btn) {
		padding: 4px 8px;
		background: none;
		border: none;
		border-radius: 6px;
		color: var(--primary);
		font-size: 13px;
		font-family: inherit;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s;

		&:hover {
			background: var(--surface-hover);
		}
	}

	:global(.DatePickerPopover .time_cell) {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 30px;
		padding: 0 8px;
		background: none;
		border: none;
		border-radius: 6px;
		color: var(--foreground);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s;

		&:hover:not(.is_selected) {
			background: var(--surface-hover);
		}

		&.is_selected {
			background: var(--primary);
			color: #ffffff;
			font-weight: 600;
		}
	}

	@keyframes date-picker-pop-appear {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
