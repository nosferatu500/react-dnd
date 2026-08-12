/**
 * `monitor.isSettling()` through the React layer.
 *
 * The dnd-core suite pins the state machine; this pins the thing a consumer
 * actually writes — a collected prop that re-renders when a drop finishes
 * saving, from all three monitors.
 */

import type { Identifier } from '@nosferatu500/dnd-core'
import type { ITestBackend } from '@nosferatu500/react-dnd-test-backend'
import { TestBackend } from '@nosferatu500/react-dnd-test-backend'
import { act, render, screen } from '@testing-library/react'
import type { FC } from 'react'

import { DndProvider } from '../../core/index.js'
import { useDrag } from '../useDrag/index.js'
import { useDragLayer } from '../useDragLayer.js'
import { useDrop } from '../useDrop/index.js'

const CARD = 'CARD'

let backend: ITestBackend | undefined
let sourceId: Identifier | null = null
let targetId: Identifier | null = null

/** Resolves the drop currently in flight. Reassigned by each `drop` call. */
let resolveDrop: (value: unknown) => void = () => undefined
let rejectDrop: (reason: unknown) => void = () => undefined

const Source: FC = () => {
	const [{ isSettling, handlerId }, drag] = useDrag(() => ({
		type: CARD,
		item: { id: 'a' },
		collect: (monitor) => ({
			isSettling: monitor.isSettling(),
			handlerId: monitor.getHandlerId(),
		}),
	}))
	sourceId = handlerId
	return (
		<div ref={drag} data-testid="source">
			{String(isSettling)}
		</div>
	)
}

const Target: FC = () => {
	const [{ isSettling, error, handlerId }, drop] = useDrop(() => ({
		accept: CARD,
		drop: () =>
			new Promise((resolve, reject) => {
				resolveDrop = resolve
				rejectDrop = reject
			}),
		collect: (monitor) => ({
			isSettling: monitor.isSettling(),
			error: monitor.getDropError<Error>()?.message ?? null,
			handlerId: monitor.getHandlerId(),
		}),
	}))
	targetId = handlerId
	return (
		<div ref={drop} data-testid="target">
			{String(isSettling)}:{String(error)}
		</div>
	)
}

/** A second, synchronous target that is never dropped on. */
const OtherTarget: FC = () => {
	const [{ isSettling }, drop] = useDrop(() => ({
		accept: CARD,
		drop: () => ({ ok: true }),
		collect: (monitor) => ({ isSettling: monitor.isSettling() }),
	}))
	return (
		<div ref={drop} data-testid="other">
			{String(isSettling)}
		</div>
	)
}

const Layer: FC = () => {
	const { isSettling } = useDragLayer((monitor) => ({
		isSettling: monitor.isSettling(),
	}))
	return <div data-testid="layer">{String(isSettling)}</div>
}

function renderApp() {
	return render(
		<DndProvider
			backend={TestBackend}
			options={{
				onCreate(be: ITestBackend) {
					backend = be
				},
			}}
		>
			<Source />
			<Target />
			<OtherTarget />
			<Layer />
		</DndProvider>,
	)
}

const text = (id: string) => screen.getByTestId(id).textContent

/** Drags the source onto the async target and drops, leaving it settling. */
function dragAndDrop() {
	act(() => {
		backend?.simulateBeginDrag([sourceId as Identifier])
		backend?.simulateHover([targetId as Identifier])
		backend?.simulateDrop()
		backend?.simulateEndDrag()
	})
}

/** Lets the promise callbacks and the re-render they cause both run. */
async function flush() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

beforeEach(() => {
	backend = undefined
	sourceId = null
	targetId = null
})

describe('isSettling as a collected prop', () => {
	it('is false before anything has been dropped', () => {
		renderApp()

		expect(text('source')).toBe('false')
		expect(text('target')).toBe('false:null')
		expect(text('layer')).toBe('false')
	})

	it('re-renders the target and the source while the drop saves', async () => {
		renderApp()

		dragAndDrop()

		// The drag is over — this is the phase after it.
		expect(text('target')).toBe('true:null')
		expect(text('source')).toBe('true')
		expect(text('layer')).toBe('true')

		await act(async () => {
			resolveDrop({ saved: true })
		})
		await flush()

		expect(text('target')).toBe('false:null')
		expect(text('source')).toBe('false')
		expect(text('layer')).toBe('false')
	})

	it('does not put an uninvolved target into a saving state', async () => {
		// Scoped per handler on purpose: on a board, one column saving must not
		// light up every other column.
		renderApp()

		dragAndDrop()

		expect(text('target')).toBe('true:null')
		expect(text('other')).toBe('false')

		await act(async () => {
			resolveDrop({ saved: true })
		})
		await flush()
	})

	it('surfaces a rejection to the target that took the drop', async () => {
		const reportError = vi.fn()
		const previous = (globalThis as Record<string, unknown>)['reportError']
		;(globalThis as Record<string, unknown>)['reportError'] = reportError

		try {
			renderApp()
			dragAndDrop()

			await act(async () => {
				rejectDrop(new Error('the server said no'))
			})
			await flush()

			expect(text('target')).toBe('false:the server said no')
			// Reported as well as recorded, so a failure nobody renders is still
			// not silent.
			expect(reportError).toHaveBeenCalledOnce()
		} finally {
			;(globalThis as Record<string, unknown>)['reportError'] = previous
		}
	})
})
