<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import { _ } from 'svelte-i18n';
	import { page } from '$app/state';
	import { isAuthenticated } from '@/lib/stores/auth';
	import { burgerMenuOpen } from '@/lib/stores/burgerMenu';
	import { UserRole } from '@/api/model';
	import { hasMinRole } from '@/lib/constants/roles';
	import { crmQueryApi } from '@/api/endpoints';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import UserMenu from './UserMenu.svelte';
	import BurgerToggle from './BurgerToggle.svelte';
	import BurgerMenu from './BurgerMenu.svelte';

	interface Props {
		height?: number;
	}

	let { height = $bindable(0) }: Props = $props();

	let isMobile = $state(false);
	let scrolled = $state(false);

	const profileQuery = crmQueryApi.createGetProfileMeV1(() => ({
		query: { enabled: $isAuthenticated }
	}));
	const profile = $derived(profileQuery.data ?? null);
	const isAdmin = $derived(hasMinRole(profile?.role, UserRole.STAFF));
	const isStaff = $derived(hasMinRole(profile?.role, UserRole.STAFF));

	const unreadQuery = crmQueryApi.createGetProfileMeNotificationsUnreadCountV1(
		() => ({ query: { enabled: $isAuthenticated } })
	);
	const unreadCount = $derived(
		$isAuthenticated ? (unreadQuery.data?.count ?? 0) : 0
	);

	const navLinks = [
		{ label: 'nav.home', href: '/' },
		{ label: 'nav.movies', href: '/movies' },
		{ label: 'nav.cinemas', href: '/cinemas' }
	];

	const isActive = (href: string) => {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	};

	onMount(() => {
		const check = () => {
			isMobile = window.innerWidth <= 768;
		};
		check();
		window.addEventListener('resize', check);
		return () => window.removeEventListener('resize', check);
	});

	onMount(() => {
		const checkScroll = () => {
			scrolled = window.scrollY > 10;
		};
		checkScroll();
		window.addEventListener('scroll', checkScroll, { passive: true });
		return () => window.removeEventListener('scroll', checkScroll);
	});

	$effect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (!$burgerMenuOpen) return;
			const header = document.querySelector('.Header');
			if (header && !header.contains(e.target as Node)) {
				burgerMenuOpen.set(false);
			}
		};

		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<header class="Header" bind:clientHeight={height}>
	<div
		class="container"
		class:scroll={scrolled}
		class:menu_open={$burgerMenuOpen}
	>
		<div class="content">
			<a href="/" class="logo" onclick={() => burgerMenuOpen.set(false)}>
				<div class="logo_icon">
					<Icon icon="lucide:film" width={20} />
				</div>
				<span class="text">ZeroWaiting</span>
			</a>

			{#if !isMobile}
				<nav class="nav">
					{#each navLinks as link}
						<a href={link.href} class="link" class:active={isActive(link.href)}>
							{$_(link.label)}
						</a>
					{/each}
				</nav>
			{/if}

			{#if !isMobile}
				<div class="actions">
					<LanguageSwitcher />

					{#if isStaff}
						<a
							href="/scanner"
							class="scanner_link"
							aria-label={$_('scanner.openScanner')}
							title={$_('scanner.openScanner')}
						>
							<Icon icon="lucide:scan-line" width={20} />
						</a>
					{/if}

					{#if isAdmin}
						<a
							href="/admin/dashboard"
							class="admin_link"
							aria-label="Админ панель"
						>
							<Icon icon="lucide:shield" width={20} />
						</a>
					{/if}

					{#if $isAuthenticated}
						<a
							href="/profile/notifications"
							class="notifications"
							aria-label="Уведомления"
						>
							<Icon icon="lucide:bell" width={20} />
							{#if unreadCount > 0}
								<span class="badge">
									{unreadCount > 9 ? '9+' : unreadCount}
								</span>
							{/if}
						</a>
						<UserMenu />
					{:else}
						<a href="/sign-in" class="cta">
							{$_('nav.signIn')}
						</a>
					{/if}
				</div>
			{/if}

			{#if isMobile}
				<BurgerToggle />
				<BurgerMenu {scrolled} />
			{/if}
		</div>
	</div>
</header>

<style lang="scss">
	.Header {
		position: sticky;
		width: 100%;
		top: 0;
		left: 0;
		right: 0;
		z-index: var(--z-header);

		.container {
			width: 100%;
			max-width: 2140px;
			margin: 0 auto;
			padding: 0 var(--container-padding);
			transition: 0.7s;

			&.scroll {
				max-width: 1540px;

				.content {
					background: color-mix(in srgb, var(--background) 80%, transparent);
				}
			}

			&.menu_open .content {
				background: color-mix(in srgb, var(--background) 80%, transparent);
			}

			.content {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 24px;
				border-radius: 12px;
				background: color-mix(in srgb, var(--background) 30%, transparent);
				transition: background 0.5s ease;
				border: 1px solid rgba(139, 92, 246, 0.15);
				margin: 11px 0;
				padding: 0 16px;
				position: relative;

				&::before {
					content: '';
					position: absolute;
					inset: 0;
					border-radius: inherit;
					backdrop-filter: blur(7px);
					-webkit-backdrop-filter: blur(7px);
					z-index: -1;
					will-change: backdrop-filter;
				}

				@media (min-width: 768px) {
					margin: 16px 0;
					padding: 0 24px;
				}

				.logo {
					display: flex;
					align-items: center;
					gap: 0.75rem;
					text-decoration: none;
					color: white;
					font-weight: bold;
					font-size: 1.5rem;
					padding: 12px 0;

					&:hover .logo_icon {
						transform: scale(1.1) rotate(5deg);
					}

					.logo_icon {
						width: 36px;
						height: 36px;
						background: linear-gradient(45deg, #8b5cf6, #a855f7);
						border-radius: 8px;
						display: flex;
						align-items: center;
						justify-content: center;
						color: white;
						box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
						transition: transform 0.3s ease;
						will-change: transform;
					}

					.text {
						background: linear-gradient(45deg, #ffffff, #c084fc);
						-webkit-background-clip: text;
						-webkit-text-fill-color: transparent;
						background-clip: text;

						@media (max-width: 768px) {
							font-size: 18px;
						}
					}
				}

				.nav {
					display: flex;
					gap: 32px;
					align-items: center;
					flex: 1;
					justify-content: center;

					.link {
						color: rgba(255, 255, 255, 0.8);
						font-size: 15px;
						font-weight: 600;
						text-decoration: none;
						white-space: nowrap;
						position: relative;
						padding: 5px 0;
						transition: color 0.3s ease;

						&::after {
							content: '';
							position: absolute;
							bottom: 0;
							left: 0;
							width: 0;
							height: 2px;
							background: linear-gradient(
								45deg,
								var(--primary-500),
								var(--primary-400)
							);
							transition: width 0.3s ease;
						}

						&:not(.active):hover {
							color: #fff;

							&::after {
								width: 100%;
							}
						}

						&.active {
							color: var(--primary-500);

							&::after {
								width: 100%;
							}
						}
					}
				}

				.actions {
					display: flex;
					align-items: center;
					gap: 16px;

					.scanner_link {
						display: flex;
						align-items: center;
						justify-content: center;
						width: 36px;
						height: 36px;
						border-radius: 8px;
						color: var(--primary-400);
						transition: all 0.15s ease;

						&:hover {
							background: rgba(168, 85, 247, 0.1);
						}
					}

					.admin_link {
						display: flex;
						align-items: center;
						justify-content: center;
						width: 36px;
						height: 36px;
						border-radius: 8px;
						color: var(--warning);
						transition: all 0.15s ease;

						&:hover {
							background: rgba(234, 179, 8, 0.1);
						}
					}

					.notifications {
						position: relative;
						display: flex;
						align-items: center;
						justify-content: center;
						width: 36px;
						height: 36px;
						border-radius: 8px;
						color: var(--muted-fg);
						transition: all 0.15s ease;

						&:hover {
							background: var(--surface-hover);
							color: var(--foreground);
						}

						.badge {
							position: absolute;
							top: 2px;
							right: 2px;
							min-width: 16px;
							height: 16px;
							padding: 0 4px;
							border-radius: 999px;
							background: var(--danger);
							color: white;
							font-size: 10px;
							font-weight: 700;
							display: flex;
							align-items: center;
							justify-content: center;
							line-height: 1;
						}
					}

					.cta {
						padding: 8px 24px;
						text-decoration: none;
						font-size: 14px;
						font-weight: 500;
						border-radius: 25px;
						white-space: nowrap;
						background: linear-gradient(
							45deg,
							var(--primary-500),
							var(--primary-400)
						);
						color: white;
						box-shadow: 0 4px 15px rgba(168, 85, 247, 0.3);
						transition: all 0.3s ease;
						will-change: transform;

						&:hover {
							transform: translateY(-2px);
							box-shadow: 0 8px 25px rgba(168, 85, 247, 0.4);
						}
					}
				}
			}
		}
	}
</style>
