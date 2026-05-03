import { untrack } from 'svelte';
import { goto } from '$app/navigation';
import { page as pageState } from '$app/state';
import { browser } from '$app/environment';

export interface TableQueryOptions<F extends Record<string, string>> {
	defaultLimit?: number;
	filters?: F;
	searchKey?: string;
	dateFromKey?: string;
	dateToKey?: string;
	syncUrl?: boolean;
	debounceMs?: number;
}

export interface TableQueryParams {
	page: number;
	limit: number;
	[key: string]: string | number | undefined;
}

const parseInt1 = (v: string | null, fallback: number): number => {
	if (v == null) return fallback;
	const n = Number(v);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const readInitialFilters = <F extends Record<string, string>>(
	defaults: F,
	syncUrl: boolean
): F => {
	if (!syncUrl) return { ...defaults };
	const result = { ...defaults };
	for (const key of Object.keys(defaults) as Array<keyof F>) {
		const urlValue = pageState.url.searchParams.get(key as string);
		if (urlValue != null) result[key] = urlValue as F[keyof F];
	}
	return result;
};

export const useTableQuery = <
	T = TableQueryParams,
	F extends Record<string, string> = Record<string, never>
>(
	options: TableQueryOptions<F> = {}
) => {
	const {
		defaultLimit = 15,
		filters: filterDefaults = {} as F,
		searchKey,
		dateFromKey = 'dateFrom',
		dateToKey = 'dateTo',
		syncUrl = true,
		debounceMs = 300
	} = options;

	const url = pageState.url;
	const initialPage = syncUrl ? parseInt1(url.searchParams.get('page'), 1) : 1;
	const initialLimit = syncUrl
		? parseInt1(url.searchParams.get('limit'), defaultLimit)
		: defaultLimit;
	const initialSearch = syncUrl ? (url.searchParams.get('search') ?? '') : '';
	const initialDateFrom = syncUrl
		? (url.searchParams.get('dateFrom') ?? '')
		: '';
	const initialDateTo = syncUrl ? (url.searchParams.get('dateTo') ?? '') : '';
	const initialFilters = readInitialFilters(filterDefaults, syncUrl);

	let currentPage = $state(initialPage);
	let currentLimit = $state(initialLimit);
	let searchInput = $state(initialSearch);
	let searchDebounced = $state(initialSearch);
	let dateFrom = $state(initialDateFrom);
	let dateTo = $state(initialDateTo);
	let filterState = $state<F>(initialFilters);

	$effect(() => {
		const next = searchInput;
		if (next === untrack(() => searchDebounced)) return;
		const timer = setTimeout(() => {
			searchDebounced = next;
			currentPage = 1;
		}, debounceMs);
		return () => clearTimeout(timer);
	});

	if (syncUrl) {
		$effect(() => {
			const p = currentPage;
			const l = currentLimit;
			const s = searchDebounced;
			const df = dateFrom;
			const dt = dateTo;
			const fs = filterState;

			if (!browser) return;

			const params = new URLSearchParams();
			if (p > 1) params.set('page', String(p));
			if (l !== defaultLimit) params.set('limit', String(l));
			if (s) params.set('search', s);
			if (df) params.set('dateFrom', df);
			if (dt) params.set('dateTo', dt);
			for (const key of Object.keys(fs) as Array<keyof F>) {
				const value = fs[key];
				if (value) params.set(key as string, String(value));
			}

			const nextQs = params.toString();

			untrack(() => {
				const currentQs = pageState.url.searchParams.toString();
				if (nextQs === currentQs) return;
				const pathname = pageState.url.pathname;
				const target = nextQs ? `${pathname}?${nextQs}` : pathname;
				goto(target, { replaceState: true, noScroll: true, keepFocus: true });
			});
		});
	}

	const params = $derived.by<TableQueryParams>(() => {
		const result: TableQueryParams = {
			page: currentPage,
			limit: currentLimit
		};
		if (searchDebounced) {
			result[searchKey ?? 'search'] = searchDebounced;
		}
		if (dateFrom) result[dateFromKey] = dateFrom;
		if (dateTo) result[dateToKey] = dateTo;
		for (const key of Object.keys(filterState) as Array<keyof F>) {
			const value = filterState[key];
			if (value) result[key as string] = value;
		}
		return result;
	});

	return {
		get page() {
			return currentPage;
		},
		get limit() {
			return currentLimit;
		},
		get searchInput() {
			return searchInput;
		},
		set searchInput(value: string) {
			searchInput = value;
		},
		get search() {
			return searchDebounced;
		},
		get dateFrom() {
			return dateFrom;
		},
		get dateTo() {
			return dateTo;
		},
		get filters() {
			return filterState;
		},
		get params() {
			return params as T;
		},
		setPage: (value: number) => {
			currentPage = value;
		},
		setLimit: (value: number) => {
			currentLimit = value;
			currentPage = 1;
		},
		setSearch: (value: string) => {
			searchInput = value;
		},
		setDateFrom: (value: string) => {
			dateFrom = value;
			currentPage = 1;
		},
		setDateTo: (value: string) => {
			dateTo = value;
			currentPage = 1;
		},
		setDateRange: (from: string, to: string) => {
			dateFrom = from;
			dateTo = to;
			currentPage = 1;
		},
		setFilter: <K extends keyof F>(key: K, value: F[K]) => {
			filterState = { ...filterState, [key]: value };
			currentPage = 1;
		},
		reset: () => {
			currentPage = 1;
			currentLimit = defaultLimit;
			searchInput = '';
			searchDebounced = '';
			dateFrom = '';
			dateTo = '';
			filterState = { ...filterDefaults };
		}
	};
};
