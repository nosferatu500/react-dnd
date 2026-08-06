import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { workspaceAliases } from './vitest.aliases.mjs'

const local = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * React 19 leg of the compat suite. No React aliases: 19 is the version
 * installed at the repo root, so plain resolution already points at it.
 */
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: workspaceAliases(local),
	},
	test: {
		name: 'react19-compat',
		globals: true,
		environment: 'jsdom',
		include: ['packages/*/src/__compat__/**/react19.compat.spec.tsx'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		clearMocks: true,
		restoreMocks: true,
	},
})
