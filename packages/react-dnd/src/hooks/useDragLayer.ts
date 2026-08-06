import { useCallback } from 'react'

import type { DragLayerMonitor } from '../types/index.js'
import { useCollector } from './useCollector.js'
import { useDragDropManager } from './useDragDropManager.js'

/**
 * useDragLayer Hook
 * @param collect The property collector
 */
export function useDragLayer<CollectedProps, DragObject = any>(
	collect: (monitor: DragLayerMonitor<DragObject>) => CollectedProps,
): CollectedProps {
	const dragDropManager = useDragDropManager()
	const monitor = dragDropManager.getMonitor()

	// A drag layer follows both the pointer offset and the drag state, so the two
	// subscriptions are composed into the single one useSyncExternalStore takes.
	//
	// This is also memoized on `monitor`, where the previous two `useEffect` calls
	// had no dependency array at all and so unsubscribed and resubscribed to both
	// streams on every render — during a drag, that is every mouse move.
	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const unsubscribeOffset = monitor.subscribeToOffsetChange(onStoreChange)
			const unsubscribeState = monitor.subscribeToStateChange(onStoreChange)
			return () => {
				unsubscribeOffset()
				unsubscribeState()
			}
		},
		[monitor],
	)

	return useCollector(monitor, collect, subscribe)
}
