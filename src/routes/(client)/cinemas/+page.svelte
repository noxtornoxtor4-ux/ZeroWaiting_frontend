<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { locale } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import EmptyState from '@/components/ui/EmptyState.svelte';
	import Icon from '@iconify/svelte';

	const cinemasQuery = crmQueryApi.createGetPublicCinemasV1();
	const cinemas = $derived(cinemasQuery.data?.data ?? []);
</script>

<svelte:head>
	<title>{$_('nav.cinemas')} — ZeroWaiting</title>
</svelte:head>

<section class="CinemasPage">
	<div class="container">
		<SectionHeader title={$_('nav.cinemas')} />

		{#if cinemasQuery.isLoading}
			<div class="grid">
				{#each Array(4) as _}
					<div class="skeleton">
						<Skeleton height="200px" radius="var(--radius-lg)" />
						<Skeleton height="24px" width="60%" />
						<Skeleton height="16px" width="80%" />
					</div>
				{/each}
			</div>
		{:else if cinemas.length === 0}
			<EmptyState icon="lucide:building-2" title={$_('common.noResults')} />
		{:else}
			<div class="grid">
				{#each cinemas as cinema}
					<a href="/cinemas/{cinema.id}" class="card glass-card">
						{#if cinema.logoUrl}
							<img src={cinema.logoUrl} alt="" class="logo" />
						{:else}
							<div class="logo_placeholder">
								<Icon icon="lucide:building-2" width={40} />
							</div>
						{/if}
						<div class="content">
							<h3 class="name">
								{getLocalizedValue(cinema.name, $locale)}
							</h3>
							{#if cinema.description}
								<p class="desc">
									{getLocalizedValue(cinema.description, $locale)}
								</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</section>

<style lang="scss">
	.CinemasPage {
		padding: var(--space-8) 0 var(--space-16);

		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
			gap: var(--space-5);
		}

		.skeleton {
			display: flex;
			flex-direction: column;
			gap: var(--space-3);
		}

		.card {
			display: flex;
			flex-direction: column;
			overflow: hidden;
			transition: all var(--duration-normal) var(--ease-default);
			will-change: transform;

			&:hover {
				border-color: var(--primary);
				transform: translateY(-2px);
			}
		}

		.logo {
			width: 100%;
			height: 180px;
			object-fit: cover;
		}

		.logo_placeholder {
			width: 100%;
			height: 180px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--surface-hover);
			color: var(--muted-fg);
		}

		.content {
			padding: var(--space-4);
		}

		.name {
			font-size: var(--text-lg);
			font-weight: var(--weight-semibold);
			color: var(--foreground);
		}

		.desc {
			font-size: var(--text-sm);
			color: var(--muted-fg);
			margin-top: var(--space-2);
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
	}
</style>
