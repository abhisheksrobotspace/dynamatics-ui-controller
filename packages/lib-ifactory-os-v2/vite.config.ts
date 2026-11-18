import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Prevent .md / .mdc (e.g. Cursor rules, docs) from entering the production bundle. */
function excludeMarkdownFromBuild(): Plugin {
	return {
		name: 'exclude-markdown-from-build',
		enforce: 'pre',
		load(id) {
			if (/\.(md|mdc)(\?.*)?$/.test(id)) {
				return { code: 'export default ""', map: null };
			}
		}
	};
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const proxyTarget = env.VITE_PROXY_TARGET || 'https://local.ifactory.io';
	const osFlavor =
		(process.env.VITE_OS_FLAVOR || env.VITE_OS_FLAVOR) === 'ioware' ? 'ioware' : 'cloud';

	return {
		define: {
			'import.meta.env.VITE_OS_FLAVOR': JSON.stringify(osFlavor)
		},
		resolve: {
			alias: {
				$osFlavor: path.resolve(rootDir, `src/lib/os/flavors/${osFlavor}.ts`)
			}
		},
		server: {
			proxy: {
				'/api/plan': {
					target: env.VITE_PLANNER_PROXY_TARGET || 'http://127.0.0.1:8000',
					changeOrigin: true
				},
				// More specific first: OCR PoC (poc-mode) — strip the /api/ocr prefix. core-mode
				// (VITE_OCR_MODE=core) does NOT use this; it calls /api/v2/* forwarded by /api below.
				'/api/ocr': {
					target: env.VITE_OCR_TARGET || 'http://localhost:5002',
					changeOrigin: true,
					rewrite: (p) => p.replace(/^\/api\/ocr/, '')
				},
				'/api': {
					target: proxyTarget,
					changeOrigin: true,
					secure: false, // Usually false for local HTTPS proxying
					cookieDomainRewrite: 'localhost',
					headers: {
						Origin: proxyTarget
					}
				}
			}
		},
		plugins: [
			excludeMarkdownFromBuild(),
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},

				// Static SPA: emit a client-only bundle served by Caddy from
				// /ifactory_apps/os. fallback:200.html gives SPA routing to match
				// Caddy's `try_files {path} /200.html`.
				adapter: adapter({ fallback: '200.html', strict: false })
			})
		],
		test: {
			expect: { requireAssertions: true },
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			]
		}
	};
});
