<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { crmQueryApi } from '@/api/endpoints';
	import { ROLE_LABELS } from '@/lib/constants/roles';
	import SectionHeader from '@/components/ui/SectionHeader.svelte';
	import Input from '@/components/ui/Input.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Skeleton from '@/components/ui/Skeleton.svelte';
	import Avatar from '@/components/ui/Avatar.svelte';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';

	const profileQuery = crmQueryApi.createGetProfileMeV1();
	const updateMutation = crmQueryApi.createPatchProfileMeV1Mutation();

	const profile = $derived(profileQuery.data);

	let firstName = $state('');
	let lastName = $state('');
	let phone = $state('');
	let editing = $state(false);

	$effect(() => {
		if (profile) {
			firstName = profile.firstName ?? '';
			lastName = profile.lastName ?? '';
			phone = profile.phone ?? '';
		}
	});

	const handleSave = async () => {
		try {
			await updateMutation.mutateAsync({
				data: { firstName, lastName, phone: phone || undefined }
			});
			editing = false;
			toast.success('Профиль обновлён');
			profileQuery.refetch();
		} catch (error) {
			toast.error(getErrorMessage(error, 'Ошибка обновления'));
		}
	};
</script>

<svelte:head>
	<title>{$_('profile.title')} — ZeroWaiting</title>
</svelte:head>

{#if profileQuery.isLoading}
	<div>
		<SectionHeader title={$_('profile.title')} />
		<Skeleton height="200px" />
	</div>
{:else if profile}
	<div class="ProfilePage">
		<SectionHeader title={$_('profile.title')}>
			{#snippet actions()}
				{#if !editing}
					<Button
						variant="outline"
						size="sm"
						icon="lucide:pencil"
						onclick={() => {
							editing = true;
						}}
					>
						{$_('profile.editProfile')}
					</Button>
				{/if}
			{/snippet}
		</SectionHeader>

		<div class="card glass-card">
			<Avatar
				src={profile.photo}
				alt={profile.firstName}
				initials={(profile.firstName?.[0] ?? '') +
					(profile.lastName?.[0] ?? '')}
				size={80}
			/>

			{#if editing}
				<div class="form">
					<Input label="Имя" bind:value={firstName} required />
					<Input label="Фамилия" bind:value={lastName} />
					<Input label="Телефон" bind:value={phone} type="tel" />
					<div class="form_actions">
						<Button
							variant="ghost"
							onclick={() => {
								editing = false;
							}}
						>
							{$_('common.cancel')}
						</Button>
						<Button
							variant="primary"
							loading={updateMutation.isPending}
							onclick={handleSave}
						>
							{$_('common.save')}
						</Button>
					</div>
				</div>
			{:else}
				<div class="info">
					<div class="field">
						<span class="label">Имя</span>
						<span class="value"
							>{profile.firstName} {profile.lastName ?? ''}</span
						>
					</div>
					<div class="field">
						<span class="label">Email</span>
						<span class="value">{profile.email}</span>
					</div>
					{#if profile.phone}
						<div class="field">
							<span class="label">Телефон</span>
							<span class="value">{profile.phone}</span>
						</div>
					{/if}
					<div class="field">
						<span class="label">Роль</span>
						<span class="value"
							>{ROLE_LABELS[profile.role] ?? profile.role}</span
						>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	.ProfilePage {
		.card {
			padding: var(--space-6);
			display: flex;
			gap: var(--space-6);
			align-items: flex-start;
		}

		.form {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
			max-width: 400px;

			.form_actions {
				display: flex;
				gap: var(--space-3);
				justify-content: flex-end;
			}
		}

		.info {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: var(--space-4);

			.field {
				display: flex;
				flex-direction: column;
				gap: 2px;

				.label {
					font-size: var(--text-xs);
					color: var(--muted-fg);
					text-transform: uppercase;
					letter-spacing: 0.05em;
				}

				.value {
					font-size: var(--text-base);
					color: var(--foreground);
				}
			}
		}
	}

	@media (max-width: 640px) {
		.ProfilePage {
			.card {
				flex-direction: column;
				align-items: stretch;
				text-align: left;

				.form,
				.info {
					max-width: none;
					width: 100%;
				}
			}
		}
	}
</style>
