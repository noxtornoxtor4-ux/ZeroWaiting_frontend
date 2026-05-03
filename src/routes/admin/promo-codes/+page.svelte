<script lang="ts">
	import { crmQueryApi } from '@/api/endpoints';
	import RoleGuard from '@/lib/guards/RoleGuard.svelte';
	import { UserRole, DiscountType } from '@/api/model';
	import { useTableQuery } from '@/lib/hooks/use-table-query.svelte';
	import DataTable, { type Column } from '@/components/ui/DataTable.svelte';
	import SearchInput from '@/components/ui/SearchInput.svelte';
	import Select from '@/components/ui/Select.svelte';
	import Badge from '@/components/ui/Badge.svelte';
	import Button from '@/components/ui/Button.svelte';
	import Popconfirm from '@/components/ui/Popconfirm.svelte';
	import PromoCodeFormModal from './components/PromoCodeFormModal.svelte';
	import Icon from '@iconify/svelte';
	import toast from 'svelte-french-toast';
	import { getErrorMessage } from '@/lib/utils/error';
	import type { PromoCodeEntity, GetPromoCodesV1Params } from '@/api/model';

	type PromoFilters = {
		discountType: string;
		status: string;
	};

	const DISCOUNT_TYPE_LABELS: Record<string, string> = {
		PERCENTAGE: 'Процент',
		FIXED: 'Фикс. сумма'
	};

	const DISCOUNT_TYPE_OPTIONS = [
		{ value: DiscountType.PERCENTAGE, label: 'Процент' },
		{ value: DiscountType.FIXED, label: 'Фикс. сумма' }
	];

	const STATUS_OPTIONS = [
		{ value: 'true', label: 'Активные' },
		{ value: 'false', label: 'Неактивные' }
	];

	const table = useTableQuery<GetPromoCodesV1Params, PromoFilters>({
		searchKey: 'code',
		filters: { discountType: '', status: '' }
	});

	let formOpen = $state(false);
	let editingPromoCode = $state<PromoCodeEntity | null>(null);

	const queryParams = $derived<GetPromoCodesV1Params>({
		...table.params,
		...(table.filters.discountType && {
			discountType: table.filters.discountType as DiscountType
		}),
		...(table.filters.status && {
			isActive: table.filters.status === 'true'
		})
	});

	const query = crmQueryApi.createGetPromoCodesV1(() => queryParams);
	const data = $derived(query.data?.data ?? []);
	const meta = $derived(query.data?.meta);

	const deleteMutation = crmQueryApi.createDeletePromoCodesByIdV1Mutation();

	const handleCreate = () => {
		editingPromoCode = null;
		formOpen = true;
	};

	const handleEdit = (promoCode: PromoCodeEntity) => {
		editingPromoCode = promoCode;
		formOpen = true;
	};

	const handleDelete = async (id: string) => {
		await deleteMutation.mutateAsync({ id });
		query.refetch();
	};

	const formatDiscountValue = (row: PromoCodeEntity): string => {
		const value = Number(row.discountValue);
		if (row.discountType === DiscountType.PERCENTAGE) return `${value}%`;
		return `${value.toLocaleString('ru-RU')} сом`;
	};

	const formatUsage = (row: PromoCodeEntity): string =>
		row.maxUses != null
			? `${row.usedCount} / ${row.maxUses}`
			: `${row.usedCount}`;

	const formatExpiresAt = (row: PromoCodeEntity): string =>
		row.expiresAt ? new Date(row.expiresAt).toLocaleDateString('ru-RU') : '—';

	const copyCode = async (code: string) => {
		try {
			await navigator.clipboard.writeText(code);
			toast.success('Код скопирован');
		} catch (error) {
			toast.error(getErrorMessage(error, 'Не удалось скопировать'));
		}
	};

	const columns: Column<PromoCodeEntity>[] = [
		{ key: 'code', title: 'Код', minWidth: 160 },
		{ key: 'discountType', title: 'Тип скидки', width: '140px' },
		{
			key: 'discountValue',
			title: 'Значение',
			width: '120px',
			align: 'right',
			accessor: formatDiscountValue
		},
		{ key: 'isActive', title: 'Статус', width: '120px' },
		{
			key: 'usedCount',
			title: 'Использований',
			width: '140px',
			align: 'right',
			accessor: formatUsage
		},
		{
			key: 'expiresAt',
			title: 'Действует до',
			width: '140px',
			align: 'right',
			accessor: formatExpiresAt
		},
		{ key: 'actions', title: '', width: '80px', align: 'center' }
	];
