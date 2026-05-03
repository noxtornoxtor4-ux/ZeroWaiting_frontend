let screeningId = $state<string | null>(null);
let selectedIds = $state<string[]>([]);

export const seatSelection = {
	get selectedIds() {
		return selectedIds;
	},
	get count() {
		return selectedIds.length;
	},
	get isEmpty() {
		return selectedIds.length === 0;
	},

	bind: (id: string) => {
		if (screeningId !== id) {
			screeningId = id;
			selectedIds = [];
		}
	},

	toggle: (seatId: string) => {
		selectedIds = selectedIds.includes(seatId)
			? selectedIds.filter((id) => id !== seatId)
			: [...selectedIds, seatId];
	},

	remove: (seatId: string) => {
		selectedIds = selectedIds.filter((id) => id !== seatId);
	},

	removeMany: (seatIds: string[]) => {
		if (seatIds.length === 0) return;
		const set = new Set(seatIds);
		selectedIds = selectedIds.filter((id) => !set.has(id));
	},

	clear: () => {
		selectedIds = [];
	}
};
