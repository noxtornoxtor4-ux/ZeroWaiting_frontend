<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { formatSeatsSummary } from '@/lib/utils/seat-label';

	interface SeatLike {
		rowNumber: number;
		seatNumber: number;
	}
	interface BookingSeatLike {
		seat?: SeatLike;
	}

	interface Props {
		seats: BookingSeatLike[];
	}
	const { seats }: Props = $props();

	const flat = $derived(
		seats
			.map((bs) => bs.seat)
			.filter((s): s is SeatLike => !!s)
			.map((s) => ({ row: s.rowNumber, seat: s.seatNumber }))
	);

	const lines = $derived(formatSeatsSummary(flat, $_).split('\n').filter(Boolean));
</script>

<div class="seats_summary">
	{#each lines as line}
		<span class="seats_summary_row">{line}</span>
	{/each}
</div>

<style lang="scss">
	.seats_summary {
		display: flex;
		flex-direction: column;
		gap: 4px;

		.seats_summary_row {
			color: var(--foreground);
			font-weight: 500;
		}
	}
</style>
