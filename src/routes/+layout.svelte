<script lang="ts">
	import favicon from '$lib/assets/logo.svg';
	import '../app.scss';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from 'svelte-french-toast';
	import '$lib/i18n';
	import { locale } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import Preloader from '@/components/ui/Preloader.svelte';
	import AuthGuard from '@/lib/guards/AuthGuard.svelte';

	const queryClient = new QueryClient();
	let { children } = $props();

	const SITE_URL = 'https://zerowaiting.elcho.dev';
	const OG_IMAGE = `${SITE_URL}/cover.png`;

	const meta = $derived(
		$locale === 'en'
			? {
					title: 'Online Movie Ticket Booking | ZeroWaiting',
					description:
						'ZeroWaiting — online movie ticket booking platform. Browse movies, showtimes, and book your seats online.',
					keywords:
						'movie tickets online, cinema booking, movie showtimes, ZeroWaiting, book cinema seats, movie theater',
					ogTitle: 'ZeroWaiting — Online Movie Ticket Booking',
					ogDesc:
						'Book movie tickets online, choose the best seats in your cinema.',
					ogLocale: 'en_US',
					ogLocaleAlt: 'ru_RU'
				}
			: $locale === 'kz'
				? {
						title: 'Кинобилеттерді онлайн брондау | ZeroWaiting',
						description:
							'ZeroWaiting — кинобилеттерді онлайн брондау платформасы. Фильмдер, сеанстар мен орындарды онлайн таңдаңыз.',
						keywords:
							'кинобилеттер онлайн, кинотеатр брондау, кино сеанстары, ZeroWaiting',
						ogTitle: 'ZeroWaiting — Кинобилеттерді онлайн брондау',
						ogDesc:
							'Кинобилеттерді онлайн брондаңыз, кинотеатрда ең жақсы орындарды таңдаңыз.',
						ogLocale: 'kk_KZ',
						ogLocaleAlt: 'ru_RU'
					}
				: $locale === 'uz'
					? {
							title: 'Kino chiptalarini onlayn bron qilish | ZeroWaiting',
							description:
								'ZeroWaiting — kino chiptalarini onlayn bron qilish platformasi. Filmlar, seanslar va oʻrinlarni onlayn tanlang.',
							keywords:
								'kino chiptalari onlayn, kinoteatr bron qilish, kino seanslari, ZeroWaiting',
							ogTitle: 'ZeroWaiting — Kino chiptalarini onlayn bron qilish',
							ogDesc:
								'Kino chiptalarini onlayn bron qiling, kinoteatrda eng yaxshi oʻrinlarni tanlang.',
							ogLocale: 'uz_UZ',
							ogLocaleAlt: 'ru_RU'
						}
					: $locale === 'ky'
						? {
								title: 'Кино билеттерди онлайн бронирование | ZeroWaiting',
								description:
									'ZeroWaiting — кино билеттерди онлайн брондоо платформасы. Фильмдерди, сеанстарды жана орундарды онлайн тандаңыз.',
								keywords:
									'кино билеттер онлайн, кинотеатр брондоо, кино сеанстары, ZeroWaiting',
								ogTitle: 'ZeroWaiting — Кино билеттерди онлайн брондоо',
								ogDesc:
									'Кино билеттерди онлайн брондоңуз, кинотеатрда эң жакшы орундарды тандаңыз.',
								ogLocale: 'ky_KG',
								ogLocaleAlt: 'ru_RU'
							}
						: {
								title: 'Онлайн-бронирование билетов в кино | ZeroWaiting',
								description:
									'ZeroWaiting — платформа для онлайн-бронирования билетов в кинотеатр. Выбирайте фильмы, сеансы и места онлайн.',
								keywords:
									'билеты в кино онлайн, бронирование кинотеатр, сеансы фильмов, ZeroWaiting, онлайн-бронирование, кинотеатр',
								ogTitle: 'ZeroWaiting — Онлайн-бронирование билетов в кино',
								ogDesc:
									'Бронируйте билеты онлайн, выбирайте лучшие места в кинотеатре.',
								ogLocale: 'ru_RU',
								ogLocaleAlt: 'en_US'
							}
	);

	const softwareSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		'@id': `${SITE_URL}/#software`,
		name: 'ZeroWaiting',
		url: SITE_URL,
		applicationCategory: 'EntertainmentApplication',
		operatingSystem: 'Web',
		description:
			'ZeroWaiting — SaaS-платформа для управления сетями кинотеатров. Онлайн-бронирование билетов, выбор мест, управление сеансами и залами.',
		screenshot: OG_IMAGE,
		author: {
			'@type': 'Organization',
			name: 'ZeroWaiting',
			url: SITE_URL
		},
		offers: {
			'@type': 'Offer',
			priceCurrency: 'KGS',
			availability: 'https://schema.org/InStock'
		}
	};

	const orgSchema = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': `${SITE_URL}/#organization`,
		name: 'ZeroWaiting',
		url: SITE_URL,
		logo: {
			'@type': 'ImageObject',
			url: `${SITE_URL}/favicon.svg`,
			contentUrl: OG_IMAGE,
			width: 1200,
			height: 630
		},
		image: OG_IMAGE,
		description:
			'ZeroWaiting — глобальная SaaS-платформа для управления сетями кинотеатров и онлайн-бронирования билетов.',
		areaServed: ['KG', 'RU', 'KZ', 'UZ']
	};

	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': `${SITE_URL}/#website`,
		url: SITE_URL,
		name: 'ZeroWaiting',
		publisher: { '@id': `${SITE_URL}/#organization` },
		inLanguage: ['ru', 'en', 'ky', 'kk', 'uz']
	};

	$effect(() => {
		if (browser && $locale) {
			document.documentElement.lang = $locale;
		}
	});
