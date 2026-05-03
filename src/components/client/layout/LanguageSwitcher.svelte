<script lang="ts">
	import { locale } from 'svelte-i18n';
	import Icon from '@iconify/svelte';
	import PopoverMenu from '@/components/ui/PopoverMenu.svelte';

	const languages = [
		{ code: 'ru', name: 'Русский', flag: 'circle-flags:ru' },
		{ code: 'en', name: 'English', flag: 'circle-flags:gb' },
		{ code: 'ky', name: 'Кыргызча', flag: 'circle-flags:kg' },
		{ code: 'kz', name: 'Қазақша', flag: 'circle-flags:kz' },
		{ code: 'uz', name: "O'zbekcha", flag: 'circle-flags:uz' }
	];

	let isOpen = $state(false);

	const currentLang = $derived(
		languages.find((l) => l.code === $locale) ?? languages[0]
	);

	const handleLanguageChange = (lang: string) => {
		locale.set(lang);
		isOpen = false;
	};
</script>

<PopoverMenu bind:open={isOpen} placement="bottom-end">
	{#snippet children()}
		<button class="trigger" aria-label="Select language" aria-expanded={isOpen}>
			<Icon icon={currentLang.flag} width={20} />
			<span class="lang_name">{currentLang.name}</span>
			<span class="chevron" class:open={isOpen}>
				<Icon icon="lucide:chevron-down" width={14} />
			</span>
		</button>
	{/snippet}

	{#snippet content()}
		<div class="dropdown">
			{#each languages as { code, name, flag }}
				<button
					class="dropdown_item"
					class:active={$locale === code}
					onclick={() => handleLanguageChange(code)}
					aria-label="Switch to {name}"
				>
					<Icon icon={flag} width={22} />
					<span>{name}</span>
				</button>
			{/each}
		</div>
	{/snippet}
</PopoverMenu>

<style lang="scss">
	.trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 8px;
		background: none;
		border: none;
		color: var(--muted-fg);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: color 0.2s ease;

		&:hover {
			color: var(--foreground);
		}

		.lang_name {
			@media (max-width: 768px) {
				display: none;
			}
		}

		.chevron {
			display: flex;
			align-items: center;
			transition: transform 0.2s ease;

			&.open {
				transform: rotate(180deg);
			}
		}
	}

	.dropdown {
		min-width: 160px;
		background: var(--surface);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		overflow: hidden;
		padding: 0;

		.dropdown_item {
			display: flex;
			align-items: center;
			gap: 12px;
			width: 100%;
			padding: 10px 16px;
			border: none;
			background: transparent;
			color: var(--muted-fg);
			font-size: 14px;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.15s ease;
			text-align: left;
			font-family: var(--font-sans);

			&:hover {
				background: var(--surface-hover);
				color: var(--foreground);
			}

			&.active {
				background: var(--primary-subtle);
				color: var(--primary-light);
				font-weight: 600;
			}
		}
	}
</style>
