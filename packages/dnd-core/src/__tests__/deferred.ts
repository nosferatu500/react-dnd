/**
 * Test helpers replacing Jest's `done` callback, which Vitest 4 removed in
 * favour of returning a promise.
 */

export interface Deferred {
	promise: Promise<void>
	resolve: () => void
}

/**
 * A promise plus its resolver, so a subscription callback can settle the test
 * the way `done` used to.
 */
export function deferred(): Deferred {
	let resolve!: () => void
	const promise = new Promise<void>((res) => {
		resolve = res
	})
	return { promise, resolve }
}

/**
 * Yields until after the current macrotask, which is when dnd-core's
 * `@react-dnd/asap` queue has flushed handler-registry mutations.
 */
export function nextMacroTask(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0)
	})
}
