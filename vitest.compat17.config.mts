import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { workspaceAliases } from './vitest.aliases.mjs'

const local = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * React 17 lives in its own workspace so npm keeps it in a nested
 * node_modules; aliasing to that directory yields a self-consistent React 17
 * tree (react, react-dom and scheduler all agree on one copy).
 *
 * This config is standalone rather than a `mergeConfig` of the main one:
 * mergeConfig concatenates arrays, so `include` would gain the Testing Library
 * suite instead of replacing it. RTL v16 needs React >= 18 anyway.
 */
const react17 = local('./packages/compat-react17/node_modules')

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: [
			{ find: /^react$/, replacement: `${react17}/react` },
			{ find: /^react\/(.*)$/, replacement: `${react17}/react/$1` },
			{ find: /^react-dom$/, replacement: `${react17}/react-dom` },
			{ find: /^react-dom\/(.*)$/, replacement: `${react17}/react-dom/$1` },
			{ find: /^scheduler$/, replacement: `${react17}/scheduler` },
			...workspaceAliases(local),
		],
	},
	test: {
		name: 'react17-compat',
		globals: true,
		environment: 'jsdom',
		include: ['packages/*/src/__compat__/**/react17.compat.spec.tsx'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		clearMocks: true,
		restoreMocks: true,
	},
})
