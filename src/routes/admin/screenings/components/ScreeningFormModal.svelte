<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { ScreeningEntity, CreateScreeningDtoFormat } from '@/api/model';
	import Modal from '@/components/ui/Modal.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Input from '@/components/ui/Input.svelte';
	import Select from '@/components/ui/Select.svelte';
	import DatePicker from '@/components/ui/DatePicker.svelte';
	import MovieSelect from '@/components/admin/selects/MovieSelect.svelte';
	import HallSelect from '@/components/admin/selects/HallSelect.svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';
	import { fromBackendInstant, toBackendInstant } from '@/lib/utils/datetime';

	interface Props {
		open: boolean;
		screening?: ScreeningEntity | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let {
		open = $bindable(false),
		screening = null,
		onclose,
		onsaved
	}: Props = $props();

	const isEdit = $derived(!!screening);

	let movieId = $state('');
	let hallId = $state('');
	let startTime = $state('');
	let endTime = $state('');
	let price = $state('');
	let format = $state('TWO_D');
	let loading = $state(false);

	const createMutation = crmQueryApi.createPostScreeningsV1Mutation();
	const updateMutation = crmQueryApi.createPatchScreeningsByIdV1Mutation();

	$effect(() => {
		if (screening) {
			movieId = screening.movieId ?? '';
			hallId = screening.hallId ?? '';
			startTime = fromBackendInstant(screening.startTime);
			endTime = fromBackendInstant(screening.endTime);
			price = String(screening.price ?? '');
			format = screening.format ?? 'TWO_D';
		} else {
			movieId = '';
			hallId = '';
			startTime = '';
			endTime = '';
			price = '';
			format = 'TWO_D';
		}
	});

	const handleSubmit = async () => {
		if (!movieId || !hallId || !startTime || !endTime || !price) {
			toast.error('Заполните обязательные поля');
			return;
		}

		loading = true;
		const data = {
			movieId,
			hallId,
			startTime: toBackendInstant(startTime),
			endTime: toBackendInstant(endTime),
			price,
			format: format as CreateScreeningDtoFormat
		};

		try {
			if (isEdit && screening) {
				await updateMutation.mutateAsync({ id: screening.id, data });
				toast.success('Сеанс обновлён');
			} else {
				await createMutation.mutateAsync({ data });
				toast.success('Сеанс создан');
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
	title={isEdit ? 'Редактировать сеанс' : 'Добавить сеанс'}
	onClose={onclose}
>
	<div class="form">
		<MovieSelect
			value={movieId}
			onChange={(id) => (movieId = id)}
			initialMovie={screening?.movie}
			required
		/>
		<HallSelect
			value={hallId}
			onChange={(id) => (hallId = id)}
			initialHall={screening?.hall}
			required
		/>
		<div class="row">
			<DatePicker
				label="Начало"
				value={startTime}
				withTime
				required
				onchange={(v) => (startTime = v)}
			/>
			<DatePicker
				label="Конец"
				value={endTime}
				withTime
				required
				onchange={(v) => (endTime = v)}
			/>
		</div>
		<div class="row">
			<Input label="Цена" bind:value={price} type="currency" required />
			<Select
				label="Формат"
				bind:value={format}
				options={[
					{ value: 'TWO_D', label: '2D' },
					{ value: 'THREE_D', label: '3D' },
					{ value: 'IMAX', label: 'IMAX' },
					{ value: 'DOLBY_ATMOS', label: 'Dolby Atmos' },
					{ value: 'FOUR_DX', label: '4DX' }
				]}
			/>
		</div>
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
