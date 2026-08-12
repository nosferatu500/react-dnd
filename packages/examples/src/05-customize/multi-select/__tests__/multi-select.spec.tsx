/**
 * The two things the multi-select example exists to demonstrate:
 * a custom `isDragging` making every selected row report the drag, and an item
 * that carries several ids reaching the drop target intact.
 *
 * Pinned because the example is the documentation for this pattern — there is
 * no multi-drag API, so if the example rots the pattern goes with it.
 */

import { wrapWithBackend } from '@nosferatu500/react-dnd-test-utils'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import Example from '../index.js'

const opacityOf = (id: number) => screen.getByTestId(`row-${id}`).style.opacity

/**
 * Starts a drag and lets the source become public.
 *
 * A drag source only reports `isDragging` once dnd-core has published it, and
 * the HTML5 backend defers that by a tick so that the browser has taken its
 * drag image from the un-dimmed element first. Without the flush the row is
 * genuinely not dragging yet.
 */
async function startDrag(id: number) {
	await act(async () => {
		fireEvent.dragStart(screen.getByTestId(`row-${id}`))
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

function renderExample() {
	const TestExample = wrapWithBackend(Example)
	return render(<TestExample />)
}

afterEach(cleanup)

describe('Customize: multi-select drag', () => {
	it('dims every selected row, not just the one grabbed', async () => {
		renderExample()

		fireEvent.click(screen.getByTestId('row-1'))
		fireEvent.click(screen.getByTestId('row-3'))

		// Nothing is dragging yet.
		expect(opacityOf(1)).toBe('1')
		expect(opacityOf(3)).toBe('1')

		await startDrag(1)

		// Both selected rows report the drag; the unselected one does not. This is
		// what the custom `isDragging` buys — by default only row 1 would dim.
		expect(opacityOf(1)).toBe('0.3')
		expect(opacityOf(3)).toBe('0.3')
		expect(opacityOf(2)).toBe('1')

		fireEvent.dragEnd(screen.getByTestId('row-1'))
	})

	it('delivers every selected id to the drop target', () => {
		renderExample()

		fireEvent.click(screen.getByTestId('row-2'))
		fireEvent.click(screen.getByTestId('row-4'))
		fireEvent.click(screen.getByTestId('row-5'))

		fireEvent.dragStart(screen.getByTestId('row-4'))
		fireEvent.dragEnter(screen.getByTestId('bin'))
		fireEvent.dragOver(screen.getByTestId('bin'))
		fireEvent.drop(screen.getByTestId('bin'))

		expect(screen.getByTestId('result').textContent).toBe(
			'Dropped 3 row(s): 2, 4, 5',
		)
	})

	it('drags only the grabbed row when it was not selected', async () => {
		// Finder behaviour: grabbing outside the selection drags just that row and
		// makes the selection match what is actually moving.
		renderExample()

		fireEvent.click(screen.getByTestId('row-1'))
		fireEvent.click(screen.getByTestId('row-2'))

		await startDrag(5)

		expect(opacityOf(5)).toBe('0.3')
		expect(opacityOf(1)).toBe('1')
		expect(opacityOf(2)).toBe('1')

		fireEvent.dragEnter(screen.getByTestId('bin'))
		fireEvent.dragOver(screen.getByTestId('bin'))
		fireEvent.drop(screen.getByTestId('bin'))

		expect(screen.getByTestId('result').textContent).toBe('Dropped 1 row(s): 5')
	})

	it('previews the count in a drag layer', () => {
		// The browser's drag image can only picture one element, so the count has
		// to come from a layer.
		renderExample()

		fireEvent.click(screen.getByTestId('row-1'))
		fireEvent.click(screen.getByTestId('row-2'))

		expect(screen.queryByTestId('drag-layer')).toBeNull()

		fireEvent.dragStart(screen.getByTestId('row-1'))
		fireEvent.dragOver(screen.getByTestId('bin'), {
			clientX: 40,
			clientY: 60,
		})

		expect(screen.getByTestId('drag-layer').textContent).toBe('2 items')

		fireEvent.dragEnd(screen.getByTestId('row-1'))
	})
})
