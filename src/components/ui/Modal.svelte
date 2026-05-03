<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		title: string;
		children: Snippet;
		footer?: Snippet<[() => void]>;
		maxWidth?: string;
	}

	let {
		open = $bindable(false),
		onClose,
		title,
		children,
		footer,
		maxWidth = '560px'
	}: Props = $props();

	let exiting = $state(false);
	let inverseScale = $state(1);

	$effect(() => {
		if (!open) return;

		const updateScale = () => {
			const rootSize =
				parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
			inverseScale = 16 / rootSize;
		};

		document.body.style.overflow = 'hidden';
		updateScale();
		window.addEventListener('resize', updateScale);

		return () => {
			document.body.style.overflow = '';
			window.removeEventListener('resize', updateScale);
		};
	});

	const close = () => {
		exiting = true;
		setTimeout(() => {
			exiting = false;
			open = false;
			onClose();
		}, 220);
	};

	const handlePositionerMouseDown = (e: MouseEvent) => {
		if (e.target === e.currentTarget) close();
	};
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && open && !exiting) close();
	}}
/>

{#if open || exiting}
	<div class="Modal">
		<div class="backdrop" class:exiting></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="positioner" onmousedown={handlePositionerMouseDown}>
			<div
				class="scale_wrap"
				style="transform: scale({inverseScale}); max-width: calc({maxWidth} / {inverseScale}); max-height: calc((100dvh - 32px) / {inverseScale})"
			>
				<div
					class="content"
					class:exiting
					role="dialog"
					aria-modal="true"
					aria-label={title}
				>
					<header class="header">
						<span class="title">{title}</span>
						<button type="button" class="close" onclick={close}>
							<Icon icon="lucide:x" width={16} />
						</button>
					</header>

					<div class="body">
						{@render children()}
					</div>

					{#if footer}
						<footer class="footer">
							{@render footer(close)}
						</footer>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.Modal {
		.backdrop {
			position: fixed;
			inset: 0;
			z-index: 50;
			background-color: rgba(0, 0, 0, 0.6);
			backdrop-filter: blur(2px);
			opacity: 1;
			transition: opacity 220ms ease;

			@starting-style {
				opacity: 0;
			}

			&.exiting {
				opacity: 0;
			}
		}

		.positioner {
			position: fixed;
			inset: 0;
			z-index: 51;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 16px;
		}

		.scale_wrap {
			width: 100%;
			transform-origin: center center;
			display: flex;
			max-height: 100%;
		}

		.content {
			--modal-padding: 12px;

			background: var(--surface);
			border: 1px solid var(--border-color);
			border-radius: 12px;
			overflow: hidden;
			padding: 0;
			width: 100%;
			max-height: 100%;
			display: flex;
			flex-direction: column;
			box-shadow:
				0 20px 60px rgba(0, 0, 0, 0.4),
				0 4px 12px rgba(0, 0, 0, 0.2);
			opacity: 1;
			transform: scale(1) translateY(0);
			transition:
				opacity 220ms ease,
				transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
			will-change: transform, opacity;

			@starting-style {
				opacity: 0;
				transform: scale(0.92) translateY(12px);
			}

			&.exiting {
				opacity: 0;
				transform: scale(0.92) translateY(12px);
				transition-timing-function: ease, ease;
			}

			.header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				background: linear-gradient(
					135deg,
					var(--primary-700),
					var(--primary-500)
				);
				padding: var(--modal-padding) var(--modal-padding) var(--modal-padding)
					calc(var(--modal-padding) + 10px);
			}

			.title {
				font-size: 15px;
				font-weight: 600;
				color: #ffffff;
			}

			.close {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 32px;
				height: 32px;
				border-radius: 6px;
				border: none;
				background: none;
				color: rgba(255, 255, 255, 0.8);
				cursor: pointer;

				&:hover {
					background-color: rgba(255, 255, 255, 0.15);
					color: #ffffff;
				}
			}

			.body {
				font-size: 14px;
				color: var(--foreground);
				padding: var(--modal-padding);
				overflow-y: auto;
				flex: 1;
			}

			.footer {
				display: flex;
				justify-content: flex-end;
				gap: 8px;
				padding: 0 var(--modal-padding) var(--modal-padding);
			}
		}
	}
</style>
