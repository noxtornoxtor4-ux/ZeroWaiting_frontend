<script lang="ts">
	import Icon from '@iconify/svelte';

	interface Props {
		value?: string;
		label?: string;
		placeholder?: string;
		rows?: number;
		maxlength?: number;
		disabled?: boolean;
		required?: boolean;
		error?: string;
		options?: string[];
		onchange?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		label,
		placeholder,
		rows = 3,
		maxlength,
		disabled = false,
		required = false,
		error,
		options,
		onchange
	}: Props = $props();

	let dropdownOpen = $state(false);
	let wrapperEl = $state<HTMLDivElement | null>(null);

	const handleOptionClick = (optionValue: string) => {
		value = optionValue;
		onchange?.(optionValue);
		dropdownOpen = false;
	};

	const handleOutsideClick = (e: MouseEvent) => {
		if (!wrapperEl?.contains(e.target as Node)) dropdownOpen = false;
	};
</script>

<svelte:window onclick={handleOutsideClick} />

<div class="Textarea">
	{#if label || (options && options.length > 0)}
		<div class="header">
			{#if label}
				<span class="label">
					{label}
					{#if required}<span class="required">*</span>{/if}
					{#if maxlength}
						<span class="count">{value.length}/{maxlength}</span>
					{/if}
				</span>
			{/if}

			{#if options && options.length > 0}
				<div class="presets" bind:this={wrapperEl}>
					<button
						class="trigger"
						type="button"
						{disabled}
						onclick={(e) => {
							e.stopPropagation();
							dropdownOpen = !dropdownOpen;
						}}
					>
						<Icon icon="lucide:list" width={13} />
						Готовый текст
						<Icon
							icon="lucide:chevron-down"
							width={12}
							style="transform: rotate({dropdownOpen
								? 180
								: 0}deg); transition: transform 0.15s"
						/>
					</button>

					{#if dropdownOpen}
						<ul class="dropdown">
							{#each options as option (option)}
								<li>
									<button
										class="option"
										type="button"
										onclick={() => handleOptionClick(option)}
									>
										{option}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<textarea
		class="input"
		class:error={!!error}
		{placeholder}
		{rows}
		{maxlength}
		{disabled}
		{required}
		bind:value
		oninput={() => onchange?.(value)}
	></textarea>

	{#if error}
		<span class="error_text">{error}</span>
	{/if}
</div>

<style lang="scss">
	.Textarea {
		display: flex;
		flex-direction: column;
		gap: 6px;

		.header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
		}

		.label {
			font-size: 13px;
			color: var(--muted-fg);
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.required {
			color: var(--danger);
		}

		.count {
			font-size: 11px;
			color: var(--muted-fg);
			opacity: 0.7;
		}

		.error_text {
			font-size: 12px;
			color: var(--danger);
		}

		.input {
			width: 100%;
			padding: 9px 12px;
			border: 1px solid var(--border-color);
			border-radius: 8px;
			font-size: 14px;
			color: var(--foreground);
			background: var(--surface);
			outline: none;
			resize: vertical;
			box-sizing: border-box;
			font-family: inherit;
			line-height: 1.5;
			transition: border-color 0.15s;

			&::placeholder {
				color: var(--muted-fg);
			}

			&:focus {
				border-color: var(--primary);
			}

			&.error {
				border-color: var(--danger);
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
				resize: none;
			}
		}

		.presets {
			position: relative;

			.trigger {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: 3px 8px;
				border: 1px solid var(--border-color);
				border-radius: 6px;
				background: var(--surface);
				color: var(--muted-fg);
				font-size: 12px;
				font-weight: 500;
				cursor: pointer;
				white-space: nowrap;
				transition:
					border-color 0.15s,
					background 0.15s;

				&:hover:not(:disabled) {
					border-color: var(--primary);
					color: var(--primary);
				}

				&:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}
			}

			.dropdown {
				position: absolute;
				right: 0;
				top: calc(100% + 4px);
				z-index: 100;
				min-width: 220px;
				max-height: 240px;
				overflow-y: auto;
				background: var(--surface);
				border: 1px solid var(--border-color);
				border-radius: 8px;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
				padding: 4px;
				list-style: none;
				margin: 0;
			}

			.option {
				display: block;
				width: 100%;
				text-align: left;
				padding: 8px 10px;
				border: none;
				border-radius: 6px;
				background: none;
				font-size: 13px;
				color: var(--foreground);
				cursor: pointer;
				transition: background 0.12s;

				&:hover {
					background: var(--surface-hover);
					color: var(--primary-light);
				}
			}
		}
	}
</style>
