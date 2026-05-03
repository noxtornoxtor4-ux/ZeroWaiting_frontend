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
	import {
		toBackendStartOfLocalDay,
		toBackendEndOfLocalDay
	} from '@/lib/utils/datetime';

	interface Props {
		from?: string;
		to?: string;
		labelFrom?: string;
		labelTo?: string;
		placeholder?: string;
		widthFull?: boolean;
		onchange?: (from: string, to: string) => void;
	}

	let {
		from = $bindable(''),
		to = $bindable(''),
		labelFrom = 'С',
		labelTo = 'По',
		placeholder = 'Выберите диапазон',
		widthFull = false,
		onchange
	}: Props = $props();

	const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
	const MONTH_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
		month: 'long',
		year: 'numeric'
	});
	const pad = (n: number) => String(n).padStart(2, '0');

	const formatDisplay = (d: Date): string =>
		`${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

	const toKey = (d: Date) =>
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

	const fromIso = (iso: string): Date | null => {
		if (!iso) return null;
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? null : d;
	};

	const atStartOfDay = (d: Date) => {
		const n = new Date(d);
		n.setHours(0, 0, 0, 0);
		return n;
	};

	const addMonths = (d: Date, delta: number) => {
		const n = new Date(d.getFullYear(), d.getMonth() + delta, 1);
		return n;
	};

	const addYears = (d: Date, delta: number) => {
		const n = new Date(d.getFullYear() + delta, d.getMonth(), 1);
		return n;
	};

	const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

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
	let cleanupAutoUpdate: (() => void) | null = null;

	const today = new Date();

	const fromDate = $derived(fromIso(from));
	const toDate = $derived(fromIso(to));

	const displayValue = $derived.by(() => {
		if (!fromDate && !toDate) return '';
		const a = fromDate ? formatDisplay(fromDate) : '…';
		const b = toDate ? formatDisplay(toDate) : '…';
		return `${a} → ${b}`;
	});

	let viewMonth = $state(untrack(() => startOfMonth(fromDate ?? today)));
	let pendingFrom = $state<Date | null>(null);
	let hoverDate = $state<Date | null>(null);

	const leftMonthLabel = $derived(
		capitalize(MONTH_FORMATTER.format(viewMonth))
	);
	const rightMonthLabel = $derived(
		capitalize(MONTH_FORMATTER.format(addMonths(viewMonth, 1)))
	);

	const leftGrid = $derived(buildMonthGrid(viewMonth));
	const rightGrid = $derived(buildMonthGrid(addMonths(viewMonth, 1)));

	const rangeStart = $derived.by<Date | null>(() => {
		if (pendingFrom) return pendingFrom;
		return fromDate ? atStartOfDay(fromDate) : null;
	});

	const rangeEnd = $derived.by<Date | null>(() => {
		if (pendingFrom) return hoverDate ?? null;
		return toDate ? atStartOfDay(toDate) : null;
	});

	const normalizedRange = $derived.by<[Date, Date] | null>(() => {
		if (!rangeStart || !rangeEnd) return null;
		return compareDays(rangeStart, rangeEnd) <= 0
			? [rangeStart, rangeEnd]
			: [rangeEnd, rangeStart];
	});

	const applyPosition = async () => {
		if (!containerRef || !dropdownRef) return;

		const { x, y } = await computePosition(containerRef, dropdownRef, {
			strategy: 'absolute',
			placement: 'bottom-end',
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
		pendingFrom = null;
		hoverDate = null;
		viewMonth = startOfMonth(fromDate ?? today);
		isOpen = true;
	};

	const closePopover = () => {
		isOpen = false;
		pendingFrom = null;
		hoverDate = null;
	};

	const toggle = () => {
		if (isOpen) closePopover();
		else openPopover();
	};

	const commit = (start: Date, end: Date) => {
		const [a, b] = compareDays(start, end) <= 0 ? [start, end] : [end, start];
		const nextFrom = toBackendStartOfLocalDay(a);
		const nextTo = toBackendEndOfLocalDay(b);
		from = nextFrom;
		to = nextTo;
		onchange?.(nextFrom, nextTo);
	};

	const handleDayClick = (day: Date) => {
		if (!pendingFrom) {
			pendingFrom = atStartOfDay(day);
			hoverDate = atStartOfDay(day);
			return;
		}
		commit(pendingFrom, atStartOfDay(day));
		closePopover();
	};

	const handleDayEnter = (day: Date) => {
		if (pendingFrom) hoverDate = atStartOfDay(day);
	};

	const clearAll = (e: MouseEvent) => {
		e.stopPropagation();
		from = '';
		to = '';
		pendingFrom = null;
		hoverDate = null;
		onchange?.('', '');
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

	const isInRange = (day: Date): boolean => {
		if (!normalizedRange) return false;
		const [a, b] = normalizedRange;
		return compareDays(day, a) >= 0 && compareDays(day, b) <= 0;
	};

	const isRangeEdge = (day: Date): 'start' | 'end' | 'both' | null => {
		if (!normalizedRange) return null;
		const [a, b] = normalizedRange;
		const isStart = isSameDay(day, a);
		const isEnd = isSameDay(day, b);
		if (isStart && isEnd) return 'both';
		if (isStart) return 'start';
		if (isEnd) return 'end';
		return null;
	};
</script>

<div
	class="DateRangeFilter"
	class:width_full={widthFull}
	bind:this={containerRef}
>
	{#if labelFrom || labelTo}
		<span class="label">{labelFrom} / {labelTo}</span>
	{/if}

	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="trigger"
		class:is_open={isOpen}
		class:has_value={!!displayValue}
		role="button"
		tabindex="0"
		onclick={toggle}
	>
		{#if displayValue}
			<span class="value">{displayValue}</span>
		{:else}
			<span class="placeholder">{placeholder}</span>
		{/if}
		<div class="suffix">
			{#if displayValue}
				<button
					type="button"
					class="clear"
					onclick={clearAll}
					aria-label="Очистить"
				>
					<Icon icon="lucide:x" width={14} />
				</button>
			{/if}
			<Icon icon="lucide:calendar" width={16} class="calendar_icon" />
		</div>
	</div>

	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		use:portal
		bind:this={dropdownRef}
		class="DateRangePopover"
		class:is_open={isOpen}
		role="dialog"
		aria-modal="false"
	>
		{#if isOpen}
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
				<div class="month_titles">
					<span class="month_title">{leftMonthLabel}</span>
					<span class="month_title">{rightMonthLabel}</span>
				</div>
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

			<div class="panels">
				{#each [{ grid: leftGrid, anchor: viewMonth }, { grid: rightGrid, anchor: addMonths(viewMonth, 1) }] as panel, panelIdx (panelIdx)}
					<div class="panel">
						<div class="weekdays">
							{#each WEEKDAYS as wd (wd)}
								<span class="weekday">{wd}</span>
							{/each}
						</div>
						<div class="days">
							{#each panel.grid as day (toKey(day) + '_' + panelIdx)}
								{@const inCurrent = day.getMonth() === panel.anchor.getMonth()}
								{@const edge = isRangeEdge(day)}
								{@const inRange = isInRange(day)}
								<button
									type="button"
									class="day"
									class:out_of_month={!inCurrent}
									class:in_range={inRange && !edge}
									class:edge_start={edge === 'start' || edge === 'both'}
									class:edge_end={edge === 'end' || edge === 'both'}
									class:is_today={isSameDay(day, today)}
									onclick={() => handleDayClick(day)}
									onmouseenter={() => handleDayEnter(day)}
								>
									<span class="day_label">{day.getDate()}</span>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style lang="scss">
	.DateRangeFilter {
		display: inline-flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		width: fit-content;

		&.width_full {
			display: flex;
			width: 100%;
		}

		.label {
			font-size: 11px;
			font-weight: 500;
			color: var(--muted-fg);
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}

		.trigger {
			display: flex;
			align-items: center;
			gap: 8px;
			height: 38px;
			min-width: 240px;
			padding: 0 10px 0 12px;
			background: var(--surface);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			color: var(--foreground);
			font-size: 13px;
			cursor: pointer;
			user-select: none;
			transition: border-color 0.15s;

			&:hover,
			&.is_open {
				border-color: var(--primary);
			}

			.value {
				flex: 1;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.placeholder {
				flex: 1;
				min-width: 0;
				color: var(--muted-fg);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.suffix {
				display: flex;
				align-items: center;
				gap: 6px;
				flex-shrink: 0;
				color: var(--muted-fg);

				.clear {
					display: flex;
					align-items: center;
					justify-content: center;
					width: 18px;
					height: 18px;
					padding: 0;
					background: none;
					border: none;
					border-radius: 50%;
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
			}
		}
	}

	:global(.DateRangePopover) {
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
			animation: date-range-pop-appear 0.15s cubic-bezier(0.23, 1, 0.32, 1);
		}
	}

	:global(.DateRangePopover .header) {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 8px;
		padding: 2px 4px 10px;
	}

	:global(.DateRangePopover .nav_group) {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	:global(.DateRangePopover .nav_btn) {
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

	:global(.DateRangePopover .month_titles) {
		display: grid;
		grid-template-columns: 1fr 1fr;
		justify-items: center;
		gap: 24px;
		font-size: 13px;
		font-weight: 600;
		color: var(--foreground);
	}

	:global(.DateRangePopover .panels) {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
	}

	:global(.DateRangePopover .panel) {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	:global(.DateRangePopover .weekdays) {
		display: grid;
		grid-template-columns: repeat(7, 32px);
		padding: 4px 0;
	}

	:global(.DateRangePopover .weekday) {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 22px;
		font-size: 11px;
		font-weight: 500;
		color: var(--muted-fg);
	}

	:global(.DateRangePopover .days) {
		display: grid;
		grid-template-columns: repeat(7, 32px);
		grid-auto-rows: 32px;
	}

	:global(.DateRangePopover .day) {
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
		z-index: 0;

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
			z-index: 1;
		}

		&:hover .day_label {
			background: var(--surface-hover);
		}

		&.out_of_month {
			color: var(--muted-fg);
			opacity: 0.5;
		}

		&.in_range {
			background: var(--primary-subtle);

			.day_label {
				color: var(--primary-light);
			}
		}

		&.edge_start,
		&.edge_end {
			background: var(--primary-subtle);

			.day_label {
				background: var(--primary);
				color: #ffffff;
			}
		}

		&.edge_start:not(.edge_end) {
			border-top-left-radius: 6px;
			border-bottom-left-radius: 6px;
		}

		&.edge_end:not(.edge_start) {
			border-top-right-radius: 6px;
			border-bottom-right-radius: 6px;
		}

		&.edge_start.edge_end {
			background: transparent;
		}

		&.is_today:not(.edge_start):not(.edge_end) .day_label {
			box-shadow: inset 0 0 0 1px var(--primary);
		}
	}

	@keyframes date-range-pop-appear {
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
