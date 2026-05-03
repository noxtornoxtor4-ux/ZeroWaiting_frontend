<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Icon from '@iconify/svelte';
	import TicketTabsMaster from '@/components/booking/TicketTabsMaster.svelte';
	import TicketTabsIndividual from '@/components/booking/TicketTabsIndividual.svelte';

	interface Seat {
		row: number;
		seat: number;
		qrCode: string;
		status: string;
	}
	interface Props {
		viewerUrl: string;
		origin: string;
		seats: Seat[];
	}

	const { viewerUrl, origin, seats }: Props = $props();

	type Tab = 'master' | 'individual';
	let active = $state<Tab>('master');
</script>

<div class="ticket_viewer glass-card">
	<div class="tabs">
		<button class:active={active === 'master'} onclick={() => (active = 'master')}>
			<Icon icon="lucide:qr-code" width={16} />
			{$_('ticket.tabs.master')}
		</button>
		<button class:active={active === 'individual'} onclick={() => (active = 'individual')}>
			<Icon icon="lucide:layout-grid" width={16} />
			{$_('ticket.tabs.individual')}
		</button>
	</div>

	<div class="tab_content">
		{#if active === 'master'}
			<TicketTabsMaster {viewerUrl} {seats} />
		{:else}
			<TicketTabsIndividual {seats} {origin} />
		{/if}
	</div>
</div>

<style lang="scss">
	.ticket_viewer {
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);

		.tabs {
			display: flex;
			gap: var(--space-2);
			border-bottom: 1px solid var(--border-color);

			button {
				display: inline-flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-3) var(--space-4);
				background: transparent;
				border: 0;
				border-bottom: 2px solid transparent;
				color: var(--muted-fg);
				font-size: var(--text-sm);
				cursor: pointer;

				&.active {
					color: var(--primary-light);
					border-bottom-color: var(--primary);
				}
			}
		}

		.tab_content {
			display: flex;
			flex-direction: column;
		}
	}
</style>
