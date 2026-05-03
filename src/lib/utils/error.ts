import { AxiosError } from 'axios';

export const getErrorMessage = (
	error: unknown,
	fallback: string,
	statusOverrides?: Record<number, string>
): string => {
	if (error instanceof AxiosError) {
		const status = error.response?.status;
		if (status !== undefined && statusOverrides?.[status]) {
			return statusOverrides[status];
		}
		const message = error.response?.data?.message;
		if (typeof message === 'string') return message;
		if (Array.isArray(message)) return message.join(', ');
	}
	return fallback;
};
