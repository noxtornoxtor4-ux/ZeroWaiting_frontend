import { get } from 'svelte/store';
import toast from 'svelte-french-toast';
import { isAuthenticated } from '@/lib/stores/auth';

export const requireAuth = (reason: string): boolean => {
	if (get(isAuthenticated)) return true;
	toast.error(reason);
	return false;
};
