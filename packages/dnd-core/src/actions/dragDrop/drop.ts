import type {
	Action,
	DragDropManager,
	DragDropMonitor,
	DropPayload,
	DropPendingPayload,
	DropSettledPayload,
	HandlerRegistry,
	Identifier,
} from '../../interfaces.js'
import { invariant } from '../../utils/invariant.js'
import { isObject } from '../../utils/js_utils.js'
import { DROP, DROP_PENDING, DROP_SETTLED } from './types.js'

let nextDropId = 0

/**
 * Abort controllers for drops still in flight, per manager.
 *
 * Kept here rather than in the store because a controller is not state — it is
 * a handle, nothing renders from it, and reducers have to stay pure. Keyed by
 * manager so a drag beginning in one provider cannot abort another's drop.
 */
const outstandingDrops = new WeakMap<
	DragDropManager,
	Map<number, AbortController>
>()

function outstandingFor(
	manager: DragDropManager,
): Map<number, AbortController> {
	let outstanding = outstandingDrops.get(manager)
	if (!outstanding) {
		outstanding = new Map()
		outstandingDrops.set(manager, outstanding)
	}
	return outstanding
}

/**
 * Aborts every drop still waiting on a promise.
 *
 * Called when a new drag begins, which is the moment those drops stop being
 * able to affect anything: `BEGIN_DRAG` clears the claim on the drop result, so
 * whatever they eventually resolve to is discarded either way. Telling the
 * handler that — rather than letting it finish a request nobody will read — is
 * the whole point of handing it a signal.
 */
export function abortOutstandingDrops(manager: DragDropManager): void {
	const outstanding = outstandingFor(manager)
	for (const controller of outstanding.values()) {
		controller.abort(
			new DOMException('The drop was superseded by a new drag.', 'AbortError'),
		)
	}
	outstanding.clear()
}

export function createDrop(manager: DragDropManager) {
	return function drop(options = {}): void {
		const monitor = manager.getMonitor()
		const registry = manager.getRegistry()
		verifyInvariants(monitor)
		const targetIds = getDroppableTargets(monitor)
		const sourceId = monitor.getSourceId()

		// Multiple actions are dispatched here, which is why this doesn't return an action
		targetIds.forEach((targetId, index) => {
			// Created before the handler runs, because there is no way to know it is
			// asynchronous until it has already returned a promise — by which time
			// it is too late to have handed it a signal. Discarded again below when
			// the drop turns out to be synchronous.
			const controller = new AbortController()
			const dropResult = determineDropResult(
				targetId,
				index,
				registry,
				monitor,
				controller.signal,
			)

			if (isThenable(dropResult)) {
				// The drag is over the moment the drop happens — for the HTML5 backend
				// the browser's drag genuinely ends here, so holding it open would have
				// the monitor describing a drag that no longer exists. Settling is a
				// separate, shorter-lived concept that outlives END_DRAG instead.
				dispatchPending(manager, dropResult, {
					targetId,
					sourceId,
					options,
					controller,
				})
				return
			}

			const action: Action<DropPayload> = {
				type: DROP,
				payload: {
					dropResult: {
						...options,
						...dropResult,
					},
				},
			}
			manager.dispatch(action)
		})
	}
}

function dispatchPending(
	manager: DragDropManager,
	promise: PromiseLike<unknown>,
	{
		targetId,
		sourceId,
		options,
		controller,
	}: {
		targetId: Identifier
		sourceId: Identifier | null
		options: Record<string, unknown>
		controller: AbortController
	},
): void {
	const dropId = nextDropId++
	const outstanding = outstandingFor(manager)
	outstanding.set(dropId, controller)
	const pending: Action<DropPendingPayload> = {
		type: DROP_PENDING,
		payload: { dropId, targetId, sourceId },
	}
	manager.dispatch(pending)

	const settle = (payload: DropSettledPayload): void => {
		outstanding.delete(dropId)
		manager.dispatch({ type: DROP_SETTLED, payload })
	}

	// Recorded *and* reported. Recorded so a component can render a retry;
	// reported so a failure is never merely sitting in the store waiting for
	// someone to think of reading it.
	const fail = (error: unknown): void => {
		// An abort is this library's own doing, not the application's failure:
		// the drop was superseded and its result discarded before the handler
		// ever rejected. Recording or reporting it would be inventing an error
		// nobody can act on.
		if (controller.signal.aborted) {
			settle({ dropId, targetId, result: null, error: null })
			return
		}
		settle({ dropId, targetId, result: null, error })
		reportError(error)
	}

	promise.then((resolved) => {
		// Inside the fulfilment handler rather than around it: a throw from here
		// would otherwise reject the derived promise, which nobody holds, and the
		// invariant would surface as an unhandled rejection instead of as this
		// drop's error.
		try {
			verifyDropResultType(resolved)
		} catch (error) {
			fail(error)
			return
		}
		if (controller.signal.aborted) {
			// It resolved anyway — a handler that ignored the signal, which is
			// allowed. The result is still not used: something else has claimed
			// the slot by now.
			settle({ dropId, targetId, result: null, error: null })
			return
		}
		settle({
			dropId,
			targetId,
			result:
				typeof resolved === 'undefined'
					? { ...options }
					: { ...options, ...(resolved as object) },
			error: null,
		})
	}, fail)
}

/**
 * Hands an error to the environment's uncaught-error handling, with its stack
 * intact.
 *
 * `reportError` is the platform API for exactly this — "emulate an uncaught
 * exception" — and is interceptable by an app's existing `window.onerror`
 * reporting. The microtask fallback is for environments without it: throwing
 * from a microtask is the only other way out of a promise chain that does not
 * turn into an unhandled *rejection*, which is a different event and easy to
 * have filtered out.
 */
function reportError(error: unknown): void {
	const report = (globalThis as { reportError?: (error: unknown) => void })
		.reportError
	if (typeof report === 'function') {
		report(error)
		return
	}
	queueMicrotask(() => {
		throw error
	})
}

function verifyInvariants(monitor: DragDropMonitor) {
	invariant(monitor.isDragging(), 'Cannot call drop while not dragging.')
	invariant(
		!monitor.didDrop(),
		'Cannot call drop twice during one drag operation.',
	)
}

function determineDropResult(
	targetId: Identifier,
	index: number,
	registry: HandlerRegistry,
	monitor: DragDropMonitor,
	signal: AbortSignal,
) {
	const target = registry.getTarget(targetId)
	let dropResult = target ? target.drop(monitor, targetId, signal) : undefined
	if (isThenable(dropResult)) {
		// Checked when it resolves instead; there is nothing to inspect yet.
		return dropResult
	}
	verifyDropResultType(dropResult)
	if (typeof dropResult === 'undefined') {
		dropResult = index === 0 ? {} : monitor.getDropResult()
	}
	return dropResult
}

function verifyDropResultType(dropResult: any) {
	invariant(
		typeof dropResult === 'undefined' || isObject(dropResult),
		'Drop result must either be an object or undefined.',
	)
}

/**
 * Duck-typed rather than `instanceof Promise`, so that a userland promise
 * library, a `Promise` from another realm, or anything else with a `then`
 * behaves the same as a native one.
 */
function isThenable(value: unknown): value is PromiseLike<unknown> {
	return typeof (value as PromiseLike<unknown> | undefined)?.then === 'function'
}

function getDroppableTargets(monitor: DragDropMonitor) {
	const targetIds = monitor
		.getTargetIds()
		.filter(monitor.canDropOnTarget, monitor)
	targetIds.reverse()
	return targetIds
}
