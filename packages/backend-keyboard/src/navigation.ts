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
 * a row rather than a step, use {@link gridNavigation}, or
 * {@link spatialNavigation} when the layout is not a regular grid.
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

export interface GridNavigationOptions {
	/** Cells per row, counting every drop target, not just the eligible ones. */
	columns: number
}

/**
 * Treats the drop targets as a row-major grid `columns` wide: left and right
 * move within a row, up and down move by a whole row.
 *
 * Unlike {@link spatialNavigation} this measures nothing, so it behaves the same
 * in a browser and under test. Unlike {@link documentOrderNavigation} it knows
 * that on a board, down means the next row rather than the next cell.
 *
 * The grid is built from `allTargets`, not from the eligible ones — on a
 * chessboard only the legal moves accept the piece, and navigating the eligible
 * squares alone would step through scattered cells with no shape. Cells that
 * cannot be dropped on are skipped over: the hover keeps traveling in the
 * direction asked for until it reaches one that can, or leaves the grid.
 *
 * Neither axis wraps. Left at the start of a row stays put rather than
 * reappearing at the end of the row above.
 */
export function gridNavigation({
	columns,
}: GridNavigationOptions): GetNextTarget {
	if (!Number.isInteger(columns) || columns < 1) {
		throw new Error(
			`gridNavigation: columns must be a positive integer, got ${columns}`,
		)
	}

	return (request) => {
		const { direction, current, candidates, allTargets } = request
		const grid = allTargets.length > 0 ? allTargets : candidates
		if (grid.length === 0) {
			return null
		}
		if (direction === 'forward' || direction === 'backward' || !current) {
			return documentOrderNavigation(request)
		}

		const index = grid.findIndex((c) => c.targetId === current.targetId)
		if (index === -1) {
			return documentOrderNavigation(request)
		}

		const move = {
			up: -columns,
			down: columns,
			left: -1,
			right: 1,
		}[direction]

		const row = Math.floor(index / columns)
		const eligible = new Set(candidates.map((c) => c.targetId))

		for (
			let next = index + move;
			next >= 0 && next < grid.length;
			next += move
		) {
			// Horizontal travel must not run off the end of its row into the next
			// one, which would read as the item teleporting a row.
			if (
				(direction === 'left' || direction === 'right') &&
				Math.floor(next / columns) !== row
			) {
				return null
			}
			const candidate = grid[next] as NavigationCandidate
			if (eligible.has(candidate.targetId)) {
				return candidate
			}
		}

		return null
	}
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
 * like it is in the same place and this degrades to document order. Prefer
 * {@link gridNavigation} for anything with a fixed column count — it needs no
 * measurement. This is for layouts a column count cannot describe: masonry,
 * freely positioned cards, rows of differing height.
 *
 * @param crossAxisPenalty how heavily to punish sideways displacement; higher
 * values insist more strongly on traveling in a straight line.
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
 * Where the hover starts when an item is picked up.
 *
 * Not `candidates[0]`: in a sortable list every row is both a drag source and a
 * drop target, so entering at the top means lifting the last row previews it
 * jumping to the front of the list before the user has pressed a single arrow
 * key. An item should start out where it already is.
 *
 * In order of preference:
 *
 * 1. The candidate containing the source — the sortable row, where `drag` and
 *    `drop` share one ref, and the drag handle nested inside a row. The
 *    innermost one wins, matching how dnd-core treats the end of a target list
 *    as the shallowest hover.
 * 2. The candidate nearest the source in document order: the first one after
 *    it, else the last one before it. Forward breaks the tie, because that is
 *    the end the default navigation enters a list from.
 * 3. The first candidate, when there is no source node to compare against.
 *
 * Containment and document order rather than geometry, deliberately: the
 * default navigator has no layout to measure (§8 of the triage doc), and a
 * pick-up has no direction to measure along in any case.
 */
export function initialCandidate(
	candidates: NavigationCandidate[],
	source: HTMLElement | null,
): NavigationCandidate | null {
	const first = candidates[0] ?? null
	if (!source || !first) {
		return first
	}

	let containing: NavigationCandidate | null = null
	let preceding: NavigationCandidate | null = null
	let following: NavigationCandidate | null = null

	for (const candidate of candidates) {
		// `contains` is true of a node itself, so this covers the shared-ref case
		// as well as the nested one.
		if (candidate.node.contains(source)) {
			// Ancestors sort ahead of their descendants, so the last match is the
			// innermost — the most specific answer to "where is it already".
			containing = candidate
		} else if (
			candidate.node.compareDocumentPosition(source) &
			Node.DOCUMENT_POSITION_FOLLOWING
		) {
			preceding = candidate
		} else {
			following ??= candidate
		}
	}

	return containing ?? following ?? preceding ?? first
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
