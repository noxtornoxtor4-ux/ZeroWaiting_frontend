<script lang="ts">
	import Icon from '@iconify/svelte';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { authStore, isAuthenticated } from '@/lib/stores/auth';
	import { crmQueryApi } from '@/api/endpoints';
	import { UserRole } from '@/api/model';
	import { hasMinRole } from '@/lib/constants/roles';
	import PopoverMenu from '@/components/ui/PopoverMenu.svelte';
	import HeaderAvatar from './HeaderAvatar.svelte';

	let menuOpen = $state(false);

	const profileQuery = crmQueryApi.createGetProfileMeV1(() => ({
		query: { enabled: $isAuthenticated }
	}));
	const user = $derived(profileQuery.data ?? null);
	const initials = $derived(
		user ? (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '') : ''
	);
	const isStaff = $derived(hasMinRole(user?.role, UserRole.STAFF));

	const menuItems = [
		{ label: 'nav.profile', icon: 'lucide:user', href: '/profile' },
		{
			label: 'nav.myBookings',
			icon: 'lucide:ticket',
			href: '/profile/bookings'
		},
		{
			label: 'nav.favorites',
			icon: 'lucide:heart',
			href: '/profile/favorites'
		},
		{
			label: 'nav.notifications',
			icon: 'lucide:bell',
			href: '/profile/notifications'
		}
	];

	const navigate = (href: string) => {
		menuOpen = false;
		goto(href);
	};

	const logout = () => {
		menuOpen = false;
		authStore.logout();
		goto('/');
	};
</script>

<PopoverMenu bind:open={menuOpen} placement="bottom-end">
	{#snippet children()}
		<button class="avatar_trigger" aria-label="Меню пользователя">
			<HeaderAvatar
				src={user?.photo}
				alt={user?.firstName}
				{initials}
				size={36}
				interactive
			/>
		</button>
	{/snippet}

	{#snippet content()}
		<div
			class="user_menu"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)}
			role="menu"
			tabindex="-1"
		>
			<div class="header">
				<HeaderAvatar src={user?.photo} {initials} size={42} />
				<div class="info">
					<span class="name">
						{user?.firstName}
						{user?.lastName ?? ''}
					</span>
					<span class="email">{user?.email}</span>
				</div>
			</div>

			<div class="divider"></div>

			{#each menuItems as item}
				<button class="item" onclick={() => navigate(item.href)}>
					<Icon icon={item.icon} width={18} />
					<span>{$_(item.label)}</span>
				</button>
			{/each}

			{#if isStaff}
				<div class="divider"></div>
				<button class="item admin" onclick={() => navigate('/admin/dashboard')}>
					<Icon icon="lucide:shield" width={18} />
					<span>Админ панель</span>
				</button>
			{/if}

			<div class="divider"></div>

			<button class="item danger" onclick={logout}>
				<Icon icon="lucide:log-out" width={18} />
				<span>{$_('nav.logout')}</span>
			</button>
		</div>
	{/snippet}
</PopoverMenu>

<style lang="scss">
	.avatar_trigger {
		display: inline-flex;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
	}

	:global(.user_menu) {
		min-width: 230px;
		background: var(--surface);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
		padding: 6px;
		animation: dropdownAppear 0.15s ease;
		will-change: transform, opacity;
	}

	@keyframes dropdownAppear {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	:global(.user_menu .header) {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 10px 12px;
	}

	:global(.user_menu .info) {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	:global(.user_menu .name) {
		font-size: 14px;
		font-weight: 600;
		color: var(--foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.user_menu .email) {
		font-size: 12px;
		color: var(--muted-fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.user_menu .divider) {
		height: 1px;
		background: var(--border-color);
		margin: 4px 0;
	}

	:global(.user_menu .item) {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		font-size: 13px;
		font-weight: 500;
		border-radius: 8px;
		color: var(--foreground);
		text-align: left;
		background: none;
		border: none;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;

		&:hover {
			background: var(--surface-hover);
		}
	}

	:global(.user_menu .item.admin) {
		color: var(--warning);

		&:hover {
			background: rgba(234, 179, 8, 0.1);
		}
	}

	:global(.user_menu .item.danger) {
		color: var(--danger);

		&:hover {
			background: rgba(239, 68, 68, 0.1);
		}
	}
</style>
