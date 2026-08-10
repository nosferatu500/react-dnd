/**
 * Writes the per-package tsconfig.json / .swcrc pair for every publishable
 * workspace. Kept in-tree alongside migrate-package-manifests.mjs so the
 * migration is reproducible; safe to delete afterwards.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Per-package build config. `refs` are TypeScript project references mirroring
 * the runtime dependency graph, so `tsc -b` orders the declaration builds.
 */
const PACKAGES = {
	// `types` is set explicitly wherever globals are needed: a composite build in
	// a monorepo otherwise picks up every @types package hoisted to the root,
	// including vitest's globals, which must not leak into published .d.ts.
	'util-invariant': { refs: [], extra: { types: ['node'] } },
	'util-shallowequal': { refs: [] },
	'dnd-core': {
		refs: ['../util-invariant'],
		extra: { types: ['node'] },
	},
	'react-dnd': {
		refs: ['../dnd-core', '../util-invariant', '../util-shallowequal'],
		extra: { types: ['node'] },
	},
	'backend-html5': { refs: ['../dnd-core'], extra: { types: ['node'] } },
	'backend-touch': {
		refs: ['../dnd-core', '../util-invariant'],
	},
	'backend-test': { refs: ['../dnd-core'] },
	'test-utils': {
		refs: [
			'../dnd-core',
			'../react-dnd',
			'../backend-html5',
			'../backend-test',
		],
	},
	examples: {
		refs: ['../dnd-core', '../react-dnd', '../backend-html5'],
		extra: { noImplicitOverride: false, types: ['node'] },
	},
}

const SWCRC = {
	$schema: 'https://swc.rs/schema.json',
	sourceMaps: true,
	jsc: {
		// SWC has no `es2025` yet (it caps at es2024), and `esnext` means "do not
		// downlevel anything" — which is what an ES2025 target wants. TypeScript
		// is the authority on which language level is allowed; see
		// tsconfig.base.json.
		target: 'esnext',
		parser: { syntax: 'typescript', tsx: true },
		transform: {
			react: { runtime: 'automatic', useBuiltins: true, development: false },
		},
	},
}

for (const [dir, { refs, extra }] of Object.entries(PACKAGES)) {
	const tsconfig = {
		extends: '../../tsconfig.base.json',
		compilerOptions: {
			composite: true,
			emitDeclarationOnly: true,
			rootDir: './src',
			// Declarations sit next to the JavaScript SWC emits; the packages are
			// ESM only, so there is a single output flavour and no dist/types
			// intermediate to mirror.
			outDir: './dist',
			// Kept out of dist/ so the build cache is never published.
			tsBuildInfoFile: './tsconfig.tsbuildinfo',
			...extra,
		},
		// A composite project must enumerate every file it owns, hence all of src/.
		// The suites are excluded: tsconfig.test.json typechecks those, and they
		// must not produce declarations in dist/types.
		include: ['./src'],
		exclude: ['./src/**/__tests__/**', './src/**/__compat__/**'],
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
