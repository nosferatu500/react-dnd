/**
 * Rewrites the Jest surface used by the spec files onto Vitest.
 * Only four Jest APIs appear in the suite, so a targeted transform is safer
 * (and reviewable) compared to a general-purpose codemod.
 */
import { glob, readFile, writeFile } from 'node:fs/promises'

const REPLACEMENTS = [
	[/\bjest\.fn\b/g, 'vi.fn'],
	[/\bjest\.spyOn\b/g, 'vi.spyOn'],
	[/\bjest\.useFakeTimers\b/g, 'vi.useFakeTimers'],
	[/\bjest\.useRealTimers\b/g, 'vi.useRealTimers'],
	[/\bjest\.advanceTimersByTime\b/g, 'vi.advanceTimersByTime'],
	[/\bjest\.Mocked\b/g, 'Mocked'],
]

let changed = 0
for await (const file of glob(
	'packages/*/src/**/__tests__/**/*.spec.{ts,tsx}',
)) {
	const original = await readFile(file, 'utf8')
	let next = original
	for (const [pattern, replacement] of REPLACEMENTS) {
		next = next.replace(pattern, replacement)
	}

	// `Mocked` is a type-only import in Vitest, unlike Jest's ambient namespace.
	if (/\bMocked</.test(next) && !/from 'vitest'/.test(next)) {
		next = `import type { Mocked } from 'vitest'\n${next}`
	}

	if (next !== original) {
		await writeFile(file, next, 'utf8')
		changed++
		console.log(`migrated ${file}`)
	}
}
console.log(`\n${changed} spec file(s) migrated to Vitest`)
