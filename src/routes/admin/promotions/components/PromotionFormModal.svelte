<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { PromotionEntity } from '@/api/model';
	import Modal from '@/components/ui/Modal.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Input from '@/components/ui/Input.svelte';
	import DatePicker from '@/components/ui/DatePicker.svelte';
	import Select from '@/components/ui/Select.svelte';
	import PromoCodeSelect from '@/components/admin/selects/PromoCodeSelect.svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';
	import {
		fromBackendCivilDate,
		toBackendCivilDate
	} from '@/lib/utils/datetime';

	interface Props {
		open: boolean;
		promotion?: PromotionEntity | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let {
		open = $bindable(false),
		promotion = null,
		onclose,
		onsaved
	}: Props = $props();

	const isEdit = $derived(!!promotion);

	let titleRu = $state('');
	let titleEn = $state('');
	let descriptionRu = $state('');
	let imageUrl = $state('');
	let promoCodeId = $state('');
	let startDate = $state('');
	let endDate = $state('');
	let isActive = $state('true');
	let loading = $state(false);

	const createMutation = crmQueryApi.createPostPromotionsV1Mutation();
	const updateMutation = crmQueryApi.createPatchPromotionsByIdV1Mutation();

	$effect(() => {
		if (promotion) {
			titleRu = (promotion.title?.ru as string) ?? '';
			titleEn = (promotion.title?.en as string) ?? '';
			descriptionRu = (promotion.description?.ru as string) ?? '';
			imageUrl = promotion.imageUrl ?? '';
			promoCodeId = promotion.promoCodeId ?? '';
			startDate = fromBackendCivilDate(promotion.startDate);
			endDate = fromBackendCivilDate(promotion.endDate);
			isActive = String(promotion.isActive);
		} else {
			titleRu = '';
			titleEn = '';
			descriptionRu = '';
			imageUrl = '';
			promoCodeId = '';
			startDate = '';
			endDate = '';
			isActive = 'true';
		}
	});

	const handleSubmit = async () => {
		if (!titleRu || !startDate || !endDate) {
			toast.error('Заполните обязательные поля');
			return;
		}

		loading = true;
		const data = {
			title: { ru: titleRu, en: titleEn || titleRu },
			description: descriptionRu ? { ru: descriptionRu } : undefined,
			imageUrl: imageUrl || undefined,
			promoCodeId: promoCodeId || undefined,
			startDate: toBackendCivilDate(startDate),
			endDate: toBackendCivilDate(endDate),
			isActive: isActive === 'true'
		};

		try {
			if (isEdit && promotion) {
				await updateMutation.mutateAsync({ id: promotion.id, data });
				toast.success('Акция обновлена');
			} else {
				await createMutation.mutateAsync({ data });
				toast.success('Акция создана');
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
	title={isEdit ? 'Редактировать акцию' : 'Добавить акцию'}
	onClose={onclose}
>
	<div class="form">
		<Input label="Заголовок (RU)" bind:value={titleRu} required />
		<Input label="Заголовок (EN)" bind:value={titleEn} />
		<Input label="Описание (RU)" bind:value={descriptionRu} />
		<Input
			label="URL изображения"
			bind:value={imageUrl}
			placeholder="https://..."
		/>
		<PromoCodeSelect
			value={promoCodeId}
			onChange={(id) => (promoCodeId = id)}
			initialPromoCode={promotion?.promoCode}
		/>
		<div class="row">
			<DatePicker label="Дата начала" bind:value={startDate} required />
			<DatePicker label="Дата окончания" bind:value={endDate} required />
		</div>
		<Select
			label="Активна"
			bind:value={isActive}
			options={[
				{ value: 'true', label: 'Да' },
				{ value: 'false', label: 'Нет' }
			]}
		/>
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
