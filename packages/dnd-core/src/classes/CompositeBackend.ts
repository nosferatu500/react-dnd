import type {
	Backend,
	BackendFactory,
	DragDropManager,
	Unsubscribe,
} from '../interfaces.js'

/**
 * Presents several backends to dnd-core as one.
 *
 * react-dnd takes a single backend per provider, but the modalities an app has
 * to support are not alternatives: pointer, touch and keyboard are all needed
 * at once, and an app that can only be driven by one of them is broken for
 * somebody. Every call fans out; every connection returns one unsubscribe that
 * undoes all of them.
 *
 * Build one with {@link composeBackends} rather than by hand.
 */
export class CompositeBackend implements Backend {
	private backends: Backend[]

	public constructor(backends: Backend[]) {
		this.backends = backends
	}

	/**
	 * The composed backends, in the order they were given.
	 *
	 * This is how a capability that is not part of the `Backend` contract is
	 * reached — announcing to a screen reader, say. A caller looks for the
	 * backend that implements it rather than dnd-core knowing the names of
	 * capabilities it has no business knowing about.
	 */
	public getBackends(): Backend[] {
		return this.backends
	}

	public setup(): void {
		const started: Backend[] = []
		try {
			for (const backend of this.backends) {
				backend.setup()
				started.push(backend)
			}
		} catch (error) {
			// A partially set-up composite is worse than none: a backend that
			// guards against being set up twice on the same root — which both the
			// HTML5 and Touch backends do — would then refuse the next mount
			// forever, because nothing would ever tear the first half down.
			for (const backend of started.reverse()) {
				backend.teardown()
			}
			throw error
		}
	}

	public teardown(): void {
		for (const backend of [...this.backends].reverse()) {
			backend.teardown()
		}
	}

	public connectDragSource(
		sourceId: unknown,
		node?: unknown,
		options?: unknown,
	): Unsubscribe {
		return combine(
			this.backends.map((backend) =>
				backend.connectDragSource(sourceId, node, options),
			),
		)
	}

	public connectDragPreview(
		sourceId: unknown,
		node?: unknown,
		options?: unknown,
	): Unsubscribe {
		return combine(
			this.backends.map((backend) =>
				backend.connectDragPreview(sourceId, node, options),
			),
		)
	}

	public connectDropTarget(
		targetId: unknown,
		node?: unknown,
		options?: unknown,
	): Unsubscribe {
		return combine(
			this.backends.map((backend) =>
				backend.connectDropTarget(targetId, node, options),
			),
		)
	}

	public profile(): Record<string, number> {
		const merged: Record<string, number> = {}
		for (const backend of this.backends) {
			for (const [key, value] of Object.entries(backend.profile())) {
				// Summed rather than overwritten: two backends counting the same
				// thing under the same name should not silently lose one of them.
				// `sourceNodes` on a composed HTML5 + Touch backend is the total
				// across both, not either one's.
				merged[key] = (merged[key] ?? 0) + value
			}
		}
		return merged
	}
}

/**
 * Runs several backends together behind one `DndProvider`.
 *
 * ```tsx
 * const backend = composeBackends(HTML5Backend, TouchBackend)
 *
 * <DndProvider backend={backend}>
 *   <App />
 * </DndProvider>
 * ```
 *
 * Nothing in the application changes: `useDrag` and `useDrop` are untouched,
 * and each backend connects to the same nodes.
 *
 * Every backend is handed the same `context` and `options` the provider was
 * given. When two backends need different options, wrap one in a factory of
 * your own rather than trying to express both at once:
 *
 * ```tsx
 * const touch = (manager, context, options) =>
 *   TouchBackend(manager, context, { ...options, delayTouchStart: 200 })
 *
 * composeBackends(HTML5Backend, touch)
 * ```
 *
 * Order matters only for setup and teardown, which run first-to-last and
 * last-to-first respectively. It does not decide which backend wins a gesture —
 * nothing arbitrates that, so compose backends that respond to *different*
 * gestures. HTML5 (`dragstart`) and Touch (`touchstart`) do not overlap by
 * default; `TouchBackend`'s `enableMouseEvents` makes it listen for `mousedown`
 * as well, which is the one combination where both could try to start a drag
 * from the same gesture.
 */
export function composeBackends(
	...factories: BackendFactory[]
): BackendFactory {
	return function createCompositeBackend(
		manager: DragDropManager,
		context?: unknown,
		options?: unknown,
	): CompositeBackend {
		return new CompositeBackend(
			factories.map((factory) => factory(manager, context, options)),
		)
	}
}

/**
 * The backends behind whatever `manager.getBackend()` returned — the composed
 * ones if it is a {@link CompositeBackend}, otherwise the single backend
 * itself.
 *
 * For finding a backend that implements a capability outside the `Backend`
 * contract, without the caller having to know whether backends were composed.
 *
 * Flattened, because composites nest: `withKeyboard(composeBackends(html5,
 * touch))` puts a composite inside a composite, and a capability one level down
 * would otherwise be invisible to whoever went looking for it.
 */
export function getComposedBackends(backend: Backend): Backend[] {
	const composite = backend as Partial<CompositeBackend>
	if (typeof composite.getBackends !== 'function') {
		return [backend]
	}
	return composite.getBackends().flatMap(getComposedBackends)
}

function combine(unsubscribes: Unsubscribe[]): Unsubscribe {
	return (): void => {
		for (const unsubscribe of unsubscribes.reverse()) {
			unsubscribe()
		}
	}
}
