/**
 * Maps every published workspace specifier onto its TypeScript source.
 *
 * Shared by vitest.config.mts and vitest.compat17.config.mts so the two suites
 * can never drift onto different copies of the library. Running against `src/`
 * (rather than a previously built `dist/`) keeps `npm test` independent of
 * `npm run build` and makes coverage describe the real code.
 */
const PACKAGE_DIRS = {
	'dnd-core': 'dnd-core',
	'react-dnd': 'react-dnd',
	'react-dnd-html5-backend': 'backend-html5',
	'react-dnd-touch-backend': 'backend-touch',
	'react-dnd-keyboard-backend': 'backend-keyboard',
	'react-dnd-test-backend': 'backend-test',
	'react-dnd-test-utils': 'test-utils',
	'react-dnd-examples': 'examples',
	'@react-dnd/invariant': 'util-invariant',
	'@react-dnd/shallowequal': 'util-shallowequal',
}

/**
 * @param {(relativePath: string) => string} local resolves a repo-relative path
 * @returns {{find: RegExp, replacement: string}[]}
 */
export function workspaceAliases(local) {
	return Object.entries(PACKAGE_DIRS).map(([specifier, dir]) => ({
		find: new RegExp(`^${specifier.replace(/[/@]/g, '\\$&')}$`),
		replacement: local(`./packages/${dir}/src/index.ts`),
	}))
}
