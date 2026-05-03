import { error } from '@sveltejs/kit';
import { API_BASE_URL } from '@/api/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const apiUrl = `${API_BASE_URL}/api/v1/public/tickets/master/${params.viewerCode}`;
	let res: Response;
	try {
		res = await fetch(apiUrl, { headers: { Origin: url.origin } });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		const cause = e instanceof Error ? String((e as { cause?: unknown }).cause ?? '') : '';
		console.error('[t/m] fetch threw', { url: apiUrl, message, cause });
		throw error(502, `Upstream fetch failed: ${message}${cause ? ` (${cause})` : ''}`);
	}
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		console.error('[t/m] upstream non-ok', { url: apiUrl, status: res.status, body });
		throw error(res.status, body || `Upstream ${res.status}`);
	}
	return { master: await res.json(), viewerCode: params.viewerCode };
};
