<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { CinemaEntity } from '@/api/model';
	import Modal from '@/components/ui/Modal.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Input from '@/components/ui/Input.svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';

	interface Props {
		open: boolean;
		cinema?: CinemaEntity | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let {
		open = $bindable(false),
		cinema = null,
		onclose,
		onsaved
	}: Props = $props();

	const isEdit = $derived(!!cinema);

	let nameRu = $state('');
	let nameEn = $state('');
	let descriptionRu = $state('');
	let logoUrl = $state('');
	let website = $state('');
	let loading = $state(false);

	const createMutation = crmQueryApi.createPostCinemasV1Mutation();
	const updateMutation = crmQueryApi.createPatchCinemasByIdV1Mutation();

	$effect(() => {
		if (cinema) {
			nameRu = (cinema.name?.ru as string) ?? '';
			nameEn = (cinema.name?.en as string) ?? '';
			descriptionRu = (cinema.description?.ru as string) ?? '';
			logoUrl = cinema.logoUrl ?? '';
			website = cinema.website ?? '';
		} else {
			nameRu = '';
			nameEn = '';
			descriptionRu = '';
			logoUrl = '';
			website = '';
		}
	});

	const handleSubmit = async () => {
		if (!nameRu) {
			toast.error('Заполните обязательные поля');
			return;
		}

		loading = true;
		const data = {
			name: { ru: nameRu, en: nameEn || nameRu },
			description: descriptionRu ? { ru: descriptionRu } : undefined,
			logoUrl: logoUrl || undefined,
			website: website || undefined
		};

		try {
			if (isEdit && cinema) {
				await updateMutation.mutateAsync({ id: cinema.id, data });
				toast.success('Кинотеатр обновлён');
			} else {
				await createMutation.mutateAsync({ data });
				toast.success('Кинотеатр создан');
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
	title={isEdit ? 'Редактировать кинотеатр' : 'Добавить кинотеатр'}
	onClose={onclose}
	maxWidth="480px"
>
	<div class="form">
		<Input label="Название (RU)" bind:value={nameRu} required />
		<Input label="Название (EN)" bind:value={nameEn} />
		<Input label="Описание (RU)" bind:value={descriptionRu} />
		<Input
			label="URL логотипа"
			bind:value={logoUrl}
			placeholder="https://..."
		/>
		<Input label="Веб-сайт" bind:value={website} placeholder="https://..." />
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
	}
</style>
