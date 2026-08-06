/**
 * Finalises a package's build output so BOTH module systems resolve correctly —
 * JavaScript *and* types.
 *
 * Each package is `"type": "module"`, so `dist/esm/*.js` is already ESM. Two
 * things still have to be stamped in:
 *
 * 1. `dist/cjs/package.json` with `"type": "commonjs"`, otherwise Node would
 *    evaluate SWC's CommonJS output as ESM.
 *
 * 2. A copy of the declarations inside *each* directory. A single shared
 *    `dist/types` inherits the package's `type: module`, so `require()`
 *    consumers on TypeScript's node16/nodenext resolution got types that
 *    "masquerade as ESM" (attw FalseESM) — they would see `export default`
 *    where the runtime hands them `module.exports`. Placing the same
 *    declarations next to each JavaScript flavor lets the adjacent
 *    package.json give them the right module kind.
 *
 * The declaration text is identical for both flavors: sources use explicit
 * `.js` import specifiers, which resolve the same either way. `dist/types` and
 * `dist/{cjs,esm}` are the same depth below the package root, so `.d.ts.map`
 * sourcemap paths stay valid after the copy.
 *
 * This replaces the old `esmify.mjs`, which renamed every ESM file to `.mjs` and
 * rewrote import specifiers by string replacement.
 */

import { existsSync } from 'node:fs'
import { cp, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const TYPES_DIR = 'dist/types'
const FLAVOURS = [
	['dist/cjs', { type: 'commonjs' }],
	['dist/esm', { type: 'module' }],
]

for (const [dir, manifest] of FLAVOURS) {
	if (!existsSync(dir)) {
		throw new Error(`expected build output in ${path.resolve(dir)}`)
	}
	await writeFile(
		path.join(dir, 'package.json'),
		`${JSON.stringify(manifest, null, 2)}\n`,
		'utf8',
	)
}

if (!existsSync(TYPES_DIR)) {
	throw new Error(`expected declarations in ${path.resolve(TYPES_DIR)}`)
}

for (const entry of await readdir(TYPES_DIR, { withFileTypes: true })) {
	// .tsbuildinfo is a build cache, not output.
	if (entry.name.startsWith('.')) continue
	for (const [dir] of FLAVOURS) {
		await cp(path.join(TYPES_DIR, entry.name), path.join(dir, entry.name), {
			recursive: true,
			force: true,
		})
	}
}

console.log(
	`finalized dist: stamped ${FLAVOURS.length} manifests and mirrored declarations`,
)
