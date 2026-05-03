import axios, { type AxiosRequestConfig, type AxiosError } from 'axios';
import { API_BASE_URL } from '@/api/constants';
import { authStore } from '@/lib/stores/auth';
import type { TokenResponseDto } from '@/api/model';

export const axiosInstance = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		'Content-Type': 'application/json'
	}
});

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

const refreshTokens = async (): Promise<string> => {
	const refreshToken = authStore.getRefreshToken();

	if (!refreshToken) {
		throw new Error('No refresh token');
	}

	const { data } = await axios.post<TokenResponseDto>(
		`${API_BASE_URL}/api/v1/auth/refresh`,
		{ refreshToken }
	);

	authStore.setTokens(
		data.accessToken,
		data.refreshToken,
		data.accessTokenExpiresIn,
		data.refreshTokenExpiresIn
	);

	return data.accessToken;
};

const ensureAccessToken = async (): Promise<string | null> => {
	const accessToken = authStore.getAccessToken();
	if (accessToken) return accessToken;

	const refreshToken = authStore.getRefreshToken();
	if (!refreshToken) return null;

	if (isRefreshing && refreshPromise) {
		return refreshPromise;
	}

	isRefreshing = true;
	refreshPromise = refreshTokens().finally(() => {
		isRefreshing = false;
		refreshPromise = null;
	});

	return refreshPromise;
};

axiosInstance.interceptors.request.use(async (config) => {
	const token = await ensureAccessToken();

	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}

	return config;
});

axiosInstance.interceptors.response.use(
	(response) => response,
	async (error: AxiosError) => {
		const originalRequest = error.config as AxiosRequestConfig & {
			_retry?: boolean;
		};

		if (error.response?.status !== 401 || originalRequest._retry) {
			return Promise.reject(error);
		}

		originalRequest._retry = true;

		try {
			const newAccessToken = await ensureAccessToken();

			if (!newAccessToken) {
				return Promise.reject(error);
			}

			if (originalRequest.headers) {
				originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
			}

			return axiosInstance(originalRequest);
		} catch (refreshError) {
			const status = (refreshError as AxiosError)?.response?.status;
			if (status === 401 || status === 403) {
				authStore.logout();
			}

			return Promise.reject(refreshError);
		}
	}
);

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
	const headers =
		config.data instanceof FormData
			? { ...config.headers, 'Content-Type': undefined }
			: config.headers;

	return axiosInstance({ ...config, headers }).then((res) => res.data);
};
