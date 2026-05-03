<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';

	interface Props {
		url: string;
		title?: string;
		text?: string;
		iconOnly?: boolean;
	}

	const { url, title, text, iconOnly = false }: Props = $props();

	const handleShare = async () => {
		if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
			try {
				await navigator.share({ url, title, text });
				return;
			} catch (e) {
				if ((e as Error).name === 'AbortError') return;
			}
		}
		try {
			await navigator.clipboard.writeText(url);
			toast.success($_('ticket.shareCopied'));
		} catch {
			toast.error($_('scanner.errors.network'));
		}
	};
</script>

<button type="button" class="share_btn" class:icon_only={iconOnly} onclick={handleShare} aria-label={$_('ticket.share')}>
	<Icon icon="lucide:share-2" width={iconOnly ? 18 : 16} />
	{#if !iconOnly}<span>{$_('ticket.share')}</span>{/if}
</button>

<style lang="scss">
	.share_btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		background: transparent;
		color: var(--foreground);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: border-color var(--duration-fast) var(--ease-default);

		&:hover { border-color: var(--primary); color: var(--primary-light); }

		&.icon_only {
			padding: var(--space-2);
			border-radius: 50%;
		}
	}
</style>
