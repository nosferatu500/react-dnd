// biome-ignore-all lint/correctness/useExhaustiveDependencies: the dependency
// list is supplied by the caller as part of the public useDrag/useDrop API, so
// it is necessarily dynamic and can never be an array literal here.
import { useMemo } from 'react'

import type { FactoryOrInstance } from './types.js'

export function useOptionalFactory<T>(
	arg: FactoryOrInstance<T>,
	deps?: unknown[],
): T {
	const memoDeps = [...(deps || [])]
	if (deps == null && typeof arg !== 'function') {
		memoDeps.push(arg)
	}
	return useMemo<T>(() => {
		return typeof arg === 'function' ? (arg as () => T)() : (arg as T)
	}, memoDeps)
}
