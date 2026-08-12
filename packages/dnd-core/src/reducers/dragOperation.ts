import {
	BEGIN_DRAG,
	DROP,
	DROP_PENDING,
	END_DRAG,
	HOVER,
	PUBLISH_DRAG_SOURCE,
} from '../actions/dragDrop/index.js'
import { REMOVE_TARGET } from '../actions/registry.js'
import type { Action, Identifier } from '../interfaces.js'
import { without } from '../utils/js_utils.js'

export interface State {
	itemType: Identifier | Identifier[] | null
	item: any
	sourceId: string | null
	targetIds: string[]
	dropResult: any
	didDrop: boolean
	isSourcePublic: boolean | null
}

const initialState: State = {
	itemType: null,
	item: null,
	sourceId: null,
	targetIds: [],
	dropResult: null,
	didDrop: false,
	isSourcePublic: null,
}

export function reduce(
	state: State = initialState,
	action: Action<{
		itemType: Identifier | Identifier[]
		item: any
		sourceId: string
		targetId: string
		targetIds: string[]
		isSourcePublic: boolean
		dropResult: any
	}>,
): State {
	const { payload } = action
	switch (action.type) {
		case BEGIN_DRAG:
			return {
				...state,
				itemType: payload.itemType,
				item: payload.item,
				sourceId: payload.sourceId,
				isSourcePublic: payload.isSourcePublic,
				dropResult: null,
				didDrop: false,
			}
		case PUBLISH_DRAG_SOURCE:
			return {
				...state,
				isSourcePublic: true,
			}
		case HOVER:
			return {
				...state,
				targetIds: payload.targetIds,
			}
		case REMOVE_TARGET:
			if (state.targetIds.indexOf(payload.targetId) === -1) {
				return state
			}
			return {
				...state,
				targetIds: without(state.targetIds, payload.targetId),
			}
		case DROP:
			return {
				...state,
				dropResult: payload.dropResult,
				didDrop: true,
				targetIds: [],
			}
		case DROP_PENDING:
			// A drop that happened but has no result yet. It has to count as a drop
			// here or the operation would not know one occurred: `didDrop()` would
			// stay false, an outer target could not see that a nested one took it,
			// and the "cannot call drop twice" invariant would not fire.
			return {
				...state,
				didDrop: true,
				targetIds: [],
			}
		case END_DRAG:
			return {
				...state,
				itemType: null,
				item: null,
				sourceId: null,
				dropResult: null,
				didDrop: false,
				isSourcePublic: null,
				targetIds: [],
			}
		default:
			return state
	}
}
