/**
 * What an async drop does today.
 *
 * This is a characterization test, not an endorsement: it pins behavior that is
 * wrong so the fix has something to change, and so the defect stops being
 * folklore. See docs/async-drops.md.
 */
import type { ITestBackend } from '@nosferatu500/react-dnd-test-backend'
import { TestBackend } from '@nosferatu500/react-dnd-test-backend'

import { createDragDropManager } from '../createDragDropManager.js'
import type { DragDropManager } from '../interfaces.js'

function setup(drop: () => unknown) {
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
	const targetId = registry.addTarget('CARD', {
		canDrop: () => true,
		hover: () => undefined,
		drop: drop as () => Record<string, unknown>,
	})

	backend.simulateBeginDrag([sourceId])
	backend.simulateHover([targetId])
	backend.simulateDrop()
	backend.simulateEndDrag()

	return () => resultSeenByEndDrag
}

describe('a drop handler that returns a promise', () => {
	it('has its result silently swallowed', () => {
		// `createDrop` spreads whatever the target returned into the drop result.
		// A promise has no own enumerable properties, so the spread yields `{}`:
		// the value the handler resolves to never reaches anyone, and neither does
		// the promise itself, so there is nothing left to await.
		const result = setup(async () => ({ saved: true }))

		expect(result()).toEqual({})
	})

	it('still runs its side effect, which is why this looks like it works', () => {
		let ran = false
		setup(async () => {
			ran = true
		})

		expect(ran).toBe(true)
	})

	it('passes the type check that is supposed to catch a bad result', () => {
		// `verifyDropResultType` asserts `typeof dropResult === 'object'`, and a
		// promise is an object, so nothing objects on the way through.
		expect(() => setup(async () => ({ saved: true }))).not.toThrow()
	})
})
