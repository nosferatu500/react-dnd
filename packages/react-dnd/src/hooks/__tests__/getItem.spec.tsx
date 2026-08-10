/**
 * `monitor.getItem()` returns `null` when nothing is being dragged.
 *
 * It always did. It was typed `T`, so every `collect` that read it was handed a
 * value TypeScript swore was there and which was `null` on the very first
 * render. These tests pin the runtime contract the type now describes, in the
 * three places a monitor is reachable.
 */
import { act, render, screen } from '@testing-library/react'
import type { Identifier } from 'dnd-core'
import type { FC } from 'react'
import type { ITestBackend } from 'react-dnd-test-backend'
import { TestBackend } from 'react-dnd-test-backend'

import { DndProvider } from '../../core/index.js'
import { useDrag } from '../useDrag/index.js'
import { useDragLayer } from '../useDragLayer.js'
import { useDrop } from '../useDrop/index.js'

const CARD = 'CARD'
interface Card {
	id: string
}

/** Renders the collected item as text, so `null` is visible in the DOM. */
function show(item: Card | null) {
	return item === null ? 'null' : item.id
}

let backend: ITestBackend | undefined
let sourceId: Identifier | null = null
let targetId: Identifier | null = null

const Source: FC = () => {
	const [{ item, handlerId }, drag] = useDrag(() => ({
		type: CARD,
		item: { id: 'a' } as Card,
		collect: (monitor) => ({
			item: monitor.getItem(),
			handlerId: monitor.getHandlerId(),
		}),
	}))
	sourceId = handlerId
	return (
		<div ref={drag} data-testid="source">
			{show(item)}
		</div>
	)
}

const Target: FC = () => {
	const [{ item, handlerId }, drop] = useDrop(() => ({
		accept: CARD,
		collect: (monitor) => ({
			item: monitor.getItem<Card>(),
			handlerId: monitor.getHandlerId(),
		}),
	}))
	targetId = handlerId
	return (
		<div ref={drop} data-testid="target">
			{show(item)}
		</div>
	)
}

const Layer: FC = () => {
	const { item } = useDragLayer((monitor) => ({
		item: monitor.getItem<Card>(),
	}))
	return <div data-testid="layer">{show(item)}</div>
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
			<Layer />
		</DndProvider>,
	)
}

const text = (id: string) => screen.getByTestId(id).textContent

beforeEach(() => {
	backend = undefined
	sourceId = null
	targetId = null
})

describe('monitor.getItem()', () => {
	it('is null on the first render, before anything has been dragged', () => {
		renderApp()

		expect(text('source')).toBe('null')
		expect(text('target')).toBe('null')
		expect(text('layer')).toBe('null')
	})

	it('is the dragged item while a drag is in progress', () => {
		renderApp()

		act(() => {
			backend?.simulateBeginDrag([sourceId as Identifier])
		})

		expect(text('source')).toBe('a')
		expect(text('target')).toBe('a')
		expect(text('layer')).toBe('a')
	})

	it('is null again once the drag ends', () => {
		renderApp()

		act(() => {
			backend?.simulateBeginDrag([sourceId as Identifier])
			backend?.simulateHover([targetId as Identifier])
			backend?.simulateDrop()
			backend?.simulateEndDrag()
		})

		expect(text('source')).toBe('null')
		expect(text('target')).toBe('null')
		expect(text('layer')).toBe('null')
	})
})
