import type { NavigationCandidate } from '../interfaces.js'
import { gridNavigation } from '../navigation.js'

/**
 * A 3x3 grid, in document order:
 *
 *   0 1 2
 *   3 4 5
 *   6 7 8
 */
function grid(size = 9): NavigationCandidate[] {
	const root = document.createElement('div')
	document.body.appendChild(root)
	return Array.from({ length: size }, (_, i) => {
		const node = document.createElement('div')
		root.appendChild(node)
		return { targetId: String(i), node }
	})
}

const nav = gridNavigation({ columns: 3 })

function move(
	direction: string,
	from: string,
	allTargets: NavigationCandidate[],
	eligible: NavigationCandidate[] = allTargets,
) {
	const current = allTargets.find((c) => c.targetId === from) ?? null
	return nav({
		direction: direction as never,
		current,
		candidates: eligible,
		allTargets,
		source: null,
	})
}

describe('gridNavigation', () => {
	it('moves a whole row for up and down', () => {
		const cells = grid()
		expect(move('down', '1', cells)?.targetId).toBe('4')
		expect(move('down', '4', cells)?.targetId).toBe('7')
		expect(move('up', '7', cells)?.targetId).toBe('4')
	})

	it('moves one cell for left and right', () => {
		const cells = grid()
		expect(move('right', '3', cells)?.targetId).toBe('4')
		expect(move('left', '4', cells)?.targetId).toBe('3')
	})

	it('stops at the edges instead of wrapping', () => {
		const cells = grid()
		expect(move('up', '1', cells)).toBeNull()
		expect(move('down', '7', cells)).toBeNull()
		// The interesting one: right from the end of a row must not reappear at
		// the start of the next, which would read as the item jumping a row.
		expect(move('right', '2', cells)).toBeNull()
		expect(move('left', '3', cells)).toBeNull()
	})

	it('skips cells that will not accept the item', () => {
		// A board where only some squares are legal moves: navigating the eligible
		// squares alone would ignore the grid entirely.
		const cells = grid()
		const eligible = [cells[0], cells[6]] as NavigationCandidate[]

		// 0 → down would land on 3, which is not eligible, so it keeps going.
		expect(move('down', '0', cells, eligible)?.targetId).toBe('6')
	})

	it('gives up when nothing in that direction accepts the item', () => {
		const cells = grid()
		const eligible = [cells[0], cells[2]] as NavigationCandidate[]
		expect(move('down', '0', cells, eligible)).toBeNull()
	})

	it('handles a ragged last row', () => {
		const cells = grid(8) // 3 + 3 + 2
		expect(move('down', '4', cells)?.targetId).toBe('7')
		// index 5 + 3 = 8, past the end
		expect(move('down', '5', cells)).toBeNull()
	})

	it('falls back to document order for forward and backward', () => {
		const cells = grid()
		expect(move('forward', '1', cells)?.targetId).toBe('2')
		expect(move('backward', '1', cells)?.targetId).toBe('0')
	})

	it('enters the grid when nothing is hovered yet', () => {
		const cells = grid()
		expect(move('down', 'nope', cells)?.targetId).toBe('0')
	})

	it('rejects a column count that cannot describe a grid', () => {
		expect(() => gridNavigation({ columns: 0 })).toThrow(
			/positive integer, got 0/,
		)
		expect(() => gridNavigation({ columns: 2.5 })).toThrow(/positive integer/)
	})
})
