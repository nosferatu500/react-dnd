/**
 * Drops that reach a server.
 *
 * This file used to be a characterization test pinning the opposite: a `drop`
 * returning a promise had its result spread into `{}` and silently discarded.
 * The drag deliberately ends when it always ended rather than staying open
 * until the promise settles: for a pointer backend the browser's drag really
 * has finished at `drop`, so a monitor still reporting `isDragging()` would
 * describe a drag that no longer exists — and a promise that never settled
 * would leave the library unable to start another one.
 */
import type { ITestBackend } from '@nosferatu500/react-dnd-test-backend'
import { TestBackend } from '@nosferatu500/react-dnd-test-backend'

import { createDragDropManager } from '../createDragDropManager.js'
import type { DragDropManager, Identifier } from '../interfaces.js'

interface Harness {
	manager: DragDropManager
	backend: ITestBackend
	sourceId: Identifier
	targetId: Identifier
	/** What `getDropResult()` looked like from inside `endDrag`. */
	resultSeenByEndDrag: () => unknown
	/** Errors handed to the environment's uncaught-error handling. */
	reported: unknown[]
	drag: () => void
	drop: () => void
	endDrag: () => void
}

/**
 * @param drop the innermost target's handler — the one that takes the drop
 * @param outerDrops enclosing targets, outermost first
 */
function setup(
	drop: () => unknown,
	outerDrops: Array<() => unknown> = [],
): Harness {
	const manager: DragDropManager = createDragDropManager(TestBackend)
	const backend = manager.getBackend() as unknown as ITestBackend
	const registry = manager.getRegistry()
	let resultSeenByEndDrag: unknown

	const sourceId = registry.addSource('CARD', {
		canDrag: () => true,
		isDragging: () => true,
		beginDrag: () => ({ id: 1 }),
		endDrag: () => {
			resultSeenByEndDrag = manager.getMonitor().getDropResult()
		},
	})
	const addTarget = (handler: () => unknown) =>
		registry.addTarget('CARD', {
			canDrop: () => true,
			hover: () => undefined,
			drop: handler as () => Record<string, unknown>,
		})
	const innerId = addTarget(drop)
	const outerIds = outerDrops.map(addTarget)

	return {
		manager,
		backend,
		sourceId,
		targetId: innerId,
		resultSeenByEndDrag: () => resultSeenByEndDrag,
		reported: captured,
		drag: () => {
			backend.simulateBeginDrag([sourceId])
			// Outermost first, which is the order a backend collects them in and
			// which `getDroppableTargets` reverses so that the outermost target's
			// contribution is dispatched last.
			backend.simulateHover([...outerIds, innerId])
		},
		drop: () => backend.simulateDrop(),
		endDrag: () => backend.simulateEndDrag(),
	}
}

/**
 * `reportError` is how an async rejection reaches the app's error reporting.
 * jsdom does not implement it, so this both installs it and records what it is
 * given — without it the library's fallback throws from a microtask and the
 * whole test file fails on an unhandled error.
 */
let captured: unknown[] = []
let originalReportError: unknown

beforeEach(() => {
	captured = []
	originalReportError = (globalThis as Record<string, unknown>)['reportError']
	;(globalThis as Record<string, unknown>)['reportError'] = (e: unknown) => {
		captured.push(e)
	}
})

afterEach(() => {
	;(globalThis as Record<string, unknown>)['reportError'] = originalReportError
})

