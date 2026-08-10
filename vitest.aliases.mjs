/**
 * Maps every published workspace specifier onto its TypeScript source.
 *
 * Shared by vitest.config.mts and vitest.react-root.config.mts so the two suites
 * can never drift onto different copies of the library. Running against `src/`
 * (rather than a previously built `dist/`) keeps `npm test` independent of
 * `npm run build` and makes coverage describe the real code.
 */
const PACKAGE_DIRS = {
	'@nosferatu500/dnd-core': 'dnd-core',
	'@nosferatu500/react-dnd': 'react-dnd',
	'@nosferatu500/react-dnd-html5-backend': 'backend-html5',
	'@nosferatu500/react-dnd-touch-backend': 'backend-touch',
	'@nosferatu500/react-dnd-keyboard-backend': 'backend-keyboard',
	'@nosferatu500/react-dnd-test-backend': 'backend-test',
	'@nosferatu500/react-dnd-test-utils': 'test-utils',
	'@nosferatu500/react-dnd-examples': 'examples',
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
