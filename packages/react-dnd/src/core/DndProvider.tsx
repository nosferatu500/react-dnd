import type { BackendFactory, DragDropManager } from 'dnd-core'
import { createDragDropManager } from 'dnd-core'
import type { FC, ReactNode } from 'react'
import { memo, useEffect } from 'react'

import { DndContext } from './DndContext.js'

export type DndProviderProps<BackendContext, BackendOptions> =
	| {
			children?: ReactNode
			manager: DragDropManager
	  }
	| {
			backend: BackendFactory
			children?: ReactNode
			context?: BackendContext
			options?: BackendOptions
			debugMode?: boolean
	  }

let refCount = 0
const INSTANCE_SYM = Symbol.for('__REACT_DND_CONTEXT_INSTANCE__')

/**
 * A React component that provides the React-DnD context
 */
export const DndProvider: FC<DndProviderProps<unknown, unknown>> = memo(
	function DndProvider({ children, ...props }) {
		const [manager, isGlobalInstance] = getDndContextValue(props) // memoized from props
		/**
		 * If the global context was used to store the DND context
		 * then where theres no more references to it we should
		 * clean it up to avoid memory leaks
		 */
		useEffect(() => {
			if (!isGlobalInstance) {
				return
			}
			const context = getGlobalContext()

			/**
			 * Re-assert ownership of the global slot on every (re)mount.
			 *
			 * React 18 StrictMode mounts effects, tears them down, then mounts
			 * them again. The teardown used to drop `refCount` to 0 and null the
			 * global slot, but the remount only incremented `refCount` again — so
			 * the slot stayed null while this provider kept using the manager it
			 * captured during render. Any provider mounted afterwards then built a
			 * *second* manager instead of sharing this one, and drags could not
			 * cross between them. The same happened for any ordinary remount,
			 * StrictMode merely made it deterministic.
			 */
			context[INSTANCE_SYM] = manager
			++refCount

			return () => {
				if (--refCount === 0) {
					context[INSTANCE_SYM] = null
				}
			}
		}, [isGlobalInstance, manager])

		return <DndContext.Provider value={manager}>{children}</DndContext.Provider>
	},
)

function getDndContextValue(props: DndProviderProps<unknown, unknown>) {
	if ('manager' in props) {
		const manager = { dragDropManager: props.manager }
		return [manager, false]
	}

	const manager = createSingletonDndContext(
		props.backend,
		props.context,
		props.options,
		props.debugMode,
	)
	const isGlobalInstance = !props.context

	return [manager, isGlobalInstance]
}

function createSingletonDndContext<BackendContext, BackendOptions>(
	backend: BackendFactory,
	context: BackendContext = getGlobalContext(),
	options: BackendOptions,
	debugMode?: boolean,
) {
	const ctx = context as any
	if (!ctx[INSTANCE_SYM]) {
		ctx[INSTANCE_SYM] = {
			dragDropManager: createDragDropManager(
				backend,
				context,
				options,
				debugMode,
			),
		}
	}
	return ctx[INSTANCE_SYM]
}

declare const global: any
function getGlobalContext() {
	return typeof global !== 'undefined' ? global : (window as any)
}
