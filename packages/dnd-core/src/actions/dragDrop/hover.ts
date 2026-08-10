import type {
	Action,
	DragDropManager,
	DragDropMonitor,
	HandlerRegistry,
	HoverOptions,
	HoverPayload,
	Identifier,
} from '../../interfaces.js'
import { invariant } from '../../utils/invariant.js'
import { matchesType } from '../../utils/matchesType.js'
import { HOVER } from './types.js'

export function createHover(manager: DragDropManager) {
	return function hover(
		targetIdsArg: string[],
		{ clientOffset }: HoverOptions = {},
	): Action<HoverPayload> {
		verifyTargetIdsIsArray(targetIdsArg)
		const targetIds = targetIdsArg.slice(0)
		const monitor = manager.getMonitor()
		const registry = manager.getRegistry()
		const draggedItemType = monitor.getItemType()

		// Uniqueness is checked against what the backend actually passed. Checking
		// it after the type filter below would let duplicates through whenever the
		// duplicated target happens not to accept the dragged type, which is a
		// backend bug either way.
		checkInvariants(targetIds, monitor)
		removeNonMatchingTargetIds(targetIds, registry, draggedItemType)
		// Deliberately after the filter: a target unregistered mid-drag is dropped
		// by it rather than throwing. Reverting that order brings back
		// "Expected targetIds to be registered" (upstream #3403, #763).
		verifyTargetIdsAreRegistered(targetIds, registry)
		hoverAllTargets(targetIds, monitor, registry)

		return {
			type: HOVER,
			payload: {
				targetIds,
				clientOffset: clientOffset || null,
			},
		}
	}
}

function verifyTargetIdsIsArray(targetIdsArg: string[]) {
	invariant(Array.isArray(targetIdsArg), 'Expected targetIds to be an array.')
}

function checkInvariants(targetIds: string[], monitor: DragDropMonitor) {
	invariant(monitor.isDragging(), 'Cannot call hover while not dragging.')
	invariant(!monitor.didDrop(), 'Cannot call hover after drop.')
	for (let i = 0; i < targetIds.length; i++) {
		invariant(
			targetIds.lastIndexOf(targetIds[i] as string) === i,
			'Expected targetIds to be unique in the passed array.',
		)
	}
}

function verifyTargetIdsAreRegistered(
	targetIds: string[],
	registry: HandlerRegistry,
) {
	for (const targetId of targetIds) {
		invariant(
			registry.getTarget(targetId),
			'Expected targetIds to be registered.',
		)
	}
}

function removeNonMatchingTargetIds(
	targetIds: string[],
	registry: HandlerRegistry,
	draggedItemType: Identifier | null,
) {
	// Remove those targetIds that don't match the targetType.  This
	// fixes shallow isOver which would only be non-shallow because of
	// non-matching targets.
	for (let i = targetIds.length - 1; i >= 0; i--) {
		const targetId = targetIds[i] as string
		const targetType = registry.getTargetType(targetId)
		if (!matchesType(targetType, draggedItemType)) {
			targetIds.splice(i, 1)
		}
	}
}

function hoverAllTargets(
	targetIds: string[],
	monitor: DragDropMonitor,
	registry: HandlerRegistry,
) {
	// Finally call hover on all matching targets.
	targetIds.forEach((targetId) => {
		const target = registry.getTarget(targetId)
		target.hover(monitor, targetId)
	})
}
