<script lang="ts">
	import { useQueryClient } from '@tanstack/svelte-query';
	import { crmQueryApi } from '@/api/endpoints';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';
	import { updateMovieFavoriteCache } from '@/lib/utils/favorite';
	import { requireAuth } from '@/lib/utils/auth-guard';

	interface Props {
		movieId: string;
		isFavorite?: boolean;
		size?: number;
	}

	let { movieId, isFavorite = false, size = 22 }: Props = $props();

	const queryClient = useQueryClient();

	let fav = $state(false);
	let loading = $state(false);

	$effect(() => {
		fav = isFavorite;
	});

	const addMutation =
		crmQueryApi.createPostProfileMeFavoritesByMovieIdV1Mutation();
	const removeMutation =
		crmQueryApi.createDeleteProfileMeFavoritesByMovieIdV1Mutation();

	const toggle = async () => {
		if (loading) return;
		if (!requireAuth('Войдите в аккаунт, чтобы сохранять фильмы в избранное'))
			return;

		const prev = fav;
		fav = !prev;
		loading = true;
		updateMovieFavoriteCache(queryClient, movieId, fav);

		try {
			if (prev) {
				await removeMutation.mutateAsync({ movieId });
			} else {
				await addMutation.mutateAsync({ movieId });
			}
			queryClient.invalidateQueries({
				queryKey: ['/api/v1/profile/me/favorites']
			});
		} catch (error) {
			fav = prev;
			updateMovieFavoriteCache(queryClient, movieId, prev);
			toast.error(getErrorMessage(error, 'Ошибка'));
		} finally {
			loading = false;
		}
	};
</script>

<button
	class="FavoriteButton"
	class:FavoriteButton--active={fav}
	onclick={(e) => {
		e.preventDefault();
		e.stopPropagation();
		toggle();
	}}
	aria-label={fav ? 'Убрать из избранного' : 'Добавить в избранное'}
	aria-busy={loading}
>
	<Icon icon={fav ? 'mdi:heart' : 'mdi:heart-outline'} width={size} />
</button>

<style lang="scss">
	.FavoriteButton {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted-fg);
		transition: all var(--duration-fast) var(--ease-default);
		padding: var(--space-1);
		border-radius: var(--radius-sm);

		&:hover {
			color: var(--danger);
		}

		&--active {
			color: var(--danger);
		}
	}
</style>
