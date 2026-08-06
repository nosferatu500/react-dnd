/**
 * Writes the per-package tsconfig.json / .swcrc pair for every publishable
 * workspace. Kept in-tree alongside migrate-package-manifests.mjs so the
 * migration is reproducible; safe to delete afterwards.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

/** entry -> the file tsc walks to decide what gets a declaration. */
const PACKAGES = {
	'util-asap': { entry: './src/index.ts', refs: [] },
	'util-invariant': { entry: './src/index.ts', refs: [] },
	'util-shallowequal': { entry: './src/index.ts', refs: [] },
	'dnd-core': {
		entry: './src/index.ts',
		refs: ['../util-asap', '../util-invariant'],
	},
	'react-dnd': {
		entry: './src/index.ts',
		refs: ['../dnd-core', '../util-invariant', '../util-shallowequal'],
	},
	'backend-html5': { entry: './src/index.ts', refs: ['../dnd-core'] },
	'backend-touch': {
		entry: './src/index.ts',
		refs: ['../dnd-core', '../util-invariant'],
	},
	'backend-test': { entry: './src/index.ts', refs: ['../dnd-core'] },
	'test-utils': {
		entry: './src/index.ts',
		refs: ['../dnd-core', '../react-dnd', '../backend-html5', '../backend-test'],
	},
	examples: {
		entry: './src/index.ts',
		refs: ['../dnd-core', '../react-dnd', '../backend-html5'],
		extra: { noImplicitOverride: false },
	},
}

const SWCRC = {
	$schema: 'https://swc.rs/schema.json',
	sourceMaps: true,
	jsc: {
		target: 'es2022',
		parser: { syntax: 'typescript', tsx: true },
		transform: {
			react: { runtime: 'automatic', useBuiltins: true, development: false },
		},
	},
}

for (const [dir, { entry, refs, extra }] of Object.entries(PACKAGES)) {
	const tsconfig = {
		extends: '../../tsconfig.base.json',
		compilerOptions: {
			composite: true,
			emitDeclarationOnly: true,
			rootDir: './src',
			outDir: './dist/types',
			tsBuildInfoFile: './dist/types/.tsbuildinfo',
			...extra,
		},
		include: [entry],
		...(refs.length ? { references: refs.map((path) => ({ path })) } : {}),
	}

	await writeFile(
		path.join('packages', dir, 'tsconfig.json'),
		`${JSON.stringify(tsconfig, null, 2)}\n`,
		'utf8',
	)
	await writeFile(
		path.join('packages', dir, '.swcrc'),
		`${JSON.stringify(SWCRC, null, '\t')}\n`,
		'utf8',
	)
	console.log(`wrote configs for packages/${dir}`)
}
