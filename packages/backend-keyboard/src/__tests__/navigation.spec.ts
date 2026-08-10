import type { NavigationCandidate } from '../interfaces.js'
import {
	documentOrderNavigation,
	sortByDocumentOrder,
	spatialNavigation,
} from '../navigation.js'

interface Rect {
	left: number
	top: number
	width: number
	height: number
}

function candidate(targetId: string, rect?: Rect): NavigationCandidate {
	const node = document.createElement('div')
	if (rect) {
		node.getBoundingClientRect = () =>
			({
				...rect,
				right: rect.left + rect.width,
				bottom: rect.top + rect.height,
				x: rect.left,
				y: rect.top,
			}) as DOMRect
	}
	document.body.appendChild(node)
	return { targetId, node }
}

describe('documentOrderNavigation', () => {
	const [a, b, c] = [candidate('a'), candidate('b'), candidate('c')]
	const candidates = [a, b, c] as NavigationCandidate[]
	const nav = (direction: string, current: NavigationCandidate | null) =>
		documentOrderNavigation({
			direction: direction as never,
			current,
			candidates,
			source: null,
		})

	it('treats down and right as forward, up and left as backward', () => {
		expect(nav('down', a as NavigationCandidate)).toBe(b)
		expect(nav('right', a as NavigationCandidate)).toBe(b)
		expect(nav('up', b as NavigationCandidate)).toBe(a)
		expect(nav('left', b as NavigationCandidate)).toBe(a)
	})

	it('enters the list from the end the key points at', () => {
		expect(nav('down', null)).toBe(a)
		expect(nav('up', null)).toBe(c)
	})

	it('returns null at the ends rather than wrapping', () => {
		expect(nav('down', c as NavigationCandidate)).toBeNull()
		expect(nav('up', a as NavigationCandidate)).toBeNull()
	})

	it('re-enters from the start when the current target became ineligible', () => {
		expect(nav('down', candidate('gone'))).toBe(a)
	})

	it('has nowhere to go with no candidates', () => {
		expect(
			documentOrderNavigation({
				direction: 'down',
				current: null,
				candidates: [],
				source: null,
			}),
		).toBeNull()
	})
})

describe('spatialNavigation', () => {
	// A 2x2 grid, 100px cells:
	//   nw  ne
	//   sw  se
	const nw = candidate('nw', { left: 0, top: 0, width: 100, height: 100 })
	const ne = candidate('ne', { left: 100, top: 0, width: 100, height: 100 })
	const sw = candidate('sw', { left: 0, top: 100, width: 100, height: 100 })
	const se = candidate('se', { left: 100, top: 100, width: 100, height: 100 })
	const candidates = [nw, ne, sw, se]
	const nav = spatialNavigation()
	const move = (direction: string, current: NavigationCandidate) =>
		nav({ direction: direction as never, current, candidates, source: null })

	it('crosses a row rather than stepping one cell in document order', () => {
		// Document order would make "down" from nw land on ne.
		expect(move('down', nw)?.targetId).toBe('sw')
		expect(move('up', se)?.targetId).toBe('ne')
	})

	it('moves along a row for left and right', () => {
		expect(move('right', nw)?.targetId).toBe('ne')
		expect(move('left', se)?.targetId).toBe('sw')
	})

	it('stays put when there is nothing in that direction', () => {
		expect(move('up', nw)).toBeNull()
		expect(move('right', se)).toBeNull()
	})

	it('prefers straight ahead over a nearer diagonal', () => {
		const origin = candidate('o', { left: 0, top: 0, width: 10, height: 10 })
		const diagonal = candidate('diagonal', {
			left: 40,
			top: 20,
			width: 10,
			height: 10,
		})
		const ahead = candidate('ahead', {
			left: 0,
			top: 60,
			width: 10,
			height: 10,
		})

		const result = spatialNavigation()({
			direction: 'down',
			current: origin,
			candidates: [origin, diagonal, ahead],
			source: null,
		})

		expect(result?.targetId).toBe('ahead')
	})
})

describe('sortByDocumentOrder', () => {
	it('orders by position in the document, not registration order', () => {
		const root = document.createElement('div')
		document.body.appendChild(root)
		const first = document.createElement('div')
		const second = document.createElement('div')
		root.append(first, second)

		const sorted = sortByDocumentOrder([
			{ targetId: 'second', node: second },
			{ targetId: 'first', node: first },
		])

		expect(sorted.map((c) => c.targetId)).toEqual(['first', 'second'])
		root.remove()
	})
})
