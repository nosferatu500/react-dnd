import {
	ADD_SOURCE,
	ADD_TARGET,
	REMOVE_SOURCE,
	REMOVE_TARGET,
} from '../actions/registry.js'
import type { Action } from '../interfaces.js'

export type State = number

/**
 * How many handlers the *application* has registered.
 *
 * This is what decides whether the backend is set up, so a source the backend
 * registered for its own machinery is deliberately not counted — see
 * `AddSourceOptions.backendOwned`. Counting it would let a backend hold itself
 * up: a native drag still in flight when the app unmounts would keep the count
 * at one forever and `teardown()` would never run.
 */
export function reduce(state: State = 0, action: Action<any>): State {
	switch (action.type) {
		case ADD_SOURCE:
			return action.payload?.backendOwned ? state : state + 1
		case ADD_TARGET:
			return state + 1
		case REMOVE_SOURCE:
			return action.payload?.backendOwned ? state : state - 1
		case REMOVE_TARGET:
			return state - 1
		default:
			return state
	}
}
