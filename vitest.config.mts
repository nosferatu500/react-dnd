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
		setupFiles: [local('./vitest.setup.mts')],
		include: ['packages/*/src/**/__tests__/**/*.spec.{ts,tsx}'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		clearMocks: true,
		restoreMocks: true,
		// A stray act() warning or React deprecation notice is a real defect in a
		// drag-and-drop library that lives inside effects; fail rather than log.
		onConsoleLog(log, type) {
			if (type === 'stderr' && /not wrapped in act|Warning:/.test(log)) {
				throw new Error(`Unexpected React warning during tests:\n${log}`)
			}
			return undefined
		},
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
			],
		},
	},
})
