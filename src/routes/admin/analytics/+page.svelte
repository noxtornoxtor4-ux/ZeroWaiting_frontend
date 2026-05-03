<script lang="ts">
	import { onMount } from 'svelte';
	import toast from 'svelte-french-toast';
	import { crmQueryApi } from '@/api/endpoints';
	import { UserRole } from '@/api/model';
	import { axiosInstance } from '@/api/mutator/custom-instance';
	import { formatPriceCompact, formatPrice } from '@/lib/utils/price';
	import { toBackendInstant } from '@/lib/utils/datetime';
	import { getErrorMessage } from '@/lib/utils/error';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import DateRangeFilter from '@/components/ui/DateRangeFilter.svelte';
	import Icon from '@iconify/svelte';
	import {
		Chart,
		LineController,
		BarController,
		DoughnutController,
		LineElement,
		BarElement,
		ArcElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Filler,
		Legend
	} from 'chart.js';

	Chart.register(
		LineController,
		BarController,
		DoughnutController,
		LineElement,
		BarElement,
		ArcElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Filler,
		Legend
	);

	type Preset = '7d' | '14d' | '30d' | '90d' | 'year' | 'custom';
	const PRESET_DAYS: Record<Exclude<Preset, 'custom'>, number> = {
		'7d': 7,
		'14d': 14,
		'30d': 30,
		'90d': 90,
		year: 365
	};
	const PRESET_LABELS: Record<Preset, string> = {
		'7d': '7 дней',
		'14d': '14 дней',
		'30d': '30 дней',
		'90d': '90 дней',
		year: 'Год',
		custom: 'Свой период'
	};

	const table = useTableQuery<never, { preset: Preset }>({
		filters: { preset: '30d' }
	});
	const preset = $derived(table.filters.preset);

	const pad = (n: number) => String(n).padStart(2, '0');
	const toIsoDay = (d: Date) =>
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

	const range = $derived.by(() => {
		const now = new Date();
		const end = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
			23,
			59,
			59
		);
		if (preset === 'custom') {
			const start = table.dateFrom
				? new Date(table.dateFrom)
				: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			const finish = table.dateTo ? new Date(table.dateTo) : end;
			finish.setHours(23, 59, 59, 999);
			return {
				from: toBackendInstant(start),
				to: toBackendInstant(finish),
				days: Math.max(
					1,
					Math.round((finish.getTime() - start.getTime()) / 86_400_000)
				)
			};
		}
		const days = PRESET_DAYS[preset];
		const start = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() - (days - 1)
		);
		return { from: toBackendInstant(start), to: toBackendInstant(end), days };
	});

	const prevRange = $derived.by(() => {
		const start = new Date(range.from);
		const end = new Date(range.to);
		const length = end.getTime() - start.getTime();
		const prevEnd = new Date(start.getTime() - 1);
		const prevStart = new Date(prevEnd.getTime() - length);
		return { from: toBackendInstant(prevStart), to: toBackendInstant(prevEnd) };
	});

	const summaryQuery = crmQueryApi.createGetSuperAdminAnalyticsSummaryV1(
		() => ({
			dateFrom: range.from,
			dateTo: range.to
		})
	);
	const summaryPrevQuery = crmQueryApi.createGetSuperAdminAnalyticsSummaryV1(
		() => ({ dateFrom: prevRange.from, dateTo: prevRange.to })
	);
	const summary = $derived(summaryQuery.data);
	const summaryPrev = $derived(summaryPrevQuery.data);

	const revenueQuery = crmQueryApi.createGetSuperAdminAnalyticsRevenueV1(
		() => ({
			dateFrom: range.from,
			dateTo: range.to
		})
	);
	const revenue = $derived(revenueQuery.data);
	const daily = $derived(revenue?.daily ?? []);

	const topMoviesQuery = crmQueryApi.createGetSuperAdminAnalyticsTopMoviesV1(
		() => ({
			dateFrom: range.from,
			dateTo: range.to
		})
	);
	const topMovies = $derived(topMoviesQuery.data ?? []);

	const peakHoursQuery = crmQueryApi.createGetSuperAdminAnalyticsPeakHoursV1(
		() => ({
			dateFrom: range.from,
			dateTo: range.to
		})
	);
	const peakHours = $derived(peakHoursQuery.data ?? []);

	const occupancyByDayQuery =
		crmQueryApi.createGetSuperAdminAnalyticsOccupancyByDayV1(() => ({
			dateFrom: range.from,
			dateTo: range.to
		}));
	const occupancyByDay = $derived(occupancyByDayQuery.data ?? []);

	const occupancyQuery = crmQueryApi.createGetSuperAdminAnalyticsOccupancyV1(
		() => ({
			dateFrom: range.from,
			dateTo: range.to
		})
	);
	const occupancy = $derived(occupancyQuery.data ?? []);

	const foodQuery = crmQueryApi.createGetSuperAdminAnalyticsFoodRevenueV1(
		() => ({ dateFrom: range.from, dateTo: range.to })
	);
	const foodPrevQuery = crmQueryApi.createGetSuperAdminAnalyticsFoodRevenueV1(
		() => ({ dateFrom: prevRange.from, dateTo: prevRange.to })
	);
	const food = $derived(foodQuery.data);
	const foodPrev = $derived(foodPrevQuery.data);

	const promoQuery = crmQueryApi.createGetSuperAdminAnalyticsPromoStatsV1(
		() => ({ dateFrom: range.from, dateTo: range.to })
	);
	const promo = $derived(promoQuery.data);

	const computeDelta = (cur?: number, prev?: number) => {
		if (cur === undefined || prev === undefined) return null;
		if (prev === 0) return cur > 0 ? 100 : null;
		return Math.round(((cur - prev) / prev) * 100);
	};

	const formatDelta = (d: number | null) => {
		if (d === null) return '—';
		const sign = d > 0 ? '+' : '';
		return `${sign}${d}%`;
	};

	const revenueDelta = $derived(
		computeDelta(summary?.totalRevenue, summaryPrev?.totalRevenue)
	);
	const bookingsDelta = $derived(
		computeDelta(summary?.totalBookings, summaryPrev?.totalBookings)
	);
	const avgTicketDelta = $derived(
		computeDelta(summary?.avgTicketPrice, summaryPrev?.avgTicketPrice)
	);
	const cancelDelta = $derived(
		computeDelta(summary?.cancellationRate, summaryPrev?.cancellationRate)
	);
	const foodDelta = $derived(
		computeDelta(food?.totalFoodRevenue, foodPrev?.totalFoodRevenue)
	);

	const avgOccupancy = $derived.by(() => {
		if (occupancy.length === 0) return 0;
		const total = occupancy.reduce((s, o) => s + o.occupancyRate, 0);
		return Math.round((total / occupancy.length) * 100) / 100;
	});

	const groupedHalls = $derived.by(() => {
		const groups = new Map<
			string,
			{
				cinemaId: string;
				cinemaName: string;
				halls: typeof occupancy;
			}
		>();
		for (const hall of occupancy) {
			const cinemaLabel =
				getLocalizedValue(hall.cinemaName) || 'Без кинотеатра';
			const key = hall.cinemaId || cinemaLabel;
			const existing = groups.get(key);
			if (existing) {
				existing.halls.push(hall);
			} else {
				groups.set(key, {
					cinemaId: hall.cinemaId ?? '',
					cinemaName: cinemaLabel,
					halls: [hall]
				});
			}
		}
		return [...groups.values()]
			.map((g) => ({
				...g,
				halls: [...g.halls].sort((a, b) => b.occupancyRate - a.occupancyRate),
				avgRate:
					g.halls.length > 0
						? g.halls.reduce((s, h) => s + h.occupancyRate, 0) / g.halls.length
						: 0
			}))
			.sort((a, b) => b.avgRate - a.avgRate);
	});

	const formatHourLabel = (h: number) => `${h.toString().padStart(2, '0')}:00`;
	const formatDateLabel = (iso: string) => {
		const d = new Date(iso);
		return d.toLocaleDateString('ru-RU', {
			day: '2-digit',
			month: 'short'
		});
	};
	const formatPercent = (rate: number) => `${(rate * 100).toFixed(0)}%`;

	let revenueCanvas = $state<HTMLCanvasElement | null>(null);
	let peakCanvas = $state<HTMLCanvasElement | null>(null);
	let donutCanvas = $state<HTMLCanvasElement | null>(null);
	let dowCanvas = $state<HTMLCanvasElement | null>(null);
	let revenueChart: Chart | null = null;
	let peakChart: Chart | null = null;
	let donutChart: Chart | null = null;
	let dowChart: Chart | null = null;

	const gridColor = 'rgba(45, 45, 61, 0.4)';
	const tickColor = '#9494a5';
	const accent = '#a855f7';

	$effect(() => {
		if (!daily.length || !revenueCanvas) return;
		const ctx = revenueCanvas.getContext('2d');
		if (!ctx) return;
		const height = revenueCanvas.height || 360;
		const gradient = ctx.createLinearGradient(0, 0, 0, height);
		gradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
		gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');

		revenueChart?.destroy();
		revenueChart = new Chart(revenueCanvas, {
			data: {
				labels: daily.map((d) => formatDateLabel(d.date)),
				datasets: [
					{
						type: 'bar',
						label: 'Бронирования',
						data: daily.map((d) => d.bookings),
						backgroundColor: 'rgba(139, 92, 246, 0.18)',
						hoverBackgroundColor: 'rgba(139, 92, 246, 0.35)',
						borderRadius: 6,
						borderSkipped: false,
						yAxisID: 'yBookings',
						order: 2
					},
					{
						type: 'line',
						label: 'Выручка',
						data: daily.map((d) => d.revenue),
						borderColor: accent,
						backgroundColor: gradient,
						borderWidth: 2.5,
						fill: true,
						tension: 0.35,
						pointRadius: 0,
						pointHoverRadius: 5,
						pointHoverBackgroundColor: '#fff',
						pointHoverBorderColor: accent,
						pointHoverBorderWidth: 2,
						yAxisID: 'yRevenue',
						order: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: {
						display: true,
						position: 'top',
						align: 'end',
						labels: {
							color: '#f8f8fb',
							boxWidth: 12,
							boxHeight: 12,
							padding: 16,
							font: { size: 12 }
						}
					},
					tooltip: {
						backgroundColor: 'rgba(26, 26, 38, 0.95)',
						borderColor: 'rgba(168, 85, 247, 0.3)',
						borderWidth: 1,
						padding: 12,
						titleColor: '#f8f8fb',
						bodyColor: '#f8f8fb',
						callbacks: {
							label: (item) => {
								const y = item.parsed.y ?? 0;
								if (item.dataset.label === 'Выручка') {
									return `Выручка: ${formatPriceCompact(y)}`;
								}
								return `Бронирования: ${y}`;
							}
						}
					}
				},
				scales: {
					x: {
						ticks: { color: tickColor, font: { size: 11 } },
						grid: { display: false },
						border: { display: false }
					},
					yRevenue: {
						type: 'linear',
						position: 'left',
						ticks: {
							color: tickColor,
							font: { size: 11 },
							callback: (v) => formatPriceCompact(Number(v))
						},
						grid: { color: gridColor },
						border: { display: false },
						beginAtZero: true
					},
					yBookings: {
						type: 'linear',
						position: 'right',
						ticks: { color: tickColor, font: { size: 11 } },
						grid: { display: false },
						border: { display: false },
						beginAtZero: true
					}
				}
			}
		});
	});

	$effect(() => {
		if (!peakHours.length || !peakCanvas) return;
		peakChart?.destroy();
		peakChart = new Chart(peakCanvas, {
			type: 'bar',
			data: {
				labels: peakHours.map((h) => formatHourLabel(h.hour)),
				datasets: [
					{
						label: 'Бронирования',
						data: peakHours.map((h) => h.bookings),
						backgroundColor: 'rgba(168, 85, 247, 0.2)',
						hoverBackgroundColor: accent,
						borderRadius: 6,
						borderSkipped: false
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: 'rgba(26, 26, 38, 0.95)',
						borderColor: 'rgba(168, 85, 247, 0.3)',
						borderWidth: 1,
						padding: 10
					}
				},
				scales: {
					x: {
						ticks: {
							color: tickColor,
							font: { size: 10 },
							maxRotation: 0,
							autoSkipPadding: 6
						},
						grid: { display: false },
						border: { display: false }
					},
					y: {
						ticks: { color: tickColor, font: { size: 10 } },
						grid: { color: gridColor },
						border: { display: false },
						beginAtZero: true
					}
				}
			}
		});
	});

	$effect(() => {
		if (!summary || !donutCanvas) return;
		const online = summary.onlineBookings;
		const offline = summary.receptionBookings;
		const cancelled = summary.cancelledBookings;
		if (online + offline + cancelled === 0) return;

		donutChart?.destroy();
		donutChart = new Chart(donutCanvas, {
			type: 'doughnut',
			data: {
				labels: ['Онлайн', 'Касса', 'Отмены'],
				datasets: [
					{
						data: [online, offline, cancelled],
						backgroundColor: [
							'rgba(168, 85, 247, 0.9)',
							'rgba(59, 130, 246, 0.9)',
							'rgba(239, 68, 68, 0.9)'
						],
						borderColor: 'rgba(26, 26, 38, 1)',
						borderWidth: 3,
						hoverOffset: 6
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '65%',
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							color: '#f8f8fb',
							boxWidth: 10,
							boxHeight: 10,
							padding: 12,
							font: { size: 12 },
							usePointStyle: true,
							pointStyle: 'circle'
						}
					},
					tooltip: {
						backgroundColor: 'rgba(26, 26, 38, 0.95)',
						borderColor: 'rgba(168, 85, 247, 0.3)',
						borderWidth: 1,
						padding: 10
					}
				}
			}
		});
	});

	$effect(() => {
		if (!occupancyByDay.length || !dowCanvas) return;
		const ordered = [1, 2, 3, 4, 5, 6, 0]
			.map((dow) => occupancyByDay.find((x) => x.dayOfWeek === dow))
			.filter((x): x is (typeof occupancyByDay)[number] => !!x);

		dowChart?.destroy();
		dowChart = new Chart(dowCanvas, {
			type: 'bar',
			data: {
				labels: ordered.map((x) => x.dayName),
				datasets: [
					{
						label: 'Средняя заполняемость',
						data: ordered.map((x) => Math.round(x.avgOccupancy * 100)),
						backgroundColor: ordered.map((x) => {
							const r = x.avgOccupancy * 100;
							if (r >= 60) return 'rgba(34, 197, 94, 0.8)';
							if (r >= 35) return 'rgba(245, 158, 11, 0.8)';
							return 'rgba(168, 85, 247, 0.55)';
						}),
						borderRadius: 8,
						borderSkipped: false
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				indexAxis: 'x',
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: 'rgba(26, 26, 38, 0.95)',
						borderColor: 'rgba(168, 85, 247, 0.3)',
						borderWidth: 1,
						padding: 10,
						callbacks: {
							label: (item) => `${item.parsed.y}% заполняемость`
						}
					}
				},
				scales: {
					x: {
						ticks: { color: tickColor, font: { size: 12 } },
						grid: { display: false },
						border: { display: false }
					},
					y: {
						ticks: {
							color: tickColor,
							font: { size: 11 },
							callback: (v) => `${v}%`
						},
						grid: { color: gridColor },
						border: { display: false },
						beginAtZero: true,
						max: 100
					}
				}
			}
		});
	});

	onMount(() => () => {
		revenueChart?.destroy();
		peakChart?.destroy();
		donutChart?.destroy();
		dowChart?.destroy();
	});

	let exporting = $state(false);

	const exportCsv = async () => {
		if (exporting) return;
		exporting = true;
		try {
			const res = await axiosInstance.get(
				'/api/v1/super-admin/analytics/export/revenue',
				{
					params: { dateFrom: range.from, dateTo: range.to },
					responseType: 'blob'
				}
			);
			const url = URL.createObjectURL(res.data as Blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `revenue-${toIsoDay(new Date(range.from))}_${toIsoDay(new Date(range.to))}.csv`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			toast.success('CSV скачан');
		} catch (error) {
			toast.error(getErrorMessage(error, 'Не удалось экспортировать CSV'));
		} finally {
			exporting = false;
		}
	};

	const setPreset = (p: Preset) => {
		if (p !== 'custom') table.setDateRange('', '');
		table.setFilter('preset', p);
	};

	const handleCustomRange = (from: string, to: string) => {
		table.setDateRange(from, to);
		if (from && to) table.setFilter('preset', 'custom');
	};

	const rangeSubtitle = $derived.by(() => {
		const fromDate = new Date(range.from);
		const toDate = new Date(range.to);
		const fmt = (d: Date) =>
			d.toLocaleDateString('ru-RU', {
				day: '2-digit',
				month: 'short',
				year: 'numeric'
			});
		return `${fmt(fromDate)} — ${fmt(toDate)} · ${range.days} дн.`;
	});
</script>

<svelte:head><title>Аналитика — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.ADMIN} redirectTo="/admin/dashboard">
	<div class="AnalyticsPage">
		<SectionHeader title="Аналитика" subtitle={rangeSubtitle}>
			{#snippet actions()}
				<div class="toolbar">
					<DateRangeFilter
						from={table.dateFrom}
						to={table.dateTo}
						placeholder="Свой период"
						onchange={handleCustomRange}
					/>
					<button
						type="button"
						class="export_btn"
						onclick={exportCsv}
						disabled={exporting}
					>
						<Icon icon="lucide:download" width={16} aria-hidden="true" />
						{exporting ? 'Экспорт…' : 'Экспорт CSV'}
					</button>
				</div>
			{/snippet}
		</SectionHeader>

		<div class="presets">
			{#each ['7d', '14d', '30d', '90d', 'year', 'custom'] as p (p)}
				<button
					type="button"
					class="preset_btn"
					class:active={preset === p}
					onclick={() => setPreset(p as Preset)}
				>
					{PRESET_LABELS[p as Preset]}
				</button>
			{/each}
		</div>

		<div class="grid">
			<div class="tile kpi glass-card">
				<div class="kpi_head">
					<div class="kpi_icon primary">
						<Icon icon="lucide:banknote" width={18} aria-hidden="true" />
					</div>
					<span class="kpi_label">Выручка</span>
				</div>
				{#if summaryQuery.isLoading}
					<Skeleton height="32px" width="90px" />
				{:else if summaryQuery.isError}
					<span class="kpi_value error">—</span>
				{:else}
					<span class="kpi_value"
						>{formatPriceCompact(summary?.totalRevenue ?? 0)}</span
					>
					<span
						class="kpi_delta"
						class:up={(revenueDelta ?? 0) > 0}
						class:down={(revenueDelta ?? 0) < 0}
					>
						<Icon
							icon={(revenueDelta ?? 0) >= 0
								? 'lucide:trending-up'
								: 'lucide:trending-down'}
							width={12}
							aria-hidden="true"
						/>
						{formatDelta(revenueDelta)} vs прошлый период
					</span>
				{/if}
			</div>

			<div class="tile kpi glass-card">
				<div class="kpi_head">
					<div class="kpi_icon success">
						<Icon icon="lucide:ticket" width={18} aria-hidden="true" />
					</div>
					<span class="kpi_label">Бронирований</span>
				</div>
				{#if summaryQuery.isLoading}
					<Skeleton height="32px" width="60px" />
				{:else if summaryQuery.isError}
					<span class="kpi_value error">—</span>
				{:else}
					<span class="kpi_value">{summary?.totalBookings ?? 0}</span>
					<span
						class="kpi_delta"
						class:up={(bookingsDelta ?? 0) > 0}
						class:down={(bookingsDelta ?? 0) < 0}
					>
						<Icon
							icon={(bookingsDelta ?? 0) >= 0
								? 'lucide:trending-up'
								: 'lucide:trending-down'}
							width={12}
							aria-hidden="true"
						/>
						{formatDelta(bookingsDelta)}
					</span>
				{/if}
			</div>

			<div class="tile kpi glass-card">
				<div class="kpi_head">
					<div class="kpi_icon info">
						<Icon icon="lucide:receipt" width={18} aria-hidden="true" />
					</div>
					<span class="kpi_label">Средний чек</span>
				</div>
				{#if summaryQuery.isLoading}
					<Skeleton height="32px" width="80px" />
				{:else if summaryQuery.isError}
					<span class="kpi_value error">—</span>
				{:else}
					<span class="kpi_value"
						>{formatPriceCompact(summary?.avgTicketPrice ?? 0)}</span
					>
					<span
						class="kpi_delta"
						class:up={(avgTicketDelta ?? 0) > 0}
						class:down={(avgTicketDelta ?? 0) < 0}
					>
						<Icon
							icon={(avgTicketDelta ?? 0) >= 0
								? 'lucide:trending-up'
								: 'lucide:trending-down'}
							width={12}
							aria-hidden="true"
						/>
						{formatDelta(avgTicketDelta)}
					</span>
				{/if}
			</div>

			<div class="tile kpi glass-card">
				<div class="kpi_head">
					<div class="kpi_icon warning">
						<Icon icon="lucide:armchair" width={18} aria-hidden="true" />
					</div>
					<span class="kpi_label">Средняя заполняемость</span>
				</div>
				{#if occupancyQuery.isLoading}
					<Skeleton height="32px" width="60px" />
				{:else if occupancyQuery.isError}
					<span class="kpi_value error">—</span>
				{:else}
					<span class="kpi_value">{formatPercent(avgOccupancy)}</span>
					<span class="kpi_sub">По {occupancy.length} залам</span>
				{/if}
			</div>

			<div class="tile kpi glass-card">
				<div class="kpi_head">
					<div class="kpi_icon food">
						<Icon icon="lucide:popcorn" width={18} aria-hidden="true" />
					</div>
					<span class="kpi_label">Выручка с еды</span>
				</div>
				{#if foodQuery.isLoading}
					<Skeleton height="32px" width="80px" />
				{:else if foodQuery.isError}
					<span class="kpi_value error">—</span>
				{:else}
					<span class="kpi_value"
						>{formatPriceCompact(food?.totalFoodRevenue ?? 0)}</span
					>
					<span
						class="kpi_delta"
						class:up={(foodDelta ?? 0) > 0}
						class:down={(foodDelta ?? 0) < 0}
					>
						<Icon
							icon={(foodDelta ?? 0) >= 0
								? 'lucide:trending-up'
								: 'lucide:trending-down'}
							width={12}
							aria-hidden="true"
						/>
						{formatDelta(foodDelta)} · {food?.totalOrders ?? 0} заказов
					</span>
				{/if}
			</div>

			<div class="tile kpi glass-card">
				<div class="kpi_head">
					<div class="kpi_icon danger">
						<Icon icon="lucide:x-circle" width={18} aria-hidden="true" />
					</div>
					<span class="kpi_label">Процент отмен</span>
				</div>
				{#if summaryQuery.isLoading}
					<Skeleton height="32px" width="60px" />
				{:else if summaryQuery.isError}
					<span class="kpi_value error">—</span>
				{:else}
					<span class="kpi_value"
						>{(summary?.cancellationRate ?? 0).toFixed(1)}%</span
					>
					<span
						class="kpi_delta"
						class:up={(cancelDelta ?? 0) < 0}
						class:down={(cancelDelta ?? 0) > 0}
					>
						<Icon
							icon={(cancelDelta ?? 0) <= 0
								? 'lucide:trending-down'
								: 'lucide:trending-up'}
							width={12}
							aria-hidden="true"
						/>
						{formatDelta(cancelDelta)}
					</span>
				{/if}
			</div>

			<div class="tile chart_big glass-card">
				<div class="tile_head">
					<div class="tile_title">
						<Icon icon="lucide:line-chart" width={18} aria-hidden="true" />
						<h3>Выручка и бронирования по дням</h3>
					</div>
					<span class="tile_meta"
						>{formatPriceCompact(revenue?.totalRevenue ?? 0)} · {revenue?.totalBookings ??
							0} бр.</span
					>
				</div>
				{#if revenueQuery.isLoading}
					<div class="chart_wrap"><Skeleton height="100%" /></div>
				{:else if revenueQuery.isError}
					<p class="muted error_text">Не удалось загрузить тренд выручки</p>
				{:else if daily.length === 0}
					<div class="empty_block">
						<Icon icon="lucide:line-chart" width={32} aria-hidden="true" />
						<p class="muted">Нет данных за период</p>
					</div>
				{:else}
					<div class="chart_wrap">
						<canvas bind:this={revenueCanvas}></canvas>
					</div>
				{/if}
			</div>

			<div class="tile donut_tile glass-card">
				<div class="tile_head">
					<div class="tile_title">
						<Icon icon="lucide:pie-chart" width={18} aria-hidden="true" />
						<h3>Структура бронирований</h3>
					</div>
				</div>
				{#if summaryQuery.isLoading}
					<div class="chart_wrap"><Skeleton height="100%" /></div>
				{:else if summaryQuery.isError}
					<p class="muted error_text">Нет данных</p>
				{:else if !summary || summary.onlineBookings + summary.receptionBookings + summary.cancelledBookings === 0}
					<div class="empty_block">
						<Icon icon="lucide:pie-chart" width={32} aria-hidden="true" />
						<p class="muted">Нет бронирований</p>
					</div>
				{:else}
					<div class="chart_wrap">
						<canvas bind:this={donutCanvas}></canvas>
					</div>
					<div class="donut_rows">
						<div class="donut_row">
							<span class="dot online"></span>
							<span class="donut_label">Онлайн</span>
							<span class="donut_value">{summary.onlineBookings}</span>
						</div>
						<div class="donut_row">
							<span class="dot offline"></span>
							<span class="donut_label">Касса</span>
							<span class="donut_value">{summary.receptionBookings}</span>
						</div>
						<div class="donut_row">
							<span class="dot cancel"></span>
							<span class="donut_label">Отмены</span>
							<span class="donut_value">{summary.cancelledBookings}</span>
						</div>
					</div>
				{/if}
			</div>

			<div class="tile peak_tile glass-card">
				<div class="tile_head">
					<div class="tile_title">
						<Icon icon="lucide:clock" width={18} aria-hidden="true" />
						<h3>Пиковые часы</h3>
					</div>
				</div>
				{#if peakHoursQuery.isLoading}
					<div class="chart_wrap"><Skeleton height="100%" /></div>
				{:else if peakHoursQuery.isError}
					<p class="muted error_text">Нет данных</p>
				{:else if peakHours.length === 0}
					<div class="empty_block">
						<Icon icon="lucide:clock" width={32} aria-hidden="true" />
						<p class="muted">Нет данных за период</p>
					</div>
				{:else}
					<div class="chart_wrap"><canvas bind:this={peakCanvas}></canvas></div>
				{/if}
			</div>

			<div class="tile dow_tile glass-card">
				<div class="tile_head">
					<div class="tile_title">
						<Icon icon="lucide:calendar-days" width={18} aria-hidden="true" />
						<h3>Заполняемость по дням недели</h3>
					</div>
				</div>
				{#if occupancyByDayQuery.isLoading}
					<div class="chart_wrap dow_chart"><Skeleton height="100%" /></div>
				{:else if occupancyByDayQuery.isError}
					<p class="muted error_text">Нет данных</p>
				{:else if occupancyByDay.length === 0}
					<div class="empty_block">
						<Icon icon="lucide:calendar-days" width={32} aria-hidden="true" />
						<p class="muted">Нет данных за период</p>
					</div>
				{:else}
					<div class="chart_wrap dow_chart">
						<canvas bind:this={dowCanvas}></canvas>
					</div>
				{/if}
			</div>

			<div class="tile top_tile glass-card">
				<div class="tile_head">
					<div class="tile_title">
						<Icon icon="lucide:trophy" width={18} aria-hidden="true" />
						<h3>Топ фильмы</h3>
					</div>
					<a href="/admin/movies" class="tile_link">
						Все
						<Icon icon="lucide:arrow-right" width={14} aria-hidden="true" />
					</a>
				</div>
				{#if topMoviesQuery.isLoading}
					<div class="skeleton_list">
						{#each Array(6) as _}
							<Skeleton height="36px" />
						{/each}
					</div>
				{:else if topMoviesQuery.isError}
					<p class="muted error_text">Нет данных</p>
				{:else if topMovies.length === 0}
					<div class="empty_block">
						<Icon icon="lucide:film" width={32} aria-hidden="true" />
						<p class="muted">Нет продаж за период</p>
					</div>
				{:else}
					{@const maxRevenue = Math.max(...topMovies.map((m) => m.revenue))}
					<div class="top_list">
						{#each topMovies.slice(0, 10) as movie, i}
							<div class="top_row">
								<span class="top_rank">#{i + 1}</span>
								<span class="top_title">{movie.title?.ru ?? movie.movieId}</span
								>
								<div class="top_bar_wrap">
									<div
										class="top_bar"
										style:width="{(movie.revenue / maxRevenue) * 100}%"
									></div>
								</div>
								<span class="top_bookings">{movie.bookings} бр.</span>
								<span class="top_revenue"
									>{formatPriceCompact(movie.revenue)}</span
								>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="tile side_stack">
				<div class="side_card glass-card">
					<div class="side_head">
						<div class="kpi_icon promo">
							<Icon icon="lucide:tag" width={18} aria-hidden="true" />
						</div>
						<span class="side_label">Промокоды</span>
					</div>
					{#if promoQuery.isLoading}
						<Skeleton height="24px" />
					{:else if promoQuery.isError}
						<p class="muted error_text">Нет данных</p>
					{:else}
						<div class="side_rows">
							<div class="side_row">
								<span>Применений</span>
								<b>{promo?.totalUsages ?? 0}</b>
							</div>
							<div class="side_row">
								<span>Уникальных</span>
								<b>{promo?.uniquePromoCodes ?? 0}</b>
							</div>
							<div class="side_row accent">
								<span>Скидок выдано</span>
								<b>{formatPrice(promo?.totalDiscount ?? 0)}</b>
							</div>
						</div>
					{/if}
				</div>

				<div class="side_card glass-card">
					<div class="side_head">
						<div class="kpi_icon food">
							<Icon icon="lucide:popcorn" width={18} aria-hidden="true" />
						</div>
						<span class="side_label">Еда и напитки</span>
					</div>
					{#if foodQuery.isLoading}
						<Skeleton height="24px" />
					{:else if foodQuery.isError}
						<p class="muted error_text">Нет данных</p>
					{:else}
						<div class="side_rows">
							<div class="side_row">
								<span>Заказов</span>
								<b>{food?.totalOrders ?? 0}</b>
							</div>
							<div class="side_row accent">
								<span>Выручка</span>
								<b>{formatPrice(food?.totalFoodRevenue ?? 0)}</b>
							</div>
							{#if food?.totalOrders && food.totalOrders > 0}
								<div class="side_row">
									<span>Ср. чек еды</span>
									<b
										>{formatPriceCompact(
											food.totalFoodRevenue / food.totalOrders
										)}</b
									>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<div class="tile halls_tile glass-card">
				<div class="tile_head">
					<div class="tile_title">
						<Icon icon="lucide:layout-grid" width={18} aria-hidden="true" />
						<h3>Заполняемость залов</h3>
					</div>
					<a href="/admin/halls" class="tile_link">
						Все
						<Icon icon="lucide:arrow-right" width={14} aria-hidden="true" />
					</a>
				</div>
				{#if occupancyQuery.isLoading}
					<div class="skeleton_list">
						{#each Array(5) as _}
							<Skeleton height="32px" />
						{/each}
					</div>
				{:else if occupancyQuery.isError}
					<p class="muted error_text">Нет данных</p>
				{:else if groupedHalls.length === 0}
					<div class="empty_block">
						<Icon icon="lucide:armchair" width={32} aria-hidden="true" />
						<p class="muted">Нет сеансов за период</p>
					</div>
				{:else}
					<div class="hall_groups">
						{#each groupedHalls as group}
							<div class="hall_group">
								<div class="hall_group_head">
									<span class="cinema_name">{group.cinemaName}</span>
									<span class="cinema_avg">
										{formatPercent(group.avgRate)} ср. · {group.halls.length} залов
									</span>
								</div>
								<div class="hall_group_body">
									{#each group.halls as hall}
										{@const rate = Math.min(hall.occupancyRate, 1)}
										{@const bandColor =
											rate >= 0.6
												? 'var(--success)'
												: rate >= 0.35
													? 'var(--warning)'
													: 'var(--danger)'}
										<div class="hall_row">
											<div class="hall_meta_col">
												<span class="hall_name">{hall.hallName}</span>
												<span class="hall_branch"
													>{getLocalizedValue(hall.branchName)}</span
												>
											</div>
											<span class="hall_seats"
												>{hall.bookedSeats}/{hall.totalSeats}</span
											>
											<div class="hall_bar_wrap">
												<div
													class="hall_bar"
													style:width="{rate * 100}%"
													style:background={bandColor}
												></div>
											</div>
											<span class="hall_percent" style:color={bandColor}
												>{formatPercent(rate)}</span
											>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</RoleGuard>

<style lang="scss">
	.toolbar {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;

		.export_btn {
			display: inline-flex;
			align-items: center;
			gap: var(--space-1);
			padding: 8px 14px;
			border-radius: var(--radius-md);
			font-size: var(--text-sm);
			font-weight: var(--weight-medium);
			color: var(--foreground);
			background: color-mix(in srgb, var(--primary) 18%, transparent);
			border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
			transition:
				background var(--duration-fast) var(--ease-default),
				border-color var(--duration-fast) var(--ease-default);

			&:hover:not(:disabled) {
				background: color-mix(in srgb, var(--primary) 28%, transparent);
				border-color: var(--primary);
			}

			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
	}

	.AnalyticsPage {
		.presets {
			display: inline-flex;
			gap: 4px;
			padding: 4px;
			margin-bottom: var(--space-5);
			background: color-mix(in srgb, var(--surface) 60%, transparent);
			border: 1px solid var(--border-color-subtle);
			border-radius: var(--radius-full);
			flex-wrap: wrap;

			.preset_btn {
				padding: 6px 14px;
				border-radius: var(--radius-full);
				font-size: var(--text-xs);
				font-weight: var(--weight-medium);
				color: var(--muted-fg);
				transition:
					background var(--duration-fast) var(--ease-default),
					color var(--duration-fast) var(--ease-default);

				&:hover {
					color: var(--foreground);
				}

				&.active {
					background: linear-gradient(
						135deg,
						var(--primary-600),
						var(--primary-500)
					);
					color: #fff;
					box-shadow: 0 4px 14px rgba(168, 85, 247, 0.35);
				}
			}
		}

		.grid {
			display: grid;
			grid-template-columns: repeat(12, 1fr);
			grid-auto-rows: auto;
			gap: var(--space-4);

			@media (max-width: 1200px) {
				grid-template-columns: repeat(6, 1fr);
			}

			@media (max-width: 640px) {
				grid-template-columns: 1fr;
			}
		}

		.tile {
			padding: var(--space-5);
			display: flex;
			flex-direction: column;
			min-width: 0;
			position: relative;
			overflow: hidden;
		}

		.kpi {
			grid-column: span 2;

			@media (max-width: 1200px) {
				grid-column: span 2;
			}

			@media (max-width: 900px) {
				grid-column: span 3;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.kpi_head {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				margin-bottom: var(--space-3);

				.kpi_label {
					font-size: var(--text-xs);
					color: var(--muted-fg);
					font-weight: var(--weight-medium);
				}
			}

			.kpi_value {
				font-size: var(--text-2xl);
				font-weight: var(--weight-bold);
				color: var(--foreground);
				line-height: 1;
				font-variant-numeric: tabular-nums;
				margin-bottom: var(--space-2);

				&.error {
					color: var(--danger);
				}
			}

			.kpi_delta {
				display: inline-flex;
				align-items: center;
				gap: 2px;
				padding: 2px 8px;
				border-radius: var(--radius-full);
				font-size: 11px;
				font-weight: var(--weight-semibold);
				font-variant-numeric: tabular-nums;
				background: color-mix(in srgb, var(--muted-fg) 15%, transparent);
				color: var(--muted-fg);
				width: fit-content;

				&.up {
					background: color-mix(in srgb, var(--success) 18%, transparent);
					color: var(--success);
				}
				&.down {
					background: color-mix(in srgb, var(--danger) 18%, transparent);
					color: var(--danger);
				}
			}

			.kpi_sub {
				font-size: 11px;
				color: var(--muted-fg);
			}
		}

		.kpi_icon {
			width: 32px;
			height: 32px;
			border-radius: var(--radius-md);
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;

			&.primary {
				color: var(--primary);
				background: color-mix(in srgb, var(--primary) 15%, transparent);
			}
			&.success {
				color: var(--success);
				background: color-mix(in srgb, var(--success) 15%, transparent);
			}
			&.info {
				color: var(--info);
				background: color-mix(in srgb, var(--info) 15%, transparent);
			}
			&.warning {
				color: var(--warning);
				background: color-mix(in srgb, var(--warning) 15%, transparent);
			}
			&.danger {
				color: var(--danger);
				background: color-mix(in srgb, var(--danger) 15%, transparent);
			}
			&.food {
				color: #fb923c;
				background: rgba(251, 146, 60, 0.14);
			}
			&.promo {
				color: #ec4899;
				background: rgba(236, 72, 153, 0.14);
			}
		}

		.chart_big {
			grid-column: span 12;
			min-height: 380px;

			@media (max-width: 1200px) {
				grid-column: span 6;
				min-height: 340px;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.chart_wrap {
				flex: 1;
				min-height: 280px;
				position: relative;
			}
		}

		.donut_tile {
			grid-column: span 4;
			min-height: 360px;

			@media (max-width: 1200px) {
				grid-column: span 6;
				min-height: 340px;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.chart_wrap {
				height: 220px;
				position: relative;
			}

			.donut_rows {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
				margin-top: var(--space-3);

				.donut_row {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					font-size: var(--text-sm);

					.dot {
						width: 10px;
						height: 10px;
						border-radius: 50%;
						flex-shrink: 0;

						&.online {
							background: rgba(168, 85, 247, 0.9);
						}
						&.offline {
							background: rgba(59, 130, 246, 0.9);
						}
						&.cancel {
							background: rgba(239, 68, 68, 0.9);
						}
					}

					.donut_label {
						flex: 1;
						color: var(--foreground-secondary);
					}

					.donut_value {
						font-weight: var(--weight-semibold);
						font-variant-numeric: tabular-nums;
					}
				}
			}
		}

		.peak_tile {
			grid-column: span 8;
			min-height: 360px;

			@media (max-width: 1200px) {
				grid-column: span 6;
				min-height: 320px;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.chart_wrap {
				flex: 1;
				min-height: 240px;
				position: relative;
			}
		}

		.dow_tile {
			grid-column: span 12;
			min-height: 260px;

			@media (max-width: 1200px) {
				grid-column: span 6;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.dow_chart {
				flex: 1;
				min-height: 200px;
				position: relative;
			}
		}

		.top_tile {
			grid-column: span 8;
			min-height: 400px;

			@media (max-width: 1200px) {
				grid-column: span 6;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.top_list {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);

				.top_row {
					display: grid;
					grid-template-columns: 36px minmax(120px, 2fr) 2fr auto auto;
					align-items: center;
					gap: var(--space-3);
					padding: var(--space-2) 0;
					border-bottom: 1px solid var(--border-color-subtle);
					font-size: var(--text-sm);

					&:last-child {
						border-bottom: none;
					}

					.top_rank {
						color: var(--primary-light);
						font-weight: var(--weight-bold);
						font-variant-numeric: tabular-nums;
					}

					.top_title {
						color: var(--foreground);
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
					}

					.top_bar_wrap {
						height: 8px;
						background: var(--neutral-800);
						border-radius: var(--radius-full);
						overflow: hidden;

						.top_bar {
							height: 100%;
							background: linear-gradient(
								90deg,
								var(--primary-700),
								var(--primary-400)
							);
							border-radius: var(--radius-full);
							transition: width var(--duration-slow) var(--ease-default);
						}
					}

					.top_bookings {
						color: var(--muted-fg);
						font-size: var(--text-xs);
						font-variant-numeric: tabular-nums;
						min-width: 60px;
						text-align: right;
					}

					.top_revenue {
						font-weight: var(--weight-semibold);
						color: var(--foreground);
						font-variant-numeric: tabular-nums;
						min-width: 80px;
						text-align: right;
					}
				}
			}
		}

		.side_stack {
			grid-column: span 4;
			padding: 0;
			background: transparent;
			border: none;
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
			min-height: 400px;

			@media (max-width: 1200px) {
				grid-column: span 6;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.side_card {
				padding: var(--space-5);
				flex: 1;
				display: flex;
				flex-direction: column;

				.side_head {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					margin-bottom: var(--space-3);

					.side_label {
						font-size: var(--text-sm);
						font-weight: var(--weight-semibold);
						color: var(--foreground);
					}
				}

				.side_rows {
					display: flex;
					flex-direction: column;
					gap: var(--space-2);

					.side_row {
						display: flex;
						justify-content: space-between;
						align-items: center;
						font-size: var(--text-sm);
						color: var(--muted-fg);

						b {
							color: var(--foreground);
							font-weight: var(--weight-semibold);
							font-variant-numeric: tabular-nums;
						}

						&.accent b {
							background: linear-gradient(45deg, #ffffff, var(--primary-400));
							-webkit-background-clip: text;
							background-clip: text;
							color: transparent;
							font-size: var(--text-lg);
						}
					}
				}
			}
		}

		.halls_tile {
			grid-column: span 12;

			@media (max-width: 1200px) {
				grid-column: span 6;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.hall_groups {
				display: flex;
				flex-direction: column;
				gap: var(--space-4);

				.hall_group {
					.hall_group_head {
						display: flex;
						justify-content: space-between;
						align-items: baseline;
						padding-bottom: var(--space-2);
						margin-bottom: var(--space-2);
						border-bottom: 1px solid var(--border-color-subtle);

						.cinema_name {
							font-size: var(--text-sm);
							font-weight: var(--weight-semibold);
							color: var(--foreground);
							text-transform: uppercase;
							letter-spacing: 0.04em;
						}

						.cinema_avg {
							font-size: var(--text-xs);
							color: var(--muted-fg);
							font-variant-numeric: tabular-nums;
						}
					}

					.hall_group_body {
						display: flex;
						flex-direction: column;
						gap: var(--space-1);

						.hall_row {
							display: grid;
							grid-template-columns:
								minmax(140px, 1.6fr) auto minmax(120px, 2fr)
								48px;
							align-items: center;
							gap: var(--space-3);

							.hall_meta_col {
								display: flex;
								flex-direction: column;
								gap: 1px;
								min-width: 0;

								.hall_name {
									font-size: var(--text-sm);
									color: var(--foreground);
									overflow: hidden;
									text-overflow: ellipsis;
									white-space: nowrap;
								}

								.hall_branch {
									font-size: 11px;
									color: var(--muted-fg);
								}
							}

							.hall_seats {
								font-size: var(--text-xs);
								color: var(--muted-fg);
								font-variant-numeric: tabular-nums;
							}

							.hall_bar_wrap {
								height: 8px;
								background: var(--neutral-800);
								border-radius: var(--radius-full);
								overflow: hidden;

								.hall_bar {
									height: 100%;
									border-radius: var(--radius-full);
									transition: width var(--duration-slow) var(--ease-default);
								}
							}

							.hall_percent {
								font-size: var(--text-sm);
								font-weight: var(--weight-semibold);
								text-align: right;
								font-variant-numeric: tabular-nums;
							}
						}
					}
				}
			}
		}

		.tile_head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-3);
			margin-bottom: var(--space-3);

			.tile_title {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				color: var(--primary-light);

				h3 {
					font-size: var(--text-base);
					font-weight: var(--weight-semibold);
					color: var(--foreground);
				}
			}

			.tile_meta {
				font-size: var(--text-xs);
				color: var(--muted-fg);
				padding: 3px 10px;
				border-radius: var(--radius-full);
				background: var(--neutral-800);
				font-variant-numeric: tabular-nums;
			}

			.tile_link {
				display: inline-flex;
				align-items: center;
				gap: var(--space-1);
				font-size: var(--text-xs);
				color: var(--muted-fg);
				transition: color var(--duration-fast) var(--ease-default);

				&:hover {
					color: var(--primary-light);
				}
			}
		}

		.skeleton_list {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
		}

		.muted {
			font-size: var(--text-sm);
			color: var(--muted-fg);
		}

		.error_text {
			color: var(--danger);
		}

		.empty_block {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: var(--space-2);
			padding: var(--space-6) 0;
			color: var(--muted-fg);
			text-align: center;
			flex: 1;

			.muted {
				margin: 0;
			}
		}
	}
</style>
