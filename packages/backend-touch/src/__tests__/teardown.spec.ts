import { describe, expect, it, vi } from 'vitest'

import { TouchBackend } from '../index.js'
import { mockManager } from './mockManager.js'

/**
 * Regression tests for two upstream TouchBackend defects:
 *
 * - react-dnd/react-dnd#3549 — `setup()` registered the handler returned by
 *   `getTopMoveStartHandler()`, which is `handleTopMoveStartDelay` when a delay
 *   option is configured, but `teardown()` removed `handleTopMoveStart`. With a
 *   delay set, the start listener was never removed.
 *
 * - react-dnd/react-dnd#3664 — `handleTopMoveStartDelay` scheduled a timer
 *   without cancelling the previous one.
 */
describe('TouchBackend teardown', () => {
	function setupBackend(options: Record<string, unknown>) {
		const root = document.createElement('div')
		document.body.appendChild(root)
		const added: string[] = []
		const removed: string[] = []
		const addSpy = vi.spyOn(root, 'addEventListener').mockImplementation(((
			type: string,
			fn: any,
			...rest: any[]
		) => {
			added.push(`${type}:${fn?.name ?? 'anon'}`)
			return HTMLElement.prototype.addEventListener.call(
				root,
				type as any,
				fn,
				...rest,
			)
		}) as any)
		const removeSpy = vi
			.spyOn(root, 'removeEventListener')
			.mockImplementation(((type: string, fn: any, ...rest: any[]) => {
				removed.push(`${type}:${fn?.name ?? 'anon'}`)
				return HTMLElement.prototype.removeEventListener.call(
					root,
					type as any,
					fn,
					...rest,
				)
			}) as any)

		const backend = TouchBackend(mockManager(), {}, {
			rootElement: root,
			...options,
		} as any)
		backend.setup()
		backend.teardown()
		addSpy.mockRestore()
		removeSpy.mockRestore()
		root.remove()
		return { added, removed }
	}

	it('removes every listener it added when no delay is configured', () => {
		const { added, removed } = setupBackend({})
		expect(added.length).toBeGreaterThan(0)
		for (const entry of added) {
			expect(removed).toContain(entry)
		}
	})

	it('removes the delayed start listener too (#3549)', () => {
		// This is the case upstream leaks: with delayTouchStart set, `setup`
		// registers handleTopMoveStartDelay while `teardown` looked for
		// handleTopMoveStart.
		const { added, removed } = setupBackend({ delayTouchStart: 50 })
		expect(added.length).toBeGreaterThan(0)
		for (const entry of added) {
			expect(removed).toContain(entry)
		}
	})
})

describe('TouchBackend delayed start (#3664)', () => {
	it('cancels a pending start timer before scheduling another', () => {
		vi.useFakeTimers()
		try {
			const root = document.createElement('div')
			document.body.appendChild(root)
			const backend: any = TouchBackend(mockManager(), {}, {
				rootElement: root,
				delayMouseStart: 100,
			} as any)
			backend.setup()

			const started = vi.spyOn(backend, 'handleTopMoveStart')
			const evt = () => {
				const e = new MouseEvent('mousedown', { button: 0, bubbles: true })
				Object.defineProperty(e, 'target', { value: root })
				return e
			}

			// Three rapid starts must leave exactly one pending timer.
			backend.handleTopMoveStartDelay(evt())
			backend.handleTopMoveStartDelay(evt())
			backend.handleTopMoveStartDelay(evt())
			vi.advanceTimersByTime(500)

			expect(started).toHaveBeenCalledTimes(1)

			backend.teardown()
			root.remove()
		} finally {
			vi.useRealTimers()
		}
	})
})
