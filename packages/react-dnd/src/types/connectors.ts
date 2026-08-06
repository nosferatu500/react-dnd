import type { ReactElement, RefObject } from 'react'

import type { DragPreviewOptions, DragSourceOptions } from './options.js'

export type ConnectableElement = RefObject<any> | ReactElement | Element | null

/**
 * A connector returned by `useDrag` / `useDrop`.
 *
 * The primary shape is a **ref callback**: `<div ref={drag} />`. React 19
 * narrowed `RefCallback` to `(instance) => void | (() => void)` because a
 * returned function is now interpreted as a ref cleanup. A single signature
 * returning `ReactElement | null` therefore no longer satisfies `Ref<T>`, and
 * `<div ref={drag} />` failed to typecheck against `@types/react@19`.
 *
 * The overloads below keep every runtime behavior intact while reporting
 * `void` for the ref-callback call, which is the only form React ever invokes.
 *
 * Note the runtime still returns the node it was handed (see
 * `wrapConnectorHooks`) so existing JavaScript keeps working; React 19 ignores
 * non-function return values from callback refs.
 */
export interface DragElementWrapper<Options> {
	/**
	 * Ref-callback form — the recommended usage.
	 *
	 * ```tsx
	 * const [, drag] = useDrag({ type: 'box' })
	 * return <div ref={drag} />
	 * ```
	 */
	(elementOrNode: Element | null): void

	/**
	 * Element form: clones `element` and injects the connector as its ref.
	 */
	(element: ReactElement, options?: Options): ReactElement | null

	/**
	 * Ref-object form, and the node form when options are supplied.
	 */
	(elementOrNode: ConnectableElement, options?: Options): ReactElement | null
}

export type ConnectDragSource = DragElementWrapper<DragSourceOptions>
export type ConnectDropTarget = DragElementWrapper<any>
export type ConnectDragPreview = DragElementWrapper<DragPreviewOptions>
