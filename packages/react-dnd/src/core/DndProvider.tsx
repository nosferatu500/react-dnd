import type { BackendFactory, DragDropManager } from '@nosferatu500/dnd-core'
import { createDragDropManager } from '@nosferatu500/dnd-core'
import type { FC, ReactNode } from 'react'
import { memo, useEffect } from 'react'

import type { DndContextType } from './DndContext.js'
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
 * The slot react-dnd stashes its shared manager in, so that separate bundles of
 * this library on one page still cooperate.
 *
 * This used to be reached through `declare const global: any`, which silently
 * turned every access into `any`. Naming the shape means the symbol indexing is
 * actually typechecked.
 */
interface DndGlobalContext {
	[INSTANCE_SYM]?: DndContextType | null
}

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

		// React 19 lets a context be rendered directly as its own provider;
		// `<DndContext.Provider>` is the pre-19 spelling and is on its way out.
		return <DndContext value={manager}>{children}</DndContext>
	},
)

/**
 * Returns the manager to publish, and whether it came from the shared global
 * slot (and therefore needs refcounting).
 *
 * The explicit tuple matters: inferred from the array literals this was
 * `(DndContextType | boolean)[]`, so `manager` reached `<DndContext value={...}>`
 * typed as `boolean | DndContextType`.
 */
function getDndContextValue(
	props: DndProviderProps<unknown, unknown>,
): [manager: DndContextType, isGlobalInstance: boolean] {
	if ('manager' in props) {
		return [{ dragDropManager: props.manager }, false]
	}

	const manager = createSingletonDndContext(
		props.backend,
		props.context,
		props.options,
		props.debugMode,
	)
	return [manager, !props.context]
}

function createSingletonDndContext<BackendContext, BackendOptions>(
	backend: BackendFactory,
	context: BackendContext | undefined,
	options: BackendOptions,
	debugMode?: boolean,
): DndContextType {
	// A caller-supplied context (an iframe's window, say) gets its own manager;
	// otherwise the manager is shared through the global slot.
	const host = (context ?? getGlobalContext()) as DndGlobalContext
	// `??=` rather than a truthiness check: DndProvider's teardown puts `null`
	// back in this slot, and nullish is exactly the condition to re-create on.
	host[INSTANCE_SYM] ??= {
		dragDropManager: createDragDropManager(
			backend,
			context,
			options,
			debugMode,
		),
	}
	return host[INSTANCE_SYM]
}

function getGlobalContext(): DndGlobalContext {
	// `globalThis` is the whole reason this used to be a `global`/`self`/`window`
	// fallback guarded by `typeof`. It resolves in browsers, workers, iframes and
	// Node alike.
	//
	// The cast claims our symbol slot on the global object; `globalThis` has no
	// declared members in common with an all-optional interface, so TS's weak-type
	// check rejects the plain return.
	return globalThis as DndGlobalContext
}
