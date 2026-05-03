<script lang="ts">
	import { untrack } from 'svelte';
	import { crmQueryApi } from '@/api/endpoints';
	import type { BranchEntity } from '@/api/model';
	import Select, { type SelectOption } from '@/components/ui/Select.svelte';
	import { useDebouncedValue } from '@/lib/hooks/use-debounced-value.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';

	interface Props {
		label?: string;
		value: string;
		onChange: (branchId: string) => void;
		required?: boolean;
		disabled?: boolean;
		initialBranch?: BranchEntity | null;
	}

	let {
		label = 'Филиал',
		value,
		onChange,
		required = false,
		disabled = false,
		initialBranch = null
	}: Props = $props();

	let cinemaId = $state(untrack(() => initialBranch?.cinemaId ?? ''));

	let lastInitialBranchId = $state<string | null>(
		untrack(() => initialBranch?.id ?? null)
	);

	$effect(() => {
		const currentId = initialBranch?.id ?? null;
		if (currentId !== lastInitialBranchId) {
			lastInitialBranchId = currentId;
			untrack(() => {
				cinemaId = initialBranch?.cinemaId ?? '';
			});
		}
	});

	const cinemaSearch = useDebouncedValue('');
	const branchSearch = useDebouncedValue('');

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

	const cinemas = $derived(cinemasQuery.data?.data ?? []);
	const branches = $derived(branchesQuery.data?.data ?? []);

	const cinemaLoading = $derived(cinemasQuery.isLoading);
	const branchLoading = $derived(branchesQuery.isLoading);

	const cinemaOptions = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = cinemas.map((c) => ({
			value: c.id,
			label: getLocalizedValue(c.name)
		}));
		const fallback = initialBranch?.cinema;
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
		if (
			!branchSearch.debounced.trim() &&
			value &&
			initialBranch &&
			initialBranch.id === value &&
			!base.some((o) => o.value === value)
		) {
			return [
				{
					value: initialBranch.id,
					label: getLocalizedValue(initialBranch.name)
				},
				...base
			];
		}
		return base;
	});

	const handleCinemaChange = (nextId: string) => {
		cinemaId = nextId;
		if (value) onChange('');
	};
</script>

<div class="branch_select">
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
		{label}
		placeholder="Выберите филиал"
		showSearch
		allowClear
		{required}
		disabled={disabled || !cinemaId}
		loading={branchLoading}
		{value}
		options={branchOptions}
		onSearch={(q) => (branchSearch.value = q)}
		onChange={(vals) => onChange(String(vals[0] ?? ''))}
	/>
</div>

<style lang="scss">
	.branch_select {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
</style>
