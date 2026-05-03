import type { QueryClient } from '@tanstack/svelte-query';

export const updateMovieFavoriteCache = (
	queryClient: QueryClient,
	movieId: string,
	isFavorite: boolean
) => {
	queryClient.setQueriesData(
		{ queryKey: ['/api/v1/public/movies'] },
		(old: unknown) => {
			if (!old || typeof old !== 'object') return old;
			const data = old as { data?: { id: string; isFavorite?: boolean }[] };
			if (!data.data) return old;
			return {
				...data,
				data: data.data.map((m) =>
					m.id === movieId ? { ...m, isFavorite } : m
				)
			};
		}
	);
};
