<script lang="ts">
	import { untrack } from 'svelte';
	import { crmQueryApi } from '@/api/endpoints';
	import type { HallEntity } from '@/api/model';
	import Select, { type SelectOption } from '@/components/ui/Select.svelte';
	import { useDebouncedValue } from '@/lib/hooks/use-debounced-value.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';

	interface Props {
		label?: string;
		value: string;
		onChange: (hallId: string) => void;
		required?: boolean;
		disabled?: boolean;
		initialHall?: HallEntity | null;
	}

	let {
		label = 'Зал',
		value,
		onChange,
		required = false,
		disabled = false,
		initialHall = null
	}: Props = $props();

	let cinemaId = $state(untrack(() => initialHall?.branch?.cinemaId ?? ''));
	let branchId = $state(untrack(() => initialHall?.branchId ?? ''));
	let lastInitialHallId = $state<string | null>(
		untrack(() => initialHall?.id ?? null)
	);

	$effect(() => {
		const currentId = initialHall?.id ?? null;
		if (currentId !== lastInitialHallId) {
			lastInitialHallId = currentId;
			untrack(() => {
				cinemaId = initialHall?.branch?.cinemaId ?? '';
				branchId = initialHall?.branchId ?? '';
			});
		}
	});

	const cinemaSearch = useDebouncedValue('');
	const branchSearch = useDebouncedValue('');
	const hallSearch = useDebouncedValue('');

	const cinemasQuery = crmQueryApi.createGetCinemasV1(() => ({
		page: 1,
		limit: 50,
		...(cinemaSearch.debounced.trim() && {
			name: cinemaSearch.debounced.trim()
		})
	}));

	const branchesQuery = crmQueryApi.createGetCinemasByCinemaIdBranchesV1(
		() => cinemaId,
		() => ({
			page: 1,
			limit: 50,
			...(branchSearch.debounced.trim() && {
				search: branchSearch.debounced.trim()
			})
		}),
		() => ({ query: { enabled: !!cinemaId } })
	);

	const hallsQuery = crmQueryApi.createGetBranchesByBranchIdHallsV1(
		() => branchId,
		() => ({
			page: 1,
			limit: 50,
			...(hallSearch.debounced.trim() && {
				search: hallSearch.debounced.trim()
			})
		}),
		() => ({ query: { enabled: !!branchId } })
	);

	const cinemas = $derived(cinemasQuery.data?.data ?? []);
	const branches = $derived(branchesQuery.data?.data ?? []);
	const halls = $derived(hallsQuery.data?.data ?? []);

	const cinemaLoading = $derived(cinemasQuery.isLoading);
	const branchLoading = $derived(branchesQuery.isLoading);
	const hallLoading = $derived(hallsQuery.isLoading);

	const cinemaOptions = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = cinemas.map((c) => ({
			value: c.id,
			label: getLocalizedValue(c.name)
		}));
		const fallback = initialHall?.branch?.cinema;
		if (
			!cinemaSearch.debounced.trim() &&
			cinemaId &&
			fallback &&
			fallback.id === cinemaId &&
			!base.some((o) => o.value === cinemaId)
		) {
			return [
				{ value: fallback.id, label: getLocalizedValue(fallback.name) },
				...base
			];
		}
		return base;
	});

	const branchOptions = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = branches.map((b) => ({
			value: b.id,
			label: getLocalizedValue(b.name)
		}));
		const fallback = initialHall?.branch;
		if (
			!branchSearch.debounced.trim() &&
			branchId &&
			fallback &&
			fallback.id === branchId &&
			!base.some((o) => o.value === branchId)
		) {
			return [
				{ value: fallback.id, label: getLocalizedValue(fallback.name) },
				...base
			];
		}
		return base;
	});

	const hallOptions = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = halls.map((h) => ({
			value: h.id,
			label: h.name
		}));
		if (
			!hallSearch.debounced.trim() &&
			value &&
			initialHall &&
			initialHall.id === value &&
			!base.some((o) => o.value === value)
		) {
			return [{ value: initialHall.id, label: initialHall.name }, ...base];
		}
		return base;
	});

	const handleCinemaChange = (nextId: string) => {
		cinemaId = nextId;
		if (branchId) branchId = '';
		if (value) onChange('');
	};

	const handleBranchChange = (nextId: string) => {
		branchId = nextId;
		if (value) onChange('');
	};
</script>

<div class="hall_select">
	<Select
		label="Кинотеатр"
		placeholder="Выберите кинотеатр"
		showSearch
		allowClear
		{required}
		{disabled}
		loading={cinemaLoading}
		value={cinemaId}
		options={cinemaOptions}
		onSearch={(q) => (cinemaSearch.value = q)}
		onChange={(vals) => handleCinemaChange(String(vals[0] ?? ''))}
	/>
	<Select
		label="Филиал"
		placeholder="Выберите филиал"
		showSearch
		allowClear
		{required}
		disabled={disabled || !cinemaId}
		loading={branchLoading}
		value={branchId}
		options={branchOptions}
		onSearch={(q) => (branchSearch.value = q)}
		onChange={(vals) => handleBranchChange(String(vals[0] ?? ''))}
	/>
	<Select
		{label}
		placeholder="Выберите зал"
		showSearch
		allowClear
		{required}
		disabled={disabled || !branchId}
		loading={hallLoading}
		{value}
		options={hallOptions}
		onSearch={(q) => (hallSearch.value = q)}
		onChange={(vals) => onChange(String(vals[0] ?? ''))}
	/>
</div>

<style lang="scss">
	.hall_select {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
</style>
