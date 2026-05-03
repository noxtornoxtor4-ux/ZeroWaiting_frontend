<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { PromoCodeEntity, DiscountType } from '@/api/model';
	import Modal from '@/components/ui/Modal.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Input from '@/components/ui/Input.svelte';
	import DatePicker from '@/components/ui/DatePicker.svelte';
	import Select from '@/components/ui/Select.svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';
	import {
		fromBackendCivilDate,
		toBackendCivilDate
	} from '@/lib/utils/datetime';

	interface Props {
		open: boolean;
		promoCode?: PromoCodeEntity | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let {
		open = $bindable(false),
		promoCode = null,
		onclose,
		onsaved
	}: Props = $props();

	const isEdit = $derived(!!promoCode);

	let code = $state('');
	let discountType = $state('PERCENTAGE');
	let discountValue = $state('');
	let minPurchase = $state('');
	let maxUses = $state('');
	let expiresAt = $state('');
	let loading = $state(false);

	const createMutation = crmQueryApi.createPostPromoCodesV1Mutation();
	const updateMutation = crmQueryApi.createPatchPromoCodesByIdV1Mutation();

	$effect(() => {
		if (promoCode) {
			code = promoCode.code ?? '';
			discountType = promoCode.discountType ?? 'PERCENTAGE';
			discountValue = String(promoCode.discountValue ?? '');
			minPurchase = promoCode.minPurchase ? String(promoCode.minPurchase) : '';
			maxUses = promoCode.maxUses ? String(promoCode.maxUses) : '';
			expiresAt = fromBackendCivilDate(promoCode.expiresAt);
		} else {
			code = '';
			discountType = 'PERCENTAGE';
			discountValue = '';
			minPurchase = '';
			maxUses = '';
			expiresAt = '';
		}
	});

	const handleSubmit = async () => {
		if (!code || !discountValue) {
			toast.error('Заполните обязательные поля');
			return;
		}

		loading = true;
		const data = {
			code,
			discountType: discountType as DiscountType,
			discountValue: Number(discountValue),
			minPurchase: minPurchase ? Number(minPurchase) : undefined,
			maxUses: maxUses ? Number(maxUses) : undefined,
			expiresAt: expiresAt ? toBackendCivilDate(expiresAt) : undefined
		};

		try {
			if (isEdit && promoCode) {
				await updateMutation.mutateAsync({ id: promoCode.id, data });
				toast.success('Промокод обновлён');
			} else {
				await createMutation.mutateAsync({ data });
				toast.success('Промокод создан');
			}
			onsaved();
			onclose();
		} catch (error) {
			toast.error(getErrorMessage(error, 'Ошибка сохранения'));
		} finally {
			loading = false;
		}
	};
</script>

<Modal
	bind:open
	title={isEdit ? 'Редактировать промокод' : 'Добавить промокод'}
	onClose={onclose}
	maxWidth="480px"
>
	<div class="form">
		<Input label="Код" bind:value={code} required placeholder="SUMMER2026" />
		<div class="row">
			<Select
				label="Тип скидки"
				bind:value={discountType}
				options={[
					{ value: 'PERCENTAGE', label: 'Процент' },
					{ value: 'FIXED', label: 'Фиксированная' }
				]}
			/>
			<Input
				label="Значение скидки"
				bind:value={discountValue}
				type="number"
				required
			/>
		</div>
		<div class="row">
			<Input
				label="Мин. сумма покупки"
				bind:value={minPurchase}
				type="number"
			/>
			<Input label="Макс. использований" bind:value={maxUses} type="number" />
		</div>
		<DatePicker label="Дата истечения" bind:value={expiresAt} />
	</div>

	{#snippet footer(close)}
		<Button variant="ghost" onclick={close}>Отмена</Button>
		<Button variant="primary" {loading} onclick={handleSubmit}>Сохранить</Button
		>
	{/snippet}
</Modal>

<style lang="scss">
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);

		.row {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: var(--space-4);
		}
	}
</style>
