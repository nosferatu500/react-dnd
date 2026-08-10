import { useDragDropManager } from '@nosferatu500/react-dnd'
import { useCallback } from 'react'

import type { AnnouncingBackend } from './interfaces.js'

/**
 * Speaks a message through the live region this backend already owns.
 *
 * The backend narrates what it can see: an item was picked up, the hover moved,
 * something was dropped. It cannot narrate what a drop *meant* — that the card
 * is now third in the Done column, that the move was rejected, that four items
 * were reordered — because only the application knows. Without this, an app
 * either stays silent about the outcome or stands up a second live region that
 * competes with the first.
 *
 * ```tsx
 * const announce = useDragDropAnnounce()
 *
 * const [, drop] = useDrop(() => ({
 *   accept: 'card',
 *   drop: (item) => {
 *     const position = move(item)
 *     announce(`${item.title} moved to position ${position} of ${total}.`)
 *   },
 * }))
 * ```
 *
 * Safe to call unconditionally. It does nothing when the provider is not using
 * a keyboard backend, or when that backend was configured with
 * `announce: false` — announcing is an enhancement, not something callers
 * should have to feature-detect.
 *
 * Messages go to a `role="status"` `aria-live="polite"` region, so they are
 * spoken once the screen reader is idle rather than interrupting. Keep them
 * short; they are read out in full.
 */
export function useDragDropAnnounce(): (message: string) => void {
	const manager = useDragDropManager()

	return useCallback(
		(message: string) => {
			const backend = manager.getBackend() as Partial<AnnouncingBackend>
			backend?.announce?.(message)
		},
		[manager],
	)
}
