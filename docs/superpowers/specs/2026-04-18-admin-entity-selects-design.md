# Admin Entity Selects — Design Spec

## Проблема

В админских модальных формах ряд foreign-key полей реализован как обычные `<Input>` с ручным вводом UUID:

- `ScreeningFormModal` — `ID фильма`, `ID зала`
- `AnnouncementFormModal` — `ID фильма`
- `PromotionFormModal` — `ID промокода`
- `FoodItemFormModal` — `ID филиала`

Админ вынужден копировать UUID из одного места в другое. Нет поиска, нет проверки, нет понятного лейбла. UX уровня «пользователь ищет ID в другой вкладке и вставляет в форму».

## Цель

Заменить сырые UUID-инпуты на поисковые селекты сущностей. Базовый компонент `Select.svelte` уже поддерживает `showSearch`, `onSearch`, portal внутри модалок — инфраструктура готова.

## Решение

Добавить четыре специализированных компонента-селекта в `src/components/admin/selects/`, каждый инкапсулирует endpoint, debounced серверный поиск, префилл при редактировании и (для каскадных) внутренние уровни.

### Новые файлы

```
src/lib/hooks/use-debounced-value.svelte.ts       # общий debounce-хук (300 мс)
src/components/admin/selects/MovieSelect.svelte
src/components/admin/selects/PromoCodeSelect.svelte
src/components/admin/selects/BranchSelect.svelte  # каскад Кинотеатр → Филиал
src/components/admin/selects/HallSelect.svelte    # каскад Кинотеатр → Филиал → Зал
```

### Затронутые файлы

```
src/routes/admin/screenings/components/ScreeningFormModal.svelte
src/routes/admin/announcements/components/AnnouncementFormModal.svelte
src/routes/admin/promotions/components/PromotionFormModal.svelte
src/routes/admin/food-items/components/FoodItemFormModal.svelte
```

## Единая схема

Все селекты работают по одной схеме:

- `limit: 50`
- серверный поиск через query-параметр эндпоинта (`title`, `name`, `code`, `search`)
- debounce ввода поиска 300 мс через общий хук `useDebouncedValue`
- `showSearch` всегда включён
- query всегда `enabled` — первая страница (без поиска) подгружается сразу

### Эндпоинты и параметры поиска

| Сущность  | Эндпоинт                          | Параметр поиска |
| --------- | --------------------------------- | --------------- |
| Кинотеатр | `GET /cinemas`                    | `name`          |
| Филиал    | `GET /cinemas/:cinemaId/branches` | `search`        |
| Зал       | `GET /branches/:branchId/halls`   | `search`        |
| Фильм     | `GET /movies`                     | `title`         |
| Промокод  | `GET /promo-codes`                | `code`          |

### Debounce-хук

`src/lib/hooks/use-debounced-value.svelte.ts`:

```ts
export const useDebouncedValue = <T>(initial: T, delayMs = 300) => {
	let value = $state(initial);
	let debounced = $state(initial);

	$effect(() => {
		const v = value;
		const timer = setTimeout(() => {
			debounced = v;
		}, delayMs);
		return () => clearTimeout(timer);
	});

	return {
		get value() {
			return value;
		},
		set value(v: T) {
			value = v;
		},
		get debounced() {
			return debounced;
		}
	};
};
```

Применяется не только в селектах — пригодится в любом поле с серверным поиском.

## API компонентов

### MovieSelect / PromoCodeSelect (одиночные)

```ts
interface Props {
	label?: string;
	placeholder?: string;
	value: string;
	onChange: (id: string) => void;
	required?: boolean;
	disabled?: boolean;
	initialMovie?: MovieEntity; // соотв. initialPromoCode?: PromoCodeEntity
}
```

**Префилл при edit:** если `value` непустой и опции ещё не загрузились — используем `initialMovie` как fallback-опцию, чтобы Select сразу отобразил название. После загрузки options опция из API перекрывает fallback.

### BranchSelect (каскад 2 уровня)

```ts
interface Props {
	label?: string; // применяется к лейблу «Филиал» (второй селект)
	value: string; // branchId
	onChange: (branchId: string) => void;
	required?: boolean;
	disabled?: boolean;
	initialBranch?: BranchEntity; // с populated branch.cinemaId для префилла
}
```

Внутри два `<Select>` подряд: «Кинотеатр» + «Филиал». Второй `disabled` и показывает пустой placeholder, пока не выбран кинотеатр.

