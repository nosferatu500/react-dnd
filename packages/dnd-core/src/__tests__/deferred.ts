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
 *
 * Built on `Promise.withResolvers()` (ES2024), which replaces the
 * `let resolve!: () => void` dance this file used to hand-roll. `resolve` is
 * re-wrapped as a zero-argument function so it can be passed straight to a
 * monitor subscription, whose `Listener` type takes no arguments.
 */
export function deferred(): Deferred {
	const { promise, resolve } = Promise.withResolvers<void>()
	return { promise, resolve: () => resolve() }
}

/**
 * Yields until after the current macrotask, by which point the microtask
 * dnd-core queues for handler-registry mutations has certainly run.
 */
export function nextMacroTask(): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>()
	setTimeout(resolve, 0)
	return promise
}
