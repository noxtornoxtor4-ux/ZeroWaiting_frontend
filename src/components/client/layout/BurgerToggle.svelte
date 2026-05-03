<script lang="ts">
	import { burgerMenuOpen } from '@/lib/stores/burgerMenu';
</script>

<button
	class="menu-toggle"
	onclick={() => burgerMenuOpen.update((v) => !v)}
	aria-label="Toggle menu"
>
	<svg
		class="ham hamRotate ham8"
		class:active={$burgerMenuOpen}
		viewBox="0 0 100 100"
		width="50"
	>
		<path
			class="line top"
			d="m 30,33 h 40 c 3.722839,0 7.5,3.126468 7.5,8.578427 0,5.451959 -2.727029,8.421573 -7.5,8.421573 h -20"
		/>
		<path class="line middle" d="m 30,50 h 40" />
		<path
			class="line bottom"
			d="m 70,67 h -40 c 0,0 -7.5,-0.802118 -7.5,-8.365747 0,-7.563629 7.5,-8.634253 7.5,-8.634253 h 20"
		/>
	</svg>
</button>

<style lang="scss">
	.menu-toggle {
		position: relative;
		overflow: hidden;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--muted-fg);
		cursor: pointer;

		.ham {
			position: absolute;
			-webkit-tap-highlight-color: transparent;
			transition: transform 400ms;
			user-select: none;

			&.hamRotate.active {
				transform: rotate(45deg);
			}

			.line {
				fill: none;
				transition:
					stroke-dasharray 400ms,
					stroke-dashoffset 400ms;
				stroke: currentColor;
				stroke-width: 5.5;
				stroke-linecap: round;
			}

			&.ham8 {
				.top {
					stroke-dasharray: 40 160;
				}

				.middle {
					stroke-dasharray: 40 142;
					transform-origin: 50%;
					transition: transform 400ms;
				}

				.bottom {
					stroke-dasharray: 40 85;
					transform-origin: 50%;
					transition:
						transform 400ms,
						stroke-dashoffset 400ms;
				}

				&.active {
					.top {
						stroke-dashoffset: -64px;
					}

					.middle {
						transform: rotate(90deg);
					}

					.bottom {
						stroke-dashoffset: -64px;
					}
				}
			}
		}
	}
</style>
