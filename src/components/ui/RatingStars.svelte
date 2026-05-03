<script lang="ts">
	import Icon from '@iconify/svelte';

	interface Props {
		rating: number;
		max?: number;
		size?: number;
		interactive?: boolean;
		onrate?: (value: number) => void;
	}

	let {
		rating = 0,
		max = 5,
		size = 18,
		interactive = false,
		onrate
	}: Props = $props();

	let hoverValue = $state(0);

	const getIcon = (index: number): string => {
		const value = interactive && hoverValue > 0 ? hoverValue : rating;
		if (index <= value) return 'lucide:star';
		if (index - 0.5 <= value) return 'lucide:star-half';
		return 'lucide:star';
	};
</script>

<div class="RatingStars" class:interactive>
	{#each Array.from({ length: max }, (_, i) => i + 1) as index}
		{#if interactive}
			<button
				class="star"
				onmouseenter={() => {
					hoverValue = index;
				}}
				onmouseleave={() => {
					hoverValue = 0;
				}}
				onclick={() => onrate?.(index)}
				aria-label="Оценка {index}"
			>
				<Icon icon={getIcon(index)} width={size} />
			</button>
		{:else}
			<span class="star">
				<Icon icon={getIcon(index)} width={size} />
			</span>
		{/if}
	{/each}
</div>

<style lang="scss">
	.RatingStars {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		color: var(--warning);

		&.interactive {
			.star {
				cursor: pointer;
				transition: transform var(--duration-fast) var(--ease-default);

				&:hover {
					transform: scale(1.2);
				}
			}
		}

		.star {
			display: flex;
			align-items: center;
		}
	}
</style>
