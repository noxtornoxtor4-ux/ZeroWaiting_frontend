<script lang="ts">
	import Icon from '@iconify/svelte';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { signInWithPopup } from 'firebase/auth';
	import { getFirebaseAuth } from '@/lib/config/firebase';
	import { crmQueryApi } from '@/api/endpoints';
	import type { TokenResponseDto } from '@/api/model';
	import { authStore } from '@/lib/stores/auth';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';
	import Button from '@/components/ui/Button.svelte';

	let loading = $state(false);

	const handleGoogleSignIn = async () => {
		loading = true;

		try {
			const { auth, googleProvider } = getFirebaseAuth();
			const result = await signInWithPopup(auth, googleProvider);
			const idToken = await result.user.getIdToken();

			let response: TokenResponseDto;

			try {
				response = await crmQueryApi.postAuthGoogleSigninV1Mutation({
					idToken
				});
			} catch {
				response = await crmQueryApi.postAuthGoogleSignupV1Mutation({
					idToken
				});
			}

			authStore.setTokens(
				response.accessToken,
				response.refreshToken,
				response.accessTokenExpiresIn,
				response.refreshTokenExpiresIn
			);

			toast.success('Добро пожаловать!');
			goto('/');
		} catch (error) {
			console.error('Auth error:', error);
			toast.error(getErrorMessage(error, 'Ошибка авторизации'));
		} finally {
			loading = false;
		}
	};
</script>

<div class="signin">
	<div class="card">
		<div class="header">
			<span class="logo">ZeroWaiting</span>
			<h1 class="title">{$_('nav.signIn')}</h1>
			<p class="subtitle">{$_('home.heroSubtitle')}</p>
		</div>

		<div class="actions">
			<Button
				variant="outline"
				size="lg"
				fullWidth
				{loading}
				icon="logos:google-icon"
				onclick={handleGoogleSignIn}
			>
				Войти через Google
			</Button>
		</div>
	</div>
</div>

<style lang="scss">
	.signin {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-5);
		background: var(--background);

		.card {
			width: 100%;
			max-width: 420px;
			padding: var(--space-10);
			background: var(--surface);
			border: 1px solid var(--border-color);
			border-radius: var(--radius-xl);
			box-shadow: var(--shadow-lg);
		}

		.header {
			text-align: center;
			margin-bottom: var(--space-8);
		}

		.logo {
			font-size: var(--text-2xl);
			font-weight: var(--weight-bold);
			background: linear-gradient(
				135deg,
				var(--primary-300),
				var(--primary-500)
			);
			-webkit-background-clip: text;
			background-clip: text;
			color: transparent;
		}

		.title {
			font-size: var(--text-xl);
			font-weight: var(--weight-semibold);
			color: var(--foreground);
			margin-top: var(--space-4);
		}

		.subtitle {
			font-size: var(--text-sm);
			color: var(--muted-fg);
			margin-top: var(--space-2);
		}
	}
</style>
