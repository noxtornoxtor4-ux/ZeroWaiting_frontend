<script lang="ts">
	import Icon from '@iconify/svelte';
	import { _, locale } from 'svelte-i18n';
	import { page } from '$app/state';
	import { isAuthenticated } from '@/lib/stores/auth';
	import { burgerMenuOpen } from '@/lib/stores/burgerMenu';
	import { crmQueryApi } from '@/api/endpoints';
	import { UserRole } from '@/api/model';
	import { hasMinRole } from '@/lib/constants/roles';
	import HeaderAvatar from './HeaderAvatar.svelte';

	interface Props {
		scrolled?: boolean;
	}

	let { scrolled = false }: Props = $props();

	const profileQuery = crmQueryApi.createGetProfileMeV1(() => ({
		query: { enabled: $isAuthenticated }
	}));
	const user = $derived(profileQuery.data ?? null);
	const initials = $derived(
		user ? (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '') : ''
	);
	const isStaff = $derived(hasMinRole(user?.role, UserRole.STAFF));

	const navLinks = [
		{ label: 'nav.home', href: '/' },
		{ label: 'nav.movies', href: '/movies' },
		{ label: 'nav.cinemas', href: '/cinemas' }
	];

	const languages = [
		{ code: 'ru', name: 'Русский', flag: 'circle-flags:ru' },
		{ code: 'en', name: 'English', flag: 'circle-flags:gb' },
		{ code: 'ky', name: 'Кыргызча', flag: 'circle-flags:kg' },
		{ code: 'kz', name: 'Қазақша', flag: 'circle-flags:kz' },
		{ code: 'uz', name: "O'zbekcha", flag: 'circle-flags:uz' }
	];

	let isMobileLangOpen = $state(false);
	const currentLang = $derived(
		languages.find((l) => l.code === $locale) ?? languages[0]
	);

	const isActive = (href: string) => {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	};

	const handleNavClick = () => {
		burgerMenuOpen.set(false);
	};

	const switchLanguage = (code: string) => {
		locale.set(code);
		isMobileLangOpen = false;
		burgerMenuOpen.set(false);
	};
</script>

