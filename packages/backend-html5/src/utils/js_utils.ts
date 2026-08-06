// cheap lodash replacements

export function memoize<T>(fn: () => T): () => T {
	let result: T | null = null
	const memoized = () => {
		if (result == null) {
			result = fn()
		}
		return result
	}
	return memoized
}

/**
 * drop-in replacement for _.without
 */
export function without<T>(items: T[], item: T) {
	return items.filter((i) => i !== item)
}

/**
 * drop-in replacement for _.union
 *
 * Deliberately *not* `new Set(itemsA).union(new Set(itemsB))`: the ES2025 Set
 * methods would raise this package's browser floor to Chrome 122 / Safari 17 /
 * Firefox 127 (2024) for no gain over the spread below, which is equally clear
 * and has no floor at all.
 */
export function union<T extends string | number>(itemsA: T[], itemsB: T[]) {
	return [...new Set([...itemsA, ...itemsB])]
}