</script>

<svelte:head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="theme-color" content="#121216" />

	<!-- Primary -->
	<title>{meta.title}</title>
	<meta name="description" content={meta.description} />
	<meta name="keywords" content={meta.keywords} />
	<meta
		name="robots"
		content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
	/>
	<meta name="author" content="ZeroWaiting" />
	<meta
		name="language"
		content={$locale === 'en'
			? 'English'
			: $locale === 'kz'
				? 'Kazakh'
				: $locale === 'uz'
					? 'Uzbek'
					: $locale === 'ky'
						? 'Kyrgyz'
						: 'Russian'}
	/>
	<meta name="revisit-after" content="7 days" />
	<meta name="rating" content="general" />

	<!-- Canonical & hreflang -->
	<link rel="canonical" href={SITE_URL + '/'} />
	<link rel="alternate" hreflang="ru" href={SITE_URL + '/'} />
	<link rel="alternate" hreflang="en" href={SITE_URL + '/'} />
	<link rel="alternate" hreflang="ky" href={SITE_URL + '/'} />
	<link rel="alternate" hreflang="kk" href={SITE_URL + '/'} />
	<link rel="alternate" hreflang="uz" href={SITE_URL + '/'} />
	<link rel="alternate" hreflang="x-default" href={SITE_URL + '/'} />

	<!-- Favicon -->
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<link rel="shortcut icon" href={favicon} />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content={SITE_URL + '/'} />
	<meta property="og:site_name" content="ZeroWaiting" />
	<meta property="og:title" content={meta.ogTitle} />
	<meta property="og:description" content={meta.ogDesc} />
	<meta property="og:image" content={OG_IMAGE} />
	<meta property="og:image:secure_url" content={OG_IMAGE} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="698" />
	<meta
		property="og:image:alt"
		content="ZeroWaiting — Онлайн-бронирование билетов в кино"
	/>
	<meta property="og:locale" content={meta.ogLocale} />
	<meta property="og:locale:alternate" content={meta.ogLocaleAlt} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={meta.ogTitle} />
	<meta name="twitter:description" content={meta.ogDesc} />
	<meta name="twitter:image" content={OG_IMAGE} />
	<meta
		name="twitter:image:alt"
		content="ZeroWaiting — Онлайн-бронирование билетов в кино"
	/>

	<!-- JSON-LD Structured Data -->
	{@html `<script type="application/ld+json">${JSON.stringify(softwareSchema)}</script>`}
	{@html `<script type="application/ld+json">${JSON.stringify(orgSchema)}</script>`}
	{@html `<script type="application/ld+json">${JSON.stringify(websiteSchema)}</script>`}
</svelte:head>

<Toaster
	position="top-right"
	toastOptions={{
		style: `
			background: var(--surface);
			color: var(--foreground);
			border: 1px solid var(--border-color);
			border-radius: var(--radius-md);
		`
	}}
/>
<Preloader />

<QueryClientProvider client={queryClient}>
	<AuthGuard />
	{@render children()}
</QueryClientProvider>
