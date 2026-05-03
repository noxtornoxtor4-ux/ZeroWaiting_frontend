import type { SeatType } from '@/api/model';

export interface SeatCell {
	gridRow: number;
	gridCol: number;
	widthCells: 1 | 2;
	type: SeatType;
}

export type PaintTool = SeatType | 'ERASER';

export interface LayoutSnapshot {
	layoutRows: number;
	layoutCols: number;
	cells: SeatCell[];
}

const UNDO_LIMIT = 20;

const cloneSnapshot = (s: LayoutSnapshot): LayoutSnapshot => ({
	layoutRows: s.layoutRows,
	layoutCols: s.layoutCols,
	cells: s.cells.map((c) => ({ ...c }))
});

export const createLayoutState = (initial: LayoutSnapshot) => {
	let current = $state<LayoutSnapshot>(cloneSnapshot(initial));
	let undoStack = $state<LayoutSnapshot[]>([]);
	let redoStack = $state<LayoutSnapshot[]>([]);
	let activeTool = $state<PaintTool>('STANDARD');

	const pushHistory = () => {
		undoStack.push(cloneSnapshot(current));
		if (undoStack.length > UNDO_LIMIT) undoStack.shift();
		redoStack = [];
	};

	const cellAt = (row: number, col: number): SeatCell | undefined =>
		current.cells.find(
			(c) =>
				c.gridRow === row && col >= c.gridCol && col < c.gridCol + c.widthCells
		);

	const setCell = (row: number, col: number, tool: PaintTool) => {
		const occupying = cellAt(row, col);

		if (tool === 'ERASER') {
			if (!occupying) return;
			pushHistory();
			current = {
				...current,
				cells: current.cells.filter((c) => c !== occupying)
			};
			return;
		}

		const widthCells: 1 | 2 = tool === 'LOVE_SEAT' ? 2 : 1;

		if (
			occupying &&
			occupying.type === tool &&
			occupying.widthCells === widthCells
		) {
			return;
		}

		if (col + widthCells > current.layoutCols) return;

		const displaced = new Set<SeatCell>();
		if (occupying) displaced.add(occupying);
		if (widthCells === 2) {
			const rightNeighbor = cellAt(row, col + 1);
			if (rightNeighbor) displaced.add(rightNeighbor);
		}

		pushHistory();
		const filtered = current.cells.filter((c) => !displaced.has(c));
		current = {
			...current,
			cells: [
				...filtered,
				{ gridRow: row, gridCol: col, widthCells, type: tool }
			]
		};
	};

	const resize = (rows: number, cols: number) => {
		if (rows === current.layoutRows && cols === current.layoutCols) return;
		pushHistory();
		const inBounds = current.cells.filter(
			(c) => c.gridRow < rows && c.gridCol + c.widthCells <= cols
		);
		current = { layoutRows: rows, layoutCols: cols, cells: inBounds };
	};

	const autoFillStandard = () => {
		pushHistory();
		const cells: SeatCell[] = [];
		for (let r = 0; r < current.layoutRows; r++) {
			for (let c = 0; c < current.layoutCols; c++) {
				cells.push({ gridRow: r, gridCol: c, widthCells: 1, type: 'STANDARD' });
			}
		}
		current = { ...current, cells };
	};

	const clear = () => {
		if (current.cells.length === 0) return;
		pushHistory();
		current = { ...current, cells: [] };
	};

	const undo = () => {
		const prev = undoStack.pop();
		if (!prev) return;
		redoStack.push(cloneSnapshot(current));
		current = prev;
	};

	const redo = () => {
		const next = redoStack.pop();
		if (!next) return;
		undoStack.push(cloneSnapshot(current));
		current = next;
	};

	return {
		get snapshot() {
			return current;
		},
		get activeTool() {
			return activeTool;
		},
		setActiveTool(t: PaintTool) {
			activeTool = t;
		},
		cellAt,
		setCell,
		resize,
		autoFillStandard,
		clear,
		undo,
		redo,
		canUndo: () => undoStack.length > 0,
		canRedo: () => redoStack.length > 0
	};
};

export type LayoutState = ReturnType<typeof createLayoutState>;
