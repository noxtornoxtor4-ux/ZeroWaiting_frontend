import { get } from 'svelte/store';
import { locale } from 'svelte-i18n';
import type { I18nField as ApiI18nField } from '@/api/model';

type I18nLike =
	| ApiI18nField
	| Record<string, string | undefined>
	| string
	| null
	| undefined;

export const getLocalizedValue = (
	field: I18nLike,
	currentLocale?: string | null
): string => {
	if (!field) return '';
	if (typeof field === 'string') return field;

	const lang = currentLocale ?? get(locale) ?? 'ru';
	const obj = field as Record<string, string | undefined>;
	return (
		obj[lang] ?? obj['ru'] ?? Object.values(obj).find((v) => v != null) ?? ''
	);
};
