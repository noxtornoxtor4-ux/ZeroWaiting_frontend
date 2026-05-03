import { MovieStatus } from '@/api/model';

export const MOVIE_STATUS_CONFIG: Record<
	string,
	{ labelKey: string; color: string }
> = {
	[MovieStatus.NOW_SHOWING]: {
		labelKey: 'movie.status.NOW_SHOWING',
		color: 'var(--success)'
	},
	[MovieStatus.UPCOMING]: {
		labelKey: 'movie.status.UPCOMING',
		color: 'var(--info)'
	},
	[MovieStatus.ARCHIVED]: {
		labelKey: 'movie.status.ARCHIVED',
		color: 'var(--muted-fg)'
	}
};
