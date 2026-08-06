import { useCallback, useRef } from 'react'

import type { HandlerManager, MonitorEventEmitter } from '../types/index.js'
import { useCollector } from './useCollector.js'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect.js'

const NO_SUBSCRIPTION = () => {
	/* the handler is not registered yet; nothing to unsubscribe */
}

export function useMonitorOutput<Monitor extends HandlerManager, Collected>(
	monitor: Monitor & MonitorEventEmitter,
	collect: (monitor: Monitor) => Collected,
	onCollect?: () => void,
): Collected {
	// Stable across renders so React does not tear the subscription down and
	// rebuild it every time. The handler id is read at subscribe time rather than
	// captured: `useSyncExternalStore` subscribes in a passive effect, which runs
	// after the layout effect in useRegisteredDragSource/DropTarget that assigns
	// it.
	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const handlerId = monitor.getHandlerId()
			if (handlerId == null) {
				return NO_SUBSCRIPTION
			}
			return monitor.subscribeToStateChange(onStoreChange, {
				handlerIds: [handlerId],
			})
		},
		[monitor],
	)

	const collected = useCollector(monitor, collect, subscribe)

	// The connector re-attaches whenever collected props change, because that
	// re-render may hand it a different node. This used to fire synchronously
	// inside the monitor's change callback, i.e. against the pre-render DOM; as a
	// layout effect it runs once the DOM matches what was collected.
	const isInitialCollect = useRef(true)
	useIsomorphicLayoutEffect(() => {
		if (isInitialCollect.current) {
			// Mount is already covered by the connectors' own setup effects.
			isInitialCollect.current = false
			return
		}
		onCollect?.()
	}, [collected, onCollect])

	return collected
}
