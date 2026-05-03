<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		icon?: string;
		title: string;
		description?: string;
		actions?: Snippet;
	}

	let { icon = 'lucide:inbox', title, description, actions }: Props = $props();
</script>

<div class="EmptyState">
	<div class="icon">
		<Icon {icon} width={48} />
	</div>
	<h3 class="title">{title}</h3>
	{#if description}
		<p class="description">{description}</p>
	{/if}
	{#if actions}
		<div class="actions">
			{@render actions()}
		</div>
	{/if}
</div>

<style lang="scss">
	.EmptyState {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-12) var(--space-6);
		text-align: center;

		.icon {
			color: var(--muted-fg);
			margin-bottom: var(--space-4);
			opacity: 0.5;
		}

		.title {
			font-size: var(--text-lg);
			font-weight: var(--weight-semibold);
			color: var(--foreground);
			margin-bottom: var(--space-2);
		}

		.description {
			font-size: var(--text-sm);
			color: var(--muted-fg);
			max-width: 400px;
		}

		.actions {
			margin-top: var(--space-5);
		}
	}
</style>
