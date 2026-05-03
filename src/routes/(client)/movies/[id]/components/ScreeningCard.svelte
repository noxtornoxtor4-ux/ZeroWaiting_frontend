<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import {
		formatTime,
		formatShortDate,
		formatWeekday
	} from '@/lib/utils/datetime';
	import { formatPriceCompact } from '@/lib/utils/price';
	import Badge from '@/components/ui/Badge.svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		screening: {
			id?: string;
			startTime?: string;
			price?: number | string;
			format?: string;
			hall?: {
				name?: string;
				type?: string;
				branch?: {
					name?: unknown;
				};
			};
		};
	}

	let { screening }: Props = $props();

	const branchName = $derived(
		screening.hall?.branch?.name
			? getLocalizedValue(
					screening.hall.branch.name as Record<string, string>,
					$locale
				)
			: ''
	);

	const FORMAT_LABELS: Record<string, string> = {
		TWO_D: '2D',
		THREE_D: '3D',
		IMAX: 'IMAX',
		DOLBY_ATMOS: 'Dolby Atmos',
		FOUR_DX: '4DX'
	};
</script>

{#if screening.id && screening.startTime}
	<a href="/screenings/{screening.id}" class="ScreeningCard glass-card">
		<div class="time">
			<span class="hour">{formatTime(screening.startTime)}</span>
			<span class="date">
				{formatWeekday(screening.startTime)}, {formatShortDate(
					screening.startTime
				)}
			</span>
		</div>

		<div class="details">
			{#if branchName}
				<span class="branch">
					<Icon icon="lucide:map-pin" width={14} />
					{branchName}
				</span>
			{/if}

			<div class="tags">
				{#if screening.format}
					<Badge
						text={FORMAT_LABELS[screening.format] ?? screening.format}
						color="var(--info)"
					/>
				{/if}
				{#if screening.hall?.type}
					<Badge
						text={$_(`common.hallType.${screening.hall.type}`)}
						color="var(--muted-fg)"
						variant="outline"
					/>
				{/if}
			</div>
		</div>

		<div class="price">
			{#if screening.price}
				<span class="price_value">{formatPriceCompact(screening.price)}</span>
			{/if}
			<Icon icon="lucide:chevron-right" width={18} />
		</div>
	</a>
{/if}

<style lang="scss">
	.ScreeningCard {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-4);
		cursor: pointer;

		&:hover {
			border-color: var(--primary);
		}

		.time {
			display: flex;
			flex-direction: column;
			align-items: center;
			min-width: 80px;
		}

		.hour {
			font-size: var(--text-xl);
			font-weight: var(--weight-bold);
			color: var(--primary-light);
		}

		.date {
			font-size: var(--text-xs);
			color: var(--muted-fg);
		}

		.details {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
		}

		.branch {
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: var(--text-sm);
			color: var(--foreground-secondary);
		}

		.tags {
			display: flex;
			gap: var(--space-2);
		}

		.price {
			display: flex;
			align-items: center;
			gap: var(--space-2);
			color: var(--muted-fg);
		}

		.price_value {
			font-size: var(--text-base);
			font-weight: var(--weight-semibold);
			color: var(--foreground);
		}
	}
</style>
