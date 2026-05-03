<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import type { MovieEntity, MovieStatus } from '@/api/model';
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
		movie?: MovieEntity | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let {
		open = $bindable(false),
		movie = null,
		onclose,
		onsaved
	}: Props = $props();

	const isEdit = $derived(!!movie);

	let titleRu = $state('');
	let titleEn = $state('');
	let description = $state('');
	let duration = $state('');
	let genres = $state('');
	let language = $state('RU');
	let ageRating = $state('0+');
	let posterUrl = $state('');
	let trailerUrl = $state('');
	let releaseDate = $state('');
	let status = $state('UPCOMING');
	let loading = $state(false);

	const createMutation = crmQueryApi.createPostMoviesV1Mutation();
	const updateMutation = crmQueryApi.createPatchMoviesByIdV1Mutation();

	$effect(() => {
		if (movie) {
			titleRu = (movie.title?.ru as string) ?? '';
			titleEn = (movie.title?.en as string) ?? '';
			description = (movie.description?.ru as string) ?? '';
			duration = String(movie.duration ?? '');
			genres = (movie.genres ?? []).join(', ');
			language = movie.language ?? 'RU';
			ageRating = movie.ageRating ?? '0+';
			posterUrl = movie.posterUrl ?? '';
			trailerUrl = movie.trailerUrl ?? '';
			releaseDate = fromBackendCivilDate(movie.releaseDate);
			status = movie.status ?? 'UPCOMING';
		} else {
			titleRu = '';
			titleEn = '';
			description = '';
			duration = '';
			genres = '';
			language = 'RU';
			ageRating = '0+';
			posterUrl = '';
			trailerUrl = '';
			releaseDate = '';
			status = 'UPCOMING';
		}
	});

	const handleSubmit = async () => {
		if (!titleRu || !duration || !releaseDate) {
			toast.error('Заполните обязательные поля');
			return;
		}

		loading = true;
		const data = {
			title: { ru: titleRu, en: titleEn || titleRu },
			description: description ? { ru: description } : undefined,
			duration: Number(duration),
			genres: genres
				.split(',')
				.map((g) => g.trim())
				.filter(Boolean),
			language,
			ageRating,
			posterUrl: posterUrl || undefined,
			trailerUrl: trailerUrl || undefined,
			releaseDate: toBackendCivilDate(releaseDate),
			status: status as MovieStatus
		};

		try {
			if (isEdit && movie) {
				await updateMutation.mutateAsync({ id: movie.id, data });
				toast.success('Фильм обновлён');
			} else {
				await createMutation.mutateAsync({ data });
				toast.success('Фильм создан');
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
	title={isEdit ? 'Редактировать фильм' : 'Добавить фильм'}
	onClose={onclose}
>
	<div class="form">
		<Input label="Название (RU)" bind:value={titleRu} required />
		<Input label="Название (EN)" bind:value={titleEn} />
		<Input label="Описание (RU)" bind:value={description} />
		<div class="row">
			<Input
				label="Длительность (мин)"
				bind:value={duration}
				type="number"
				required
			/>
			<DatePicker label="Дата выхода" bind:value={releaseDate} required />
		</div>
		<Input
			label="Жанры (через запятую)"
			bind:value={genres}
			placeholder="Боевик, Драма"
		/>
		<div class="row triple">
			<Input label="Язык" bind:value={language} />
			<Input label="Возрастной рейтинг" bind:value={ageRating} />
			<Select
				label="Статус"
				bind:value={status}
				options={[
					{ value: 'UPCOMING', label: 'Скоро' },
					{ value: 'NOW_SHOWING', label: 'В прокате' },
					{ value: 'ARCHIVED', label: 'Архив' }
				]}
			/>
		</div>
		<Input
			label="URL постера"
			bind:value={posterUrl}
			placeholder="https://..."
		/>
		<Input
			label="URL трейлера"
			bind:value={trailerUrl}
			placeholder="https://..."
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

			&.triple {
				grid-template-columns: 1fr 1fr 1fr;
			}
		}
	}
</style>
