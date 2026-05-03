<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { crmQueryApi } from '@/api/endpoints';
	import { hasMinRole } from '@/lib/constants/roles';

	interface Props {
		minRole: string;
		redirectTo?: string;
		children: Snippet;
		fallback?: Snippet;
	}

	let { minRole, redirectTo, children, fallback }: Props = $props();

	const profileQuery = crmQueryApi.createGetProfileMeV1();
	const isLoading = $derived(profileQuery.isLoading);
	const hasAccess = $derived(hasMinRole(profileQuery.data?.role, minRole));

	$effect(() => {
		if (!browser) return;
		if (isLoading) return;

		if (!hasAccess && redirectTo) {
			goto(redirectTo);
		}
	});
</script>

{#if hasAccess}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
