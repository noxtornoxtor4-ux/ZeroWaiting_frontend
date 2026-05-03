<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		actions?: Snippet;
	}

	let { title, subtitle, actions }: Props = $props();
</script>

<div class="SectionHeader">
	<div class="text">
		<h2 class="title">{title}</h2>
		{#if subtitle}
			<p class="subtitle">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="actions">
			{@render actions()}
		</div>
	{/if}
</div>

<style lang="scss">
	.SectionHeader {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		margin-bottom: var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid rgba(168, 85, 247, 0.1);

		.text {
			.title {
				font-size: var(--text-4xl);
				font-weight: var(--weight-bold);
				background: linear-gradient(45deg, #ffffff, var(--primary-400));
				-webkit-background-clip: text;
				background-clip: text;
				color: transparent;
				line-height: var(--leading-tight);
			}

			.subtitle {
				font-size: var(--text-lg);
				color: rgba(255, 255, 255, 0.7);
				margin-top: var(--space-2);
			}
		}
	}

	@media (max-width: 640px) {
		.SectionHeader {
			flex-direction: column;
			align-items: flex-start;

			.text .title {
				font-size: var(--text-3xl);
			}
		}
	}
</style>
