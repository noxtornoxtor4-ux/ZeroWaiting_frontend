<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';

	let visible = $state(true);
	let hiding = $state(false);

	onMount(() => {
		document.body.style.overflow = 'hidden';
		document.documentElement.style.overflow = 'hidden';

		const timer = setTimeout(() => {
			hiding = true;
			setTimeout(() => {
				visible = false;
				document.body.style.overflow = '';
				document.documentElement.style.overflow = '';
			}, 600);
		}, 1400);

		return () => {
			clearTimeout(timer);
			document.body.style.overflow = '';
			document.documentElement.style.overflow = '';
		};
	});
</script>

{#if visible}
	<div class="Preloader" class:hiding>
		<div class="logo">
			<div class="logo_icon">
				<Icon icon="lucide:film" width={28} />
			</div>
			<span class="text">ZeroWaiting</span>
		</div>

		<div class="bar_wrap">
			<div class="bar"></div>
		</div>
	</div>
{/if}

<style lang="scss">
	.Preloader {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 40px;
		background: var(--background);
		opacity: 1;
		transition: opacity 0.6s ease;

		&.hiding {
			opacity: 0;
			pointer-events: none;
		}

		.logo {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			animation: fadeInDown 0.5s ease both;

			.logo_icon {
				width: 48px;
				height: 48px;
				background: linear-gradient(45deg, #8b5cf6, #a855f7);
				border-radius: 10px;
				display: flex;
				align-items: center;
				justify-content: center;
				color: white;
				box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
			}

			.text {
				font-size: 36px;
				font-weight: 700;
				background: linear-gradient(45deg, #ffffff, #c084fc);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
			}
		}

		.bar_wrap {
			width: 160px;
			height: 3px;
			border-radius: 9999px;
			background: var(--border-color);
			overflow: hidden;
			animation: fadeIn 0.4s ease 0.2s both;

			.bar {
				height: 100%;
				border-radius: 9999px;
				background: var(--primary);
				animation: load 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
			}
		}
	}

	@keyframes fadeInDown {
		from {
			opacity: 0;
			transform: translateY(-16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes load {
		from {
			width: 0%;
		}
		to {
			width: 100%;
		}
	}
</style>
