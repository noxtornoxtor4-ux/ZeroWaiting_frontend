<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import Icon from '@iconify/svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import { formatDateTime, formatTime, addMinutes } from '@/lib/utils/datetime';
	import type { ScreeningFormat } from '@/api/model';

	interface Props {
		posterUrl: string | null;
		movieTitle: string;
		ageRating: string;
		duration: number;
		branchName: string;
		hallName: string;
		startTime: string;
		format: ScreeningFormat;
	}

	const {
		posterUrl,
		movieTitle,
		ageRating,
		duration,
		branchName,
		hallName,
		startTime,
		format
	}: Props = $props();

	const localeTag = $derived($locale === 'en' ? 'en-US' : 'ru-RU');
	const startLabel = $derived(formatDateTime(startTime, localeTag));
	const endLabel = $derived(formatTime(addMinutes(startTime, duration), localeTag));
	const timeRange = $derived(
		$_('ticket.header.timeRange', { values: { start: startLabel, end: endLabel } })
	);
	const durationLabel = $derived($_('ticket.header.duration', { values: { n: duration } }));
	const formatLabel = $derived($_(`screening.format.${format}`));
</script>

<section class="ticket_screening_header glass-card">
	<div class="poster">
		{#if posterUrl}
			<img src={posterUrl} alt={movieTitle} loading="lazy" />
		{:else}
			<div class="poster_placeholder">
				<Icon icon="lucide:film" width={32} />
			</div>
		{/if}
	</div>

	<div class="info">
		<div class="title_row">
			<h2 class="title">{movieTitle}</h2>
			<Badge text={ageRating} color="var(--muted-fg)" />
		</div>

		<p class="meta_short">{durationLabel} · {formatLabel}</p>

		<p class="venue">
			<Icon icon="lucide:building-2" width={16} />
			<span>{branchName} · {hallName}</span>
		</p>
		<p class="time">
			<Icon icon="lucide:calendar" width={16} />
			<span>{timeRange}</span>
		</p>
	</div>
</section>

<style lang="scss">
	.ticket_screening_header {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-4);
		padding: var(--space-5);
		max-width: 640px;
		margin: 0 auto;

		.poster {
			width: 96px;
			height: 144px;
			border-radius: var(--radius-md);
			overflow: hidden;
			background: var(--surface);

			img {
				width: 100%;
				height: 100%;
				object-fit: cover;
				display: block;
			}

			.poster_placeholder {
				width: 100%;
				height: 100%;
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--muted-fg);
			}
		}

		.info {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			min-width: 0;

			.title_row {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				flex-wrap: wrap;

				.title {
					margin: 0;
					font-size: var(--text-xl);
					font-weight: var(--weight-bold);
					line-height: 1.2;
				}
			}

			.meta_short {
				margin: 0;
				color: var(--muted-fg);
				font-size: var(--text-sm);
			}

			.venue,
			.time {
				margin: 0;
				display: flex;
				align-items: center;
				gap: var(--space-2);
				color: var(--foreground);
				font-size: var(--text-sm);
			}
		}

		@media (max-width: 640px) {
			padding: var(--space-4);

			.poster {
				width: 72px;
				height: 108px;
			}

			.info .title_row .title {
				font-size: var(--text-lg);
			}
		}
	}
</style>
