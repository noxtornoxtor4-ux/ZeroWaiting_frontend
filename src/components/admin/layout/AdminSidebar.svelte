<script lang="ts">
	import Icon from '@iconify/svelte';
	import { _ } from 'svelte-i18n';
	import { page } from '$app/state';
	import { crmQueryApi } from '@/api/endpoints';
	import { sidebarOpen } from '@/lib/stores/sidebar';
	import { adminNavItems } from '@/lib/config/nav';
	import { hasMinRole } from '@/lib/constants/roles';
	import { UserRole } from '@/api/model';

	const profileQuery = crmQueryApi.createGetProfileMeV1();
	const userRole = $derived(profileQuery.data?.role ?? '');

	const visibleItems = $derived(
		adminNavItems.filter((item) => hasMinRole(userRole, item.minRole))
	);

	const isStaff = $derived(hasMinRole(userRole, UserRole.STAFF));

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
</script>

<aside class="AdminSidebar" class:collapsed={!$sidebarOpen}>
	<div class="header">
		<a href="/admin/dashboard" class="logo">
			<div class="logo_icon_box">
				<Icon icon="lucide:film" width={18} />
			</div>
			{#if $sidebarOpen}
				<span class="logo_text">ZeroWaiting</span>
			{/if}
		</a>
	</div>

	<nav class="nav">
		{#each visibleItems as item}
			<a
				href={item.href}
				class="link"
				class:active={isActive(item.href)}
				title={$sidebarOpen ? undefined : item.label}
			>
				<Icon icon={item.icon} width={20} />
				{#if $sidebarOpen}
					<span class="link_text">{item.label}</span>
				{/if}
			</a>
		{/each}

		{#if isStaff}
			<a
				href="/scanner"
				class="link"
				class:active={isActive('/scanner')}
				title={$sidebarOpen ? undefined : $_('scanner.openScanner')}
			>
				<Icon icon="lucide:scan-line" width={20} />
				{#if $sidebarOpen}
					<span class="link_text">{$_('scanner.openScanner')}</span>
				{/if}
			</a>
		{/if}
	</nav>

	<div class="footer">
		<a href="/" class="link" title="На сайт">
			<Icon icon="lucide:globe" width={20} />
			{#if $sidebarOpen}
				<span class="link_text">На сайт</span>
			{/if}
		</a>
	</div>
</aside>

<style lang="scss">
	.AdminSidebar {
		width: 260px;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border-right: 1px solid var(--border-color);
		transition: width var(--duration-normal) var(--ease-default);
		overflow: hidden;

		&.collapsed {
			width: 64px;
		}

		.header {
			padding: var(--space-4);
			border-bottom: 1px solid var(--border-color);
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 60px;
		}

		.logo {
			display: flex;
			align-items: center;
			gap: 0.75rem;
		}

		.logo_icon_box {
			width: 32px;
			height: 32px;
			background: linear-gradient(45deg, #8b5cf6, #a855f7);
			border-radius: 8px;
			display: flex;
			align-items: center;
			justify-content: center;
			color: white;
			box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
			flex-shrink: 0;
		}

		.logo_text {
			font-size: var(--text-xl);
			font-weight: var(--weight-bold);
			background: linear-gradient(45deg, #ffffff, #c084fc);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			white-space: nowrap;
		}

		.nav {
			flex: 1;
			padding: var(--space-2);
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		.link {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			padding: var(--space-2) var(--space-3);
			font-size: var(--text-sm);
			font-weight: var(--weight-medium);
			color: var(--muted-fg);
			border-radius: var(--radius-md);
			transition: all var(--duration-fast) var(--ease-default);
			white-space: nowrap;

			&:hover {
				background: var(--surface-hover);
				color: var(--foreground);
			}

			&.active {
				background: var(--primary-subtle);
				color: var(--primary-light);
			}
		}

		.footer {
			padding: var(--space-2);
			border-top: 1px solid var(--border-color);
		}
	}
</style>
