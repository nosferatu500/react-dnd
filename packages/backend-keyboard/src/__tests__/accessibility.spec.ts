import { KeyboardBackend } from '../index.js'
import { harness } from './harness.js'

describe('ARIA attributes on drag sources', () => {
	it('makes a plain element focusable and describes it', () => {
		const h = harness(KeyboardBackend)
		const node = h.sourceNode

		expect(node.getAttribute('tabindex')).toBe('0')
		expect(node.getAttribute('role')).toBe('button')
		expect(node.getAttribute('aria-roledescription')).toBe('draggable item')

		const describedBy = node.getAttribute('aria-describedby') as string
		const instructions = document.getElementById(describedBy)
		expect(instructions?.textContent).toContain(
			'Press space or enter to pick up',
		)

		h.cleanup()
	})

	it('restores the element exactly as it found it', () => {
		const h = harness(KeyboardBackend)
		const node = h.sourceNode

		h.cleanup()

		expect(node.hasAttribute('tabindex')).toBe(false)
		expect(node.hasAttribute('role')).toBe(false)
		expect(node.hasAttribute('aria-roledescription')).toBe(false)
		expect(node.hasAttribute('aria-describedby')).toBe(false)
	})

	it('does not overrule semantics the application already chose', () => {
		const h = harness(KeyboardBackend)
		h.cleanup()

		// A source that is already a button, already labelled, already described.
		const node = document.createElement('button')
		node.setAttribute('role', 'gridcell')
		node.setAttribute('aria-roledescription', 'chess piece')
		node.setAttribute('aria-describedby', 'app-help')
		document.body.appendChild(node)

		const h2 = harness(KeyboardBackend)
		const disconnect = h2.backend.connectDragSource('S99', node)

		expect(node.hasAttribute('tabindex')).toBe(false) // buttons already focus
		expect(node.getAttribute('role')).toBe('gridcell')
		expect(node.getAttribute('aria-roledescription')).toBe('chess piece')
		// The app's description is kept and the instructions are appended to it.
		expect(node.getAttribute('aria-describedby')).toMatch(
			/^app-help react-dnd-keyboard-instructions-\d+$/,
		)

		disconnect()
		expect(node.getAttribute('aria-describedby')).toBe('app-help')

		node.remove()
		h2.cleanup()
	})

	it('can be turned off entirely', () => {
		const h = harness(KeyboardBackend, {
			options: { applyAriaAttributes: false },
		})

		expect(h.sourceNode.hasAttribute('tabindex')).toBe(false)
		expect(h.sourceNode.hasAttribute('role')).toBe(false)
		// The interaction still works; only the DOM is left alone.
		expect(h.press(' ')).toBe(true)
		expect(h.manager.getMonitor().isDragging()).toBe(true)

		h.cleanup()
	})
})

describe('the live region', () => {
	function region() {
		return document.querySelector('[role="status"]')
	}

	it('is polite and atomic, so a drag never interrupts the user', () => {
		const h = harness(KeyboardBackend)

		expect(region()?.getAttribute('aria-live')).toBe('polite')
		expect(region()?.getAttribute('aria-atomic')).toBe('true')

		h.cleanup()
	})

	it('narrates pick up, move, and drop', () => {
		const h = harness(KeyboardBackend)

		h.press(' ')
		expect(h.announcements()).toBe(
			'Picked up Card A. Over Target 1, 1 of 3. ' +
				'Use the arrow keys to move, space to drop, escape to cancel.',
		)

		h.press('ArrowDown')
		expect(h.announcements()).toBe('Over Target 2, 2 of 3.')

		h.press(' ')
		expect(h.announcements()).toBe('Dropped Card A on Target 2.')

		h.cleanup()
	})

	it('reports the new position every time the hover moves', () => {
		const h = harness(KeyboardBackend, { targets: [{}, {}] })
		h.press(' ')

		h.press('ArrowDown')
		expect(h.announcements()).toBe('Over Target 2, 2 of 2.')
		h.press('ArrowUp')
		expect(h.announcements()).toBe('Over Target 1, 1 of 2.')
		h.press('ArrowDown')
		expect(h.announcements()).toBe('Over Target 2, 2 of 2.')

		h.cleanup()
	})

	it('uses aria-label in preference to the element text', () => {
		const h = harness(KeyboardBackend)
		h.sourceNode.setAttribute('aria-label', 'Knight on b1')

		h.press(' ')
		expect(h.announcements()).toContain('Picked up Knight on b1.')

		h.cleanup()
	})

	it('takes wholesale replacement of the wording', () => {
		const h = harness(KeyboardBackend, {
			options: {
				announcements: {
					pickUp: ({ source, targetCount }) =>
						`${source} aufgenommen. ${targetCount} Ziele.`,
				},
			},
		})

		h.press(' ')
		expect(h.announcements()).toBe('Card A aufgenommen. 3 Ziele.')

		h.cleanup()
	})

	it('is removed from the document on teardown', () => {
		const h = harness(KeyboardBackend)
		expect(region()).not.toBeNull()
		h.cleanup()
		expect(region()).toBeNull()
	})

	it('can be turned off', () => {
		const h = harness(KeyboardBackend, { options: { announce: false } })
		expect(region()).toBeNull()
		h.press(' ')
		expect(h.manager.getMonitor().isDragging()).toBe(true)
		h.cleanup()
	})
})
