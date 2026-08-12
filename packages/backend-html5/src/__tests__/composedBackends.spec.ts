/**
 * HTML5 and Touch running behind one provider.
 *
 * react-dnd takes a single backend, which has meant choosing between a mouse
 * and a finger since 2015 — upstream #3483. `composeBackends` runs both, and
 * this pins what jsdom can actually prove: that they set up together, connect
 * to the same nodes, tear down together, and that a mouse drag through the pair
 * begins exactly one drag.
 *
 * **What it cannot prove** is how the two behave on a real device. Nothing
 * arbitrates a gesture between backends, so composing two that respond to the
 * *same* gesture is the caller's problem — `TouchBackend`'s `enableMouseEvents`
 * being the case in point. That needs a browser and a touchscreen, which this
 * repository has neither of.
 */

import type { DragDropManager } from '@nosferatu500/dnd-core'
import { composeBackends, createDragDropManager } from '@nosferatu500/dnd-core'
import {
	isKeyboardDrag,
	withKeyboard,
} from '@nosferatu500/react-dnd-keyboard-backend'
import { TouchBackend } from '@nosferatu500/react-dnd-touch-backend'

import { HTML5Backend } from '../index.js'

class FakeDataTransfer {
	public dropEffect = 'none'
	public effectAllowed = 'all'
	public types: string[] = []
	public files: File[] = []
	public items: unknown[] = []
	public getData() {
		return ''
	}
	public setData() {
		/* noop */
	}
	public setDragImage() {
		/* jsdom has no drag image */
	}
}

function fire(
	node: EventTarget,
	type: string,
	init: Record<string, unknown> = {},
) {
	const event = new Event(type, { bubbles: true, cancelable: true })
	Object.assign(
		event,
		{ clientX: 5, clientY: 5, dataTransfer: new FakeDataTransfer() },
		init,
	)
	node.dispatchEvent(event)
	return event
}

interface App {
	manager: DragDropManager
	node: HTMLElement
	beginDrags: () => number
	/** Unregisters everything, which is what drives teardown. */
	unmount: () => void
}

function mount(touchOptions: Record<string, unknown> = {}): App {
	const root = document.createElement('div')
	document.body.appendChild(root)

	const touch = (manager: never, context: never, options: never) =>
		TouchBackend(manager, context, {
			...(options as object),
			...touchOptions,
		})

	const manager = createDragDropManager(
		composeBackends(HTML5Backend, touch as never),
		undefined,
		{ rootElement: root },
	)
	const registry = manager.getRegistry()
	const node = document.createElement('div')
	root.appendChild(node)

	let beginDrags = 0
	const sourceId = registry.addSource('CARD', {
		canDrag: () => true,
		isDragging: () => true,
		beginDrag: () => {
			beginDrags++
			return { id: 1 }
		},
		endDrag: () => undefined,
	}) as string
	const disconnect = manager.getBackend().connectDragSource(sourceId, node, {})

	return {
		manager,
		node,
		beginDrags: () => beginDrags,
		unmount() {
			if (manager.getMonitor().isDragging()) {
				manager.getActions().endDrag()
			}
			disconnect()
			registry.removeSource(sourceId)
			root.remove()
		},
	}
}

describe('composeBackends(HTML5Backend, TouchBackend)', () => {
	it('sets both up on the same nodes', () => {
		const app = mount()

		// HTML5's contribution…
		expect(app.node.getAttribute('draggable')).toBe('true')
		// …and both counted in one profile. `sourceNodes` is a key they share, so
		// the composite's sum is 2 for the one node.
		expect(app.manager.getBackend().profile()['sourceNodes']).toBe(2)

		app.unmount()
	})

	it('begins exactly one drag from a mouse gesture', () => {
		const app = mount()

		fire(app.node, 'dragstart')

		expect(app.beginDrags()).toBe(1)
		expect(app.manager.getMonitor().isDragging()).toBe(true)

		app.unmount()
	})

	it('tears both down, so the next provider can mount', () => {
		// Each of these backends refuses to be set up twice on one root, so a
		// composite that tore down only half would poison every later mount.
		const first = mount()
		first.unmount()

		expect(() => {
			const second = mount()
			second.unmount()
		}).not.toThrow()
	})

	it('undoes both halves when a source disconnects', () => {
		const app = mount()
		app.unmount()

		expect(app.node.getAttribute('draggable')).toBe('false')
	})
})

describe('withKeyboard over a composed backend', () => {
	/** All three modalities at once, which is the point of the exercise. */
	function mountAll() {
		const root = document.createElement('div')
		document.body.appendChild(root)

		const manager = createDragDropManager(
			withKeyboard(composeBackends(HTML5Backend, TouchBackend)),
			undefined,
			{ rootElement: root },
		)
		const registry = manager.getRegistry()
		const node = document.createElement('div')
		node.textContent = 'Card'
		root.appendChild(node)

		const sourceId = registry.addSource('CARD', {
			canDrag: () => true,
			isDragging: () => true,
			beginDrag: () => ({ id: 1 }),
			endDrag: () => undefined,
		}) as string
		const targetId = registry.addTarget('CARD', {
			canDrop: () => true,
			hover: () => undefined,
			drop: () => ({}),
		}) as string
		const backend = manager.getBackend()
		const disconnectSource = backend.connectDragSource(sourceId, node, {})
		const targetNode = document.createElement('div')
		root.appendChild(targetNode)
		const disconnectTarget = backend.connectDropTarget(targetId, targetNode)

		return {
			manager,
			node,
			unmount() {
				if (manager.getMonitor().isDragging()) {
					manager.getActions().endDrag()
				}
				disconnectTarget()
				disconnectSource()
				registry.removeTarget(targetId)
				registry.removeSource(sourceId)
				root.remove()
			},
		}
	}

	it('wires all three modalities onto one node', () => {
		const app = mountAll()

		expect(app.node.getAttribute('draggable')).toBe('true') // HTML5
		expect(app.node.getAttribute('tabindex')).toBe('0') // keyboard
		expect(app.node.getAttribute('aria-roledescription')).toBe('draggable item')

		app.unmount()
	})

	it('reports a keyboard drag through two levels of composition', () => {
		// The capability lives on a backend nested inside the outer composite.
		const app = mountAll()

		expect(isKeyboardDrag(app.manager)).toBe(false)

		app.node.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: ' ',
				bubbles: true,
				cancelable: true,
			}),
		)

		expect(app.manager.getMonitor().isDragging()).toBe(true)
		expect(isKeyboardDrag(app.manager)).toBe(true)

		app.unmount()
	})
})
