<script lang="ts">
	import logo from '$lib/assets/logo.svg';

	let { children } = $props();
</script>

<div class="public_ticket_shell">
	<header class="public_ticket_header">
		<a href="/" class="logo_link">
			<img src={logo} alt="ZeroWaiting" width="120" />
		</a>
	</header>
	<main>
		{@render children()}
	</main>
</div>

<style lang="scss">
	.public_ticket_shell {
		min-height: 100vh;
		background: var(--background);
		color: var(--foreground);
		display: flex;
		flex-direction: column;
	}

	.public_ticket_header {
		padding: var(--space-4) var(--space-6);
		display: flex;
		justify-content: center;
		border-bottom: 1px solid var(--border-color);

		.logo_link {
			display: inline-flex;
			align-items: center;
		}
	}

	main {
		flex: 1;
		padding: var(--space-8) var(--space-4);
	}
</style>
