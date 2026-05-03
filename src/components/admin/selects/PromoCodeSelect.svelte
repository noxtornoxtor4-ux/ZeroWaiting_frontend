<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { PromoCodeEntity } from '@/api/model';
	import Select, { type SelectOption } from '@/components/ui/Select.svelte';
	import { useDebouncedValue } from '@/lib/hooks/use-debounced-value.svelte';

	interface Props {
		label?: string;
		placeholder?: string;
		value: string;
		onChange: (id: string) => void;
		required?: boolean;
		disabled?: boolean;
		initialPromoCode?: PromoCodeEntity | null;
	}

	let {
		label = 'Промокод',
		placeholder = 'Выберите промокод',
		value,
		onChange,
		required = false,
		disabled = false,
		initialPromoCode = null
	}: Props = $props();

	const search = useDebouncedValue('');

	const query = crmQueryApi.createGetPromoCodesV1(() => ({
		page: 1,
		limit: 50,
		...(search.debounced.trim() && { code: search.debounced.trim() })
	}));

	const promoCodes = $derived(query.data?.data ?? []);
	const loading = $derived(query.isLoading);

	const options = $derived.by<SelectOption[]>(() => {
		const base: SelectOption[] = promoCodes.map((p) => ({
			value: p.id,
			label: p.code
		}));
		if (
			!search.debounced.trim() &&
			value &&
			initialPromoCode &&
			initialPromoCode.id === value &&
			!base.some((o) => o.value === value)
		) {
			return [
				{ value: initialPromoCode.id, label: initialPromoCode.code },
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
