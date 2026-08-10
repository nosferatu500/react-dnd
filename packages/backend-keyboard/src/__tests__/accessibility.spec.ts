import { KeyboardBackend } from '../index.js'
import type { KeyboardBackendOptions } from '../interfaces.js'
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

	/**
	 * Connects a `<div>` of the given content as an extra drag source and reports
	 * what the backend wrote, unwinding whatever happens — the assertions belong
	 * in the test, so that a failing one does not leave a live region behind for
	 * the next test to trip over.
	 */
	function connectSource(html: string, own: Record<string, string> = {}) {
		const h = harness(KeyboardBackend)
		const node = document.createElement('div')
		node.innerHTML = html
		for (const [name, value] of Object.entries(own)) {
			node.setAttribute(name, value)
		}
		document.body.appendChild(node)

		try {
			const disconnect = h.backend.connectDragSource('S99', node)
			const applied = {
				role: node.getAttribute('role'),
				tabindex: node.getAttribute('tabindex'),
				roleDescription: node.getAttribute('aria-roledescription'),
				roleAfterDisconnect: null as string | null,
			}
			disconnect()
			applied.roleAfterDisconnect = node.getAttribute('role')
			return applied
		} finally {
			node.remove()
			h.cleanup()
		}
	}

	it('uses role="group", not "button", when the source wraps controls', () => {
		// The whole-row drag source: the row is draggable and it also carries the
		// row's own buttons. `role="button"` there is invalid nesting — a button's
		// children are presentational, so the nested controls may not be reachable
		// at all.
		const applied = connectSource(
			'<span>Card A</span><button type="button">Delete</button>',
		)

		expect(applied.role).toBe('group')
		// Still focusable, and still announced as a draggable item — which is why
		// the role cannot simply be dropped: `aria-roledescription` needs one.
		expect(applied.tabindex).toBe('0')
		expect(applied.roleDescription).toBe('draggable item')
		expect(applied.roleAfterDisconnect).toBeNull()
	})

	it.each([
		['a link', '<a href="#x">Open</a>'],
		['a text input', '<input type="text" />'],
		['a select', '<select><option>a</option></select>'],
		['a textarea', '<textarea></textarea>'],
		['anything focusable', '<div tabindex="0">custom</div>'],
		['something nested deeper', '<div><p><button>Go</button></p></div>'],
	])('counts %s as an interactive descendant', (_label, html) => {
		expect(connectSource(html).role).toBe('group')
	})

	it('keeps role="button" for non-interactive content', () => {
		const applied = connectSource('<span>Card A</span><img alt="" src="#" />')
		expect(applied.role).toBe('button')
	})

	it('leaves an application-chosen role alone either way', () => {
		const applied = connectSource('<button type="button">Delete</button>', {
			role: 'listitem',
		})
		expect(applied.role).toBe('listitem')
		expect(applied.roleAfterDisconnect).toBe('listitem')
	})

	it('can be turned off entirely', () => {
		const h = harness(KeyboardBackend, {
			options: { applyAriaAttributes: false },
		})

		expect(h.sourceNode.hasAttribute('tabindex')).toBe(false)
		expect(h.sourceNode.hasAttribute('role')).toBe(false)
		expect(h.sourceNode.hasAttribute('aria-roledescription')).toBe(false)
		expect(h.sourceNode.hasAttribute('aria-describedby')).toBe(false)
		// The interaction still works; only the DOM is left alone.
		expect(h.press(' ')).toBe(true)
		expect(h.manager.getMonitor().isDragging()).toBe(true)

		h.cleanup()
	})

	describe('chosen per attribute', () => {
		/** What the backend wrote onto the source, by attribute option name. */
		function written(
			applyAriaAttributes: KeyboardBackendOptions['applyAriaAttributes'],
		) {
			const h = harness(KeyboardBackend, { options: { applyAriaAttributes } })
			const { sourceNode } = h
			try {
				return {
					tabIndex: sourceNode.hasAttribute('tabindex'),
					role: sourceNode.hasAttribute('role'),
					roleDescription: sourceNode.hasAttribute('aria-roledescription'),
					describedBy: sourceNode.hasAttribute('aria-describedby'),
				}
			} finally {
				h.cleanup()
			}
		}

		it.each(['tabIndex', 'role', 'roleDescription', 'describedBy'] as const)(
			'writes everything except %s',
			(name) => {
				// The case this exists for: a consumer wanting the backend's ARIA but
				// their own focus management is `{ tabIndex: false }`.
				expect(written({ [name]: false })).toEqual({
					tabIndex: true,
					role: true,
					roleDescription: true,
					describedBy: true,
					[name]: false,
				})
			},
		)

		it('leaves anything unstated on', () => {
			expect(written({})).toEqual(written(true))
		})

		it('can name the one attribute it wants', () => {
			// The inverse spelling: everything off, then one back on. Only possible
			// because each key is independent rather than a mode.
			expect(
				written({
					tabIndex: false,
					role: false,
					describedBy: false,
				}),
			).toEqual({
				tabIndex: false,
				role: false,
				roleDescription: true,
				describedBy: false,
			})
		})

		it('restores only what it wrote', () => {
			const h = harness(KeyboardBackend, {
				options: { applyAriaAttributes: { tabIndex: false } },
			})
			const { sourceNode } = h
			sourceNode.setAttribute('tabindex', '-1') // the application's own

			h.cleanup()

			expect(sourceNode.getAttribute('tabindex')).toBe('-1')
			expect(sourceNode.hasAttribute('role')).toBe(false)
		})
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
