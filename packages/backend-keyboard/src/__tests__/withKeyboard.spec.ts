import type {
	Backend,
	BackendFactory,
	DragDropManager,
} from '@nosferatu500/dnd-core'
import { createDragDropManager } from '@nosferatu500/dnd-core'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'

import { CompositeBackend, isKeyboardDrag, withKeyboard } from '../index.js'
import { TYPE } from './harness.js'

function press(node: EventTarget, key: string) {
	const event = new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
	})
	node.dispatchEvent(event)
	return event.defaultPrevented
}

describe('withKeyboard over the HTML5 backend', () => {
	function setup() {
		const root = document.createElement('div')
		document.body.appendChild(root)
		const sourceNode = document.createElement('div')
		const targetNode = document.createElement('div')
		targetNode.textContent = 'Bin'
		root.append(sourceNode, targetNode)

		const manager = createDragDropManager(
			withKeyboard(HTML5Backend),
			undefined,
			{
				rootElement: root,
			},
		)
		const registry = manager.getRegistry()
		const backend = manager.getBackend()
		const dropped: string[] = []

		const sourceId = registry.addSource(TYPE, {
			canDrag: () => true,
			isDragging: () => true,
			beginDrag: () => ({ id: 'a' }),
			endDrag: () => undefined,
		})
		const targetId = registry.addTarget(TYPE, {
			canDrop: () => true,
			hover: () => undefined,
			drop: () => {
				dropped.push('Bin')
				return { ok: true }
			},
		})
		const disconnectSource = backend.connectDragSource(
			sourceId as string,
			sourceNode,
			{},
		)
		const disconnectTarget = backend.connectDropTarget(
			targetId as string,
			targetNode,
		)

		return {
			manager,
			backend,
			root,
			sourceNode,
			targetNode,
			dropped,
			cleanup() {
				disconnectTarget()
				disconnectSource()
				backend.teardown()
				root.remove()
			},
		}
	}

	it('wires up both backends on the same node', () => {
		const s = setup()

		// HTML5's contribution…
		expect(s.sourceNode.getAttribute('draggable')).toBe('true')
		// …and the keyboard backend's.
		expect(s.sourceNode.getAttribute('tabindex')).toBe('0')
		expect(s.sourceNode.getAttribute('aria-roledescription')).toBe(
			'draggable item',
		)

		s.cleanup()
	})

	it('drives a whole drag from the keyboard', () => {
		const s = setup()

		expect(press(s.sourceNode, ' ')).toBe(true)
		expect(s.manager.getMonitor().isDragging()).toBe(true)
		expect(press(s.sourceNode, ' ')).toBe(true)

		expect(s.dropped).toEqual(['Bin'])
		expect(s.manager.getMonitor().isDragging()).toBe(false)

		s.cleanup()
	})

	it('undoes both halves when a node disconnects', () => {
		const s = setup()
		s.cleanup()

		expect(s.sourceNode.getAttribute('draggable')).toBe('false')
		expect(s.sourceNode.hasAttribute('tabindex')).toBe(false)
	})

	it('reports a keyboard drag through the composite', () => {
		const s = setup()

		expect(isKeyboardDrag(s.manager)).toBe(false)
		press(s.sourceNode, ' ')
		expect(isKeyboardDrag(s.manager)).toBe(true)
		press(s.sourceNode, 'Escape')
		expect(isKeyboardDrag(s.manager)).toBe(false)

		s.cleanup()
	})

	it('reports both backends in one profile', () => {
		const s = setup()
		const profile = s.backend.profile()

		expect(profile['sourceNodes']).toBe(1)
		expect(profile['keyboardSourceNodes']).toBe(1)

		s.cleanup()
	})
})

describe('CompositeBackend', () => {
	const noop = (): void => undefined

	function stub(overrides: Partial<Backend> = {}): Backend {
		return {
			setup: noop,
			teardown: noop,
			connectDragSource: () => noop,
			connectDragPreview: () => noop,
			connectDropTarget: () => noop,
			profile: () => ({}),
			...overrides,
		}
	}

	it('unwinds the backends it already started if a later one throws', () => {
		// HTML5Backend refuses a second setup on the same root forever, so a
		// half-started composite would poison every later mount.
		const torn: string[] = []
		const first = stub({ teardown: () => torn.push('first') })
		const second = stub({
			setup: () => {
				throw new Error('Cannot have two HTML5 backends at the same time.')
			},
		})

		const composite = new CompositeBackend([first, second])

		expect(() => composite.setup()).toThrow('two HTML5 backends')
		expect(torn).toEqual(['first'])
	})

	it('sums profile keys the backends share instead of dropping one', () => {
		const composite = new CompositeBackend([
			stub({ profile: () => ({ nodes: 2 }) }),
			stub({ profile: () => ({ nodes: 3, other: 1 }) }),
		])

		expect(composite.profile()).toEqual({ nodes: 5, other: 1 })
	})

	it('says no keyboard drag when no backend can answer', () => {
		// Two pointer backends: nobody to ask, and "no" is the honest answer.
		// Asked through `isKeyboardDrag`, which is how an application asks — the
		// composite itself knows nothing about keyboards, it just exposes what it
		// composed.
		const composite = new CompositeBackend([stub(), stub()])
		const manager = {
			getBackend: () => composite,
		} as unknown as DragDropManager

		expect(isKeyboardDrag(manager)).toBe(false)
	})

	it('finds a keyboard backend nested inside another composite', () => {
		// `composeBackends(withKeyboard(HTML5Backend), TouchBackend)` — and the
		// other nesting order too. A capability one level down is still a
		// capability the provider has.
		const keyboard = stub({
			isKeyboardDragging: () => true,
		} as Partial<Backend>)
		const composite = new CompositeBackend([
			new CompositeBackend([stub(), keyboard]),
			stub(),
		])
		const manager = {
			getBackend: () => composite,
		} as unknown as DragDropManager

		expect(isKeyboardDrag(manager)).toBe(true)
	})

	it('finds the keyboard backend among several composed backends', () => {
		const keyboard = stub({
			isKeyboardDragging: () => true,
		} as Partial<Backend>)
		const composite = new CompositeBackend([stub(), keyboard, stub()])
		const manager = {
			getBackend: () => composite,
		} as unknown as DragDropManager

		expect(isKeyboardDrag(manager)).toBe(true)
	})

	it('is a BackendFactory-compatible result', () => {
		const factory: BackendFactory = withKeyboard(HTML5Backend)
		const manager = {
			getActions: () => ({}),
			getMonitor: () => ({}),
			getRegistry: () => ({}),
		}
		expect(
			factory(manager as unknown as DragDropManager, undefined, {}),
		).toBeInstanceOf(CompositeBackend)
	})
})