</script>

<svelte:head><title>Промокоды — ZeroWaiting Admin</title></svelte:head>

<RoleGuard minRole={UserRole.ADMIN} redirectTo="/admin/dashboard">
	<div class="page">
		<div class="toolbar top">
			<div class="search">
				<SearchInput
					bind:value={table.searchInput}
					placeholder="Поиск по коду..."
				/>
			</div>
			<Button
				variant="primary"
				size="sm"
				icon="lucide:plus"
				onclick={handleCreate}
			>
				Добавить промокод
			</Button>
		</div>

		<div class="filters">
			<div class="filter">
				<Select
					label="Тип скидки"
					placeholder="Любой тип"
					value={table.filters.discountType}
					options={DISCOUNT_TYPE_OPTIONS}
					allowClear
					onChange={(vals) =>
						table.setFilter('discountType', String(vals[0] ?? ''))}
				/>
			</div>
			<div class="filter">
				<Select
					label="Статус"
					placeholder="Любой статус"
					value={table.filters.status}
					options={STATUS_OPTIONS}
					allowClear
					onChange={(vals) => table.setFilter('status', String(vals[0] ?? ''))}
				/>
			</div>
		</div>

		<DataTable
			{columns}
			{data}
			loading={query.isLoading}
			total={meta?.total ?? 0}
			page={table.page}
			pageSize={table.limit}
			onPageChange={table.setPage}
			onPageSizeChange={table.setLimit}
			rowKey={(row) => row.id}
		>
			{#snippet cell({ row, column, rowIndex })}
				{#if column.key === 'code'}
					<button
						type="button"
						class="code_cell"
						title="Скопировать код"
						onclick={() => copyCode(row.code)}
					>
						<span class="code_text">{row.code}</span>
						<Icon icon="lucide:copy" width={14} />
					</button>
				{:else if column.key === 'discountType'}
					<Badge
						text={DISCOUNT_TYPE_LABELS[row.discountType] ?? row.discountType}
						color="var(--info)"
						variant="outline"
					/>
				{:else if column.key === 'isActive'}
					<Badge
						text={row.isActive ? 'Активен' : 'Неактивен'}
						color={row.isActive ? 'var(--success)' : 'var(--muted-fg)'}
					/>
				{:else if column.key === 'actions'}
					<div class="cell_actions">
						<Button
							variant="icon"
							size="sm"
							icon="lucide:pencil"
							onclick={() => handleEdit(row)}
						/>
						<Popconfirm
							title="Удалить промокод?"
							onConfirm={() => handleDelete(row.id)}
							placement="bottom-start"
						>
							<Button
								variant="icon"
								intent="danger"
								size="sm"
								icon="lucide:trash-2"
							/>
						</Popconfirm>
					</div>
				{:else}
					{column.accessor?.(row, rowIndex) ?? '—'}
				{/if}
			{/snippet}
		</DataTable>
	</div>

	<PromoCodeFormModal
		bind:open={formOpen}
		promoCode={editingPromoCode}
		onclose={() => {
			formOpen = false;
		}}
		onsaved={() => {
			query.refetch();
		}}
	/>
</RoleGuard>

<style lang="scss">
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		flex: 1;
		min-height: 0;

		.toolbar.top {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;

			.search {
				flex: 1;
				max-width: 360px;
			}
		}

		.filters {
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
			align-items: flex-end;

			.filter {
				flex: 1 1 160px;
				min-width: 160px;
				max-width: 240px;
			}
		}

		.code_cell {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 4px 8px;
			margin: -4px -8px;
			background: transparent;
			border: 1px solid transparent;
			border-radius: 6px;
			color: inherit;
			cursor: pointer;
			transition:
				background 0.15s ease,
				border-color 0.15s ease,
				color 0.15s ease;

			.code_text {
				font-family: var(
					--font-mono,
					ui-monospace,
					SFMono-Regular,
					Menlo,
					monospace
				);
				font-weight: 600;
				letter-spacing: 0.5px;
			}

			:global(svg) {
				opacity: 0.5;
				transition: opacity 0.15s ease;
			}

			&:hover {
				background: rgba(139, 92, 246, 0.1);
				border-color: rgba(139, 92, 246, 0.2);
				color: #c084fc;

				:global(svg) {
					opacity: 1;
				}
			}

			&:focus-visible {
				outline: none;
				border-color: rgba(168, 85, 247, 0.6);
				box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2);
			}
		}

		.cell_actions {
			display: flex;
			align-items: center;
			gap: 4px;
		}
	}
</style>
