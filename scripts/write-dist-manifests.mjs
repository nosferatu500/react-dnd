/**
 * Stamps per-directory `type` manifests into the build output.
 *
 * The package itself is `"type": "module"`, so `dist/esm/*.js` is already
 * interpreted as ESM. `dist/cjs` needs an explicit opt back out, otherwise
 * Node would try to evaluate the SWC CommonJS output as ESM.
 *
 * This replaces the old `esmify.mjs` step, which renamed every ESM file to
 * `.mjs` and rewrote import specifiers with string replacement.
 */
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const targets = [
	['dist/cjs', { type: 'commonjs' }],
	['dist/esm', { type: 'module' }],
]

for (const [dir, manifest] of targets) {
	if (!existsSync(dir)) {
		throw new Error(`expected build output in ${path.resolve(dir)}`)
	}
	const file = path.join(dir, 'package.json')
	await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
	console.log(`wrote ${file}`)
}
