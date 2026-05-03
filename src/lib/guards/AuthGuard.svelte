<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { isAuthenticated } from '@/lib/stores/auth';
	import { crmQueryApi } from '@/api/endpoints';
	import { UserRole } from '@/api/model';
	import { hasMinRole } from '@/lib/constants/roles';

	const PROTECTED_PREFIXES = ['/profile', '/admin', '/scanner'];
	const AUTH_PATHS = ['/sign-in'];

	const profileQuery = crmQueryApi.createGetProfileMeV1(() => ({
		query: { enabled: $isAuthenticated }
	}));

	$effect(() => {
		if (!browser) return;

		const path = page.url.pathname;
		const isProtected = PROTECTED_PREFIXES.some((prefix) =>
			path.startsWith(prefix)
		);
		const isAuthPage = AUTH_PATHS.some((p) => path.startsWith(p));

		if (isProtected && !$isAuthenticated) {
			goto('/sign-in');
			return;
		}

		if (isAuthPage && $isAuthenticated) {
			goto('/');
			return;
		}

		if (!path.startsWith('/admin')) return;
		if (profileQuery.isLoading) return;

		if (!hasMinRole(profileQuery.data?.role, UserRole.STAFF)) {
			goto('/');
		}
	});
</script>
