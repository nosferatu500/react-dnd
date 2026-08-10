import type { DropEffect } from '@nosferatu500/dnd-core'

export type { DropEffect }

export interface DragSourceOptions {
	/**
	 * Optional. What dragging *this* item does, when no drop target says
	 * otherwise. 'copy' shows a copying cursor, 'move' the move cursor — a hint
	 * to the user about whether the action is destructive.
	 *
	 * A drop target's own `dropEffect` wins over this, because the target is what
	 * knows what dropping *there* means. Set this when the item itself decides —
	 * dragging out of a read-only list always copies, whatever it lands on.
	 *
	 * Setting it also opts out of the copy modifier (alt by default): an explicit
	 * effect is not something a keypress should override.
	 */
	dropEffect?: DropEffect
}

export interface DragPreviewOptions {
	/**
	 * Optional. A boolean. By default, false. If true, the component will learn that it is being dragged immediately as the drag
	 * starts instead of the next tick. This means that the screenshotting would occur with monitor.isDragging() already being true,
	 * and if you apply any styling like a decreased opacity to the dragged element, this styling will also be reflected on the
	 * screenshot. This is rarely desirable, so false is a sensible default. However, you might want to set it to true in rare cases,
	 * such as if you want to make the custom drag layers work in IE and you need to hide the original element without resorting to
	 * an empty drag preview which IE doesn't support.
	 */
	captureDraggingState?: boolean

	/**
	 * Optional. A number between 0 and 1. By default, 0.5. Specifies how the offset relative to the drag source node is translated
	 * into the horizontal offset of the drag preview when their sizes don't match. 0 means “dock the preview to the left”, 0.5 means
	 * “interpolate linearly” and 1 means “dock the preview to the right”.
	 */
	anchorX?: number

	/**
	 * Optional. A number between 0 and 1. By default, 0.5. Specifies how the offset relative to the drag source node is translated into
	 * the vertical offset of the drag preview when their sizes don't match. 0 means “dock the preview to the top, 0.5 means “interpolate
	 * linearly” and 1 means “dock the preview to the bottom.
	 */
	anchorY?: number

	/**
	 * Optional. A number or null if not needed. By default, null. Specifies the vertical offset between the cursor and the drag preview
	 * element. If offsetX has a value, anchorX won't be used.
	 */
	offsetX?: number

	/**
	 *  Optional. A number or null if not needed. By default, null. Specifies the vertical offset between the cursor and the drag
	 *  preview element. If offsetY has a value, anchorY won't be used.
	 */
	offsetY?: number
}

export interface DropTargetOptions {
	/**
	 * Optional. What dropping on this target does. Takes precedence over the drag
	 * source's `dropEffect` and over the copy modifier.
	 *
	 * This mirrors how the platform splits the two: a drag source constrains what
	 * is possible (`effectAllowed`), and a drop target states what will actually
	 * happen (`dropEffect`). The same card dropped on "Archive" moves and dropped
	 * on "Duplicate to…" copies; only the target knows which.
	 *
	 * Evaluated wherever your `useDrop` spec is, so compute it there rather than
	 * looking for a callback form:
	 *
	 * ```tsx
	 * useDrop(
	 *   () => ({ accept: 'card', options: { dropEffect: locked ? 'copy' : 'move' } }),
	 *   [locked],
	 * )
	 * ```
	 *
	 * Only the innermost target that can accept the item is consulted, so an
	 * outer target's effect does not leak into a nested one.
	 */
	dropEffect?: DropEffect
}
