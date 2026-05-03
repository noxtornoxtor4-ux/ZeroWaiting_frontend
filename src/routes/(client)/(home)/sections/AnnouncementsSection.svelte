<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { locale } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { formatDate } from '@/lib/utils/datetime';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Icon from '@iconify/svelte';

	const query = crmQueryApi.createGetPublicAnnouncementsV1(() => ({
		limit: 4
	}));

	const announcements = $derived(query.data?.data ?? []);
</script>

{#if announcements.length > 0}
	<section class="AnnouncementsSection">
		<div class="container">
			<SectionHeader title={$_('home.announcements')} />
			<div class="grid">
				{#each announcements as item}
					<div class="card glass-card">
						{#if item.imageUrl}
							<img src={item.imageUrl} alt="" class="image" loading="lazy" />
						{:else}
							<div class="image_placeholder">
								<Icon icon="lucide:megaphone" width={28} />
							</div>
						{/if}
						<div class="content">
							<h3 class="title">
								{getLocalizedValue(item.title, $locale)}
							</h3>
							{#if item.publishDate}
								<span class="date">
									{formatDate(item.publishDate)}
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>
{/if}

<style lang="scss">
	.AnnouncementsSection {
		padding: var(--space-12) 0;

		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
			gap: var(--space-4);
		}

		.card {
			overflow: hidden;
			transition: transform var(--duration-normal) var(--ease-default);
			will-change: transform;

			&:hover {
				transform: translateY(-2px);
			}
		}

		.image {
			width: 100%;
			height: 160px;
			object-fit: cover;
		}

		.image_placeholder {
			width: 100%;
			height: 160px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--surface-hover);
			color: var(--muted-fg);
		}

		.content {
			padding: var(--space-3) var(--space-4);
		}

		.title {
			font-size: var(--text-sm);
			font-weight: var(--weight-semibold);
			color: var(--foreground);
		}

		.date {
			font-size: var(--text-xs);
			color: var(--muted-fg);
			margin-top: var(--space-1);
			display: block;
		}
	}
</style>
