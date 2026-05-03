<script lang="ts">
	interface Props {
		text: string;
		color?: string;
		variant?: 'filled' | 'outline' | 'subtle';
		size?: 'sm' | 'md';
	}

	let {
		text,
		color = 'var(--primary)',
		variant = 'subtle',
		size = 'sm'
	}: Props = $props();
</script>

<span class="badge badge--{variant} badge--{size}" style:--badge-color={color}>
	{text}
</span>

<style lang="scss">
	.badge {
		display: inline-flex;
		align-items: center;
		border-radius: var(--radius-full);
		font-weight: var(--weight-medium);
		white-space: nowrap;

		&--sm {
			padding: 2px var(--space-2);
			font-size: var(--text-xs);
		}

		&--md {
			padding: var(--space-1) var(--space-3);
			font-size: var(--text-sm);
		}

		&--filled {
			background: var(--badge-color);
			color: white;
		}

		&--outline {
			border: 1px solid var(--badge-color);
			color: var(--badge-color);
		}

		&--subtle {
			background: color-mix(in srgb, var(--badge-color) 15%, transparent);
			color: var(--badge-color);
		}
	}
</style>
