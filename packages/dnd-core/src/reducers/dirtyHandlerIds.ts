import { HOVER } from '../actions/dragDrop/index.js'
import {
	ADD_SOURCE,
	ADD_TARGET,
	REMOVE_SOURCE,
	REMOVE_TARGET,
} from '../actions/registry.js'
import type { Action } from '../interfaces.js'
import { ALL, NONE } from '../utils/dirtiness.js'
import { areArraysEqual } from '../utils/equality.js'
import { xor } from '../utils/js_utils.js'

export type State = string[]

export interface DirtyHandlerIdPayload {
	targetIds: string[]
	prevTargetIds: string[]
}

export function reduce(
	_state: State = NONE,
	action: Action<DirtyHandlerIdPayload>,
): State {
	switch (action.type) {
		case HOVER:
			break
		case ADD_SOURCE:
		case ADD_TARGET:
		case REMOVE_TARGET:
		case REMOVE_SOURCE:
			return NONE
		default:
			return ALL
	}

	const { targetIds = [], prevTargetIds = [] } = action.payload
	const result = xor(targetIds, prevTargetIds)
	const didChange =
		result.length > 0 || !areArraysEqual(targetIds, prevTargetIds)

	if (!didChange) {
		return NONE
	}

	// Check the target ids at the innermost position. If they are valid, add them
	// to the result
	const prevInnermostTargetId = prevTargetIds.at(-1)
	const innermostTargetId = targetIds.at(-1)
	if (prevInnermostTargetId !== innermostTargetId) {
		if (prevInnermostTargetId) {
			result.push(prevInnermostTargetId)
		}
		if (innermostTargetId) {
			result.push(innermostTargetId)
		}
	}

	return result
}
