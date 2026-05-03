<script lang="ts">
	import type { SeatType } from '@/api/model';
	import { SEAT_TYPE_CONFIG } from '@/lib/constants/seat-types';
	import type { LayoutState, PaintTool } from '../lib/layout-state.svelte';

	interface Props {
		layout: LayoutState;
	}

	let { layout }: Props = $props();

	const TYPES: SeatType[] = [
		'STANDARD',
		'VIP',
		'LOVE_SEAT',
		'RECLINER',
		'WHEELCHAIR',
		'DIRECTOR'
	];

	const SHORT_LABEL: Record<SeatType, string> = {
		STANDARD: 'Std',
		VIP: 'VIP',
		LOVE_SEAT: 'Love',
		RECLINER: 'Recl',
		WHEELCHAIR: 'Whl',
		DIRECTOR: 'Dir'
	};

	const CODE_TO_TOOL: Record<string, PaintTool> = {
		Digit1: 'STANDARD',
		Digit2: 'VIP',
		Digit3: 'LOVE_SEAT',
		Digit4: 'RECLINER',
		Digit5: 'WHEELCHAIR',
		Digit6: 'DIRECTOR',
		Numpad1: 'STANDARD',
		Numpad2: 'VIP',
		Numpad3: 'LOVE_SEAT',
		Numpad4: 'RECLINER',
		Numpad5: 'WHEELCHAIR',
		Numpad6: 'DIRECTOR',
		KeyE: 'ERASER'
	};

	const onKey = (e: KeyboardEvent) => {
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		const target = e.target as HTMLElement | null;
		if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
		const tool = CODE_TO_TOOL[e.code];
		if (!tool) return;
		layout.setActiveTool(tool);
		e.preventDefault();
	};
</script>

<svelte:window onkeydown={onKey} />

<div class="Palette">
	<div class="section_label">Тип</div>
	{#each TYPES as t}
		{@const cfg = SEAT_TYPE_CONFIG[t]}
		<button
			type="button"
			class="btn"
			class:active={layout.activeTool === t}
			style:--tone={cfg.color}
			aria-label={SHORT_LABEL[t]}
			aria-pressed={layout.activeTool === t}
			onclick={() => layout.setActiveTool(t)}
		>
			<span class="swatch" class:wide={t === 'LOVE_SEAT'}></span>
			<span class="label">{SHORT_LABEL[t]}</span>
		</button>
	{/each}

	<button
		type="button"
		class="btn eraser"
		class:active={layout.activeTool === 'ERASER'}
		aria-label="Стереть"
		aria-pressed={layout.activeTool === 'ERASER'}
		onclick={() => layout.setActiveTool('ERASER')}
	>
		<span class="swatch"></span>
		<span class="label">Del</span>
	</button>
</div>

<style lang="scss">
	.Palette {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 64px;

		.section_label {
			font-size: 9px;
			letter-spacing: 1.5px;
			text-transform: uppercase;
			color: rgba(255, 255, 255, 0.4);
			padding: 0 4px 4px;
		}

		.btn {
			width: 100%;
			aspect-ratio: 1;
			background: rgba(255, 255, 255, 0.05);
			border: 1px solid transparent;
			border-radius: 6px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 4px;
			cursor: pointer;
			color: rgba(255, 255, 255, 0.8);
			transition:
				border-color 120ms ease,
				background 120ms ease;

			.swatch {
				height: 16px;
				width: 16px;
				border-radius: 3px;
				background: var(--tone, #6b7280);

				&.wide {
					width: 28px;
				}
			}

			.label {
				font-size: 10px;
			}

			&:hover {
				background: rgba(255, 255, 255, 0.08);
			}

			&.active {
				border-color: #a855f7;
				background: rgba(168, 85, 247, 0.18);
				box-shadow: 0 0 10px rgba(168, 85, 247, 0.35);
			}

			&.eraser .swatch {
				background: transparent;
				border: 1px dashed rgba(255, 255, 255, 0.4);
			}
		}
	}
</style>
