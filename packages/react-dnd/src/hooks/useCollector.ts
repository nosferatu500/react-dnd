import equal from 'fast-deep-equal'
import { useCallback, useRef, useSyncExternalStore } from 'react'

/**
 * Reads collected props out of a dnd-core monitor.
 *
 * dnd-core monitors are an external store: they hold drag state outside React and
 * announce changes through their own subscription API. That is exactly what
 * `useSyncExternalStore` exists for, and it replaces the previous
 * `useState` + subscribe-in-a-layout-effect + re-collect-on-every-render
 * arrangement, which had two problems React 18 made worse:
 *
 * - A change landing between render and the subscribing effect was missed. The
 *   old code compensated by re-running the collector on *every* render (the
 *   `useIsomorphicLayoutEffect(updateCollected)` line, whose comment noted the
 *   Dustbin stress test broke without it). `useSyncExternalStore` re-checks the
 *   snapshot when it subscribes, so nothing is missed and no polling is needed.
 * - Under concurrent rendering, `useState` holding a mirror of external state can
 *   tear: two components rendering in one pass could observe different drag
 *   state. `useSyncExternalStore` is what makes that impossible.
 *
 * @param monitor The monitor to collect state from
 * @param collect The collecting function
 * @param subscribe Registers a store-change listener; must be referentially
 * stable, or React will resubscribe on every render
 */
export function useCollector<T, S>(
	monitor: T,
	collect: (monitor: T) => S,
	subscribe: (onStoreChange: () => void) => () => void,
): S {
	// `getSnapshot` has to be pure and has to return the *same* reference while
	// nothing has changed — React compares snapshots with Object.is and would
	// re-render forever otherwise. `collect` builds a fresh object every call, so
	// the last accepted value is cached here.
	const snapshot = useRef<{ value: S } | null>(null)

	const getSnapshot = useCallback(() => {
		const next = collect(monitor)
		// Deep equality, not Object.is: monitor output includes XYCoord objects
		// that are equal by value but never by identity, so a shallow check would
		// report a change on every single collect.
		if (snapshot.current === null || !equal(snapshot.current.value, next)) {
			snapshot.current = { value: next }
		}
		return snapshot.current.value
	}, [monitor, collect])

	// getSnapshot doubles as getServerSnapshot: on the server the monitor has no
	// registered handler, and collecting from it is what the old `useState`
	// initializer did too.
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
