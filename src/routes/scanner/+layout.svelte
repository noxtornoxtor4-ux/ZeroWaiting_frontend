<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { UserRole } from '@/api/model';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';

	let { children } = $props();
</script>

<RoleGuard minRole={UserRole.STAFF} redirectTo="/">
	<div class="scanner_shell">
		<header class="scanner_header">
			<button
				type="button"
				class="back_button"
				onclick={() => goto('/')}
				aria-label={$_('common.back')}
			>
				←
			</button>
			<h1 class="scanner_title">{$_('scanner.title')}</h1>
		</header>
		<main class="scanner_main">
			{@render children()}
		</main>
	</div>
</RoleGuard>

<style lang="scss">
	.scanner_shell {
		min-height: 100dvh;
		background: #000;
		color: #fff;
		display: flex;
		flex-direction: column;
	}

	.scanner_header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: #0a0a10;

		.scanner_title {
			font-size: var(--text-base);
			margin: 0;
			font-weight: 500;
		}
	}

	.back_button {
		background: transparent;
		border: 0;
		color: inherit;
		font-size: 20px;
		line-height: 1;
		padding: var(--space-2);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);

		&:hover {
			background: rgba(255, 255, 255, 0.08);
		}
	}

	.scanner_main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
