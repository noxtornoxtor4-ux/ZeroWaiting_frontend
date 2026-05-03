<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { FoodItemEntity } from '@/api/model';
	import Modal from '@/components/ui/Modal.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Input from '@/components/ui/Input.svelte';
	import Select from '@/components/ui/Select.svelte';
	import BranchSelect from '@/components/admin/selects/BranchSelect.svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';

	interface Props {
		open: boolean;
		foodItem?: FoodItemEntity | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let {
		open = $bindable(false),
		foodItem = null,
		onclose,
		onsaved
	}: Props = $props();

	const isEdit = $derived(!!foodItem);

	let nameRu = $state('');
	let nameEn = $state('');
	let descriptionRu = $state('');
	let price = $state('');
	let category = $state('');
	let imageUrl = $state('');
	let isAvailable = $state('true');
	let branchId = $state('');
	let loading = $state(false);

	const createMutation = crmQueryApi.createPostFoodItemsV1Mutation();
	const updateMutation = crmQueryApi.createPatchFoodItemsByIdV1Mutation();

	$effect(() => {
		if (foodItem) {
			nameRu = (foodItem.name?.ru as string) ?? '';
			nameEn = (foodItem.name?.en as string) ?? '';
			descriptionRu = (foodItem.description?.ru as string) ?? '';
			price = String(foodItem.price ?? '');
			category = foodItem.category ?? '';
			imageUrl = foodItem.imageUrl ?? '';
			isAvailable = String(foodItem.isAvailable);
			branchId = foodItem.branchId ?? '';
		} else {
			nameRu = '';
			nameEn = '';
			descriptionRu = '';
			price = '';
			category = '';
			imageUrl = '';
			isAvailable = 'true';
			branchId = '';
		}
	});

	const handleSubmit = async () => {
		if (!nameRu || !price || !category) {
			toast.error('Заполните обязательные поля');
			return;
		}

		loading = true;
		const data = {
			name: { ru: nameRu, en: nameEn || nameRu },
			description: descriptionRu ? { ru: descriptionRu } : undefined,
			price: Number(price),
			category,
			imageUrl: imageUrl || undefined,
			isAvailable: isAvailable === 'true',
			branchId: branchId || undefined
		};

		try {
			if (isEdit && foodItem) {
				await updateMutation.mutateAsync({ id: foodItem.id, data });
				toast.success('Позиция обновлена');
			} else {
				await createMutation.mutateAsync({ data });
				toast.success('Позиция создана');
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
	title={isEdit ? 'Редактировать позицию' : 'Добавить позицию'}
	onClose={onclose}
>
	<div class="form">
		<Input label="Название (RU)" bind:value={nameRu} required />
		<Input label="Название (EN)" bind:value={nameEn} />
		<Input label="Описание (RU)" bind:value={descriptionRu} />
		<div class="row">
			<Input label="Цена" bind:value={price} type="number" required />
			<Input
				label="Категория"
				bind:value={category}
				required
				placeholder="POPCORN, DRINKS..."
			/>
		</div>
		<Input
			label="URL изображения"
			bind:value={imageUrl}
			placeholder="https://..."
		/>
		<BranchSelect
			value={branchId}
			onChange={(id) => (branchId = id)}
			initialBranch={foodItem?.branch}
		/>
		<Select
			label="Доступно"
			bind:value={isAvailable}
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
