<script lang="ts">
	import { onMount } from 'svelte';
	import { crmQueryApi } from '@/api/endpoints';
	import { UserRole } from '@/api/model';
	import { hasMinRole, ROLE_LABELS } from '@/lib/constants/roles';
	import { formatPriceCompact } from '@/lib/utils/price';
	import { toBackendInstant } from '@/lib/utils/datetime';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Icon from '@iconify/svelte';
	import {
		Chart,
		LineController,
		BarController,
		LineElement,
		BarElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Filler
	} from 'chart.js';

	Chart.register(
		LineController,
		BarController,
		LineElement,
		BarElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Filler
	);

	type Period = '7d' | '14d' | '30d';
	const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '14d': 14, '30d': 30 };
	const PERIOD_LABELS: Record<Period, string> = {
		'7d': '7 дней',
		'14d': '14 дней',
		'30d': '30 дней'
	};

	const table = useTableQuery<never, { period: Period }>({
		filters: { period: '7d' }
	});
	const period = $derived(table.filters.period);

	const profileQuery = crmQueryApi.createGetProfileMeV1();
	const user = $derived(profileQuery.data ?? null);
	const roleName = $derived(
		user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ''
	);
	const isManager = $derived(hasMinRole(user?.role, UserRole.MANAGER));

	const getDayKey = () => new Date().toDateString();
	let dayKey = $state(getDayKey());

	$effect(() => {
		const id = setInterval(() => {
			const next = getDayKey();
			if (next !== dayKey) dayKey = next;
		}, 60_000);
		return () => clearInterval(id);
	});

	const dayRange = $derived.by(() => {
		void dayKey;
		const now = new Date();
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const end = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
			23,
			59,
			59
		);
		return { from: toBackendInstant(start), to: toBackendInstant(end) };
	});

	const trendRange = $derived.by(() => {
		void dayKey;
		const now = new Date();
		const start = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() - (PERIOD_DAYS[period] - 1)
		);
		const end = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
			23,
			59,
			59
		);
		return { from: toBackendInstant(start), to: toBackendInstant(end) };
	});

	const summaryQuery = crmQueryApi.createGetSuperAdminAnalyticsSummaryV1(
		() => ({ dateFrom: dayRange.from, dateTo: dayRange.to }),
		() => ({ query: { enabled: isManager } })
	);
	const summary = $derived(summaryQuery.data);

	const revenueTrendQuery = crmQueryApi.createGetSuperAdminAnalyticsRevenueV1(
		() => ({ dateFrom: trendRange.from, dateTo: trendRange.to }),
		() => ({ query: { enabled: isManager } })
	);
	const revenueTrend = $derived(revenueTrendQuery.data);
	const daily = $derived(revenueTrend?.daily ?? []);

	const occupancyQuery = crmQueryApi.createGetSuperAdminAnalyticsOccupancyV1(
		() => ({ dateFrom: dayRange.from, dateTo: dayRange.to }),
		() => ({ query: { enabled: isManager } })
	);
	const occupancy = $derived(occupancyQuery.data ?? []);
	const sortedOccupancy = $derived(
		[...occupancy].sort((a, b) => b.occupancyRate - a.occupancyRate)
	);
	const avgOccupancy = $derived.by(() => {
		if (occupancy.length === 0) return 0;
		const total = occupancy.reduce((s, o) => s + o.occupancyRate, 0);
		return Math.round(total / occupancy.length);
	});

	const peakHoursQuery = crmQueryApi.createGetSuperAdminAnalyticsPeakHoursV1(
		() => ({ dateFrom: trendRange.from, dateTo: trendRange.to }),
		() => ({ query: { enabled: isManager } })
	);
	const peakHours = $derived(peakHoursQuery.data ?? []);

	const topMoviesQuery = crmQueryApi.createGetSuperAdminAnalyticsTopMoviesV1(
		() => ({ dateFrom: trendRange.from, dateTo: trendRange.to }),
		() => ({ query: { enabled: isManager } })
	);
	const topMovies = $derived(topMoviesQuery.data ?? []);
	const podium = $derived(topMovies.slice(0, 3));
	const runnersUp = $derived(topMovies.slice(3, 6));

	const screeningsQuery = crmQueryApi.createGetScreeningsV1(
		() => ({ limit: 1 }),
		() => ({ query: { enabled: isManager } })
	);
	const activeScreenings = $derived(screeningsQuery.data?.meta?.total ?? 0);

	const recentBookingsQuery = crmQueryApi.createGetBookingsV1(
		() => ({ limit: 8, sortBy: 'createdAt', sortOrder: 'desc' }),
		() => ({ query: { enabled: isManager } })
	);
	const recentBookings = $derived(recentBookingsQuery.data?.data ?? []);

	const BOOKING_STATUS_LABELS: Record<string, string> = {
		PENDING: 'Ожидание',
		CONFIRMED: 'Подтверждено',
		CANCELLED: 'Отменено',
		COMPLETED: 'Завершено',
		NO_SHOW: 'Неявка'
	};

	const BOOKING_STATUS_COLORS: Record<string, string> = {
		PENDING: 'var(--warning)',
		CONFIRMED: 'var(--success)',
		CANCELLED: 'var(--danger)',
		COMPLETED: 'var(--info)',
		NO_SHOW: 'var(--muted-fg)'
	};

	const bookingDelta = $derived.by(() => {
		if (daily.length < 2) return null;
		const last = daily[daily.length - 1]!.bookings;
		const prev = daily[daily.length - 2]!.bookings;
		if (prev === 0) return last > 0 ? 100 : 0;
		return Math.round(((last - prev) / prev) * 100);
	});

	const revenueDelta = $derived.by(() => {
		if (daily.length < 2) return null;
		const last = daily[daily.length - 1]!.revenue;
		const prev = daily[daily.length - 2]!.revenue;
		if (prev === 0) return last > 0 ? 100 : 0;
		return Math.round(((last - prev) / prev) * 100);
	});

	const formatDelta = (d: number | null) => {
		if (d === null) return '—';
		const sign = d > 0 ? '+' : '';
		return `${sign}${d}%`;
	};

	const formatHourLabel = (h: number) => `${h.toString().padStart(2, '0')}:00`;
	const formatDateLabel = (iso: string) => {
		const d = new Date(iso);
		return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
	};
	const formatRelativeTime = (iso: string) => {
		const d = new Date(iso);
		const diff = Date.now() - d.getTime();
		const min = Math.floor(diff / 60_000);
		if (min < 1) return 'сейчас';
		if (min < 60) return `${min} мин`;
		const hr = Math.floor(min / 60);
		if (hr < 24) return `${hr} ч`;
		const day = Math.floor(hr / 24);
		return `${day} д`;
	};

	const getCustomerInitial = (b: (typeof recentBookings)[number]) => {
		const name =
			b.user?.firstName ?? b.user?.email ?? b.guestName ?? b.guestEmail ?? '?';
		return name.trim().charAt(0).toUpperCase() || '?';
	};
	const getCustomerName = (b: (typeof recentBookings)[number]) => {
		if (b.user) {
			const full = [b.user.firstName, b.user.lastName]
				.filter(Boolean)
				.join(' ')
				.trim();
			return full || b.user.email || '—';
		}
		return b.guestName?.trim() || b.guestEmail || '—';
	};

	const medalMeta = [
		{ color: '#fbbf24', glow: 'rgba(251,191,36,0.35)', icon: 'lucide:crown' },
		{
			color: '#d1d5db',
			glow: 'rgba(209,213,219,0.25)',
			icon: 'lucide:medal'
		},
		{ color: '#c27b3f', glow: 'rgba(194,123,63,0.25)', icon: 'lucide:medal' }
	];

	let revenueCanvas = $state<HTMLCanvasElement | null>(null);
	let peakHoursCanvas = $state<HTMLCanvasElement | null>(null);
	let sparkBookingsCanvas = $state<HTMLCanvasElement | null>(null);
	let sparkRevenueCanvas = $state<HTMLCanvasElement | null>(null);
	let revenueChart: Chart | null = null;
	let peakHoursChart: Chart | null = null;
	let sparkBookingsChart: Chart | null = null;
	let sparkRevenueChart: Chart | null = null;

	const gridColor = 'rgba(45, 45, 61, 0.4)';
	const tickColor = '#9494a5';
	const accent = '#a855f7';
	const accentSoft = 'rgba(168, 85, 247, 0.15)';

	const buildGradient = (ctx: CanvasRenderingContext2D, h: number) => {
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, 'rgba(168, 85, 247, 0.45)');
		g.addColorStop(1, 'rgba(168, 85, 247, 0)');
		return g;
	};

	$effect(() => {
		if (!daily.length || !revenueCanvas) return;
		const ctx = revenueCanvas.getContext('2d');
		if (!ctx) return;
		revenueChart?.destroy();
		revenueChart = new Chart(revenueCanvas, {
			type: 'line',
			data: {
				labels: daily.map((d) => formatDateLabel(d.date)),
				datasets: [
					{
						label: 'Выручка',
						data: daily.map((d) => d.revenue),
						borderColor: accent,
						backgroundColor: buildGradient(ctx, revenueCanvas.height || 320),
						borderWidth: 2.5,
						fill: true,
						tension: 0.35,
						pointRadius: 0,
						pointHoverRadius: 5,
						pointHoverBackgroundColor: '#fff',
						pointHoverBorderColor: accent,
						pointHoverBorderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: 'rgba(26, 26, 38, 0.95)',
						borderColor: 'rgba(168, 85, 247, 0.3)',
						borderWidth: 1,
						padding: 12,
						titleColor: '#f8f8fb',
						bodyColor: '#f8f8fb',
						displayColors: false,
						callbacks: {
							label: (item) => formatPriceCompact(item.parsed.y ?? 0)
						}
					}
				},
				scales: {
					x: {
						ticks: { color: tickColor, font: { size: 11 } },
						grid: { display: false },
						border: { display: false }
					},
					y: {
						ticks: {
							color: tickColor,
							font: { size: 11 },
							callback: (v) => formatPriceCompact(Number(v))
						},
						grid: { color: gridColor },
						border: { display: false }
					}
				}
			}
		});
	});

	$effect(() => {
		if (!peakHours.length || !peakHoursCanvas) return;
		peakHoursChart?.destroy();
		peakHoursChart = new Chart(peakHoursCanvas, {
			type: 'bar',
			data: {
				labels: peakHours.map((h) => formatHourLabel(h.hour)),
				datasets: [
					{
						label: 'Бронирования',
						data: peakHours.map((h) => h.bookings),
						backgroundColor: accentSoft,
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
						padding: 10,
						displayColors: false
					}
				},
				scales: {
					x: {
						ticks: {
							color: tickColor,
							font: { size: 10 },
							maxRotation: 0,
							autoSkipPadding: 8
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

	const renderSparkline = (
		canvas: HTMLCanvasElement,
		data: number[],
		color: string
	) => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		const h = canvas.height || 48;
		const gradient = ctx.createLinearGradient(0, 0, 0, h);
		gradient.addColorStop(0, color.replace('1)', '0.35)'));
		gradient.addColorStop(1, color.replace('1)', '0)'));
		return new Chart(canvas, {
			type: 'line',
			data: {
				labels: data.map((_, i) => String(i)),
				datasets: [
					{
						data,
						borderColor: color,
						backgroundColor: gradient,
						borderWidth: 2,
						fill: true,
						tension: 0.4,
						pointRadius: 0
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false }, tooltip: { enabled: false } },
				scales: {
					x: { display: false },
					y: { display: false, beginAtZero: true }
				},
				elements: { line: { capBezierPoints: false } }
			}
		});
	};

	$effect(() => {
		if (!daily.length || !sparkBookingsCanvas) return;
		sparkBookingsChart?.destroy();
		sparkBookingsChart = renderSparkline(
			sparkBookingsCanvas,
			daily.map((d) => d.bookings),
			'rgba(168, 85, 247, 1)'
		);
	});

	$effect(() => {
		if (!daily.length || !sparkRevenueCanvas) return;
		sparkRevenueChart?.destroy();
		sparkRevenueChart = renderSparkline(
			sparkRevenueCanvas,
			daily.map((d) => d.revenue),
			'rgba(34, 197, 94, 1)'
		);
	});

	onMount(() => () => {
		revenueChart?.destroy();
		peakHoursChart?.destroy();
		sparkBookingsChart?.destroy();
		sparkRevenueChart?.destroy();
	});
</script>

<svelte:head>
	<title>Дашборд — ZeroWaiting Admin</title>
</svelte:head>

<div class="DashboardPage">
	<SectionHeader
		title="Дашборд"
		subtitle="Добро пожаловать, {user?.firstName ?? ''}! Роль: {roleName}"
	>
		{#snippet actions()}
			<div class="period_switcher">
				{#each ['7d', '14d', '30d'] as p (p)}
					<button
						type="button"
						class="period_btn"
						class:active={period === p}
						onclick={() => table.setFilter('period', p as Period)}
					>
						{PERIOD_LABELS[p as Period]}
					</button>
				{/each}
			</div>
		{/snippet}
	</SectionHeader>

	<div class="bento">
		<div class="tile kpi glass-card kpi_primary">
			<div class="kpi_head">
				<div class="kpi_icon primary">
					<Icon icon="lucide:ticket" width={20} aria-hidden="true" />
				</div>
				<span class="kpi_label">Бронирования сегодня</span>
			</div>
			<div class="kpi_row">
				{#if summaryQuery.isLoading}
					<Skeleton height="32px" width="70px" />
				{:else if summaryQuery.isError}
					<span class="kpi_value error">—</span>
				{:else}
					<span class="kpi_value">{summary?.totalBookings ?? 0}</span>
				{/if}
				{#if bookingDelta !== null}
					<span
						class="kpi_delta"
						class:up={bookingDelta > 0}
						class:down={bookingDelta < 0}
					>
						<Icon
							icon={bookingDelta >= 0
								? 'lucide:trending-up'
								: 'lucide:trending-down'}
							width={12}
							aria-hidden="true"
						/>
						{formatDelta(bookingDelta)}
					</span>
				{/if}
			</div>
			<div class="kpi_spark">
				{#if daily.length}
					<canvas bind:this={sparkBookingsCanvas}></canvas>
				{/if}
			</div>
		</div>

		<div class="tile kpi glass-card kpi_primary">
			<div class="kpi_head">
				<div class="kpi_icon success">
					<Icon icon="lucide:banknote" width={20} aria-hidden="true" />
				</div>
				<span class="kpi_label">Выручка сегодня</span>
			</div>
			<div class="kpi_row">
				{#if summaryQuery.isLoading}
					<Skeleton height="32px" width="90px" />
				{:else if summaryQuery.isError}
					<span class="kpi_value error">—</span>
				{:else}
					<span class="kpi_value"
						>{formatPriceCompact(summary?.totalRevenue ?? 0)}</span
					>
				{/if}
				{#if revenueDelta !== null}
					<span
						class="kpi_delta"
						class:up={revenueDelta > 0}
						class:down={revenueDelta < 0}
					>
						<Icon
							icon={revenueDelta >= 0
								? 'lucide:trending-up'
								: 'lucide:trending-down'}
							width={12}
							aria-hidden="true"
						/>
						{formatDelta(revenueDelta)}
					</span>
				{/if}
			</div>
			<div class="kpi_spark">
				{#if daily.length}
					<canvas bind:this={sparkRevenueCanvas}></canvas>
				{/if}
			</div>
		</div>

		<div class="tile kpi glass-card kpi_gauge">
			<div class="kpi_head">
				<div class="kpi_icon info">
					<Icon icon="lucide:armchair" width={20} aria-hidden="true" />
				</div>
				<span class="kpi_label">Средняя заполняемость</span>
			</div>
			<div class="gauge" style:--p={avgOccupancy}>
				{#if occupancyQuery.isLoading}
					<Skeleton height="64px" width="64px" />
				{:else if occupancyQuery.isError}
					<span class="kpi_value error">—</span>
				{:else}
					<div class="gauge_ring">
						<span class="gauge_value">{avgOccupancy}%</span>
					</div>
				{/if}
				<span class="kpi_sub">Среднее по залам</span>
			</div>
		</div>

		<div class="tile kpi glass-card kpi_simple">
			<div class="kpi_head">
				<div class="kpi_icon warning">
					<Icon icon="lucide:calendar-clock" width={20} aria-hidden="true" />
				</div>
				<span class="kpi_label">Активные сеансы</span>
			</div>
			<div class="kpi_big_row">
				{#if screeningsQuery.isLoading}
					<Skeleton height="44px" width="80px" />
				{:else if screeningsQuery.isError}
					<span class="kpi_big error">—</span>
				{:else}
					<span class="kpi_big">{activeScreenings}</span>
				{/if}
			</div>
			<a href="/admin/screenings" class="tile_cta">
				Перейти
				<Icon icon="lucide:arrow-right" width={14} aria-hidden="true" />
			</a>
		</div>

		<div class="tile revenue_chart glass-card">
			<div class="tile_head">
				<div class="tile_title">
					<Icon icon="lucide:trending-up" width={18} aria-hidden="true" />
					<h3>Выручка</h3>
				</div>
				<span class="tile_period">{PERIOD_LABELS[period]}</span>
			</div>
			{#if revenueTrendQuery.isLoading}
				<div class="chart_wrap"><Skeleton height="100%" /></div>
			{:else if revenueTrendQuery.isError}
				<p class="muted error_text">Не удалось загрузить тренд выручки</p>
			{:else if !daily.length}
				<p class="muted">Нет данных за период</p>
			{:else}
				<div class="chart_wrap">
					<canvas bind:this={revenueCanvas}></canvas>
				</div>
			{/if}
		</div>

		<div class="tile podium_tile glass-card">
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
					{#each Array(5) as _}
						<Skeleton height="40px" />
					{/each}
				</div>
			{:else if topMoviesQuery.isError}
				<p class="muted error_text">Не удалось загрузить топ</p>
			{:else if podium.length === 0}
				<div class="empty_block">
					<Icon icon="lucide:film" width={28} aria-hidden="true" />
					<p class="muted">Нет данных за период</p>
				</div>
			{:else}
				<div class="podium">
					{#each podium as movie, i}
						{@const meta = medalMeta[i]!}
						<div
							class="podium_row"
							style:--medal={meta.color}
							style:--glow={meta.glow}
						>
							<div class="medal">
								<Icon icon={meta.icon} width={18} aria-hidden="true" />
								<span class="medal_rank">{i + 1}</span>
							</div>
							<div class="podium_info">
								<span class="podium_title"
									>{movie.title?.ru ?? movie.movieId}</span
								>
								<span class="podium_meta">
									{movie.bookings} бр.
								</span>
							</div>
							<span class="podium_revenue"
								>{formatPriceCompact(movie.revenue)}</span
							>
						</div>
					{/each}
				</div>
				{#if runnersUp.length > 0}
					<div class="runners">
						{#each runnersUp as movie, i}
							<div class="runner_row">
								<span class="runner_rank">#{i + 4}</span>
								<span class="runner_title"
									>{movie.title?.ru ?? movie.movieId}</span
								>
								<span class="runner_revenue"
									>{formatPriceCompact(movie.revenue)}</span
								>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<div class="tile peak_tile glass-card">
			<div class="tile_head">
				<div class="tile_title">
					<Icon icon="lucide:clock" width={18} aria-hidden="true" />
					<h3>Пиковые часы</h3>
				</div>
				<span class="tile_period">{PERIOD_LABELS[period]}</span>
			</div>
			{#if peakHoursQuery.isLoading}
				<div class="chart_wrap"><Skeleton height="100%" /></div>
			{:else if peakHoursQuery.isError}
				<p class="muted error_text">Не удалось загрузить часы</p>
			{:else if !peakHours.length}
				<p class="muted">Нет данных за период</p>
			{:else}
				<div class="chart_wrap">
					<canvas bind:this={peakHoursCanvas}></canvas>
				</div>
			{/if}
		</div>

		<div class="tile occupancy_tile glass-card">
			<div class="tile_head">
				<div class="tile_title">
					<Icon icon="lucide:layout-grid" width={18} aria-hidden="true" />
					<h3>Залы сегодня</h3>
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
				<p class="muted error_text">Не удалось загрузить залы</p>
			{:else if sortedOccupancy.length === 0}
				<div class="empty_block">
					<Icon icon="lucide:armchair" width={28} aria-hidden="true" />
					<p class="muted">Нет сеансов сегодня</p>
				</div>
			{:else}
				<div class="hall_list">
					{#each sortedOccupancy.slice(0, 6) as hall}
						{@const rate = Math.min(hall.occupancyRate, 100)}
						{@const bandColor =
							rate >= 80
								? 'var(--success)'
								: rate >= 50
									? 'var(--warning)'
									: 'var(--danger)'}
						<div class="hall_row">
							<div class="hall_main">
								<span class="hall_name">{hall.hallName}</span>
								<span class="hall_meta"
									>{hall.bookedSeats}/{hall.totalSeats}</span
								>
							</div>
							<div class="hall_bar_wrap">
								<div
									class="hall_bar"
									style:width="{rate}%"
									style:background={bandColor}
								></div>
							</div>
							<span class="hall_percent" style:color={bandColor}
								>{rate.toFixed(0)}%</span
							>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="tile feed_tile glass-card">
			<div class="tile_head">
				<div class="tile_title">
					<Icon icon="lucide:activity" width={18} aria-hidden="true" />
					<h3>Лента бронирований</h3>
				</div>
				<a href="/admin/bookings" class="tile_link">
					Все
					<Icon icon="lucide:arrow-right" width={14} aria-hidden="true" />
				</a>
			</div>
			{#if recentBookingsQuery.isLoading}
				<div class="skeleton_list">
					{#each Array(6) as _}
						<Skeleton height="44px" />
					{/each}
				</div>
			{:else if recentBookingsQuery.isError}
				<p class="muted error_text">Не удалось загрузить ленту</p>
			{:else if recentBookings.length === 0}
				<div class="empty_block">
					<Icon icon="lucide:inbox" width={28} aria-hidden="true" />
					<p class="muted">Нет новых бронирований</p>
				</div>
			{:else}
				<div class="feed">
					{#each recentBookings as booking}
						{@const color =
							BOOKING_STATUS_COLORS[booking.status] ?? 'var(--muted-fg)'}
						<div class="feed_row" style:--status-color={color}>
							<div class="feed_avatar">{getCustomerInitial(booking)}</div>
							<div class="feed_main">
								<span class="feed_name">{getCustomerName(booking)}</span>
								<span class="feed_status" style:color>
									{BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
								</span>
							</div>
							<div class="feed_meta">
								<span class="feed_price"
									>{formatPriceCompact(booking.totalPrice)}</span
								>
								<span class="feed_time"
									>{formatRelativeTime(booking.createdAt)}</span
								>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	.period_switcher {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 4px;
		background: color-mix(in srgb, var(--surface) 60%, transparent);
		border: 1px solid var(--border-color-subtle);
		border-radius: var(--radius-full);

		.period_btn {
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

	.DashboardPage {
		.bento {
			display: grid;
			grid-template-columns: repeat(12, 1fr);
			grid-auto-rows: minmax(0, auto);
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

			&::before {
				content: '';
				position: absolute;
				inset: 0;
				background: radial-gradient(
					circle at top right,
					rgba(168, 85, 247, 0.08),
					transparent 60%
				);
				pointer-events: none;
				opacity: 0;
				transition: opacity var(--duration-normal) var(--ease-default);
			}

			&:hover::before {
				opacity: 1;
			}
		}

		.kpi {
			grid-column: span 3;

			@media (max-width: 1200px) {
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

				.kpi_icon {
					width: 36px;
					height: 36px;
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
				}

				.kpi_label {
					font-size: var(--text-xs);
					color: var(--muted-fg);
					font-weight: var(--weight-medium);
				}
			}

			.kpi_row {
				display: flex;
				align-items: baseline;
				gap: var(--space-2);
				flex-wrap: wrap;
				margin-bottom: var(--space-2);

				.kpi_value {
					font-size: var(--text-3xl);
					font-weight: var(--weight-bold);
					color: var(--foreground);
					line-height: 1;
					font-variant-numeric: tabular-nums;

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
					font-size: var(--text-xs);
					font-weight: var(--weight-semibold);
					font-variant-numeric: tabular-nums;
					background: color-mix(in srgb, var(--muted-fg) 15%, transparent);
					color: var(--muted-fg);

					&.up {
						background: color-mix(in srgb, var(--success) 18%, transparent);
						color: var(--success);
					}
					&.down {
						background: color-mix(in srgb, var(--danger) 18%, transparent);
						color: var(--danger);
					}
				}
			}

			.kpi_spark {
				height: 44px;
				margin-top: auto;
			}
		}

		.kpi_gauge {
			.gauge {
				display: flex;
				align-items: center;
				gap: var(--space-4);
				margin-top: auto;

				.gauge_ring {
					--size: 76px;
					--thick: 9px;
					position: relative;
					width: var(--size);
					height: var(--size);
					border-radius: 50%;
					background: conic-gradient(
						from -90deg,
						var(--primary-500) calc(var(--p) * 1%),
						var(--neutral-800) 0
					);
					display: flex;
					align-items: center;
					justify-content: center;
					box-shadow: 0 0 22px rgba(168, 85, 247, 0.18);

					&::before {
						content: '';
						position: absolute;
						inset: var(--thick);
						border-radius: 50%;
						background: var(--neutral-900);
					}

					.gauge_value {
						position: relative;
						font-size: var(--text-base);
						font-weight: var(--weight-bold);
						color: var(--foreground);
						font-variant-numeric: tabular-nums;
					}
				}

				.kpi_sub {
					font-size: var(--text-xs);
					color: var(--muted-fg);
				}
			}
		}

		.kpi_simple {
			.kpi_big_row {
				margin-top: auto;
				margin-bottom: var(--space-3);

				.kpi_big {
					font-size: var(--text-4xl);
					font-weight: var(--weight-extrabold);
					background: linear-gradient(135deg, #fff, var(--primary-400));
					-webkit-background-clip: text;
					background-clip: text;
					color: transparent;
					line-height: 1;
					font-variant-numeric: tabular-nums;

					&.error {
						background: none;
						color: var(--danger);
					}
				}
			}

			.tile_cta {
				display: inline-flex;
				align-items: center;
				gap: var(--space-1);
				align-self: flex-start;
				padding: 6px 12px;
				border-radius: var(--radius-full);
				font-size: var(--text-xs);
				font-weight: var(--weight-medium);
				color: var(--primary-light);
				background: color-mix(in srgb, var(--primary) 10%, transparent);
				transition: background var(--duration-fast) var(--ease-default);

				&:hover {
					background: color-mix(in srgb, var(--primary) 20%, transparent);
				}
			}
		}

		.revenue_chart {
			grid-column: span 8;
			grid-row: span 2;
			min-height: 360px;

			@media (max-width: 1200px) {
				grid-column: span 6;
				grid-row: span 1;
				min-height: 320px;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.chart_wrap {
				flex: 1;
				min-height: 260px;
				position: relative;
			}
		}

		.podium_tile {
			grid-column: span 4;
			grid-row: span 2;
			min-height: 360px;

			@media (max-width: 1200px) {
				grid-column: span 6;
				grid-row: span 1;
				min-height: 320px;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.podium {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
				margin-bottom: var(--space-3);

				.podium_row {
					display: flex;
					align-items: center;
					gap: var(--space-3);
					padding: var(--space-3);
					border-radius: var(--radius-lg);
					background: linear-gradient(
						135deg,
						color-mix(in srgb, var(--medal) 12%, transparent),
						transparent 90%
					);
					border: 1px solid color-mix(in srgb, var(--medal) 20%, transparent);
					transition: transform var(--duration-fast) var(--ease-default);

					&:hover {
						transform: translateX(4px);
					}

					.medal {
						position: relative;
						width: 40px;
						height: 40px;
						border-radius: 50%;
						background: linear-gradient(
							135deg,
							var(--medal),
							color-mix(in srgb, var(--medal) 60%, #000)
						);
						display: flex;
						align-items: center;
						justify-content: center;
						color: #1a1a26;
						box-shadow: 0 0 20px var(--glow);
						flex-shrink: 0;

						.medal_rank {
							position: absolute;
							right: -2px;
							bottom: -2px;
							width: 16px;
							height: 16px;
							border-radius: 50%;
							background: var(--neutral-900);
							color: var(--foreground);
							font-size: 10px;
							font-weight: var(--weight-bold);
							display: flex;
							align-items: center;
							justify-content: center;
							border: 1px solid var(--medal);
						}
					}

					.podium_info {
						display: flex;
						flex-direction: column;
						gap: 2px;
						flex: 1;
						min-width: 0;

						.podium_title {
							font-size: var(--text-sm);
							font-weight: var(--weight-semibold);
							color: var(--foreground);
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;
						}

						.podium_meta {
							font-size: var(--text-xs);
							color: var(--muted-fg);
						}
					}

					.podium_revenue {
						font-size: var(--text-sm);
						font-weight: var(--weight-bold);
						color: var(--foreground);
						font-variant-numeric: tabular-nums;
					}
				}
			}

			.runners {
				display: flex;
				flex-direction: column;
				gap: 2px;
				padding-top: var(--space-2);
				border-top: 1px dashed var(--border-color-subtle);

				.runner_row {
					display: flex;
					align-items: center;
					gap: var(--space-3);
					padding: var(--space-2) 0;
					font-size: var(--text-xs);

					.runner_rank {
						color: var(--muted-fg);
						font-weight: var(--weight-semibold);
						min-width: 24px;
						font-variant-numeric: tabular-nums;
					}

					.runner_title {
						flex: 1;
						color: var(--foreground-secondary);
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
					}

					.runner_revenue {
						color: var(--muted-fg);
						font-variant-numeric: tabular-nums;
					}
				}
			}
		}

		.peak_tile {
			grid-column: span 4;
			min-height: 260px;

			@media (max-width: 1200px) {
				grid-column: span 6;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.chart_wrap {
				flex: 1;
				min-height: 180px;
				position: relative;
			}
		}

		.occupancy_tile {
			grid-column: span 4;
			min-height: 260px;

			@media (max-width: 1200px) {
				grid-column: span 6;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.hall_list {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);

				.hall_row {
					display: grid;
					grid-template-columns: minmax(80px, 1fr) minmax(80px, 2fr) 48px;
					align-items: center;
					gap: var(--space-3);

					.hall_main {
						display: flex;
						flex-direction: column;
						gap: 2px;
						min-width: 0;

						.hall_name {
							font-size: var(--text-sm);
							color: var(--foreground);
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}

						.hall_meta {
							font-size: var(--text-xs);
							color: var(--muted-fg);
							font-variant-numeric: tabular-nums;
						}
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

		.feed_tile {
			grid-column: span 4;
			min-height: 260px;

			@media (max-width: 1200px) {
				grid-column: span 6;
			}

			@media (max-width: 640px) {
				grid-column: span 1;
			}

			.feed {
				display: flex;
				flex-direction: column;
				gap: 2px;

				.feed_row {
					display: flex;
					align-items: center;
					gap: var(--space-3);
					padding: var(--space-2) var(--space-3);
					border-radius: var(--radius-md);
					border-left: 2px solid var(--status-color);
					background: color-mix(in srgb, var(--status-color) 6%, transparent);
					transition: background var(--duration-fast) var(--ease-default);

					&:hover {
						background: color-mix(
							in srgb,
							var(--status-color) 12%,
							transparent
						);
					}

					.feed_avatar {
						width: 32px;
						height: 32px;
						border-radius: 50%;
						background: linear-gradient(
							135deg,
							var(--primary-600),
							var(--primary-500)
						);
						color: #fff;
						font-size: var(--text-xs);
						font-weight: var(--weight-bold);
						display: flex;
						align-items: center;
						justify-content: center;
						flex-shrink: 0;
						box-shadow: 0 0 12px rgba(168, 85, 247, 0.25);
					}

					.feed_main {
						flex: 1;
						min-width: 0;
						display: flex;
						flex-direction: column;
						gap: 1px;

						.feed_name {
							font-size: var(--text-sm);
							color: var(--foreground);
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}

						.feed_status {
							font-size: var(--text-xs);
							font-weight: var(--weight-medium);
						}
					}

					.feed_meta {
						display: flex;
						flex-direction: column;
						align-items: flex-end;
						gap: 1px;
						flex-shrink: 0;

						.feed_price {
							font-size: var(--text-sm);
							font-weight: var(--weight-semibold);
							color: var(--foreground);
							font-variant-numeric: tabular-nums;
						}

						.feed_time {
							font-size: 11px;
							color: var(--muted-fg);
							font-variant-numeric: tabular-nums;
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

			.tile_period {
				font-size: var(--text-xs);
				color: var(--muted-fg);
				padding: 3px 10px;
				border-radius: var(--radius-full);
				background: var(--neutral-800);
				font-weight: var(--weight-medium);
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

			.muted {
				margin: 0;
			}
		}
	}
</style>
