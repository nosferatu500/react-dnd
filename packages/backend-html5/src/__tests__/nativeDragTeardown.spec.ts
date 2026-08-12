/**
 * A native drag left in progress when the app unmounts.
 *
 * dnd-core decides whether a backend should be set up from a refcount of
 * registered handlers. `beginDragNativeItem` registers a drag source of its
 * own so that a dragged file has something to be, which means that while a
 * native drag is in flight the backend is itself holding that refcount up. If
 * every application handler unmounts before the drag ends, the count stops at
 * one instead of reaching zero, `teardown()` never runs, and the window
 * listeners plus `__isReactDndBackendSetUp` leak — so the next `DndProvider`
 * to mount dies with "Cannot have two HTML5 backends at the same time".
 *
 * Originally found while writing the `dropEffect` tests, where it showed up as
 * one test poisoning every test after it.
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

function dragEvent(type: string, init: Record<string, unknown> = {}) {
	const event = new Event(type, { bubbles: true, cancelable: true })
	Object.assign(event, { clientX: 0, clientY: 0, altKey: false }, init)
	return event as unknown as DragEvent
}

interface RootNode extends HTMLElement {
	__isReactDndBackendSetUp?: boolean
}

interface App {
	manager: DragDropManager
	backend: HTML5BackendImpl
	root: RootNode
	node: HTMLElement
	/** Unregisters every handler, the way unmounting the provider would. */
	unmount: () => void
}

/** One drop target that accepts files, connected on a fresh root. */
function mountApp(root: RootNode): App {
	const manager = createDragDropManager(HTML5Backend, undefined, {
		rootElement: root,
	})
	const backend = manager.getBackend() as unknown as HTML5BackendImpl
	const registry = manager.getRegistry()

	const node = document.createElement('div')
	root.appendChild(node)

	const targetId = registry.addTarget(NativeTypes.FILE, {
		canDrop: () => true,
		hover: () => undefined,
		drop: () => ({}),
	}) as string
	const disconnect = backend.connectDropTarget(targetId, node)

	return {
		manager,
		backend,
		root,
		node,
		unmount() {
			disconnect()
			registry.removeTarget(targetId)
			node.remove()
		},
	}
}

let root: RootNode

beforeEach(() => {
	root = document.createElement('div') as RootNode
	document.body.appendChild(root)
})

afterEach(() => {
	root.remove()
})

/** A file dragged in from the desktop and left hovering over the app. */
function dragFileOver(app: App) {
	const dataTransfer = new FakeDataTransfer(['Files'])
	app.node.dispatchEvent(dragEvent('dragenter', { dataTransfer }))
	app.node.dispatchEvent(dragEvent('dragover', { dataTransfer }))
}

describe('a native drag still in progress when the app unmounts', () => {
	it('does not keep the backend set up', () => {
		const app = mountApp(root)
		expect(root.__isReactDndBackendSetUp).toBe(true)

		dragFileOver(app)
		expect(app.manager.getMonitor().isDragging()).toBe(true)

		app.unmount()

		expect(root.__isReactDndBackendSetUp).toBe(false)
	})

	it('lets the next provider mount on the same root', () => {
		// The symptom as an app sees it: unrelated drag and drop stops working
		// after a file was dragged over a component that then unmounted.
		const first = mountApp(root)
		dragFileOver(first)
		first.unmount()

		expect(() => mountApp(root)).not.toThrow()
	})

	it('leaves no drag in progress behind it', () => {
		const app = mountApp(root)
		dragFileOver(app)

		app.unmount()

		expect(app.manager.getMonitor().isDragging()).toBe(false)
	})

	it('tears down exactly once, though ending the drag dispatches', () => {
		// `teardown()` runs inside dnd-core's store subscriber, and ending the
		// native drag dispatches from there — which re-enters the subscriber. The
		// second entry must find the backend already recorded as torn down.
		const app = mountApp(root)
		dragFileOver(app)

		let calls = 0
		const original = app.backend.teardown.bind(app.backend)
		app.backend.teardown = () => {
			calls++
			original()
		}

		app.unmount()

		expect(calls).toBe(1)
	})

	it('still tears down when no native drag was involved', () => {
		// The guard: the ordinary path must keep working unchanged.
		const app = mountApp(root)
		expect(root.__isReactDndBackendSetUp).toBe(true)

		app.unmount()

		expect(root.__isReactDndBackendSetUp).toBe(false)
	})
})
