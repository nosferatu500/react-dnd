import type { Identifier } from '@nosferatu500/dnd-core'
import { invariant } from '@nosferatu500/dnd-core'
import { useMemo } from 'react'

import type { DragSourceHookSpec } from '../types.js'

export function useDragType(
	spec: DragSourceHookSpec<any, any, any>,
): Identifier {
	return useMemo(() => {
		const result: Identifier = spec.type
		invariant(result != null, 'spec.type must be defined')
		return result
	}, [spec])
}
