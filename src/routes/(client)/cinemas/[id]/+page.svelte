<script lang="ts">
	import { page } from '$app/state';
	import { locale } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import EmptyState from '@/components/ui/EmptyState.svelte';
	import Icon from '@iconify/svelte';

	const cinemaId = $derived(page.params.id);

	const cinemaQuery = crmQueryApi.createGetPublicCinemasByIdV1(() => cinemaId!);
	const branchesQuery = crmQueryApi.createGetPublicCinemasByCinemaIdBranchesV1(
		() => cinemaId!
	);

	const cinema = $derived(cinemaQuery.data);
	const branches = $derived(branchesQuery.data?.data ?? []);

	const cinemaName = $derived(
		cinema ? getLocalizedValue(cinema.name, $locale) : ''
	);
</script>

<svelte:head>
	<title>{cinemaName || 'Кинотеатр'} — ZeroWaiting</title>
</svelte:head>

{#if cinema}
	<section class="CinemaDetail">
		<div class="container">
			<div class="header">
				{#if cinema.logoUrl}
					<img src={cinema.logoUrl} alt={cinemaName} class="logo" />
				{/if}
				<div>
					<h1 class="name">{cinemaName}</h1>
					{#if cinema.description}
						<p class="desc">
							{getLocalizedValue(cinema.description, $locale)}
						</p>
					{/if}
					{#if cinema.website}
						<a
							href={cinema.website}
							target="_blank"
							rel="noopener"
							class="website"
						>
							<Icon icon="lucide:external-link" width={14} />
							{cinema.website}
						</a>
					{/if}
				</div>
			</div>

			<div class="branches">
				<SectionHeader title="Филиалы" />
				{#if branches.length === 0}
					<EmptyState icon="lucide:store" title="Нет филиалов" />
				{:else}
					<div class="branches_grid">
						{#each branches as branch}
							<div class="branch glass-card">
								<h3 class="branch_name">
									{getLocalizedValue(branch.name, $locale)}
								</h3>
								{#if branch.address}
									<p class="branch_address">
										<Icon icon="lucide:map-pin" width={16} />
										{getLocalizedValue(branch.address, $locale)}
									</p>
								{/if}
								{#if branch.city}
									<p class="branch_city">{branch.city}</p>
								{/if}
								{#if branch.phone}
									<p class="branch_phone">
										<Icon icon="lucide:phone" width={16} />
										{branch.phone}
									</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</section>
{/if}

<style lang="scss">
	.CinemaDetail {
		padding: var(--space-8) 0 var(--space-16);

		.header {
			display: flex;
			gap: var(--space-6);
			align-items: flex-start;
			margin-bottom: var(--space-10);
		}

		.logo {
			width: 120px;
			height: 120px;
			border-radius: var(--radius-lg);
			object-fit: cover;
			flex-shrink: 0;
		}

		.name {
			font-size: var(--text-3xl);
			font-weight: var(--weight-bold);
		}

		.desc {
			font-size: var(--text-base);
			color: var(--muted-fg);
			margin-top: var(--space-2);
			max-width: 600px;
		}

		.website {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			font-size: var(--text-sm);
			color: var(--primary-light);
			margin-top: var(--space-2);

			&:hover {
				text-decoration: underline;
			}
		}

		.branches_grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
			gap: var(--space-4);
		}

		.branch {
			padding: var(--space-5);
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
		}

		.branch_name {
			font-size: var(--text-lg);
			font-weight: var(--weight-semibold);
		}

		.branch_address,
		.branch_phone {
			display: flex;
			align-items: center;
			gap: var(--space-2);
			font-size: var(--text-sm);
			color: var(--muted-fg);
		}

		.branch_city {
			font-size: var(--text-sm);
			color: var(--muted-fg);
		}
	}

	@media (max-width: 640px) {
		.CinemaDetail {
			.header {
				flex-direction: column;
				align-items: center;
				text-align: center;
			}
		}
	}
</style>
