export const useDebouncedValue = <T>(initial: T, delayMs = 300) => {
	let value = $state(initial);
	let debounced = $state(initial);

	$effect(() => {
		const snapshot = value;
		const timer = setTimeout(() => {
			debounced = snapshot;
		}, delayMs);
		return () => clearTimeout(timer);
	});

	return {
		get value() {
			return value;
		},
		set value(next: T) {
			value = next;
		},
		get debounced() {
			return debounced;
		}
	};
};
