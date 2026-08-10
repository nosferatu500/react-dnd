import { isKeyboardDrag, KeyboardBackend } from '../index.js'
import { harness } from './harness.js'

describe('picking a source up', () => {
	it('begins a drag on space and hovers the nearest eligible target', () => {
		const h = harness(KeyboardBackend)

		expect(h.press(' ')).toBe(true)

		expect(h.manager.getMonitor().isDragging()).toBe(true)
		expect(h.manager.getMonitor().getItem()).toEqual({ id: 'a' })
		expect(h.hovered).toEqual(['Target 1'])

		h.cleanup()
	})

	it('starts the hover where the item already is, not at the top', () => {
		// The sortable list: every row is both a drag source and a drop target,
		// sharing one ref. Entering at `candidates[0]` would preview the last row
		// jumping to the front of the list before the user pressed anything.
		const h = harness(KeyboardBackend, { sourcePlacement: { isTarget: 2 } })

		h.press(' ')

		expect(h.hovered).toEqual(['Target 3'])
		expect(h.announcements()).toContain('Over Target 3, 3 of 3.')

		h.cleanup()
	})

	it('finds the row a drag handle is nested in', () => {
		const h = harness(KeyboardBackend, { sourcePlacement: { insideTarget: 1 } })

		h.press(' ')

		expect(h.hovered).toEqual(['Target 2'])

		h.cleanup()
	})

	it('falls back to the last target when the source follows them all', () => {
		const h = harness(KeyboardBackend, { sourcePlacement: 'after' })

		h.press(' ')

		expect(h.hovered).toEqual(['Target 3'])

		h.cleanup()
	})

	it('does not start on a row that will not accept the item', () => {
		// A row that refuses its own item — a list that only takes cards from
		// elsewhere. Starting there would announce a position it cannot drop on.
		const h = harness(KeyboardBackend, {
			targets: [{}, { canDrop: false }, {}],
			sourcePlacement: { isTarget: 1 },
		})

		h.press(' ')

		expect(h.hovered).toEqual(['Target 3'])

		h.cleanup()
	})

	it('arrows on from where it started, not from the top', () => {
		const h = harness(KeyboardBackend, { sourcePlacement: { isTarget: 2 } })
		h.press(' ')
		h.hovered.length = 0

		h.press('ArrowUp')

		expect(h.hovered).toEqual(['Target 2'])

		h.cleanup()
	})

	it('begins a drag on enter too', () => {
		const h = harness(KeyboardBackend)
		expect(h.press('Enter')).toBe(true)
		expect(h.manager.getMonitor().isDragging()).toBe(true)
		h.cleanup()
	})

	it('ignores keys pressed outside any drag source', () => {
		const h = harness(KeyboardBackend)
		const elsewhere = document.createElement('div')
		document.body.appendChild(elsewhere)

		expect(h.press(' ', elsewhere)).toBe(false)
		expect(h.manager.getMonitor().isDragging()).toBe(false)

		elsewhere.remove()
		h.cleanup()
	})

	it('leaves the space bar to a text field inside the source', () => {
		// A card with an inline rename box: space belongs to the input, and
		// hijacking it would make the field impossible to type in.
		const h = harness(KeyboardBackend)
		const input = document.createElement('input')
		h.sourceNode.appendChild(input)

		expect(h.press(' ', input)).toBe(false)
		expect(h.manager.getMonitor().isDragging()).toBe(false)

		h.cleanup()
	})

	it('leaves modified key presses to the application', () => {
		const h = harness(KeyboardBackend)
		expect(h.press(' ', h.sourceNode, { metaKey: true })).toBe(false)
		expect(h.manager.getMonitor().isDragging()).toBe(false)
		h.cleanup()
	})

	it('does not lift a source that refuses to be dragged', () => {
		const h = harness(KeyboardBackend, { canDrag: false })
		expect(h.press(' ')).toBe(false)
		expect(h.manager.getMonitor().isDragging()).toBe(false)
		h.cleanup()
	})

	it('does not strand the user in a drag nothing can accept', () => {
		const h = harness(KeyboardBackend, {
			targets: [{ type: 'OTHER' }, { canDrop: false }],
		})

		h.press(' ')

		expect(h.manager.getMonitor().isDragging()).toBe(false)
		expect(h.announcements()).toContain('No drop targets accept it')

		h.cleanup()
	})
})

describe('moving between targets', () => {
	it('walks forwards and backwards in document order', () => {
		const h = harness(KeyboardBackend)
		h.press(' ')
		h.hovered.length = 0

		h.press('ArrowDown')
		h.press('ArrowRight')
		h.press('ArrowUp')

		expect(h.hovered).toEqual(['Target 2', 'Target 3', 'Target 2'])

		h.cleanup()
	})

	it('stays put at the ends rather than wrapping around', () => {
		const h = harness(KeyboardBackend, { targets: [{}, {}] })
		h.press(' ')
		h.hovered.length = 0

		h.press('ArrowUp')
		expect(h.hovered).toEqual([])

		h.press('ArrowDown')
		h.press('ArrowDown')
		expect(h.hovered).toEqual(['Target 2'])

		h.cleanup()
	})

	it('skips targets of the wrong type and targets that refuse the item', () => {
		const h = harness(KeyboardBackend, {
			targets: [
				{ label: 'first' },
				{ label: 'wrong type', type: 'OTHER' },
				{ label: 'refuses', canDrop: false },
				{ label: 'last' },
			],
		})

		h.press(' ')
		h.press('ArrowDown')

		expect(h.hovered).toEqual(['first', 'last'])

		h.cleanup()
	})

	it('claims the arrow keys so the page does not scroll underneath', () => {
		const h = harness(KeyboardBackend)
		expect(h.press('ArrowDown')).toBe(false)
		h.press(' ')
		expect(h.press('ArrowDown')).toBe(true)
		h.cleanup()
	})
})

