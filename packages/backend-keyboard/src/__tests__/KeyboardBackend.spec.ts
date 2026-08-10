import { KeyboardBackend } from '../index.js'
import { harness } from './harness.js'

describe('picking a source up', () => {
	it('begins a drag on space and hovers the first eligible target', () => {
		const h = harness(KeyboardBackend)

		expect(h.press(' ')).toBe(true)

		expect(h.manager.getMonitor().isDragging()).toBe(true)
		expect(h.manager.getMonitor().getItem()).toEqual({ id: 'a' })
		expect(h.hovered).toEqual(['Target 1'])

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
