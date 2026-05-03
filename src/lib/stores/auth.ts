import { writable, derived, get } from 'svelte/store';

interface AuthState {
	accessToken: string | null;
	refreshToken: string | null;
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

const isBrowser = typeof window !== 'undefined';

const getCookie = (name: string): string | null => {
	if (!isBrowser) return null;
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
};

const setCookie = (name: string, value: string, maxAge: number) => {
	if (!isBrowser) return;
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
};

const deleteCookie = (name: string) => {
	if (!isBrowser) return;
	document.cookie = `${name}=; path=/; max-age=0`;
};

const readTokensFromCookies = (): AuthState => ({
	accessToken: getCookie(ACCESS_TOKEN_KEY),
	refreshToken: getCookie(REFRESH_TOKEN_KEY)
});

const createAuthStore = () => {
	const { subscribe, set } = writable<AuthState>(readTokensFromCookies());

	return {
		subscribe,

		setTokens(
			accessToken: string,
			refreshToken: string,
			accessTokenExpiresIn: number,
			refreshTokenExpiresIn: number
		) {
			setCookie(ACCESS_TOKEN_KEY, accessToken, accessTokenExpiresIn);
			setCookie(REFRESH_TOKEN_KEY, refreshToken, refreshTokenExpiresIn);
			set({ accessToken, refreshToken });
		},

		logout() {
			deleteCookie(ACCESS_TOKEN_KEY);
			deleteCookie(REFRESH_TOKEN_KEY);
			set({ accessToken: null, refreshToken: null });
		},

		getAccessToken: (): string | null => getCookie(ACCESS_TOKEN_KEY),

		getRefreshToken: (): string | null => getCookie(REFRESH_TOKEN_KEY),

		syncFromCookies: () => {
			set(readTokensFromCookies());
		}
	};
};

export const authStore = createAuthStore();

export const isAuthenticated = derived(
	authStore,
	($auth) => $auth.accessToken !== null
);
