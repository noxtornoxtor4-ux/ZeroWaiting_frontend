<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { isAuthenticated } from '@/lib/stores/auth';
	import RatingStars from '@/components/ui/RatingStars.svelte';
	import Button from '@/components/ui/Button.svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';

	interface Props {
		movieId: string;
		onsaved: () => void;
	}

	let { movieId, onsaved }: Props = $props();

	let rating = $state(0);
	let comment = $state('');
	let loading = $state(false);

	const mutation = crmQueryApi.createPostMoviesByMovieIdReviewsV1Mutation();

	const handleSubmit = async () => {
		if (rating === 0) {
			toast.error('Выберите оценку');
			return;
		}

		loading = true;
		try {
			await mutation.mutateAsync({
				movieId,
				data: { rating, comment: comment || undefined }
			});
			toast.success('Отзыв отправлен');
			rating = 0;
			comment = '';
			onsaved();
		} catch (error) {
			toast.error(getErrorMessage(error, 'Ошибка отправки отзыва'));
		} finally {
			loading = false;
		}
	};
</script>

{#if $isAuthenticated}
	<div class="ReviewForm glass-card">
		<h4 class="title">{$_('movie.writeReview')}</h4>

		<div class="rating">
			<span class="label">{$_('movie.yourRating')}</span>
			<RatingStars
				{rating}
				interactive
				size={28}
				onrate={(v) => {
					rating = v;
				}}
			/>
		</div>

		<textarea
			class="textarea"
			placeholder={$_('movie.comment')}
			bind:value={comment}
			rows={3}
		></textarea>

		<div class="actions">
			<Button variant="primary" {loading} onclick={handleSubmit}>
				{$_('movie.submit')}
			</Button>
		</div>
	</div>
{/if}

<style lang="scss">
	.ReviewForm {
		padding: var(--space-5);

		.title {
			font-size: var(--text-base);
			font-weight: var(--weight-semibold);
			margin-bottom: var(--space-4);
		}

		.rating {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			margin-bottom: var(--space-4);
		}

		.label {
			font-size: var(--text-sm);
			color: var(--muted-fg);
		}

		.textarea {
			width: 100%;
			padding: var(--space-3);
			background: var(--surface);
			border: 1px solid var(--border-color);
			border-radius: var(--radius-md);
			color: var(--foreground);
			font-size: var(--text-sm);
			resize: vertical;
			outline: none;
			font-family: var(--font-sans);
			margin-bottom: var(--space-4);

			&::placeholder {
				color: var(--muted-fg);
			}

			&:focus {
				border-color: var(--primary);
				box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
			}
		}

		.actions {
			display: flex;
			justify-content: flex-end;
		}
	}
</style>
