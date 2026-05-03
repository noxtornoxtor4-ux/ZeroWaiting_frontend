import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sharp from 'sharp';

const ALLOWED_HOSTS = ['cinematica.kg'];
const MAX_WIDTH = 480;
const DEFAULT_QUALITY = 75;
const CACHE_DURATION = 60 * 60 * 24 * 7; // 7 days

export const GET: RequestHandler = async ({ url }) => {
	const src = url.searchParams.get('url');
	const width = Math.min(
		Number(url.searchParams.get('w')) || MAX_WIDTH,
		MAX_WIDTH
	);
	const quality = Math.min(
		Number(url.searchParams.get('q')) || DEFAULT_QUALITY,
		100
	);

	if (!src) {
		error(400, 'Missing url parameter');
	}

	let parsed: URL;
	try {
		parsed = new URL(src);
	} catch {
		error(400, 'Invalid url');
	}

	if (!ALLOWED_HOSTS.some((host) => parsed.hostname.endsWith(host))) {
		error(403, 'Host not allowed');
	}

	try {
		const response = await fetch(src);
		if (!response.ok) {
			error(502, 'Failed to fetch image');
		}

		const buffer = Buffer.from(await response.arrayBuffer());

		const optimized = await sharp(buffer)
			.resize(width, undefined, { withoutEnlargement: true })
			.webp({ quality })
			.toBuffer();

		return new Response(new Uint8Array(optimized), {
			headers: {
				'Content-Type': 'image/webp',
				'Cache-Control': `public, max-age=${CACHE_DURATION}, immutable`,
				Vary: 'Accept'
			}
		});
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		error(502, 'Image processing failed');
	}
};
