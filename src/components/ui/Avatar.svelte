<script lang="ts">
	interface Props {
		src?: string | null;
		initials?: string;
		size?: number;
		alt?: string;
	}

	let { src, initials = '', size = 32, alt = '' }: Props = $props();
	let failed = $state(false);

	$effect(() => {
		void src;
		failed = false;
	});

	const fontSize = $derived(Math.max(10, Math.round(size * 0.38)));
</script>

<span
	class="Avatar"
	style:width="{size}px"
	style:height="{size}px"
	style:font-size="{fontSize}px"
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
	.Avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		background: var(--primary-subtle);
		color: var(--primary-light);

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		.initials {
			font-weight: var(--weight-semibold);
			text-transform: uppercase;
			line-height: 1;
		}
	}
</style>
