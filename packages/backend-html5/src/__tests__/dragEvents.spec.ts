/**
 * Behavioural coverage for the HTML5 backend's event handling.
 *
 * jsdom implements neither `DragEvent` nor `DataTransfer`, so both are faked.
 * That is enough to pin the parts of the backend that are pure bookkeeping —
 * which handlers run, which target ids are collected, and whether the browser's
 * own drop action is cancelled. It is *not* enough to assert what a browser
 * does afterwards; the `preventDefault` call pattern is the mechanism, and the
 * comments below record which real behaviour each pattern is standing in for.
 */

import type { DragDropManager } from '@nosferatu500/dnd-core'
import { createDragDropManager } from '@nosferatu500/dnd-core'

import type { HTML5BackendImpl } from '../HTML5BackendImpl.js'
import { HTML5Backend } from '../index.js'
import * as NativeTypes from '../NativeTypes.js'

class FakeDataTransfer {
	public files: File[] = []
	public items: unknown[] = []
	public dropEffect = 'none'
	public effectAllowed = 'all'
	private store = new Map<string, string>()

	public constructor(public types: string[] = []) {}

	public setData(format: string, data: string) {
		this.store.set(format, String(data))
	}
	public getData(format: string) {
		return this.store.get(format) ?? ''
	}
	public setDragImage() {
		/* jsdom has no drag image */
	}
}

/**
 * A selection dragged out of a browser page carries both of these — and so it
 * matches `NativeTypes.HTML`, which `nativeTypesConfig` declares ahead of
 * `NativeTypes.TEXT`. Targets below register for HTML accordingly.
 */
const TEXT_SELECTION_TYPES = ['text/plain', 'text/html']
/** A link or an image carries `text/html` too, so it matches HTML, not URL. */
const LINK_TYPES = ['text/uri-list', 'text/plain', 'text/html']
const FILE_TYPES = ['Files']

function dragEvent(type: string, init: Record<string, unknown> = {}) {
	const event = new Event(type, { bubbles: true, cancelable: true })
	Object.assign(event, { clientX: 0, clientY: 0, altKey: false }, init)
	return event as unknown as DragEvent
}

interface TargetSpec {
	type?: string | string[]
	canDrop?: boolean
}

interface Harness {
	manager: DragDropManager
	backend: HTML5BackendImpl
	root: HTMLElement
	/** A node with a connected drag source on it. */
	sourceNode: HTMLElement
	/** Nodes with connected drop targets on them, in declaration order. */
	targetNodes: HTMLElement[]
	hovered: string[]
	fire: (
		node: EventTarget,
		type: string,
		init?: Record<string, unknown>,
	) => Event
	cleanup: () => void
}

function harness({
	targets = [{ type: NativeTypes.TEXT }] as TargetSpec[],
	canDrag = true,
} = {}): Harness {
	const root = document.createElement('div')
	document.body.appendChild(root)
	const sourceNode = document.createElement('div')
	root.appendChild(sourceNode)

	const manager = createDragDropManager(HTML5Backend, undefined, {
		rootElement: root,
	})
	const backend = manager.getBackend() as unknown as HTML5BackendImpl
	const registry = manager.getRegistry()
	const hovered: string[] = []

	const sourceId = registry.addSource('CARD', {
		canDrag: () => canDrag,
		isDragging: () => true,
		beginDrag: () => ({ id: 1 }),
		endDrag: () => undefined,
	})
	backend.connectDragSource(sourceId as string, sourceNode, {})

	const targetNodes = targets.map((spec, index) => {
		const node = document.createElement('div')
		root.appendChild(node)
		const targetId = registry.addTarget(spec.type ?? NativeTypes.TEXT, {
			canDrop: () => spec.canDrop ?? true,
			hover: () => hovered.push(String(index)),
			drop: () => ({ dropped: index }),
		})
		backend.connectDropTarget(targetId as string, node)
		return node
	})

	return {
		manager,
		backend,
		root,
		sourceNode,
		targetNodes,
		hovered,
		fire(node, type, init = {}) {
			const event = dragEvent(type, init)
			node.dispatchEvent(event)
			return event
		},
		cleanup() {
			backend.teardown()
			root.remove()
		},
	}
}

