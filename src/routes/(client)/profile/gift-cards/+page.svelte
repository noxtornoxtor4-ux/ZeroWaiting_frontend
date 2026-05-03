<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { formatPriceCompact } from '@/lib/utils/price';
	import { formatDate } from '@/lib/utils/datetime';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import EmptyState from '@/components/ui/EmptyState.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Icon from '@iconify/svelte';

	const giftCardsQuery = crmQueryApi.createGetProfileMeGiftCardsV1();
	const giftCards = $derived(giftCardsQuery.data ?? []);

	const STATUS_COLORS: Record<string, string> = {
		ACTIVE: 'var(--success)',
		PARTIALLY_USED: 'var(--warning)',
		FULLY_USED: 'var(--muted-fg)',
		EXPIRED: 'var(--danger)'
	};
</script>

<svelte:head>
	<title>{$_('profile.giftCards')} — ZeroWaiting</title>
</svelte:head>

<div class="GiftCardsPage">
	<SectionHeader title={$_('profile.giftCards')} />

	{#if giftCardsQuery.isLoading}
		<div class="grid">
			{#each Array(3) as _}
				<Skeleton height="140px" radius="var(--radius-lg)" />
			{/each}
		</div>
	{:else if giftCards.length === 0}
		<EmptyState icon="lucide:gift" title="Нет сертификатов" />
	{:else}
		<div class="grid">
			{#each giftCards as card}
				<div class="card glass-card">
					<div class="card_header">
						<Icon icon="lucide:gift" width={24} />
						<Badge
							text={$_(`common.giftCardStatus.${card.status}`)}
							color={STATUS_COLORS[card.status] ?? 'var(--muted-fg)'}
						/>
					</div>
					<div class="card_body">
						<span class="code">{card.code}</span>
						<div class="amounts">
							<span
								>Баланс: <strong>{formatPriceCompact(card.balance)}</strong
								></span
							>
							<span class="original">из {formatPriceCompact(card.amount)}</span>
						</div>
					</div>
					{#if card.expiresAt}
						<span class="expires">
							До {formatDate(card.expiresAt)}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style lang="scss">
	.GiftCardsPage {
		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
			gap: var(--space-4);
		}

		.card {
			padding: var(--space-5);
			display: flex;
			flex-direction: column;
			gap: var(--space-3);

			.card_header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				color: var(--primary-light);
			}

			.card_body {
				.code {
					font-family: monospace;
					font-size: var(--text-lg);
					font-weight: var(--weight-bold);
					color: var(--foreground);
					letter-spacing: 0.05em;
				}

				.amounts {
					font-size: var(--text-sm);
					color: var(--foreground);

					strong {
						color: var(--primary-light);
					}

					.original {
						color: var(--muted-fg);
						margin-left: var(--space-2);
					}
				}
			}

			.expires {
				font-size: var(--text-xs);
				color: var(--muted-fg);
			}
		}
	}
</style>