/** Lets every already-queued promise callback run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('a drop handler that returns a promise', () => {
	it('ends the drag when it always ended, not when the promise settles', async () => {
		// The design's central decision. For the HTML5 backend the browser's drag
		// genuinely ends at `drop` — no pointer capture, no more `dragover` — so a
		// monitor still reporting `isDragging()` would be describing a drag that
		// does not exist, and a never-settling promise would wedge the library.
		//
		// A backend calls `drop()` then `endDrag()`, exactly as it does for a
		// synchronous drop; neither is deferred.
		let resolveDrop: (value: unknown) => void = () => undefined
		const h = setup(
			() =>
				new Promise((resolve) => {
					resolveDrop = resolve
				}),
		)
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()

		// A drop with no result yet is still a drop that happened.
		expect(monitor.didDrop()).toBe(true)

		h.endDrag()

		expect(monitor.isDragging()).toBe(false)
		expect(monitor.getItem()).toBeNull()
		// …while the save is genuinely still in flight.
		expect(monitor.isSettling()).toBe(true)

		resolveDrop({ saved: true })
		await flush()
	})

	it('is settling from the drop until the promise resolves', async () => {
		let resolveDrop: (value: unknown) => void = () => undefined
		const h = setup(
			() =>
				new Promise((resolve) => {
					resolveDrop = resolve
				}),
		)
		const monitor = h.manager.getMonitor()

		h.drag()
		expect(monitor.isSettling()).toBe(false)

		h.drop()
		h.endDrag()
		expect(monitor.isSettling()).toBe(true)

		resolveDrop({ saved: true })
		await flush()

		expect(monitor.isSettling()).toBe(false)
	})

	it('delivers the resolved value as the drop result', async () => {
		const h = setup(async () => ({ saved: true }))
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()
		h.endDrag()
		await flush()

		// Outliving END_DRAG is the whole reason this needed state of its own:
		// END_DRAG clears `dragOperation` wholesale, `dropResult` included.
		expect(monitor.getDropResult()).toEqual({ saved: true })
	})

	it('has no result yet while it is settling', async () => {
		const h = setup(async () => ({ saved: true }))
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()

		expect(monitor.getDropResult()).toBeNull()
		// Which is what `end` sees, because a drag ends before its drop settles.
		// `didDrop()` is how `end` knows the drop happened; `isSettling()` is how
		// it knows the answer is still coming.
		h.endDrag()
		expect(h.resultSeenByEndDrag()).toBeNull()

		await flush()
	})

	it('resolving to nothing still produces a drop result', async () => {
		// `drop: async () => {}` — the spelling that was silently swallowed.
		const h = setup(async () => undefined)
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()
		h.endDrag()
		await flush()

		expect(monitor.getDropResult()).toEqual({})
	})
})

describe('a drop handler whose promise rejects', () => {
	it('records the reason and reports it', async () => {
		const boom = new Error('the server said no')
		const h = setup(async () => {
			throw boom
		})
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()
		h.endDrag()
		await flush()

		expect(monitor.getDropError()).toBe(boom)
		// Recorded so a component can offer a retry, reported so the failure is
		// never merely sitting in the store waiting to be noticed.
		expect(h.reported).toEqual([boom])
		expect(monitor.isSettling()).toBe(false)
		expect(monitor.getDropResult()).toBeNull()
	})

	it('reports a resolved value that is not a valid drop result', async () => {
		const h = setup(async () => 42)
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()
		h.endDrag()
		await flush()

		expect((h.reported[0] as Error)?.message).toContain(
			'Drop result must either be an object or undefined',
		)
		// Not an unhandled rejection: the invariant is thrown inside the fulfilment
		// handler, so it has to be caught there or it rejects a promise nobody
		// holds.
		expect(monitor.getDropError()).toBe(h.reported[0])
	})

	it('clears the error on the next drag', async () => {
		const h = setup(async () => {
			throw new Error('nope')
		})
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()
		h.endDrag()
		await flush()
		expect(monitor.getDropError()).not.toBeNull()

		h.drag()

		expect(monitor.getDropError()).toBeNull()
	})
})

describe('a settle that arrives too late', () => {
	it('does not overwrite a newer drag’s drop result', async () => {
		let resolveFirst: (value: unknown) => void = () => undefined
		const h = setup(
			() =>
				new Promise((resolve) => {
					resolveFirst = resolve
				}),
		)
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()
		h.endDrag()

		// A second drag starts before the first drop has saved.
		h.drag()
		expect(monitor.isSettling()).toBe(true) // still genuinely saving

		resolveFirst({ from: 'the first drop' })
		await flush()

		// The stale result is discarded rather than becoming the current drag's.
		expect(monitor.getDropResult()).toBeNull()
		expect(monitor.isSettling()).toBe(false)

		h.endDrag()
	})
})

describe('isSettling, by handler', () => {
	it('names the target that took the drop and the source it came from', async () => {
		let resolveDrop: (value: unknown) => void = () => undefined
		const h = setup(
			() =>
				new Promise((resolve) => {
					resolveDrop = resolve
				}),
		)
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()
		h.endDrag()

		expect(monitor.isSettling(h.targetId)).toBe(true)
		expect(monitor.isSettling(h.sourceId)).toBe(true)
		expect(monitor.isSettling('some-other-handler')).toBe(false)

		resolveDrop({})
		await flush()

		expect(monitor.isSettling(h.targetId)).toBe(false)
	})
})

describe('nested targets', () => {
	it('lets a synchronous outer result outrank a pending inner one', async () => {
		// Same rule as for two synchronous targets: whichever contribution lands
		// last owns the result, and for nested targets that is the outermost.
		let resolveInner: (value: unknown) => void = () => undefined
		const h = setup(
			() =>
				new Promise((resolve) => {
					resolveInner = resolve
				}),
			[() => ({ from: 'outer' })],
		)
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()

		expect(monitor.getDropResult()).toEqual({ from: 'outer' })

		h.endDrag()
		resolveInner({ from: 'inner' })
		await flush()

		// The inner target's late answer does not resurrect a drop result the
		// outer one had already spoken for and END_DRAG had cleared.
		expect(monitor.getDropResult()).toBeNull()
		expect(monitor.isSettling()).toBe(false)
	})
})

describe('synchronous drops', () => {
	it('are completely unaffected', () => {
		const h = setup(() => ({ saved: true }))
		const monitor = h.manager.getMonitor()

		h.drag()
		h.drop()

		expect(monitor.getDropResult()).toEqual({ saved: true })
		expect(monitor.isSettling()).toBe(false)

		h.endDrag()
		expect(h.resultSeenByEndDrag()).toEqual({ saved: true })
		expect(monitor.getDropResult()).toBeNull()
	})
})
