import type { NavigationCandidate } from '../interfaces.js'
import {
	documentOrderNavigation,
	initialCandidate,
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

describe('initialCandidate', () => {
	/** Builds `<div>` siblings under a fresh root, in the order named. */
	function row(...ids: string[]) {
		const root = document.createElement('div')
		document.body.appendChild(root)
		const nodes: Record<string, HTMLElement> = {}
		for (const id of ids) {
			const node = document.createElement('div')
			root.appendChild(node)
			nodes[id] = node
		}
		return nodes
	}

	it('prefers a candidate the source sits inside', () => {
		const nodes = row('a', 'b', 'c')
		const source = document.createElement('div')
		;(nodes['b'] as HTMLElement).appendChild(source)

		const candidates = ['a', 'b', 'c'].map((id) => ({
			targetId: id,
			node: nodes[id] as HTMLElement,
		}))

		expect(initialCandidate(candidates, source)?.targetId).toBe('b')
	})

	it('counts a candidate as containing itself', () => {
		const nodes = row('a', 'b')
		const candidates = ['a', 'b'].map((id) => ({
			targetId: id,
			node: nodes[id] as HTMLElement,
		}))

		expect(
			initialCandidate(candidates, nodes['b'] as HTMLElement)?.targetId,
		).toBe('b')
	})

	it('takes the innermost of nested candidates', () => {
		// A list that is itself a drop target, containing rows that are too.
		const outer = document.createElement('div')
		const inner = document.createElement('div')
		const source = document.createElement('div')
		outer.appendChild(inner)
		inner.appendChild(source)
		document.body.appendChild(outer)

		const candidates = [
			{ targetId: 'outer', node: outer },
			{ targetId: 'inner', node: inner },
		]

		expect(initialCandidate(candidates, source)?.targetId).toBe('inner')
	})

	it('takes the first candidate after the source when it is inside none', () => {
		const nodes = row('a', 'source', 'b', 'c')
		const candidates = ['a', 'b', 'c'].map((id) => ({
			targetId: id,
			node: nodes[id] as HTMLElement,
		}))

		expect(
			initialCandidate(candidates, nodes['source'] as HTMLElement)?.targetId,
		).toBe('b')
	})

	it('falls back to the last one before it when nothing follows', () => {
		const nodes = row('a', 'b', 'source')
		const candidates = ['a', 'b'].map((id) => ({
			targetId: id,
			node: nodes[id] as HTMLElement,
		}))

		expect(
			initialCandidate(candidates, nodes['source'] as HTMLElement)?.targetId,
		).toBe('b')
	})

	it('takes the first candidate with no source to compare against', () => {
		const nodes = row('a', 'b')
		const candidates = ['a', 'b'].map((id) => ({
			targetId: id,
			node: nodes[id] as HTMLElement,
		}))

		expect(initialCandidate(candidates, null)?.targetId).toBe('a')
	})

	it('has nowhere to start with no candidates', () => {
		expect(initialCandidate([], document.createElement('div'))).toBeNull()
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
