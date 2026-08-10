/**
 * One-shot codemod that rewrites every publishable workspace manifest onto the
 * npm + TS6 + React>=17 baseline. Kept in-tree so the transformation is
 * auditable; safe to delete once the migration lands.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const REPO = 'https://github.com/nosferatu500/react-dnd'
const REACT_PEER = '^17.0.2 || ^18.0.0 || ^19.0.0'
const TYPES_REACT_PEER = '^17.0.0 || ^18.0.0 || ^19.0.0'

/** Packages that are published to npm. */
const PUBLISHED = [
	'util-invariant',
	'util-shallowequal',
	'dnd-core',
	'react-dnd',
	'backend-html5',
	'backend-touch',
	'backend-test',
	'test-utils',
]

const LIB_SCRIPTS = {
	clean: 'shx rm -rf dist .turbo tsconfig.tsbuildinfo',
	_build_types: 'tsc -b tsconfig.json',
	_build_esm:
		'swc src -d dist/esm --strip-leading-paths -C module.type=es6 -C module.ignoreDynamic=true',
	_build_cjs:
		'swc src -d dist/cjs --strip-leading-paths -C module.type=commonjs',
	_build_pkgjson: 'node ../../scripts/write-dist-manifests.mjs',
	build: 'run-p _build_types _build_esm _build_cjs && npm run _build_pkgjson',
	check: 'biome check src',
	release: 'npm publish --access public',
}

/** Tooling that now lives exclusively in the root manifest. */
const HOISTED_TOOLING = new Set([
	'@react-dnd/eslint-config',
	'@react-dnd/jest-config',
	'@swc/cli',
	'@swc/core',
	'@types/jest',
	'@types/eslint',
	'eslint',
	'jest',
	'jest-environment-jsdom',
	'npm-run-all',
	'rome',
	'shx',
	'typescript',
	'@testing-library/jest-dom',
	'@testing-library/react',
	'@types/node',
	'@types/react',
	'@types/react-dom',
	'react',
	'react-dom',
])

function sortKeys(obj) {
	return Object.fromEntries(
		Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)),
	)
}

/** yarn-only `portal:` links become plain workspace links. */
function normalizeDeps(deps) {
	if (!deps) return undefined
	const out = {}
	for (const [name, range] of Object.entries(deps)) {
		if (HOISTED_TOOLING.has(name)) continue
		out[name] = range.startsWith('portal:') ? 'workspace:^' : range
	}
	return Object.keys(out).length ? sortKeys(out) : undefined
}

for (const dir of PUBLISHED) {
	const file = path.join('packages', dir, 'package.json')
	const pkg = JSON.parse(await readFile(file, 'utf8'))

	const next = {
		name: pkg.name,
		version: pkg.version,
		description: pkg.description,
		license: 'MIT',
		author: pkg.author,
		homepage: `${REPO}#readme`,
		repository: {
			type: 'git',
			url: `git+${REPO}.git`,
			directory: `packages/${dir}`,
		},
		bugs: { url: `${REPO}/issues` },
		keywords: pkg.keywords,
		// Sources are ESM; dist/cjs gets its own `type: commonjs` manifest.
		type: 'module',
		sideEffects: false,
		main: './dist/cjs/index.js',
		module: './dist/esm/index.js',
		types: './dist/types/index.d.ts',
		exports: {
			'.': {
				types: './dist/types/index.d.ts',
				import: './dist/esm/index.js',
				require: './dist/cjs/index.js',
				default: './dist/esm/index.js',
			},
			'./package.json': './package.json',
		},
		files: ['dist', 'README.md', 'LICENSE'],
		engines: { node: '>=20.19.0' },
		publishConfig: { access: 'public', provenance: true },
		scripts: LIB_SCRIPTS,
		dependencies: normalizeDeps(pkg.dependencies),
		devDependencies: normalizeDeps(pkg.devDependencies),
		peerDependencies: pkg.peerDependencies,
		peerDependenciesMeta: pkg.peerDependenciesMeta,
	}

	// React 16 is dropped: 17 is the new floor everywhere React is a peer.
	if (next.peerDependencies?.react) {
		next.peerDependencies.react = REACT_PEER
	}
	if (next.peerDependencies?.['react-dom']) {
		next.peerDependencies['react-dom'] = REACT_PEER
	}
	for (const k of ['@types/react', '@types/react-dom']) {
		if (next.peerDependencies?.[k]) next.peerDependencies[k] = TYPES_REACT_PEER
	}
	if (next.peerDependencies?.['@types/node']) {
		next.peerDependencies['@types/node'] = '>=20'
	}

	for (const key of Object.keys(next)) {
		if (next[key] === undefined) delete next[key]
	}

	await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
	console.log(`rewrote ${file}`)
}
