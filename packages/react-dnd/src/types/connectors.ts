import type { RefObject } from 'react'

import type {
	DragPreviewOptions,
	DragSourceOptions,
	DropTargetOptions,
} from './options.js'

export type ConnectableElement = RefObject<any> | Element | null

/**
 * A connector returned by `useDrag` / `useDrop`.
 *
 * Three ways to use one, all of which report `void`:
 *
 * ```tsx
 * <div ref={drag} />                             // the usual one
 * drag(ref)                                     // a ref object
 * preview(getEmptyImage(), { captureDraggingState: true })  // node + options
 * ```
 *
 * This was an overloaded interface until the element-cloning form —
 * `drag(<div />)`, which returned `ReactElement | null` — was removed. That
 * return type is not assignable to React 19's `RefCallback`
 * (`(instance) => void | (() => void)`), where a returned function means a ref
 * cleanup, so `<div ref={drag} />` did not typecheck and the overloads existed
 * to report `void` for the ref-callback call while the other forms kept their
 * old return types. With the element form gone, one honest signature does it.
 *
 * To attach two connectors to one element, call both from a block-bodied ref
 * callback or share a ref object — never `ref={(n) => drag(drop(n))}`.
 *
 * The three states of `options` are all meaningful and distinct: omitted leaves
 * whatever the `useDrag`/`useDrop` spec set alone, a value overrides it, and an
 * explicit `null` clears it. Omitted used to behave like `null`, which is how a
 * target lost its options whenever its element remounted.
 */
export type DragElementWrapper<Options> = (
	elementOrNode: ConnectableElement,
	options?: Options | null,
) => void

export type ConnectDragSource = DragElementWrapper<DragSourceOptions>
export type ConnectDropTarget = DragElementWrapper<DropTargetOptions>
export type ConnectDragPreview = DragElementWrapper<DragPreviewOptions>
