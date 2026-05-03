import { browser } from '$app/environment';
import { init, register, locale, waitLocale } from 'svelte-i18n';

const defaultLocale = 'ru';

register('ky', () => import('./locales/ky.json'));
register('ru', () => import('./locales/ru.json'));
register('en', () => import('./locales/en.json'));
register('kz', () => import('./locales/kz.json'));
register('uz', () => import('./locales/uz.json'));

// Get saved locale or fallback to default (always KY for first visit)
const savedLocale = browser ? localStorage.getItem('svelte-i18n-locale') : null;
const initialLocale = savedLocale || defaultLocale;

init({
	fallbackLocale: defaultLocale,
	initialLocale: initialLocale,
	loadingDelay: 0
});

// Subscribe to locale changes to save to localStorage
if (browser) {
	locale.subscribe((value) => {
		if (value) {
			localStorage.setItem('svelte-i18n-locale', value);
		}
	});
}

// Export a promise that resolves when locale is loaded
export const localeLoaded = waitLocale();