/** Walks a native drag in from outside the document onto `node`. */
function dragNativeItemOver(
	h: Harness,
	node: HTMLElement,
	dataTransfer: FakeDataTransfer,
) {
	h.fire(node, 'dragenter', { dataTransfer })
	return h.fire(node, 'dragover', { dataTransfer })
}

describe('drop of a drag the backend never started', () => {
	/**
	 * Another library (MUI's data grid, in the original report) starts its own
	 * HTML5 drag with a payload react-dnd does not recognise. No `beginDrag` ever
	 * runs, so the monitor is idle — but the root `drop` listener fired anyway and
	 * dispatched `hover`, whose first invariant is "a drag is in progress".
	 *
	 * @see https://github.com/react-dnd/react-dnd/issues/3491
	 * @see https://github.com/react-dnd/react-dnd/issues/1572
	 */
	it('does not throw "Cannot call hover while not dragging" (#3491)', () => {
		const h = harness()
		const dataTransfer = new FakeDataTransfer(['application/x-other-library'])

		expect(h.manager.getMonitor().isDragging()).toBe(false)
		expect(() =>
			h.backend.handleTopDrop(dragEvent('drop', { dataTransfer })),
		).not.toThrow()

		h.cleanup()
	})

	it('leaves the drop to whoever did start the drag', () => {
		const h = harness()
		const dataTransfer = new FakeDataTransfer(['application/x-other-library'])

		h.fire(h.targetNodes[0] as HTMLElement, 'dragenter', { dataTransfer })
		const drop = h.fire(h.targetNodes[0] as HTMLElement, 'drop', {
			dataTransfer,
		})

		expect(drop.defaultPrevented).toBe(false)
		expect(h.hovered).toEqual([])

		h.cleanup()
	})
})

describe('native drags nothing in the app accepts', () => {
	/**
	 * Cancelling the browser's default drop action for every native payload is
	 * what made a single mounted HTML5 backend break text drag-and-drop into
	 * every input on the page, including inputs outside the provider.
	 *
	 * @see https://github.com/react-dnd/react-dnd/issues/1552
	 * @see https://github.com/react-dnd/react-dnd/pull/3495
	 */
	it('lets a dragged text selection through to the browser (#1552)', () => {
		const h = harness({ targets: [{ canDrop: false }] })
		const dataTransfer = new FakeDataTransfer(TEXT_SELECTION_TYPES)

		const over = dragNativeItemOver(
			h,
			h.targetNodes[0] as HTMLElement,
			dataTransfer,
		)
		expect(over.defaultPrevented).toBe(false)

		const drop = h.fire(h.targetNodes[0] as HTMLElement, 'drop', {
			dataTransfer,
		})
		expect(drop.defaultPrevented).toBe(false)

		h.cleanup()
	})

	it('still cancels a file drop', () => {
		const h = harness({ targets: [{ type: NativeTypes.FILE, canDrop: false }] })
		const dataTransfer = new FakeDataTransfer(FILE_TYPES)

		const over = dragNativeItemOver(
			h,
			h.targetNodes[0] as HTMLElement,
			dataTransfer,
		)
		// Without this the browser navigates the document to the dropped file.
		expect(over.defaultPrevented).toBe(true)

		const drop = h.fire(h.targetNodes[0] as HTMLElement, 'drop', {
			dataTransfer,
		})
		expect(drop.defaultPrevented).toBe(true)

		h.cleanup()
	})

	it('still cancels a link or image drop, which matches HTML but navigates', () => {
		// The regression guard for the narrower "only cancel for NativeTypes.FILE"
		// fix: a link carries text/html, so it is matched as HTML, and gating on
		// the matched type would let the browser navigate away from the app.
		const h = harness({ targets: [{ type: NativeTypes.HTML, canDrop: false }] })
		const dataTransfer = new FakeDataTransfer(LINK_TYPES)

		const over = dragNativeItemOver(
			h,
			h.targetNodes[0] as HTMLElement,
			dataTransfer,
		)
		expect(over.defaultPrevented).toBe(true)

		h.cleanup()
	})

	it('cancels when the payload describes itself as nothing at all', () => {
		const h = harness({ targets: [{ canDrop: false }] })
		const dataTransfer = new FakeDataTransfer(TEXT_SELECTION_TYPES)
		h.fire(h.targetNodes[0] as HTMLElement, 'dragenter', { dataTransfer })

		// Some hosts hide the payload description mid-drag. With nothing to judge
		// by, keep the safe behaviour rather than risk navigating away.
		dataTransfer.types = []
		const over = h.fire(h.targetNodes[0] as HTMLElement, 'dragover', {
			dataTransfer,
		})
		expect(over.defaultPrevented).toBe(true)

		h.cleanup()
	})
})

