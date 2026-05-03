<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { AnnouncementEntity } from '@/api/model';
	import Modal from '@/components/ui/Modal.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Input from '@/components/ui/Input.svelte';
	import DatePicker from '@/components/ui/DatePicker.svelte';
	import Select from '@/components/ui/Select.svelte';
	import MovieSelect from '@/components/admin/selects/MovieSelect.svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';
	import {
		fromBackendCivilDate,
		toBackendCivilDate
	} from '@/lib/utils/datetime';

	interface Props {
		open: boolean;
		announcement?: AnnouncementEntity | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let {
		open = $bindable(false),
		announcement = null,
		onclose,
		onsaved
	}: Props = $props();

	const isEdit = $derived(!!announcement);

	let titleRu = $state('');
	let titleEn = $state('');
	let descriptionRu = $state('');
	let imageUrl = $state('');
	let movieId = $state('');
	let publishDate = $state('');
	let expiryDate = $state('');
	let isActive = $state('true');
	let loading = $state(false);

	const createMutation = crmQueryApi.createPostAnnouncementsV1Mutation();
	const updateMutation = crmQueryApi.createPatchAnnouncementsByIdV1Mutation();

	$effect(() => {
		if (announcement) {
			titleRu = (announcement.title?.ru as string) ?? '';
			titleEn = (announcement.title?.en as string) ?? '';
			descriptionRu = (announcement.description?.ru as string) ?? '';
			imageUrl = announcement.imageUrl ?? '';
			movieId = announcement.movieId ?? '';
			publishDate = fromBackendCivilDate(announcement.publishDate);
			expiryDate = fromBackendCivilDate(announcement.expiryDate);
			isActive = String(announcement.isActive);
		} else {
			titleRu = '';
			titleEn = '';
			descriptionRu = '';
			imageUrl = '';
			movieId = '';
			publishDate = '';
			expiryDate = '';
			isActive = 'true';
		}
	});

	const handleSubmit = async () => {
		if (!titleRu) {
			toast.error('Заполните обязательные поля');
			return;
		}

		loading = true;
		const data = {
			title: JSON.stringify({ ru: titleRu, en: titleEn || titleRu }),
			description: descriptionRu
				? JSON.stringify({ ru: descriptionRu })
				: undefined,
			imageUrl: imageUrl || undefined,
			movieId: movieId || undefined,
			publishDate: publishDate ? toBackendCivilDate(publishDate) : undefined,
			expiryDate: expiryDate ? toBackendCivilDate(expiryDate) : undefined,
			isActive: isActive === 'true'
		};

		try {
			if (isEdit && announcement) {
				await updateMutation.mutateAsync({ id: announcement.id, data });
				toast.success('Анонс обновлён');
			} else {
				await createMutation.mutateAsync({ data });
				toast.success('Анонс создан');
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
	title={isEdit ? 'Редактировать анонс' : 'Добавить анонс'}
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
		<MovieSelect
			value={movieId}
			onChange={(id) => (movieId = id)}
			initialMovie={announcement?.movie}
		/>
		<div class="row">
			<DatePicker label="Дата публикации" bind:value={publishDate} />
			<DatePicker label="Дата истечения" bind:value={expiryDate} />
		</div>
		<Select
			label="Активен"
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
