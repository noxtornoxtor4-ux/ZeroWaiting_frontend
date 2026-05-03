<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { crmQueryApi } from '@/api/endpoints';
	import { UserRole, type SaveHallLayoutDto } from '@/api/model';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { getErrorMessage } from '@/lib/utils/error';
	import {
		createLayoutState,
		type LayoutState
	} from './lib/layout-state.svelte';
	import Palette from './components/Palette.svelte';
	import Toolbar from './components/Toolbar.svelte';
	import Canvas from './components/Canvas.svelte';
	import StatsPanel from './components/StatsPanel.svelte';

	const hallId = $derived(page.params.id ?? '');

	const hallQuery = crmQueryApi.createGetHallsByIdV1(() => hallId);
	const layoutQuery = crmQueryApi.createGetHallsByIdLayoutV1(() => hallId);
	const saveMutation = crmQueryApi.createPutHallsByIdLayoutV1Mutation();

	let editor = $state<LayoutState | null>(null);
	let saving = $state(false);

	$effect(() => {
		if (editor || !layoutQuery.data) return;
		const data = layoutQuery.data;
		editor = createLayoutState({
			layoutRows: data.layoutRows,
			layoutCols: data.layoutCols,
			cells: data.seats.map((s) => ({
				gridRow: s.gridRow,
				gridCol: s.gridCol,
				widthCells: s.widthCells as 1 | 2,
				type: s.type
			}))
		});
	});

	const formatConflicts = (error: unknown): string | null => {
		const raw = (error as { response?: { data?: unknown } })?.response?.data;
		if (!raw || typeof raw !== 'object') return null;
		const conflicts = (raw as { conflicts?: unknown }).conflicts;
		if (Array.isArray(conflicts) && conflicts.length > 0) {
			return `Нельзя удалить ${conflicts.length} мест с активными бронями`;
		}
		return null;
	};

	const handleSave = async () => {
		if (!editor || saving) return;
		saving = true;
		try {
			const payload: SaveHallLayoutDto = {
				layoutRows: editor.snapshot.layoutRows,
				layoutCols: editor.snapshot.layoutCols,
				seats: editor.snapshot.cells.map((c) => ({
					gridRow: c.gridRow,
					gridCol: c.gridCol,
					widthCells: c.widthCells,
					type: c.type
				}))
			};
			await saveMutation.mutateAsync({ id: hallId, data: payload });
			toast.success('Схема сохранена');
			await layoutQuery.refetch();
		} catch (error) {
			const conflictMsg = formatConflicts(error);
			toast.error(
				conflictMsg ?? getErrorMessage(error, 'Не удалось сохранить схему')
			);
		} finally {
			saving = false;
		}
	};

	const handleCancel = () => goto('/admin/halls');
</script>

<svelte:head>
	<title>{hallQuery.data?.name ?? 'Зал'} — схема</title>
</svelte:head>

<RoleGuard minRole={UserRole.ADMIN} redirectTo="/admin/dashboard">
	<div class="LayoutEditor">
		<div class="header">
			<a class="back" href="/admin/halls">← Все залы</a>
			<h1 class="title">
				{hallQuery.data?.name ?? 'Загрузка...'}
				<span class="suffix">— схема</span>
			</h1>
		</div>

		{#if layoutQuery.isLoading || !editor}
			<div class="loading">Загружаем схему...</div>
		{:else if layoutQuery.isError}
			<div class="loading">Не удалось загрузить схему.</div>
		{:else}
			<div class="workspace">
				<Palette layout={editor} />
				<div class="center">
					<Toolbar
						layout={editor}
						{saving}
						onSave={handleSave}
						onCancel={handleCancel}
					/>
					<Canvas layout={editor} />
				</div>
				<StatsPanel layout={editor} />
			</div>
		{/if}
	</div>
</RoleGuard>

<style lang="scss">
	.LayoutEditor {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 4px 0;

		.header {
			display: flex;
			flex-direction: column;
			gap: 4px;

			.back {
				font-size: 12px;
				color: var(--muted-fg);
				text-decoration: none;
				width: fit-content;

				&:hover {
					color: var(--foreground);
				}
			}

			.title {
				margin: 0;
				font-size: 22px;
				color: var(--foreground);

				.suffix {
					color: var(--muted-fg);
					font-weight: 400;
				}
			}
		}

		.workspace {
			display: grid;
			grid-template-columns: 80px 1fr 220px;
			gap: 18px;
			align-items: flex-start;

			.center {
				display: flex;
				flex-direction: column;
				gap: 12px;
				min-width: 0;
				overflow-x: auto;
			}
		}

		.loading {
			color: var(--muted-fg);
			padding: 40px;
			text-align: center;
			font-size: 13px;
		}
	}
</style>
