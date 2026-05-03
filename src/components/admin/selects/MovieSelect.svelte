<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { MovieEntity } from '@/api/model';
	import Select, { type SelectOption } from '@/components/ui/Select.svelte';
	import { useDebouncedValue } from '@/lib/hooks/use-debounced-value.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';

	interface Props {
		label?: string;
		placeholder?: string;
		value: string;
		onChange: (id: string) => void;
		required?: boolean;
		disabled?: boolean;
		initialMovie?: MovieEntity | null;
	}

	let {
		label = 'Фильм',
		placeholder = 'Выберите фильм',
		value,
		onChange,
		required = false,
		disabled = false,
		initialMovie = null
	}: Props = $props();

	const search = useDebouncedValue('');

	const query = crmQueryApi.createGetMoviesV1(() => ({
		page: 1,
		limit: 50,
		...(search.debounced.trim() && { title: search.debounced.trim() })
	}));

	const movies = $derived(query.data?.data ?? []);
	const loading = $derived(query.isLoading);

	const options = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = movies.map((m) => ({
			value: m.id,
			label: getLocalizedValue(m.title)
		}));
		if (
			!search.debounced.trim() &&
			value &&
			initialMovie &&
			initialMovie.id === value &&
			!base.some((o) => o.value === value)
		) {
			return [
				{
					value: initialMovie.id,
					label: getLocalizedValue(initialMovie.title)
				},
				...base
			];
		}
		return base;
	});
</script>

<Select
	{label}
	{placeholder}
	{required}
	{disabled}
	showSearch
	allowClear
	{loading}
	{value}
	{options}
	onSearch={(q) => (search.value = q)}
	onChange={(vals) => onChange(String(vals[0] ?? ''))}
/>
