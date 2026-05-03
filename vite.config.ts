import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: ['zerowaiting.elcho.dev']
	},
	preview: {
		allowedHosts: ['zerowaiting.elcho.dev']
	}
});