describe('dropping', () => {
	it('drops on the hovered target and ends the drag', () => {
		const h = harness(KeyboardBackend)
		h.press(' ')
		h.press('ArrowDown')

		expect(h.press(' ')).toBe(true)

		expect(h.dropped).toEqual(['Target 2'])
		expect(h.manager.getMonitor().isDragging()).toBe(false)

		h.cleanup()
	})

	it('refuses to drop on a target that stopped accepting mid-drag', () => {
		// `canDrop` is read live, so flipping the spec is what a target whose
		// answer depends on the dragged item looks like from here.
		const spec = { label: 'only', canDrop: true }
		const h = harness(KeyboardBackend, { targets: [spec] })

		h.press(' ')
		spec.canDrop = false
		h.press(' ')

		expect(h.dropped).toEqual([])
		expect(h.announcements()).toContain('Cannot drop')
		expect(h.manager.getMonitor().isDragging()).toBe(true)

		h.cleanup()
	})

	it('says so when there is nothing under the item to drop on', () => {
		const h = harness(KeyboardBackend)
		h.press(' ')
		// Remove every target from the document mid-drag.
		for (const node of h.targetNodes) {
			node.remove()
		}
		h.press(' ')

		expect(h.dropped).toEqual([])
		expect(h.announcements()).toContain('Cannot drop')

		h.cleanup()
	})
})

describe('isKeyboardDrag', () => {
	it('is false until something is picked up, and again once it lands', () => {
		const h = harness(KeyboardBackend)

		expect(isKeyboardDrag(h.manager)).toBe(false)

		h.press(' ')
		expect(isKeyboardDrag(h.manager)).toBe(true)

		h.press(' ')
		expect(isKeyboardDrag(h.manager)).toBe(false)

		h.cleanup()
	})

	it('is false again after a cancel', () => {
		const h = harness(KeyboardBackend)
		h.press(' ')
		h.press('Escape')

		expect(isKeyboardDrag(h.manager)).toBe(false)

		h.cleanup()
	})

	it('answers during the drop callback, which is where it is asked', () => {
		// The reason this exists: a target deciding what a drop means needs to
		// know the modality *while* it is handling the drop, and `endDrag` has not
		// run yet at that point.
		const seen: boolean[] = []
		const h = harness(KeyboardBackend, {
			targets: [
				{
					drop: () => {
						seen.push(isKeyboardDrag(h.manager))
						return { ok: true }
					},
				},
			],
		})

		h.press(' ')
		h.press(' ')

		expect(seen).toEqual([true])

		h.cleanup()
	})

	it('does not answer for a drag the keyboard did not start', () => {
		// dnd-core cannot tell the difference — `isDragging()` is true either way.
		const h = harness(KeyboardBackend)

		h.manager.getActions().beginDrag([h.sourceId])

		expect(h.manager.getMonitor().isDragging()).toBe(true)
		expect(isKeyboardDrag(h.manager)).toBe(false)

		h.manager.getActions().endDrag()
		h.cleanup()
	})

	it('is false for a backend that has never heard of the keyboard', () => {
		const manager = {
			getBackend: () => ({ profile: () => ({}) }),
		} as unknown as Parameters<typeof isKeyboardDrag>[0]

		expect(isKeyboardDrag(manager)).toBe(false)
	})
})

describe('cancelling', () => {
	it('ends the drag on escape without dropping', () => {
		const h = harness(KeyboardBackend)
		h.press(' ')
		h.press('ArrowDown')

		expect(h.press('Escape')).toBe(true)

		expect(h.dropped).toEqual([])
		expect(h.manager.getMonitor().isDragging()).toBe(false)
		expect(h.announcements()).toContain('Cancelled')

		h.cleanup()
	})

	it('holds on to focus while a drag is in progress', () => {
		// Tab would leave a drag running with nothing steering it.
		const h = harness(KeyboardBackend)
		expect(h.press('Tab')).toBe(false)
		h.press(' ')
		expect(h.press('Tab')).toBe(true)
		h.cleanup()
	})

	it('cancels when the dragged element is unmounted mid-drag', () => {
		const h = harness(KeyboardBackend)
		h.press(' ')
		expect(h.manager.getMonitor().isDragging()).toBe(true)

		h.cleanup() // disconnects the source while the drag is live

		expect(h.manager.getMonitor().isDragging()).toBe(false)
	})
})
