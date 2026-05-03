<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import EmptyState from '@/components/ui/EmptyState.svelte';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';

	const loyaltyQuery = crmQueryApi.createGetProfileMeLoyaltyV1();
	const createCardMutation = crmQueryApi.createPostLoyaltyCardsV1Mutation();

	const loyalty = $derived(loyaltyQuery.data);

	const TIER_COLORS: Record<string, string> = {
		BASIC: 'var(--muted-fg)',
		SILVER: '#8585a8',
		GOLD: '#f59e0b',
		PLATINUM: '#c084fc'
	};

	const handleCreateCard = async () => {
		try {
			await createCardMutation.mutateAsync({ data: {} });
			toast.success('Карта создана');
			loyaltyQuery.refetch();
		} catch (error) {
			toast.error(getErrorMessage(error, 'Ошибка создания карты'));
		}
	};

	const formatCardNumber = (num?: string | null) => {
		if (!num) return '—';
		return num.replace(/(.{4})/g, '$1 ').trim();
	};

	const handleCopyCard = async () => {
		const number = loyalty?.cardNumber;
		if (!number) return;
		try {
			await navigator.clipboard.writeText(number);
			toast.success('Номер карты скопирован');
		} catch {
			toast.error('Не удалось скопировать');
		}
	};

	const handleCardKey = (e: KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleCopyCard();
		}
	};
</script>

<svelte:head>
	<title>{$_('profile.loyalty')} — ZeroWaiting</title>
</svelte:head>

<div class="LoyaltyPage">
	<SectionHeader title={$_('profile.loyalty')} />

	{#if loyaltyQuery.isLoading}
		<Skeleton height="200px" radius="var(--radius-lg)" />
	{:else if !loyalty}
		<EmptyState
			icon="lucide:id-card"
			title="У вас нет клубной карты"
			description="Создайте клубную карту для получения бонусов"
		>
			{#snippet actions()}
				<Button
					variant="primary"
					onclick={handleCreateCard}
					loading={createCardMutation.isPending}
				>
					Создать карту
				</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="card glass-card">
			<div class="header">
				<Icon icon="lucide:id-card" width={32} />
				<Badge
					text={$_(`common.loyaltyTier.${loyalty.tier ?? 'BASIC'}`)}
					color={TIER_COLORS[loyalty.tier ?? 'BASIC'] ?? 'var(--muted-fg)'}
					variant="filled"
					size="md"
				/>
			</div>
			<div class="stats">
				<div class="stat">
					<span class="stat_value">{loyalty.balance ?? 0}</span>
					<span class="stat_label">Баллы</span>
				</div>
				<div class="stat">
					<span class="stat_value">{loyalty.discountPct ?? 0}%</span>
					<span class="stat_label">Скидка</span>
				</div>
				<button
					class="stat card_number"
					type="button"
					onclick={handleCopyCard}
					onkeydown={handleCardKey}
					aria-label="Скопировать номер карты"
					title="Нажмите, чтобы скопировать"
					disabled={!loyalty.cardNumber}
				>
					<span class="stat_value">
						<span class="number">{formatCardNumber(loyalty.cardNumber)}</span>
						<Icon icon="lucide:copy" width={16} class="copy_icon" />
					</span>
					<span class="stat_label">
						Номер карты
						<span class="hint">— нажмите, чтобы скопировать</span>
					</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.LoyaltyPage {
		.card {
			padding: var(--space-4);
			width: fit-content;
			max-width: 100%;

			@media (max-width: 640px) {
				width: 100%;
			}

			.header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: var(--space-4);
				color: var(--primary-light);
			}

			.stats {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--space-4);

				.stat {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: var(--space-1);
					background: none;
					border: none;
					padding: 0;
					font: inherit;
					color: inherit;
					text-align: center;

					.stat_value {
						font-size: var(--text-2xl);
						font-weight: var(--weight-bold);
						color: var(--foreground);
					}

					.stat_label {
						font-size: var(--text-xs);
						color: var(--muted-fg);
						text-transform: uppercase;
						letter-spacing: 0.04em;

						.hint {
							text-transform: none;
							letter-spacing: 0;
							color: var(--muted-fg);
							opacity: 0.8;
						}
					}
				}

				.card_number {
					grid-column: 1 / -1;
					cursor: pointer;
					padding: var(--space-3) var(--space-4);
					border-radius: var(--radius-lg);
					min-width: 0;
					transition:
						background var(--duration-fast) var(--ease-default),
						color var(--duration-fast) var(--ease-default),
						transform var(--duration-fast) var(--ease-default);

					.stat_value {
						display: inline-flex;
						align-items: center;
						justify-content: center;
						gap: var(--space-2);
						max-width: 100%;
						font-size: clamp(15px, 4.6vw, var(--text-xl));
						font-variant-numeric: tabular-nums;
						white-space: nowrap;

						.number {
							font-family: var(--font-mono, ui-monospace, monospace);
							letter-spacing: 0.04em;
						}

						:global(.copy_icon) {
							flex-shrink: 0;
							color: var(--primary-light);
							opacity: 0.65;
							transition: opacity var(--duration-fast) var(--ease-default);
						}
					}

					&:hover,
					&:focus-visible {
						background: color-mix(in srgb, var(--primary) 12%, transparent);

						.stat_value :global(.copy_icon) {
							opacity: 1;
						}
					}

					&:active {
						transform: scale(0.98);
					}

					&:focus-visible {
						outline: 2px solid var(--primary);
						outline-offset: 2px;
					}

					&:disabled {
						cursor: not-allowed;
						opacity: 0.6;
					}
				}
			}
		}
	}
</style>
