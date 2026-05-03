<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';

	let { children } = $props();

	const navItems = [
		{ label: 'profile.title', href: '/profile', icon: 'lucide:user' },
		{
			label: 'profile.bookings',
			href: '/profile/bookings',
			icon: 'lucide:ticket'
		},
		{
			label: 'profile.favorites',
			href: '/profile/favorites',
			icon: 'lucide:heart'
		},
		{
			label: 'profile.loyalty',
			href: '/profile/loyalty',
			icon: 'lucide:id-card'
		},
		{
			label: 'profile.notifications',
			href: '/profile/notifications',
			icon: 'lucide:bell'
		},
		{
			label: 'profile.giftCards',
			href: '/profile/gift-cards',
			icon: 'lucide:gift'
		},
		{
			label: 'profile.referrals',
			href: '/profile/referrals',
			icon: 'lucide:user-plus'
		}
	];

	const isActive = (href: string) => page.url.pathname === href;
</script>

<div class="ProfileLayout">
	<div class="container">
		<div class="grid">
			<aside class="sidebar">
				<nav class="nav">
					{#each navItems as item}
						<a href={item.href} class="link" class:active={isActive(item.href)}>
							<Icon icon={item.icon} width={20} />
							<span>{$_(item.label)}</span>
						</a>
					{/each}
				</nav>
			</aside>

			<main class="content">
				{@render children()}
			</main>
		</div>
	</div>
</div>

<style lang="scss">
	.ProfileLayout {
		padding: var(--space-8) 0 var(--space-16);

		.grid {
			display: grid;
			grid-template-columns: 240px 1fr;
			gap: var(--space-8);
			align-items: start;
		}

		.sidebar {
			position: sticky;
			top: 100px;
		}

		.nav {
			display: flex;
			flex-direction: column;
			gap: var(--space-1);
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: var(--radius-lg);
			padding: var(--space-2);
		}

		.link {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			padding: var(--space-3) var(--space-4);
			font-size: var(--text-sm);
			font-weight: var(--weight-medium);
			color: var(--muted-fg);
			border-radius: var(--radius-md);
			transition: all var(--duration-fast) var(--ease-default);

			&:hover {
				background: var(--surface-hover);
				color: var(--foreground);
			}

			&.active {
				background: var(--primary-subtle);
				color: var(--primary-light);
			}
		}
	}

	@media (max-width: 768px) {
		.ProfileLayout {
			.grid {
				grid-template-columns: 1fr;
				gap: var(--space-4);
			}

			.sidebar {
				position: static;
			}

			.nav {
				flex-direction: row;
				overflow-x: auto;
				gap: 0;
				padding: var(--space-1);
			}

			.link {
				white-space: nowrap;
				padding: var(--space-2) var(--space-3);

				span {
					display: none;
				}
			}
		}
	}
</style>
