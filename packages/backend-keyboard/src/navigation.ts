import type {
	GetNextTarget,
	NavigationCandidate,
	NavigationDirection,
} from './interfaces.js'

const BACKWARD: NavigationDirection[] = ['backward', 'up', 'left']

/**
 * Steps through the eligible drop targets in document order: down/right go
 * forward, up/left go back. Deliberately does not wrap — at the ends the hover
 * stays put, so holding an arrow key cannot carry an item past the end of a
 * list and around to the start without the user noticing.
 *
 * This is the default because it is the only model that is both deterministic
 * and independent of layout: it needs no measurement, so it behaves identically
 * in a browser and under test. For grids and boards, where up/down should mean
 * a row rather than a step, use {@link spatialNavigation}.
 */
export const documentOrderNavigation: GetNextTarget = ({
	direction,
	current,
	candidates,
}) => {
	if (candidates.length === 0) {
		return null
	}
	const step = BACKWARD.includes(direction) ? -1 : 1
	if (!current) {
		// Nothing hovered yet: enter from whichever end the key points at.
		return (
			(step === 1 ? candidates[0] : candidates[candidates.length - 1]) ?? null
		)
	}

	const index = candidates.findIndex((c) => c.targetId === current.targetId)
	if (index === -1) {
		// The hovered target stopped being eligible mid-drag.
		return candidates[0] ?? null
	}
	return candidates[index + step] ?? null
}

interface Point {
	x: number
	y: number
}

function centerOf(node: HTMLElement): Point {
	const rect = node.getBoundingClientRect()
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/**
 * Moves to the nearest eligible target lying in the direction of the arrow key,
 * measured from the center of the currently hovered one. Targets off to the
 * side are penalized so that a straight-ahead neighbour wins over a closer
 * diagonal, which is what makes up/down cross a row on a grid.
 *
 * Needs real layout: under jsdom every rect is zero, so every candidate looks
 * like it is in the same place and this degrades to document order. Reach for it
 * in 2D layouts (a board, a kanban, a calendar) and keep the default elsewhere.
 *
 * @param crossAxisPenalty how heavily to punish sideways displacement; higher
 * values insist more strongly on travelling in a straight line.
 */
export function spatialNavigation(crossAxisPenalty = 3): GetNextTarget {
	return (request) => {
		const { direction, current, candidates } = request
		if (candidates.length === 0) {
			return null
		}
		if (direction === 'forward' || direction === 'backward' || !current) {
			return documentOrderNavigation(request)
		}

		const origin = centerOf(current.node)
		let best: NavigationCandidate | null = null
		let bestCost = Number.POSITIVE_INFINITY

		for (const candidate of candidates) {
			if (candidate.targetId === current.targetId) {
				continue
			}
			const point = centerOf(candidate.node)
			const dx = point.x - origin.x
			const dy = point.y - origin.y

			// Distance along the direction of travel, and away from it.
			let along: number
			let across: number
			switch (direction) {
				case 'up':
					along = -dy
					across = Math.abs(dx)
					break
				case 'down':
					along = dy
					across = Math.abs(dx)
					break
				case 'left':
					along = -dx
					across = Math.abs(dy)
					break
				default:
					along = dx
					across = Math.abs(dy)
					break
			}
			if (along <= 0) {
				continue
			}

			const cost = along + across * crossAxisPenalty
			if (cost < bestCost) {
				bestCost = cost
				best = candidate
			}
		}

		// Nothing that way. Stay put rather than teleporting somewhere unrelated.
		return best
	}
}

/**
 * Sorts by position in the document. `compareDocumentPosition` is the only
 * ordering that survives portals, fragments and re-parenting, all of which make
 * registration order meaningless.
 */
export function sortByDocumentOrder(
	candidates: NavigationCandidate[],
): NavigationCandidate[] {
	return [...candidates].sort((a, b) => {
		if (a.node === b.node) {
			return 0
		}
		const position = a.node.compareDocumentPosition(b.node)
		if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
			return -1
		}
		if (position & Node.DOCUMENT_POSITION_PRECEDING) {
			return 1
		}
		return 0
	})
}
