import type { DragDropManager } from '@nosferatu500/dnd-core'

import type { KeyboardDragBackend } from './interfaces.js'

/**
 * Whether the drag in progress was started from the keyboard.
 *
 * `monitor.isDragging()` deliberately does not distinguish: to dnd-core a drag
 * is a drag, whichever backend opened it. But some behavior genuinely differs
 * by modality — a tree that computes drop depth from the pointer's horizontal
 * offset has no pointer to read during a keyboard drag, and needs to fall back
 * to something the arrow keys can drive.
 *
 * ```tsx
 * const manager = useDragDropManager()
 *
 * const [, drop] = useDrop(() => ({
 *   accept: 'item',
 *   hover: (item, monitor) => {
 *     const depth = isKeyboardDrag(manager)
 *       ? item.keyboardDepth
 *       : depthFromOffset(monitor.getClientOffset())
 *     // …
 *   },
 * }))
 * ```
 *
 * Safe to call whatever backend the provider is using: a pointer-only backend
 * has nobody to ask and the answer is `false`.
 *
 * **This is a question to ask inside a callback, not something to render
 * from.** It reads current state through the backend and publishes no
 * subscription, so a component that renders from it will not re-render when the
 * answer changes. If you need to *show* something for the duration of a
 * keyboard drag, drive it from a collected prop — `isDragging` from the
 * relevant `useDrag`/`useDrop` — and consult this only to decide what to show.
 */
export function isKeyboardDrag(manager: DragDropManager): boolean {
	const backend = manager.getBackend() as Partial<KeyboardDragBackend>
	return backend?.isKeyboardDragging?.() ?? false
}
