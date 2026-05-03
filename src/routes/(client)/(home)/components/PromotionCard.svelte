<script lang="ts">
	import { locale } from 'svelte-i18n';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import Icon from '@iconify/svelte';

	interface Promotion {
		id: string;
		title: unknown;
		description?: unknown;
		imageUrl?: string | null;
	}

	interface Props {
		promotion: Promotion;
	}

	let { promotion }: Props = $props();
</script>

<div class="PromotionCard glass-card">
	{#if promotion.imageUrl}
		<img src={promotion.imageUrl} alt="" class="image" loading="lazy" />
	{:else}
		<div class="image_placeholder">
			<Icon icon="lucide:badge-percent" width={32} />
		</div>
	{/if}
	<div class="content">
		<h3 class="title">
			{getLocalizedValue(promotion.title as Record<string, string>, $locale)}
		</h3>
		{#if promotion.description}
			<p class="desc">
				{getLocalizedValue(
					promotion.description as Record<string, string>,
					$locale
				)}
			</p>
		{/if}
	</div>
</div>

<style lang="scss">
	.PromotionCard {
		overflow: hidden;
		transition: transform var(--duration-normal) var(--ease-default);
		will-change: transform;

		&:hover {
			transform: translateY(-2px);
		}

		.image {
			width: 100%;
			height: 180px;
			object-fit: cover;
		}

		.image_placeholder {
			width: 100%;
			height: 180px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--gradient-bg);
			color: var(--primary-light);
		}

		.content {
			padding: var(--space-4);
		}

		.title {
			font-size: var(--text-base);
			font-weight: var(--weight-semibold);
			color: var(--foreground);
		}

		.desc {
			font-size: var(--text-sm);
			color: var(--muted-fg);
			margin-top: var(--space-1);
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
	}
</style>
