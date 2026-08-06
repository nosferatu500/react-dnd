import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const local = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Every workspace package is aliased to its TypeScript source so the suite runs
 * against `src/` rather than a previously-built `dist/`. Coverage numbers then
 * describe the real code, and `npm test` no longer depends on `npm run build`.
 */
const workspaceAliases = [
	['dnd-core', 'dnd-core'],
	['react-dnd', 'react-dnd'],
	['react-dnd-html5-backend', 'backend-html5'],
	['react-dnd-touch-backend', 'backend-touch'],
	['react-dnd-test-backend', 'backend-test'],
	['react-dnd-test-utils', 'test-utils'],
	['react-dnd-examples', 'examples'],
	['@react-dnd/asap', 'util-asap'],
	['@react-dnd/invariant', 'util-invariant'],
	['@react-dnd/shallowequal', 'util-shallowequal'],
].map(([specifier, dir]) => ({
	find: new RegExp(`^${specifier!.replace(/[/@]/g, '\\$&')}$`),
	replacement: local(`./packages/${dir}/src/index.ts`),
}))

/**
 * `REACT_VERSION=18 npm test` re-points every React specifier at the aliased
 * `react-18` / `react-dom-18` installs, so one suite covers the whole supported
 * peer range. Unset (or 19) uses the primary React install.
 *
 * React 17 is covered separately by packages/react-dnd/src/__compat__ because
 * @testing-library/react v16 requires the react-dom/client root API.
 */
const reactVersion = process.env['REACT_VERSION'] ?? '19'
const reactAliases =
	reactVersion === '18'
		? [
				{ find: /^react$/, replacement: 'react-18' },
				{ find: /^react\/(.*)$/, replacement: 'react-18/$1' },
				{ find: /^react-dom$/, replacement: 'react-dom-18' },
				{ find: /^react-dom\/(.*)$/, replacement: 'react-dom-18/$1' },
			]
		: []

export default defineConfig({
	plugins: [react()],
	resolve: {
		// React aliases must win over the workspace ones, hence the ordering.
		alias: [...reactAliases, ...workspaceAliases],
	},
	define: {
		__REACT_MAJOR__: JSON.stringify(reactVersion),
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: [local('./vitest.setup.ts')],
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
