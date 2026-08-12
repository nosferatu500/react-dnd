/**
 * How often a drop target's `canDrop` is consulted.
 *
 * `canDrop` is application code and runs on `dragover`, which fires
 * continuously for as long as a drag is in progress. The backend asked the same
 * question twice per event from opposite ends of the target list — once to
 * decide whether to `preventDefault`, and again to resolve the `dropEffect` —
 * so a `canDrop` that walks a tree or hits a map did all of it twice for
 * nothing.
 *
 * Cheap for most apps and invisible in a profile of the library itself (the
 * backend's own bookkeeping measures ~3µs per `dragover`, flat from one nested
 * target to ten). It is the *user's* predicate that this doubles.
 */

import { createDragDropManager } from '@nosferatu500/dnd-core'

import type { HTML5BackendImpl } from '../HTML5BackendImpl.js'
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

function dragEvent(type: string, init: Record<string, unknown> = {}) {
	const event = new Event(type, { bubbles: true, cancelable: true })
	Object.assign(
		event,
		{
			clientX: 5,
			clientY: 5,
			altKey: false,
			dataTransfer: new FakeDataTransfer(),
		},
		init,
	)
	return event as unknown as DragEvent
}

interface Setup {
	backend: HTML5BackendImpl
	/** Target ids, outermost first. */
	ids: string[]
	/** `canDrop` calls so far, by target id. */
	calls: Map<string, number>
	root: HTMLElement
	reset: () => void
}

/** `depth` nested drop targets with a drag already in progress. */
function setup(
	depth: number,
	accepts: (index: number) => boolean = () => true,
) {
	const root = document.createElement('div')
	document.body.appendChild(root)
	const manager = createDragDropManager(HTML5Backend, undefined, {
		rootElement: root,
	})
	const backend = manager.getBackend() as unknown as HTML5BackendImpl
	const registry = manager.getRegistry()
	const calls = new Map<string, number>()

	const sourceNode = document.createElement('div')
	root.appendChild(sourceNode)
	const sourceId = registry.addSource('CARD', {
		canDrag: () => true,
		isDragging: () => true,
		beginDrag: () => ({ id: 1 }),
		endDrag: () => undefined,
	}) as string
	backend.connectDragSource(sourceId, sourceNode, {})

	let parent: HTMLElement = root
	const ids: string[] = []
	for (let i = 0; i < depth; i++) {
		const node = document.createElement('div')
		parent.appendChild(node)
		const index = i
		const id = registry.addTarget('CARD', {
			canDrop: () => {
				const current = calls.get(ids[index] as string) ?? 0
				calls.set(ids[index] as string, current + 1)
				return accepts(index)
			},
			hover: () => undefined,
			drop: () => ({}),
		}) as string
		backend.connectDropTarget(id, node)
		ids.push(id)
		parent = node
	}

	manager.getActions().beginDrag([sourceId])
	calls.clear()

	return {
		backend,
		ids,
		calls,
		root,
		reset: () => calls.clear(),
	} satisfies Setup
}

/** One `dragover`, delivered the way the DOM delivers it: innermost first. */
function fireDragOver(s: Setup) {
	const event = dragEvent('dragover')
	s.backend.handleTopDragOverCapture(event)
	for (let i = s.ids.length - 1; i >= 0; i--) {
		s.backend.handleDragOver(event, s.ids[i] as string)
	}
	s.backend.handleTopDragOver(event)
}

/** One `dragenter`, same ordering. */
function fireDragEnter(s: Setup) {
	const event = dragEvent('dragenter')
	for (let i = s.ids.length - 1; i >= 0; i--) {
		s.backend.handleDragEnter(event, s.ids[i] as string)
	}
	s.backend.handleTopDragEnter(event)
}

const total = (s: Setup) => [...s.calls.values()].reduce((a, b) => a + b, 0)

afterEach(() => {
	document.body.innerHTML = ''
})

describe('canDrop is consulted once per target per event', () => {
	it('asks a single target once per dragover, not twice', () => {
		const s = setup(1)

		fireDragOver(s)

		expect(s.calls.get(s.ids[0] as string)).toBe(1)
	})

	it('asks a single target once per dragenter, not twice', () => {
		const s = setup(1)

		fireDragEnter(s)

		expect(s.calls.get(s.ids[0] as string)).toBe(1)
	})

	it('never asks the same nested target twice in one event', () => {
		// Only the innermost accepts — the shape that made the old code walk the
		// whole list looking for "does anything accept", then walk back in from
		// the other end looking for "which one".
		const s = setup(4, (index) => index === 3)

		fireDragOver(s)

		for (const id of s.ids) {
			expect(s.calls.get(id) ?? 0).toBeLessThanOrEqual(1)
		}
	})

	it('stops as soon as it finds one, rather than asking every target', () => {
		const s = setup(4)

		fireDragOver(s)

		// The innermost accepts, so nothing further out needs asking: its
		// `dropEffect` is the one that would be honoured either way.
		expect(total(s)).toBe(1)
	})
})

describe('the answers it gets are unchanged', () => {
	it('cancels the event when some target accepts', () => {
		const s = setup(3, (index) => index === 0)
		const event = dragEvent('dragover')

		s.backend.handleTopDragOverCapture(event)
		for (let i = s.ids.length - 1; i >= 0; i--) {
			s.backend.handleDragOver(event, s.ids[i] as string)
		}
		s.backend.handleTopDragOver(event)

		expect(event.defaultPrevented).toBe(true)
		expect(event.dataTransfer?.dropEffect).toBe('move')
	})

	it('honours the innermost accepting target, not an outer one', () => {
		const s = setup(2)
		s.backend.connectDropTarget(
			s.ids[0] as string,
			document.createElement('div'),
			{
				dropEffect: 'link',
			},
		)
		s.backend.connectDropTarget(
			s.ids[1] as string,
			document.createElement('div'),
			{
				dropEffect: 'copy',
			},
		)

		const event = dragEvent('dragover')
		s.backend.handleTopDragOverCapture(event)
		for (let i = s.ids.length - 1; i >= 0; i--) {
			s.backend.handleDragOver(event, s.ids[i] as string)
		}
		s.backend.handleTopDragOver(event)

		expect(event.dataTransfer?.dropEffect).toBe('copy')
	})
})
