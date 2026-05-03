<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { formatDateTime } from '@/lib/utils/datetime';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Button from '@/components/ui/Button.svelte';
	import EmptyState from '@/components/ui/EmptyState.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Pagination from '@/components/ui/Pagination.svelte';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';
	import type { GetProfileMeNotificationsV1Params } from '@/api/model';

	const table = useTableQuery<GetProfileMeNotificationsV1Params>({
		defaultLimit: 20
	});

	const notifQuery = crmQueryApi.createGetProfileMeNotificationsV1(
		() => table.params
	);
	const unreadQuery =
		crmQueryApi.createGetProfileMeNotificationsUnreadCountV1();
	const markReadMutation =
		crmQueryApi.createPatchNotificationsByIdReadV1Mutation();
	const markAllReadMutation =
		crmQueryApi.createPostNotificationsReadAllV1Mutation();

	const notifications = $derived(notifQuery.data?.data ?? []);
	const meta = $derived(notifQuery.data?.meta);
	const unreadCount = $derived(unreadQuery.data?.count ?? 0);

	const handleMarkRead = async (id: string) => {
		try {
			await markReadMutation.mutateAsync({ id });
			notifQuery.refetch();
			unreadQuery.refetch();
		} catch {
			/* ignore */
		}
	};

	const handleMarkAllRead = async () => {
		try {
			await markAllReadMutation.mutateAsync();
			toast.success('Все прочитаны');
			notifQuery.refetch();
			unreadQuery.refetch();
		} catch {
			/* ignore */
		}
	};
</script>

<svelte:head>
	<title>{$_('profile.notifications')} — ZeroWaiting</title>
</svelte:head>

<div class="NotificationsPage">
	<SectionHeader
		title={$_('profile.notifications')}
		subtitle={unreadCount > 0 ? `${unreadCount} непрочитанных` : undefined}
	>
		{#snippet actions()}
			{#if unreadCount > 0}
				<Button variant="ghost" size="sm" onclick={handleMarkAllRead}>
					Прочитать все
				</Button>
			{/if}
		{/snippet}
	</SectionHeader>

	{#if notifQuery.isLoading}
		<div class="list">
			{#each Array(5) as _}
				<Skeleton height="60px" radius="var(--radius-md)" />
			{/each}
		</div>
	{:else if notifications.length === 0}
		<EmptyState icon="lucide:bell-off" title={$_('profile.noNotifications')} />
	{:else}
		<div class="list">
			{#each notifications as notif}
				<button
					class="item"
					class:unread={!notif.isRead}
					onclick={() => !notif.isRead && handleMarkRead(notif.id)}
				>
					<div class="icon">
						<Icon
							icon={notif.isRead ? 'lucide:bell' : 'lucide:bell-dot'}
							width={20}
						/>
					</div>
					<div class="content">
						<span class="title">{notif.title}</span>
						<span class="body">{notif.body}</span>
						<span class="time">{formatDateTime(notif.createdAt)}</span>
					</div>
				</button>
			{/each}
		</div>

		{#if meta && meta.totalPages > 1}
			<div class="pagination">
				<Pagination
					page={table.page}
					totalPages={meta.totalPages}
					onchange={table.setPage}
				/>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	.NotificationsPage {
		.list {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
		}

		.item {
			display: flex;
			align-items: flex-start;
			gap: var(--space-3);
			padding: var(--space-4);
			border-radius: var(--radius-md);
			text-align: left;
			width: 100%;
			background: var(--card-bg);
			border: 1px solid var(--border-color-subtle);
			transition: all var(--duration-fast) var(--ease-default);

			&:hover {
				background: var(--surface-hover);
			}

			&.unread {
				border-left: 3px solid var(--primary);
				background: color-mix(in srgb, var(--primary) 5%, var(--card-bg));
			}

			.icon {
				color: var(--muted-fg);
				flex-shrink: 0;
				margin-top: 2px;
			}

			.content {
				display: flex;
				flex-direction: column;
				gap: 2px;
				flex: 1;
				min-width: 0;

				.title {
					font-size: var(--text-sm);
					font-weight: var(--weight-semibold);
					color: var(--foreground);
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.body {
					font-size: var(--text-sm);
					color: var(--muted-fg);
					line-height: 1.45;
					word-break: break-word;
					overflow-wrap: anywhere;
				}

				.time {
					font-size: var(--text-xs);
					color: var(--muted-fg);
					margin-top: 2px;
				}
			}
		}

		.pagination {
			margin-top: var(--space-6);
		}
	}
</style>
