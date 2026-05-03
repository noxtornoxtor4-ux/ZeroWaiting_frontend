<!-- <script lang="ts">
	const DESIGN_WIDTH = 1600;
	const BASE_FONT_SIZE = 16;

	let innerWidth = $state(0);

	$effect(() => {
		if (innerWidth > 0) {
			const scale = Math.min(innerWidth / DESIGN_WIDTH, 1);
			const newFontSize = BASE_FONT_SIZE * scale;
			document.documentElement.style.fontSize = `${newFontSize}px`;
		}
	});
</script>

<svelte:window bind:innerWidth /> -->

<script lang="ts">
	const DESIGN_WIDTH = 1600;
	const BASE_FONT_SIZE = 16;

	$effect(() => {
		const scale = Math.min(screen.width / DESIGN_WIDTH, 1);
		const newFontSize = BASE_FONT_SIZE * scale;
		console.log(
			`screen.width=${screen.width}, scale=${scale}, fontSize=${newFontSize}px`
		);
		document.documentElement.style.fontSize = `${newFontSize}px`;
	});
</script>
