<script lang="ts">
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { crmQueryApi } from '@/api/endpoints';
	import { HallType, type CreateHallDtoType } from '@/api/model';
	import Modal from '@/components/ui/Modal.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Input from '@/components/ui/Input.svelte';
	import Select from '@/components/ui/Select.svelte';
	import { getLocalizedValue } from '@/lib/utils/i18n-field';
	import { getErrorMessage } from '@/lib/utils/error';

	interface Props {
		open: boolean;
		onclose: () => void;
		onsaved: () => void;
	}

	let { open = $bindable(false), onclose, onsaved }: Props = $props();

	let cinemaId = $state('');
	let branchId = $state('');
	let name = $state('');
	let type = $state<CreateHallDtoType>(HallType.STANDARD);
	let layoutRows = $state('10');
	let layoutCols = $state('14');
	let loading = $state(false);

	const cinemasQuery = crmQueryApi.createGetCinemasV1(() => ({
		page: 1,
		limit: 100
	}));
	const cinemaOptions = $derived(
		(cinemasQuery.data?.data ?? []).map((c) => ({
			value: c.id,
			label: getLocalizedValue(c.name)
		}))
	);

	const branchesQuery = crmQueryApi.createGetBranchesV1(
		() => ({ page: 1, limit: 100, cinemaId }),
		() => ({ query: { enabled: !!cinemaId } })
	);
	const branchOptions = $derived(
		(branchesQuery.data?.data ?? []).map((b) => ({
			value: b.id,
			label: getLocalizedValue(b.name)
		}))
	);

	$effect(() => {
		if (!cinemaId && branchId) branchId = '';
	});

	$effect(() => {
		if (!open) {
			cinemaId = '';
			branchId = '';
			name = '';
			type = HallType.STANDARD;
			layoutRows = '10';
			layoutCols = '14';
			loading = false;
		}
	});

	const TYPE_OPTIONS = [
		{ value: HallType.STANDARD, label: 'Стандарт' },
		{ value: HallType.IMAX, label: 'IMAX' },
		{ value: HallType.VIP, label: 'VIP' }
	];

	const createMutation =
		crmQueryApi.createPostBranchesByBranchIdHallsV1Mutation();

	const rowsNum = $derived(Number(layoutRows));
	const colsNum = $derived(Number(layoutCols));

	const canSubmit = $derived(
		!!cinemaId &&
			!!branchId &&
			!!name.trim() &&
			Number.isFinite(rowsNum) &&
			Number.isFinite(colsNum) &&
			rowsNum >= 1 &&
			rowsNum <= 50 &&
			colsNum >= 1 &&
			colsNum <= 50
	);

	const handleSubmit = async () => {
		if (!canSubmit || loading) return;

		loading = true;
		try {
			const hall = await createMutation.mutateAsync({
				branchId,
				data: {
					name: name.trim(),
					type,
					layoutRows: rowsNum,
					layoutCols: colsNum
				}
			});
			toast.success('Зал создан');
			onsaved();
			onclose();
			await goto(`/admin/halls/${hall.id}/layout`);
		} catch (error) {
			toast.error(getErrorMessage(error, 'Не удалось создать зал'));
		} finally {
			loading = false;
		}
	};
</script>

<Modal bind:open title="Создать зал" onClose={onclose}>
	<div class="CreateHallModal">
		<div class="form">
			<Select
				label="Кинотеатр"
				placeholder="Выберите кинотеатр"
				value={cinemaId}
				options={cinemaOptions}
				required
				onChange={(vals) => {
					cinemaId = String(vals[0] ?? '');
					branchId = '';
				}}
			/>
			<Select
				label="Филиал"
				placeholder="Выберите филиал"
				value={branchId}
				options={branchOptions}
				disabled={!cinemaId}
				required
				onChange={(vals) => (branchId = String(vals[0] ?? ''))}
			/>
			<Input label="Название" bind:value={name} placeholder="Зал 1" required />
			<Select
				label="Тип"
				value={type}
				options={TYPE_OPTIONS}
				onChange={(vals) => (type = String(vals[0]) as CreateHallDtoType)}
			/>
			<div class="grid_dims">
				<Input label="Рядов" type="number" bind:value={layoutRows} required />
				<Input label="Колонок" type="number" bind:value={layoutCols} required />
			</div>
			<p class="hint">Размеры от 1 до 50 по каждой оси.</p>
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
			Создать и перейти к схеме
		</Button>
	{/snippet}
</Modal>

<style lang="scss">
	.CreateHallModal {
		.form {
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
			min-width: 420px;

			.grid_dims {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--space-4);
			}

			.hint {
				margin: 0;
				font-size: 12px;
				color: var(--muted-fg);
			}
		}
	}
</style>
