import { KeyboardBackend } from '../index.js'
import type { NavigationEvent } from '../interfaces.js'
import { harness } from './harness.js'

/** Records every navigation event, minus the DOM nodes, for comparison. */
function recorder() {
	const seen: Array<{
		direction: string
		current: string | null
		candidates: string[]
		allTargets: string[]
		source: string | null
	}> = []

	const onNavigate = (event: NavigationEvent): void => {
		seen.push({
			direction: event.direction,
			current: event.current?.targetId ?? null,
			candidates: event.candidates.map((c) => c.targetId),
			allTargets: event.allTargets.map((c) => c.targetId),
			source: event.source?.textContent ?? null,
		})
	}

	return { seen, onNavigate }
}

describe('onNavigate', () => {
	it('fires on every arrow key, in the direction pressed', () => {
		const r = recorder()
		const h = harness(KeyboardBackend, {
			options: { onNavigate: r.onNavigate },
		})

		h.press(' ')
		h.press('ArrowDown')
		h.press('ArrowRight')
		h.press('ArrowUp')
		h.press('ArrowLeft')

		expect(r.seen.map((e) => e.direction)).toEqual([
			'down',
			'right',
			'up',
			'left',
		])

		h.cleanup()
	})

	it('fires even when the hover does not move', () => {
		// The whole point. `documentOrderNavigation` stops at the ends, and a
		// `hover` with unchanged targetIds is dirtiness NONE anyway, so this is the
		// only signal the application gets that a key was pressed at all.
		const r = recorder()
		const h = harness(KeyboardBackend, {
			targets: [{}],
			options: { onNavigate: r.onNavigate },
		})

		h.press(' ')
		h.hovered.length = 0
		h.press('ArrowDown')
		h.press('ArrowUp')

		expect(h.hovered).toEqual([])
		expect(r.seen.map((e) => e.direction)).toEqual(['down', 'up'])

		h.cleanup()
	})

	it('is not called before a pick-up or after a drop', () => {
		const r = recorder()
		const h = harness(KeyboardBackend, {
			options: { onNavigate: r.onNavigate },
		})

		h.press('ArrowDown')
		expect(r.seen).toEqual([])

		h.press(' ')
		h.press(' ') // drop
		h.press('ArrowDown')
		expect(r.seen).toEqual([])

		h.cleanup()
	})

	it('describes where the drag is when it fires', () => {
		const r = recorder()
		const h = harness(KeyboardBackend, {
			targets: [{}, { canDrop: false }, {}],
			options: { onNavigate: r.onNavigate },
		})

		h.press(' ')
		h.press('ArrowDown')

		const [first] = r.seen
		expect(first?.source).toBe('Card A')
		// The hovered target as of the key press, before this key moved anything.
		expect(first?.current).toBe(first?.candidates[0])
		// `candidates` is what accepts the item; `allTargets` is every mounted
		// target, which is what a layout-aware navigator needs.
		expect(first?.candidates).toHaveLength(2)
		expect(first?.allTargets).toHaveLength(3)

		h.cleanup()
	})

	it('reports the hover it moved to on the next key press', () => {
		const r = recorder()
		const h = harness(KeyboardBackend, {
			options: { onNavigate: r.onNavigate },
		})

		h.press(' ')
		h.press('ArrowDown')
		h.press('ArrowDown')

		expect(r.seen[0]?.current).toBe(r.seen[0]?.candidates[0])
		expect(r.seen[1]?.current).toBe(r.seen[1]?.candidates[1])

		h.cleanup()
	})

	describe('preventDefault', () => {
		it('keeps the key press from moving the hover', () => {
			// A tree taking left and right for indentation, leaving up and down to
			// move between rows as usual.
			const indents: string[] = []
			const h = harness(KeyboardBackend, {
				options: {
					onNavigate: (event) => {
						if (event.direction === 'left' || event.direction === 'right') {
							indents.push(event.direction)
							event.preventDefault()
						}
					},
				},
			})

			h.press(' ')
			h.hovered.length = 0

			h.press('ArrowRight')
			expect(h.hovered).toEqual([])
			expect(indents).toEqual(['right'])

			h.press('ArrowDown')
			expect(h.hovered).toEqual(['Target 2'])

			h.cleanup()
		})

		it('still takes the key press from the page', () => {
			// A drag owns the arrow keys whether or not the app handled one — a list
			// scrolling underneath a drag it did not move is worse than either.
			const h = harness(KeyboardBackend, {
				options: { onNavigate: (event) => event.preventDefault() },
			})

			h.press(' ')

			expect(h.press('ArrowDown')).toBe(true)

			h.cleanup()
		})

		it('says nothing, leaving the announcement to the application', () => {
			const h = harness(KeyboardBackend, {
				options: { onNavigate: (event) => event.preventDefault() },
			})

			h.press(' ')
			const afterPickUp = h.announcements()
			h.press('ArrowDown')

			expect(h.announcements()).toBe(afterPickUp)

			h.cleanup()
		})

		it('is per key press, not sticky', () => {
			let prevent = true
			const h = harness(KeyboardBackend, {
				options: {
					onNavigate: (event) => {
						if (prevent) {
							event.preventDefault()
						}
					},
				},
			})

			h.press(' ')
			h.hovered.length = 0

			h.press('ArrowDown')
			expect(h.hovered).toEqual([])

			prevent = false
			h.press('ArrowDown')
			expect(h.hovered).toEqual(['Target 2'])

			h.cleanup()
		})
	})

	it('does not consult getNextTarget when the application took the key', () => {
		const getNextTarget = vi.fn(() => null)
		const h = harness(KeyboardBackend, {
			options: {
				getNextTarget,
				onNavigate: (event) => event.preventDefault(),
			},
		})

		h.press(' ')
		h.press('ArrowDown')

		expect(getNextTarget).not.toHaveBeenCalled()

		h.cleanup()
	})

	it('hands getNextTarget the same request it was given', () => {
		let fromNavigate: unknown
		let fromNextTarget: unknown
		const h = harness(KeyboardBackend, {
			options: {
				onNavigate: ({ preventDefault, ...request }) => {
					fromNavigate = request
				},
				getNextTarget: (request) => {
					fromNextTarget = request
					return null
				},
			},
		})

		h.press(' ')
		h.press('ArrowDown')

		expect(fromNavigate).toEqual(fromNextTarget)

		h.cleanup()
	})
})
