import type { DragDropManager } from '@nosferatu500/dnd-core'
import { createDragDropManager } from '@nosferatu500/dnd-core'
import type { KeyboardBackendOptions } from '../interfaces.js'
import type { KeyboardBackendImpl } from '../KeyboardBackendImpl.js'

export interface TargetSpec {
	/** Defaults to the source's type, i.e. droppable. */
	type?: string
	canDrop?: boolean
	label?: string
	drop?: () => unknown
}

/**
 * Where the drag source's node sits relative to the drop targets.
 *
 * `'before'`/`'after'` give it an element of its own at one end. The two object
 * forms are the shapes a sortable list actually has: `isTarget` makes target N
 * *be* the source, which is `drag(drop(ref))` sharing a single element, and
 * `insideTarget` nests the source within target N, which is a drag handle.
 */
export type SourcePlacement =
	| 'before'
	| 'after'
	| { isTarget: number }
	| { insideTarget: number }

export interface Harness {
	manager: DragDropManager
	backend: KeyboardBackendImpl
	sourceNode: HTMLElement
	/** The registered drag source, for driving dnd-core without the keyboard. */
	sourceId: string
	targetNodes: HTMLElement[]
	/** Every `hover` the backend dispatched, by target label. */
	hovered: string[]
	dropped: string[]
	announcements: () => string
	press: (key: string, from?: EventTarget, init?: KeyboardEventInit) => boolean
	cleanup: () => void
}

export const TYPE = 'CARD'

/**
 * Every harness built so far, so that one can be torn down even when the test
 * that built it never reached its own `cleanup()`.
 *
 * Without this a failing assertion leaves its live region and its `keydown`
 * listener in the document, and the *next* test fails too — which turns one
 * real failure into a wall of noise and makes "reverting the fix fails exactly
 * these tests" impossible to check.
 */
const live: Harness[] = []

afterEach(() => {
	for (const h of live.splice(0)) {
		h.cleanup()
	}
})

function placeSource(
	root: HTMLElement,
	targetNodes: HTMLElement[],
	placement: SourcePlacement,
	label: string,
): HTMLElement {
	if (typeof placement === 'object' && 'isTarget' in placement) {
		// One element, two roles: nothing to create and nothing to relabel.
		return targetNodes[placement.isTarget] as HTMLElement
	}

	const node = document.createElement('div')
	node.textContent = label
	if (typeof placement === 'object') {
		;(targetNodes[placement.insideTarget] as HTMLElement).appendChild(node)
	} else if (placement === 'after') {
		root.appendChild(node)
	} else {
		root.insertBefore(node, root.firstChild)
	}
	return node
}

/**
 * Builds a real manager over the keyboard backend with one drag source and N
 * drop targets in document order, all attached to the document so that
 * `contains` and `compareDocumentPosition` behave.
 */
export function harness(
	backendFactory: (
		manager: DragDropManager,
		context: unknown,
		options: unknown,
	) => unknown,
	{
		targets = [{}, {}, {}] as TargetSpec[],
		canDrag = true,
		options = {} as KeyboardBackendOptions,
		sourceLabel = 'Card A',
		sourcePlacement = 'before' as SourcePlacement,
	} = {},
): Harness {
	const root = document.createElement('div')
	document.body.appendChild(root)

	const manager = createDragDropManager(
		backendFactory as never,
		undefined,
		options,
	)
	const backend = manager.getBackend() as unknown as KeyboardBackendImpl
	const registry = manager.getRegistry()

	const hovered: string[] = []
	const dropped: string[] = []

	// Targets first, so that the source can be placed inside one of them.
	const targetNodes = targets.map((spec, index) => {
		const label = spec.label ?? `Target ${index + 1}`
		const node = document.createElement('div')
		node.textContent = label
		// Labelled rather than left to the text content, so that nesting the
		// source inside a target does not change what the target is called.
		node.setAttribute('aria-label', label)
		root.appendChild(node)

		const targetId = registry.addTarget(spec.type ?? TYPE, {
			canDrop: () => spec.canDrop ?? true,
			hover: () => hovered.push(label),
			drop: () => {
				dropped.push(label)
				return spec.drop ? spec.drop() : { on: label }
			},
		})
		backend.connectDropTarget(targetId as string, node)
		return node
	})

	const sourceNode = placeSource(
		root,
		targetNodes,
		sourcePlacement,
		sourceLabel,
	)

	const sourceId = registry.addSource(TYPE, {
		canDrag: () => canDrag,
		isDragging: () => true,
		beginDrag: () => ({ id: 'a' }),
		endDrag: () => undefined,
	})
	const disconnectSource = backend.connectDragSource(
		sourceId as string,
		sourceNode,
	)

	let cleaned = false
	const built: Harness = {
		manager,
		backend,
		sourceNode,
		sourceId: sourceId as string,
		targetNodes,
		hovered,
		dropped,
		announcements: () => backend.liveRegionText,
		press(key, from = sourceNode, init = {}) {
			const event = new KeyboardEvent('keydown', {
				key,
				bubbles: true,
				cancelable: true,
				...init,
			})
			from.dispatchEvent(event)
			return event.defaultPrevented
		},
		cleanup() {
			if (cleaned) {
				return
			}
			cleaned = true
			disconnectSource()
			backend.teardown()
			root.remove()
		},
	}

	live.push(built)
	return built
}