### HallSelect (каскад 3 уровня)

```ts
interface Props {
	label?: string; // применяется к «Зал»
	value: string; // hallId
	onChange: (hallId: string) => void;
	required?: boolean;
	disabled?: boolean;
	initialHall?: HallEntity; // с populated branch.cinema — бэк уже отдаёт это в списках
}
```

Внутри три `<Select>` подряд: «Кинотеатр» → «Филиал» → «Зал». Каждый дочерний `disabled`, пока не выбран родитель.

## Поведение

### Каскадный сброс

Внутри каскадных компонентов — `$effect`:

```ts
$effect(() => {
	if (!cinemaId && branchId) branchId = '';
});
$effect(() => {
	if (!branchId && value) onChange('');
});
```

Очистка родителя приводит к очистке ребёнка и внешнего `value`.

### Префилл при редактировании

В `$effect` на изменение `initialHall` / `initialBranch` / `initialMovie`:

- `HallSelect`: `cinemaId = initialHall?.branch?.cinemaId ?? ''`, `branchId = initialHall?.branchId ?? ''`.
- `BranchSelect`: `cinemaId = initialBranch?.cinemaId ?? ''`.
- `MovieSelect` / `PromoCodeSelect`: лейбл для `value` берётся из `initialMovie` пока не загрузились опции.

Бэкенд уже возвращает вложенные связи в списках сеансов (`admin/screenings/+page.svelte:245-253` — `hall.branch.cinema`), поэтому данные есть без доп. запросов. Для announcement/promotion/food-item перед интеграцией нужно убедиться, что связи отдаются — если нет, поправить на бэке (убрать `@DtoEntityHidden` или дополнить include).

### Серверный поиск

`Select.svelte` вызывает `onSearch(query)` на каждый keystroke. Компонент пробрасывает в `useDebouncedValue`:

```svelte
<Select
	showSearch
	value={movieId}
	options={movieOptions}
	onSearch={(q) => (search.value = q)}
	onChange={(vals) => onChange(String(vals[0] ?? ''))}
/>
```

`queryParams` реактивно завязан на `search.debounced` — запрос срабатывает только после паузы в наборе.

## Интеграция в формы

| Файл                    | До                                                          | После                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ScreeningFormModal`    | `<Input label="ID фильма" bind:value={movieId} required />` | `<MovieSelect label="Фильм" value={movieId} onChange={(id) => (movieId = id)} initialMovie={screening?.movie} required />`               |
| `ScreeningFormModal`    | `<Input label="ID зала" bind:value={hallId} required />`    | `<HallSelect label="Зал" value={hallId} onChange={(id) => (hallId = id)} initialHall={screening?.hall} required />`                      |
| `AnnouncementFormModal` | `<Input label="ID фильма" bind:value={movieId} />`          | `<MovieSelect label="Фильм" value={movieId} onChange={(id) => (movieId = id)} initialMovie={announcement?.movie} />`                     |
| `PromotionFormModal`    | `<Input label="ID промокода" bind:value={promoCodeId} />`   | `<PromoCodeSelect label="Промокод" value={promoCodeId} onChange={(id) => (promoCodeId = id)} initialPromoCode={promotion?.promoCode} />` |
| `FoodItemFormModal`     | `<Input label="ID филиала" bind:value={branchId} />`        | `<BranchSelect label="Филиал" value={branchId} onChange={(id) => (branchId = id)} initialBranch={foodItem?.branch} />`                   |

`Select.svelte` не трогаем.

## Тестирование

Ручная проверка в браузере для каждой из четырёх модалок:

1. Create — все селекты пустые, можно выбрать.
2. Edit — префилл из сущности, лейблы отображаются сразу (не UUID).
3. Поиск — набираю текст, после паузы ~300 мс прилетает отфильтрованный список.
4. Каскадный сброс — очищаю «Кинотеатр» → «Филиал» и «Зал» обнуляются.
5. Сохранение — отправляется корректный id.

## Неопределённости на бэке

Перед интеграцией проверить, приходят ли следующие связи в ответах списков/детализации:

- `AnnouncementEntity.movie`
- `PromotionEntity.promoCode`
- `FoodItemEntity.branch` (+ `branch.cinemaId`)

Если не приходят — исправляем на бэке (убрать `@DtoEntityHidden` в Prisma / расширить include), регенерируем API-клиент. Это отдельная задача внутри плана.
