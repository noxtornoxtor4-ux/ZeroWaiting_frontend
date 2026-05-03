<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Button from '@/components/ui/Button.svelte';
	import EmptyState from '@/components/ui/EmptyState.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';

	const codeQuery = crmQueryApi.createGetProfileMeReferralCodeV1();
	const referralsQuery = crmQueryApi.createGetProfileMeReferralsV1();

	const referralCode = $derived(codeQuery.data?.referralCode ?? '');
	const referrals = $derived(referralsQuery.data ?? []);

	const copyCode = () => {
		if (referralCode) {
			navigator.clipboard.writeText(referralCode);
			toast.success('Код скопирован');
		}
	};
</script>

<svelte:head>
	<title>{$_('profile.referrals')} — ZeroWaiting</title>
</svelte:head>

<div class="ReferralsPage">
	<SectionHeader title={$_('profile.referrals')} />

	{#if codeQuery.isLoading}
		<Skeleton height="120px" radius="var(--radius-lg)" />
	{:else}
		<div class="code_card glass-card">
			<div class="code_header">
				<Icon icon="lucide:user-plus" width={28} />
				<span>Ваш реферальный код</span>
			</div>
			<div class="code_row">
				<span class="code">{referralCode || '—'}</span>
				{#if referralCode}
					<Button
						variant="ghost"
						size="sm"
						icon="lucide:copy"
						onclick={copyCode}
					>
						Скопировать
					</Button>
				{/if}
			</div>
		</div>

		{#if Array.isArray(referrals) && referrals.length > 0}
			<div class="list">
				<h3 class="subtitle">
					Приглашённые ({referrals.length})
				</h3>
				{#each referrals as ref}
					<div class="item glass-card">
						<Icon icon="lucide:user-check" width={20} />
						<span>Пользователь</span>
						<span class="badge">
							{ref.bonusAwarded ? 'Бонус начислен' : 'Ожидание'}
						</span>
					</div>
				{/each}
			</div>
		{:else}
			<EmptyState
				icon="lucide:users"
				title="Пока нет приглашённых"
				description="Поделитесь своим кодом с друзьями"
			/>
		{/if}
	{/if}
</div>

<style lang="scss">
	.ReferralsPage {
		.code_card {
			padding: var(--space-5);
			margin-bottom: var(--space-6);

			.code_header {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				color: var(--primary-light);
				font-size: var(--text-base);
				font-weight: var(--weight-semibold);
				margin-bottom: var(--space-4);
			}

			.code_row {
				display: flex;
				align-items: center;
				gap: var(--space-3);

				.code {
					font-family: monospace;
					font-size: var(--text-2xl);
					font-weight: var(--weight-bold);
					color: var(--foreground);
					letter-spacing: 0.1em;
				}
			}
		}

		.list {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);

			.subtitle {
				font-size: var(--text-base);
				font-weight: var(--weight-semibold);
				margin-bottom: var(--space-3);
			}

			.item {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				padding: var(--space-3) var(--space-4);
				font-size: var(--text-sm);
				color: var(--foreground);

				.badge {
					margin-left: auto;
					font-size: var(--text-xs);
					color: var(--muted-fg);
				}
			}
		}
	}
</style>
