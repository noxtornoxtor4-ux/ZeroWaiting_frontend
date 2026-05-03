<script lang="ts">
	interface Props {
		src?: string | null;
		initials?: string;
		size?: number;
		alt?: string;
		interactive?: boolean;
	}

	let {
		src,
		initials = '',
		size = 36,
		alt = '',
		interactive = false
	}: Props = $props();

	let failed = $state(false);

	$effect(() => {
		void src;
		failed = false;
	});

	const fontSize = $derived(Math.max(10, Math.round(size * 0.33)));
	const fontWeight = $derived(interactive ? 600 : 700);
</script>

<span
	class="HeaderAvatar"
	class:interactive
	style:width="{size}px"
	style:height="{size}px"
	style:font-size="{fontSize}px"
	style:font-weight={fontWeight}
>
	{#if src && !failed}
		<img
			{src}
			{alt}
			referrerpolicy="no-referrer"
			onerror={() => (failed = true)}
		/>
	{:else if initials}
		<span class="initials">{initials}</span>
	{/if}
</span>

<style lang="scss">
	.HeaderAvatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		overflow: hidden;
		background: var(--primary-subtle);
		border: 2px solid var(--primary);
		flex-shrink: 0;

		&.interactive {
			border-color: transparent;
			cursor: pointer;
			transition: border-color 0.2s ease;

			&:hover {
				border-color: var(--primary);
			}
		}

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		.initials {
			color: var(--primary-light);
			text-transform: uppercase;
			line-height: 1;
		}
	}
</style>
