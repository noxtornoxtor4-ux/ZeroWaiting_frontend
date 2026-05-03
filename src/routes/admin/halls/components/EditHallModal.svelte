<script lang="ts">
	import toast from 'svelte-french-toast';
	import { crmQueryApi } from '@/api/endpoints';
	import {
		HallType,
		type HallEntity,
		type CreateHallDtoType
	} from '@/api/model';
	import Modal from '@/components/ui/Modal.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Input from '@/components/ui/Input.svelte';
	import Select from '@/components/ui/Select.svelte';
	import { getErrorMessage } from '@/lib/utils/error';

	interface Props {
		open: boolean;
		hall: HallEntity | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let { open = $bindable(false), hall, onclose, onsaved }: Props = $props();

	let name = $state('');
	let type = $state<CreateHallDtoType>(HallType.STANDARD);
	let loading = $state(false);

	$effect(() => {
		if (open && hall) {
			name = hall.name;
			type = hall.type as CreateHallDtoType;
		}
	});

	$effect(() => {
		if (!open) loading = false;
	});

	const TYPE_OPTIONS = [
		{ value: HallType.STANDARD, label: 'Стандарт' },
		{ value: HallType.IMAX, label: 'IMAX' },
		{ value: HallType.VIP, label: 'VIP' }
	];

	const updateMutation = crmQueryApi.createPatchHallsByIdV1Mutation();

	const canSubmit = $derived(!!name.trim() && !!hall);

	const handleSubmit = async () => {
		if (!canSubmit || !hall || loading) return;

		loading = true;
		try {
			await updateMutation.mutateAsync({
				id: hall.id,
				data: { name: name.trim(), type }
			});
			toast.success('Зал обновлён');
			onsaved();
			onclose();
		} catch (error) {
			toast.error(getErrorMessage(error, 'Не удалось обновить зал'));
		} finally {
			loading = false;
		}
	};
</script>

<Modal bind:open title="Редактировать зал" onClose={onclose}>
	<div class="EditHallModal">
		<div class="form">
			<Input label="Название" bind:value={name} placeholder="Зал 1" required />
			<Select
				label="Тип"
				value={type}
				options={TYPE_OPTIONS}
				onChange={(vals) => (type = String(vals[0]) as CreateHallDtoType)}
			/>
		</div>
	</div>

	{#snippet footer(close)}
		<Button variant="ghost" onclick={close} disabled={loading}>Отмена</Button>
		<Button
			variant="primary"
			disabled={!canSubmit}
			{loading}
			onclick={handleSubmit}
		>
			Сохранить
		</Button>
	{/snippet}
</Modal>

<style lang="scss">
	.EditHallModal {
		.form {
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
			min-width: 380px;
		}
	}
</style>
