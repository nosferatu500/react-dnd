import type { Backend, Unsubscribe } from 'dnd-core'

/**
 * Presents several backends to dnd-core as one.
 *
 * react-dnd takes a single backend per provider, but pointer and keyboard
 * support are not alternatives — an accessible app needs both at once. Every
 * call fans out; every connection returns one unsubscribe that undoes all of
 * them.
 */
export class CompositeBackend implements Backend {
	private backends: Backend[]

	public constructor(backends: Backend[]) {
		this.backends = backends
	}

	public setup(): void {
		const started: Backend[] = []
		try {
			for (const backend of this.backends) {
				backend.setup()
				started.push(backend)
			}
		} catch (error) {
			// A partially set-up composite is worse than none: HTML5Backend's
			// "two backends at the same time" guard would then refuse the next
			// mount forever, because nothing would ever tear the first half down.
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
				merged[key] = (merged[key] ?? 0) + value
			}
		}
		return merged
	}
}

function combine(unsubscribes: Unsubscribe[]): Unsubscribe {
	return (): void => {
		for (const unsubscribe of unsubscribes.reverse()) {
			unsubscribe()
		}
	}
}
