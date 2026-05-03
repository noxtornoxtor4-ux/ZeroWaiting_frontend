import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'zerowaiting:admin:sidebarOpen';

const readInitial = (): boolean => {
	if (!browser) return true;
	const raw = localStorage.getItem(STORAGE_KEY);
	if (raw === null) return true;
	return raw === '1';
};

export const sidebarOpen = writable<boolean>(readInitial());

if (browser) {
	sidebarOpen.subscribe((value) => {
		localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
	});
}
