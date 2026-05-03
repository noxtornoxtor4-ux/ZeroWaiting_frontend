<script lang="ts">
	import Icon from '@iconify/svelte';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { authStore } from '@/lib/stores/auth';
	import { crmQueryApi } from '@/api/endpoints';
	import { sidebarOpen } from '@/lib/stores/sidebar';
	import { ROLE_LABELS, hasMinRole } from '@/lib/constants/roles';
	import { UserRole } from '@/api/model';
	import Badge from '@/components/ui/Badge.svelte';

	const profileQuery = crmQueryApi.createGetProfileMeV1();
	const user = $derived(profileQuery.data ?? null);
	const roleLabel = $derived(
		user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ''
	);
	const isStaff = $derived(hasMinRole(user?.role, UserRole.STAFF));

	const toggleSidebar = () => {
		sidebarOpen.update((v) => !v);
	};

	const handleLogout = () => {
		authStore.logout();
		goto('/');
	};
</script>

<header class="AdminHeader">
	<div class="left">
		<button
			class="toggle"
			onclick={toggleSidebar}
			aria-label="Переключить боковую панель"
		>
			<Icon
				icon={$sidebarOpen ? 'lucide:panel-left-close' : 'lucide:menu'}
				width={22}
			/>
		</button>
	</div>

	<div class="right">
		{#if isStaff}
			<a
				href="/scanner"
				class="scanner"
				aria-label={$_('scanner.openScanner')}
				title={$_('scanner.openScanner')}
			>
				<Icon icon="lucide:scan-line" width={20} />
			</a>
		{/if}

		<div class="user">
			<span class="name">{user?.firstName ?? ''} {user?.lastName ?? ''}</span>
			<Badge text={roleLabel} color="var(--primary)" size="sm" />
		</div>
		<button class="logout" onclick={handleLogout} aria-label="Выйти">
			<Icon icon="lucide:log-out" width={20} />
		</button>
	</div>
</header>

<style lang="scss">
	.AdminHeader {
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-5);
		background: var(--surface);
		border-bottom: 1px solid var(--border-color);

		.left {
			display: flex;
			align-items: center;
		}

		.toggle {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 36px;
			height: 36px;
			border-radius: var(--radius-md);
			color: var(--muted-fg);
			transition: all var(--duration-fast) var(--ease-default);

			&:hover {
				background: var(--surface-hover);
				color: var(--foreground);
			}
		}

		.right {
			display: flex;
			align-items: center;
			gap: var(--space-4);
		}

		.user {
			display: flex;
			align-items: center;
			gap: var(--space-2);
		}

		.name {
			font-size: var(--text-sm);
			font-weight: var(--weight-medium);
			color: var(--foreground);
		}

		.scanner {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 36px;
			height: 36px;
			border-radius: var(--radius-md);
			color: var(--muted-fg);
			transition: all var(--duration-fast) var(--ease-default);

			&:hover {
				background: var(--surface-hover);
				color: var(--primary);
			}
		}

		.logout {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 36px;
			height: 36px;
			border-radius: var(--radius-md);
			color: var(--muted-fg);
			transition: all var(--duration-fast) var(--ease-default);

			&:hover {
				background: var(--danger-bg);
				color: var(--danger);
			}
		}
	}
</style>
