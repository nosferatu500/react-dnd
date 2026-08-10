import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { workspaceAliases } from './vitest.aliases.mjs'

const local = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: workspaceAliases(local),
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: [
			local('./vitest.console-guard.mts'),
			local('./vitest.setup.mts'),
		],
		include: ['packages/*/src/**/__tests__/**/*.spec.{ts,tsx}'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		clearMocks: true,
		restoreMocks: true,
		coverage: {
			provider: 'v8',
			reportsDirectory: './coverage',
			reporter: ['text', 'lcov'],
			include: ['packages/*/src/**/*.{ts,tsx}'],
			exclude: [
				'**/__tests__/**',
				'**/__compat__/**',
				'**/index.ts',
				'**/types/**',
				'**/interfaces.ts',
				// The Gatsby docsite is out of the workspace and does not build; its
				// sources are not library code, and coverage's uncovered-file pass
				// cannot parse them, so every run logged a wall of parse errors.
				'packages/docsite/**',
			],
		},
	},
})
