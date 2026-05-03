<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import AdminSidebar from '@/components/admin/layout/AdminSidebar.svelte';
	import AdminHeader from '@/components/admin/layout/AdminHeader.svelte';
	import ViewportScale from '@/components/admin/layout/ViewportScale.svelte';

	let { children } = $props();

	$effect(() => {
		if (!browser) return;

		const path = page.url.pathname as string;
		if (path === '/admin' || path === '/admin/') {
			goto('/admin/dashboard', { replaceState: true });
		}
	});
</script>

<ViewportScale />

<div class="layout">
	<AdminSidebar />
	<div class="content">
		<AdminHeader />
		<main class="main">
			{@render children()}
		</main>
	</div>
</div>

<style lang="scss">
	.layout {
		display: grid;
		grid-template-columns: auto 1fr;
		height: 100dvh;
		overflow: hidden;

		.content {
			display: grid;
			grid-template-rows: auto 1fr;
			overflow: hidden;

			.main {
				overflow-y: auto;
				padding: 10px 20px;
				display: flex;
				flex-direction: column;
			}
		}
	}
</style>
