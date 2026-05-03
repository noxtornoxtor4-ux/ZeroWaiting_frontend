<script lang="ts">
	import { _ } from 'svelte-i18n';
	import DateRangeFilter from '@/components/ui/DateRangeFilter.svelte';
	import {
		presetRange,
		matchPreset,
		type DatePreset
	} from '@/lib/utils/datetime';

	interface Props {
		dateFrom: string;
		dateTo: string;
		onchange?: (from: string, to: string) => void;
	}

	let {
		dateFrom = $bindable(''),
		dateTo = $bindable(''),
		onchange
	}: Props = $props();

	const activePreset = $derived(matchPreset(dateFrom, dateTo));

	const selectPreset = (kind: DatePreset) => {
		const r = presetRange(kind);
		dateFrom = r.dateFrom;
		dateTo = r.dateTo;
		onchange?.(r.dateFrom, r.dateTo);
	};

	const handleRangeChange = (from: string, to: string) => {
		if (!from || !to) {
			const r = presetRange('today');
			dateFrom = r.dateFrom;
			dateTo = r.dateTo;
			onchange?.(r.dateFrom, r.dateTo);
			return;
		}
		dateFrom = from;
		dateTo = to;
		onchange?.(from, to);
	};
</script>

<div class="ScheduleFilterBar">
	<div class="presets">
		<button
			type="button"
			class="preset"
			class:active={activePreset === 'yesterday'}
			onclick={() => selectPreset('yesterday')}
		>
			{$_('movie.schedule.yesterday')}
		</button>
		<button
			type="button"
			class="preset"
			class:active={activePreset === 'today'}
			onclick={() => selectPreset('today')}
		>
			{$_('movie.schedule.today')}
		</button>
		<button
			type="button"
			class="preset"
			class:active={activePreset === 'tomorrow'}
			onclick={() => selectPreset('tomorrow')}
		>
			{$_('movie.schedule.tomorrow')}
		</button>
	</div>

	<DateRangeFilter
		from={dateFrom}
		to={dateTo}
		labelFrom=""
		labelTo=""
		placeholder={$_('movie.schedule.customRange')}
		onchange={handleRangeChange}
	/>
</div>

<style lang="scss">
	.ScheduleFilterBar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-5);

		.presets {
			display: flex;
			gap: var(--space-2);
			flex-wrap: wrap;

			.preset {
				height: 38px;
				padding: 0 var(--space-4);
				background: rgba(255, 255, 255, 0.08);
				border: 1px solid rgba(139, 92, 246, 0.15);
				border-radius: 8px;
				color: rgba(255, 255, 255, 0.8);
				font-size: var(--text-sm);
				font-weight: var(--weight-medium);
				cursor: pointer;
				backdrop-filter: blur(10px);
				transition:
					background 0.15s,
					border-color 0.15s,
					color 0.15s,
					box-shadow 0.15s;

				&:hover {
					border-color: var(--primary);
					color: white;
				}

				&.active {
					background: linear-gradient(45deg, #8b5cf6, #a855f7);
					border-color: transparent;
					color: white;
					box-shadow: 0 4px 14px rgba(139, 92, 246, 0.3);
				}
			}
		}
	}

	@media (max-width: 640px) {
		.ScheduleFilterBar {
			flex-direction: column;
			align-items: stretch;

			.presets {
				overflow-x: auto;
				flex-wrap: nowrap;
				scrollbar-width: none;

				&::-webkit-scrollbar {
					display: none;
				}

				.preset {
					flex: 0 0 auto;
				}
			}
		}
	}
</style>
