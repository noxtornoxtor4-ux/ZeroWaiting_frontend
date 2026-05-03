export default {
	plugins: {
		'postcss-pxtorem': {
			rootValue: 16, // Базовый размер шрифта (1rem = 16px)
			unitPrecision: 5, // Сколько знаков после запятой
			propList: ['*'], // Конвертировать все свойства (margin, padding, width и т.д.)
			selectorBlackList: [], // Какие классы игнорировать (если нужно)
			replace: true, // Заменять px на rem (не оставлять дубликаты)
			mediaQuery: true, // Конвертировать ли px внутри @media
			minPixelValue: 2 // Минимальное значение для конвертации (например, 1px для border останется в px)
		},
		autoprefixer: {} // Рекомендуется оставить для совместимости
	}
};
