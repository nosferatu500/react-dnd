import { act, render } from '@testing-library/react'
import { createDragDropManager } from 'dnd-core'
import type { FC, ReactNode } from 'react'
import { useState } from 'react'
import { TestBackend } from 'react-dnd-test-backend'
import { describe, expect, it, vi } from 'vitest'

import { DndProvider } from '../../core/index.js'
import { useDrag } from '../useDrag/index.js'
import { useDragLayer } from '../useDragLayer.js'

/**
 * Behaviour that came out of moving the collectors onto `useSyncExternalStore`.
 *
 * The subscription-churn test fails against the previous `useState` +
 * subscribe-in-an-effect implementation (it resubscribed once per render). The
 * identity test passed there too — it is a regression guard, not a fix.
 */
describe('collector subscriptions', () => {
	/** A manager whose monitor counts how often each stream is subscribed to. */
	function instrumentedManager() {
		const manager = createDragDropManager(TestBackend, undefined, {}, false)
		const monitor = manager.getMonitor()
		const offset = vi.fn()
		const state = vi.fn()

		const realOffset = monitor.subscribeToOffsetChange.bind(monitor)
		const realState = monitor.subscribeToStateChange.bind(monitor)
		monitor.subscribeToOffsetChange = (cb: () => void) => {
			offset()
			return realOffset(cb)
		}
		monitor.subscribeToStateChange = ((cb: () => void, opts?: unknown) => {
			state()
			return realState(cb, opts as never)
		}) as typeof monitor.subscribeToStateChange

		return { manager, offset, state }
	}

	const wrap = (manager: ReturnType<typeof instrumentedManager>['manager']) =>
		function Wrapper({ children }: { children: ReactNode }) {
			return <DndProvider manager={manager}>{children}</DndProvider>
		}

	it('subscribes the drag layer once, not once per render', () => {
		// The old useDragLayer used `useEffect(() => monitor.subscribeToOffsetChange(...))`
		// with no dependency array, so every render tore both subscriptions down and
		// rebuilt them. During a drag that is every pointer move.
		const { manager, offset, state } = instrumentedManager()
		let bump: (n: number) => void = () => {}

		const Layer: FC = () => {
			const { isDragging } = useDragLayer((m) => ({
				isDragging: m.isDragging(),
			}))
			const [, setN] = useState(0)
			bump = setN
			return <div data-dragging={isDragging} />
		}

		const Wrapper = wrap(manager)
		const r = render(
			<Wrapper>
				<Layer />
			</Wrapper>,
		)

		const offsetAfterMount = offset.mock.calls.length
		const stateAfterMount = state.mock.calls.length
		expect(offsetAfterMount).toBeGreaterThan(0)

		for (const n of [1, 2, 3]) {
			act(() => {
				bump(n)
			})
		}

		expect(offset.mock.calls.length).toBe(offsetAfterMount)
		expect(state.mock.calls.length).toBe(stateAfterMount)
		r.unmount()
	})

	it('keeps collected object identity stable across unrelated re-renders', () => {
		// Collected props feed consumer memoization, so handing back a fresh object
		// on every render defeats it.
		const { manager } = instrumentedManager()
		const seen: unknown[] = []
		let bump: (n: number) => void = () => {}

		const Source: FC = () => {
			const [collected, drag] = useDrag(() => ({
				type: 'BOX',
				collect: (m) => ({ isDragging: m.isDragging() }),
			}))
			seen.push(collected)
			const [, setN] = useState(0)
			bump = setN
			return <div ref={drag} />
		}

		const Wrapper = wrap(manager)
		const r = render(
			<Wrapper>
				<Source />
			</Wrapper>,
		)

		for (const n of [1, 2]) {
			act(() => {
				bump(n)
			})
		}

		expect(seen.length).toBeGreaterThan(2)
		expect(new Set(seen).size).toBe(1)
		r.unmount()
	})
})
