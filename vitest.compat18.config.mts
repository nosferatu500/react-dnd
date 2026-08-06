import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { workspaceAliases } from './vitest.aliases.mjs'

const local = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * React 18 lives in its own workspace so npm keeps it in a nested
 * node_modules; aliasing to that directory yields a self-consistent React 18
 * tree (react, react-dom and scheduler all agree on one copy).
 *
 * This config is standalone rather than a `mergeConfig` of the main one:
 * mergeConfig concatenates arrays, so `include` would gain the Testing Library
 * suite instead of replacing it. The compat legs are deliberately RTL-free —
 * RTL resolves its own `react-dom/client` through Node, which ignores these
 * aliases and would load a second React.
 */
const react18 = local('./packages/compat-react18/node_modules')

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: [
			{ find: /^react$/, replacement: `${react18}/react` },
			{ find: /^react\/(.*)$/, replacement: `${react18}/react/$1` },
			{ find: /^react-dom$/, replacement: `${react18}/react-dom` },
			{ find: /^react-dom\/(.*)$/, replacement: `${react18}/react-dom/$1` },
			{ find: /^scheduler$/, replacement: `${react18}/scheduler` },
			...workspaceAliases(local),
		],
	},
	test: {
		name: 'react18-compat',
		globals: true,
		environment: 'jsdom',
		include: ['packages/*/src/__compat__/**/react18.compat.spec.tsx'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		clearMocks: true,
		restoreMocks: true,
	},
})
