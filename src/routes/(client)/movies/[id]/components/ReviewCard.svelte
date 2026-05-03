<script lang="ts">
	import type { ReviewEntity } from '@/api/model';
	import RatingStars from '@/components/ui/RatingStars.svelte';
	import { formatDateTime } from '@/lib/utils/datetime';

	interface Props {
		review: ReviewEntity;
	}

	let { review }: Props = $props();
</script>

<div class="ReviewCard glass-card">
	<div class="header">
		<div class="author">
			<div class="avatar">?</div>
			<div>
				<span class="name">Пользователь</span>
				<span class="date">{formatDateTime(review.createdAt)}</span>
			</div>
		</div>
		<RatingStars rating={review.rating} size={16} />
	</div>
	{#if review.comment}
		<p class="comment">{review.comment}</p>
	{/if}
</div>

<style lang="scss">
	.ReviewCard {
		padding: var(--space-4);

		.header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: var(--space-3);
		}

		.author {
			display: flex;
			align-items: center;
			gap: var(--space-3);
		}

		.avatar {
			width: 36px;
			height: 36px;
			border-radius: 50%;
			background: var(--primary-subtle);
			color: var(--primary-light);
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: var(--text-sm);
			font-weight: var(--weight-semibold);
		}

		.name {
			display: block;
			font-size: var(--text-sm);
			font-weight: var(--weight-medium);
			color: var(--foreground);
		}

		.date {
			display: block;
			font-size: var(--text-xs);
			color: var(--muted-fg);
		}

		.comment {
			font-size: var(--text-sm);
			color: var(--foreground-secondary);
			line-height: var(--leading-relaxed);
		}
	}
</style>
