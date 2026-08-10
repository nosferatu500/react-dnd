import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { workspaceAliases } from './vitest.aliases.mjs'

const local = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Runs the suites under `src/__compat__`, which drive React's own `createRoot`
 * instead of Testing Library. They need their own config purely to skip
 * `vitest.setup.mts`: that file imports and configures RTL, and RTL resolves
 * its own `react-dom/client` through Node, so loading it here risks a second
 * copy of React in a suite whose whole point is using the real root API.
 *
 * There are no React aliases. There used to be, so a React 18 leg could resolve
 * a pinned copy in its own workspace; React 18 is no longer supported and that
 * workspace is gone.
 */
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: workspaceAliases(local),
	},
	test: {
		name: 'react-root',
		globals: true,
		environment: 'jsdom',
		// The console guard, but not vitest.setup.mts: that one pulls in RTL,
		// which is precisely what this suite avoids.
		setupFiles: [local('./vitest.console-guard.mts')],
		include: ['packages/*/src/__compat__/**/*.spec.tsx'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		clearMocks: true,
		restoreMocks: true,
	},
})
