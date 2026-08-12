import {
	BEGIN_DRAG,
	DROP,
	DROP_PENDING,
	DROP_SETTLED,
} from '../actions/dragDrop/index.js'
import type { Action, Identifier } from '../interfaces.js'

/** One drop whose handler returned a promise that has not settled yet. */
export interface PendingDrop {
	dropId: number
	targetId: Identifier
	sourceId: Identifier | null
}

export interface State {
	/**
	 * Drops still in flight, oldest first.
	 *
	 * An array rather than a map because it is read far more often than it is
	 * written (every `isSettling()` call, i.e. every collector) and it holds at
	 * most one entry per drop target involved in a drop — single digits.
	 */
	pending: PendingDrop[]
	/**
	 * Which pending drop, if any, is allowed to write {@link result}.
	 *
	 * Only one contribution owns the drop result. For synchronous drops that is
	 * whichever target dispatched last, which for nested targets is the
	 * outermost; this keeps the same rule when a promise is involved, and lets a
	 * synchronous outer target take the slot back from an inner asynchronous one.
	 */
	claimId: number | null
	/**
	 * Whether {@link result}/{@link error} describe a settled drop.
	 *
	 * Needed as its own flag because a drop that resolves to `undefined` is not
	 * the same as one that has not resolved.
	 */
	hasSettled: boolean
	result: unknown
	error: unknown
}

const initialState: State = {
	pending: [],
	claimId: null,
	hasSettled: false,
	result: null,
	error: null,
}

export function reduce(
	state: State = initialState,
	action: Action<{
		dropId: number
		targetId: Identifier
		sourceId: Identifier | null
		result: unknown
		error: unknown
	}>,
): State {
	const { payload } = action
	switch (action.type) {
		case BEGIN_DRAG:
			// A new drag supersedes the previous outcome, exactly as it does for
			// `dragOperation.dropResult`. `pending` is deliberately *not* cleared: a
			// drop from the previous drag is genuinely still saving, and a source
			// rendering "saving…" should keep doing so. Dropping the claim is what
			// stops it landing on top of this drag's result later.
			return {
				...state,
				claimId: null,
				hasSettled: false,
				result: null,
				error: null,
			}
		case DROP:
			// A synchronous contribution, which by arriving later outranks any
			// promise already in flight for this same drop.
			return { ...state, claimId: null, hasSettled: false }
		case DROP_PENDING:
			return {
				...state,
				pending: [
					...state.pending,
					{
						dropId: payload.dropId,
						targetId: payload.targetId,
						sourceId: payload.sourceId,
					},
				],
				claimId: payload.dropId,
			}
		case DROP_SETTLED: {
			const pending = state.pending.filter((p) => p.dropId !== payload.dropId)
			if (payload.dropId !== state.claimId) {
				// Superseded — by a newer drag, or by a synchronous result from an
				// outer target. It still stops being pending; it just does not speak.
				return { ...state, pending }
			}
			return {
				...state,
				pending,
				hasSettled: true,
				result: payload.result ?? null,
				error: payload.error ?? null,
			}
		}
		default:
			return state
	}
}
