export const formatPrice = (
	amount: number | string,
	currency = 'KGS'
): string => {
	const num = typeof amount === 'string' ? parseFloat(amount) : amount;

	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency,
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(num);
};

export const formatPriceCompact = (amount: number | string): string => {
	const num = typeof amount === 'string' ? parseFloat(amount) : amount;
	return `${Math.round(num)} сом`;
};
