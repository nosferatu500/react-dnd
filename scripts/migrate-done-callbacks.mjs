/**
 * Vitest 4 removed Jest's `done` callback: the second argument to `it()` is now
 * a TestContext. This rewrites `it('...', (done) => { ... })` into
 * `it('...', async () => { const { promise, resolve: done } = deferred(); ... await promise })`,
 * preserving the `done` identifier so the bodies stay untouched.
 *
 * One-shot migration helper; safe to delete once it has run.
 */
import { readFile, writeFile } from 'node:fs/promises'

const FILES = [
	'packages/dnd-core/src/__tests__/DragDropManager.spec.ts',
	'packages/dnd-core/src/__tests__/DragDropMonitor.spec.ts',
]

const OPENER = /^(\s*)it\((.+), \(done\) => \{$/

/** Finds the line index closing the block opened at `start`. */
function findBlockEnd(lines, start) {
	const indent = lines[start].match(/^(\s*)/)[1]
	const closer = `${indent}})`
	for (let i = start + 1; i < lines.length; i++) {
		if (lines[i] === closer) return i
	}
	throw new Error(`unbalanced it() block starting at line ${start + 1}`)
}

for (const file of FILES) {
	const lines = (await readFile(file, 'utf8')).split('\n')

	// Walk backwards so earlier rewrites do not shift later line numbers.
	for (let i = lines.length - 1; i >= 0; i--) {
		const m = lines[i].match(OPENER)
		if (!m) continue
		const [, indent, title] = m
		const end = findBlockEnd(lines, i)
		const body = `${indent}\t`

		lines.splice(end, 0, `${body}await promise`)
		lines[i] = `${indent}it(${title}, async () => {`
		lines.splice(
			i + 1,
			0,
			`${body}const { promise, resolve: done } = deferred()`,
		)
	}

	let out = lines.join('\n')

	// setImmediate(() => { ...; done() }) becomes a plain await of the same turn.
	out = out.replace(
		/(\s*)setImmediate\(\(\) => \{\n([\s\S]*?)\n\1\tdone\(\)\n\1\}\)/g,
		(_all, indent, inner) =>
			`${indent}await nextMacroTask()\n${inner.replace(/^\t/gm, '')}`,
	)

	if (!/from '\.\/deferred\.js'/.test(out)) {
		out = out.replace(
			/^(import .*\n)/,
			`import { deferred, nextMacroTask } from './deferred.js'\n$1`,
		)
	}

	await writeFile(file, out, 'utf8')
	console.log(`migrated ${file}`)
}
