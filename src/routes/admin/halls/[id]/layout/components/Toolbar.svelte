<script lang="ts">
	import Button from '@/components/ui/Button.svelte';
	import Input from '@/components/ui/Input.svelte';
	import type { LayoutState } from '../lib/layout-state.svelte';

	interface Props {
		layout: LayoutState;
		saving: boolean;
		onSave: () => void;
		onCancel: () => void;
	}

	let { layout, saving, onSave, onCancel }: Props = $props();

	let rowsInput = $state('0');
	let colsInput = $state('0');

	$effect(() => {
		rowsInput = String(layout.snapshot.layoutRows);
		colsInput = String(layout.snapshot.layoutCols);
	});

	const applyResize = () => {
		const rows = Number(rowsInput);
		const cols = Number(colsInput);
		if (!Number.isFinite(rows) || !Number.isFinite(cols)) return;
		const clampedRows = Math.min(50, Math.max(1, Math.floor(rows)));
		const clampedCols = Math.min(50, Math.max(1, Math.floor(cols)));
		layout.resize(clampedRows, clampedCols);
	};
</script>

<div class="Toolbar">
	<div class="dim">
		<span>Рядов</span>
		<div class="dim_input">
			<Input type="number" bind:value={rowsInput} onblur={applyResize} />
		</div>
	</div>
	<div class="dim">
		<span>Колонок</span>
		<div class="dim_input">
			<Input type="number" bind:value={colsInput} onblur={applyResize} />
		</div>
	</div>

	<div class="sep"></div>

	<Button
		variant="ghost"
		size="sm"
		icon="lucide:grid-3x3"
		onclick={() => layout.autoFillStandard()}
	>
		Заполнить
	</Button>
	<Button
		variant="ghost"
		size="sm"
		icon="lucide:eraser"
		onclick={() => layout.clear()}
	>
		Очистить
	</Button>

	<div class="sep"></div>

	<Button
		variant="ghost"
		size="sm"
		icon="lucide:undo-2"
		disabled={!layout.canUndo()}
		onclick={() => layout.undo()}
	/>
	<Button
		variant="ghost"
		size="sm"
		icon="lucide:redo-2"
		disabled={!layout.canRedo()}
		onclick={() => layout.redo()}
	/>

	<div class="filler"></div>

	<Button variant="ghost" onclick={onCancel} disabled={saving}>Отмена</Button>
	<Button variant="primary" disabled={saving} loading={saving} onclick={onSave}>
		Сохранить схему
	</Button>
</div>

<style lang="scss">
	.Toolbar {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 8px;
		padding: 10px 12px;

		.dim {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 12px;
			color: rgba(255, 255, 255, 0.7);

			.dim_input {
				width: 80px;
			}
		}

		.sep {
			width: 1px;
			height: 20px;
			background: rgba(255, 255, 255, 0.1);
		}

		.filler {
			flex: 1;
		}
	}
</style>
