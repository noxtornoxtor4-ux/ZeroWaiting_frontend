<script lang="ts">
	import { page } from '$app/state';
	import Button from '@/components/ui/Button.svelte';
	import Icon from '@iconify/svelte';
</script>

<div class="error_page">
	<div class="content">
		<span class="icon">
			<Icon icon="lucide:alert-circle" width={64} />
		</span>
		<h1 class="code">{page.status}</h1>
		<p class="message">
			{page.error?.message ?? 'Страница не найдена'}
		</p>
		<div class="actions">
			<Button href="/" variant="primary" icon="lucide:home">На главную</Button>
		</div>
	</div>
</div>

<style lang="scss">
	.error_page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-5);

		.content {
			text-align: center;
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: var(--space-3);
		}

		.icon {
			color: var(--muted-fg);
			opacity: 0.5;
		}

		.code {
			font-size: var(--text-6xl);
			font-weight: var(--weight-bold);
			color: var(--foreground);
			line-height: 1;
		}

		.message {
			font-size: var(--text-lg);
			color: var(--muted-fg);
		}

		.actions {
			margin-top: var(--space-4);
		}
	}
</style>