<div class="mobile-menu" class:open={$burgerMenuOpen} class:scroll={scrolled}>
	{#if $isAuthenticated && user}
		<div class="user_header">
			<HeaderAvatar
				src={user.photo}
				alt={user.firstName}
				{initials}
				size={42}
			/>
			<div class="info">
				<span class="name">
					{user.firstName}
					{user.lastName ?? ''}
				</span>
				<span class="email">{user.email}</span>
			</div>
		</div>
	{/if}

	<nav class="nav-mobile">
		{#each navLinks as link}
			<a
				href={link.href}
				class="nav-link"
				class:active={isActive(link.href)}
				onclick={handleNavClick}
			>
				{$_(link.label)}
			</a>
		{/each}

		{#if isStaff}
			<a
				href="/scanner"
				class="nav-link scanner-link"
				class:active={isActive('/scanner')}
				onclick={handleNavClick}
			>
				<Icon icon="lucide:scan-line" width={18} />
				<span>{$_('scanner.openScanner')}</span>
			</a>
		{/if}
	</nav>

	<div class="mobile-settings">
		<div class="mobile-lang-row">
			<button
				class="lang-trigger"
				onclick={() => (isMobileLangOpen = !isMobileLangOpen)}
				aria-expanded={isMobileLangOpen}
			>
				<div class="lang-trigger-left">
					<Icon icon={currentLang.flag} width={22} />
					<span class="lang-name">{currentLang.name}</span>
				</div>
				<span class="chevron" class:open={isMobileLangOpen}>
					<Icon icon="lucide:chevron-down" width={14} />
				</span>
			</button>

			{#if isMobileLangOpen}
				<div class="lang-options">
					{#each languages.filter((l) => l.code !== $locale) as lang}
						<button
							class="lang-option"
							onclick={() => switchLanguage(lang.code)}
						>
							<Icon icon={lang.flag} width={22} />
							<span>{lang.name}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if $isAuthenticated}
		<a href="/profile" class="cta-button-mobile" onclick={handleNavClick}>
			{$_('nav.profile')}
		</a>
	{:else}
		<a
			href="/sign-in"
			class="cta-button-mobile btn-gradient"
			onclick={handleNavClick}
		>
			{$_('nav.signIn')}
		</a>
	{/if}
</div>

<style lang="scss">
	.mobile-menu {
		position: absolute;
		top: 110%;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		padding: 0 16px 16px;
		background: color-mix(in srgb, var(--background) 30%, transparent);
		border: 1px solid rgba(124, 124, 124, 0.11);
		border-radius: 12px;
		z-index: -1;
		transform: translateY(-200%);
		transition:
			transform 0.5s,
			background 0.5s ease;
		pointer-events: none;

		&.open {
			transform: translateY(0);
			pointer-events: auto;
			background: color-mix(in srgb, var(--background) 80%, transparent);
		}

		&.scroll {
			background: color-mix(in srgb, var(--background) 80%, transparent);
		}

		&::before {
			content: '';
			position: absolute;
			inset: 0;
			border-radius: inherit;
			backdrop-filter: blur(7px);
			-webkit-backdrop-filter: blur(7px);
			z-index: -1;
		}

		.user_header {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 12px 0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.06);

			.info {
				display: flex;
				flex-direction: column;
				min-width: 0;

				.name {
					font-size: 14px;
					font-weight: 600;
					color: var(--foreground);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.email {
					font-size: 12px;
					color: var(--muted-fg);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
			}
		}

		.nav-mobile {
			display: flex;
			flex-direction: column;

			.nav-link {
				color: var(--muted-fg);
				font-size: 14px;
				font-weight: 500;
				text-decoration: none;
				padding: 12px 0;
				border-bottom: 1px solid rgba(255, 255, 255, 0.06);
				transition: all 0.3s ease;

				&:hover,
				&.active {
					color: var(--foreground);
				}

				&.scanner-link {
					display: flex;
					align-items: center;
					gap: 8px;
					color: var(--primary-400);

					&:hover,
					&.active {
						color: var(--primary-300);
					}
				}
			}
		}

		.mobile-settings {
			margin-top: 16px;

			.mobile-lang-row {
				margin-top: 12px;

				.lang-trigger {
					display: flex;
					align-items: center;
					justify-content: space-between;
					width: 100%;
					background: rgba(255, 255, 255, 0.04);
					border: 1px solid var(--border-color);
					border-radius: 10px;
					cursor: pointer;
					padding: 10px 14px;
					color: var(--muted-fg);
					transition: all 0.2s ease;

					&:hover {
						color: var(--foreground);
						border-color: rgba(168, 85, 247, 0.5);
						background: rgba(168, 85, 247, 0.06);
					}

					.lang-trigger-left {
						display: flex;
						align-items: center;
						gap: 8px;
					}

					.lang-name {
						font-size: 14px;
						font-weight: 500;
					}

					.chevron {
						display: flex;
						align-items: center;
						opacity: 0.6;
						transition: transform 0.2s ease;

						&.open {
							transform: rotate(180deg);
						}
					}
				}

				.lang-options {
					margin-top: 6px;
					border: 1px solid var(--border-color);
					border-radius: 10px;
					overflow: hidden;
					background: rgba(255, 255, 255, 0.02);

					.lang-option {
						display: flex;
						align-items: center;
						gap: 10px;
						width: 100%;
						background: none;
						border: none;
						border-bottom: 1px solid rgba(255, 255, 255, 0.05);
						cursor: pointer;
						color: var(--muted-fg);
						font-size: 14px;
						font-weight: 500;
						padding: 10px 14px;
						transition: all 0.15s ease;
						text-align: left;

						&:last-child {
							border-bottom: none;
						}

						&:hover {
							color: var(--foreground);
							background: rgba(168, 85, 247, 0.08);
						}
					}
				}
			}
		}

		.cta-button-mobile {
			display: block;
			margin-top: 16px;
			padding: 12px 24px;
			text-decoration: none;
			font-size: 14px;
			font-weight: 600;
			border-radius: 12px;
			text-align: center;
			background: var(--primary);
			color: white;
			transition: all 0.3s ease;

			&:hover {
				transform: scale(1.02);
				box-shadow: 0 6px 20px rgba(168, 85, 247, 0.4);
			}
		}
	}
</style>
