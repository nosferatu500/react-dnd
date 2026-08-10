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

export interface Harness {
	manager: DragDropManager
	backend: KeyboardBackendImpl
	sourceNode: HTMLElement
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

	const sourceNode = document.createElement('div')
	sourceNode.textContent = sourceLabel
	root.appendChild(sourceNode)

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

	const targetNodes = targets.map((spec, index) => {
		const label = spec.label ?? `Target ${index + 1}`
		const node = document.createElement('div')
		node.textContent = label
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

	return {
		manager,
		backend,
		sourceNode,
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
			disconnectSource()
			backend.teardown()
			root.remove()
		},
	}
}