describe('native drags the app does accept', () => {
	it('cancels the browser default so an accepted drop is not handled twice', () => {
		const h = harness({
			targets: [{ type: NativeTypes.HTML, canDrop: true }],
		})
		const dataTransfer = new FakeDataTransfer(TEXT_SELECTION_TYPES)

		const over = dragNativeItemOver(
			h,
			h.targetNodes[0] as HTMLElement,
			dataTransfer,
		)
		expect(over.defaultPrevented).toBe(true)

		const drop = h.fire(h.targetNodes[0] as HTMLElement, 'drop', {
			dataTransfer,
		})
		expect(drop.defaultPrevented).toBe(true)
		expect(h.manager.getMonitor().isDragging()).toBe(false)

		h.cleanup()
	})
})

describe('dragstart on elements the backend does not own', () => {
	/**
	 * `useDrop` alone was enough to disable dragging for every `draggable`
	 * element on the page, because an unclaimed `dragstart` was cancelled
	 * outright.
	 *
	 * @see https://github.com/react-dnd/react-dnd/issues/3304
	 */
	it('leaves a foreign draggable element alone (#3304)', () => {
		const h = harness()
		const foreign = document.createElement('div')
		foreign.setAttribute('draggable', 'true')
		h.root.appendChild(foreign)

		const start = h.fire(foreign, 'dragstart', {
			dataTransfer: new FakeDataTransfer([]),
		})

		expect(start.defaultPrevented).toBe(false)

		h.cleanup()
	})

	it('still cancels a dragstart inside a source that refuses to drag', () => {
		const h = harness({ canDrag: false })
		const child = document.createElement('span')
		h.sourceNode.appendChild(child)

		const start = h.fire(child, 'dragstart', {
			dataTransfer: new FakeDataTransfer([]),
		})

		expect(start.defaultPrevented).toBe(true)
		expect(h.manager.getMonitor().isDragging()).toBe(false)

		h.cleanup()
	})
})

describe('hover throttling', () => {
	/**
	 * `dragover` is throttled onto an animation frame. The frame used to dispatch
	 * the *first* event's target ids alongside the *last* event's client offset,
	 * so a drag crossing a boundary mid-frame reported the target it had just
	 * left, at coordinates inside the target it had just entered.
	 */
	it('hovers the target the pointer ended the frame on', async () => {
		const h = harness({
			targets: [{ type: NativeTypes.HTML }, { type: NativeTypes.HTML }],
		})
		const [first, second] = h.targetNodes as [HTMLElement, HTMLElement]
		const dataTransfer = new FakeDataTransfer(TEXT_SELECTION_TYPES)

		h.fire(first, 'dragenter', { dataTransfer })
		h.hovered.length = 0

		h.fire(first, 'dragover', { dataTransfer, clientX: 10 })
		h.fire(second, 'dragover', { dataTransfer, clientX: 90 })
		await new Promise((resolve) => requestAnimationFrame(resolve))

		expect(h.hovered).toEqual(['1'])

		h.cleanup()
	})
})
