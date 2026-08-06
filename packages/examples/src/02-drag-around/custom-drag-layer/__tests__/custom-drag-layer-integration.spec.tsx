import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { wrapWithBackend } from 'react-dnd-test-utils'

import Example from '../index.js'

describe('Drag Around: Custom Drag Layer', () => {
	afterEach(() => {
		cleanup()
		vi.useRealTimers()
	})

	it('toggles the overlay layer over time', async () => {
		// `shouldAdvanceTime` keeps the real clock ticking underneath the fake one.
		// Without it, Testing Library's `findBy*`/`waitFor` polling never fires and
		// the test deadlocks instead of failing.
		vi.useFakeTimers({ shouldAdvanceTime: true })

		const TestExample = wrapWithBackend(Example)
		const rendered = render(<TestExample />)
		const draggableBoxes = await rendered.findAllByRole('DraggableBox')
		expect(draggableBoxes).toHaveLength(2)
		const first = draggableBoxes[0]!
		const second = draggableBoxes[1]!

		// Dragging a box hides it
		await act(async () => {
			fireEvent.dragStart(first)
			await vi.advanceTimersByTimeAsync(10)
		})

		expect(first).toHaveStyle({ opacity: 0 })
		expect(second).toHaveStyle({ opacity: 1 })

		const preview = await rendered.findByRole('BoxPreview')
		expect(preview).toHaveStyle('background-color: rgb(255, 255, 255)')

		// The preview cycles its color on a 500ms interval.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(501)
		})
		expect(preview).toHaveStyle('background-color: rgb(255, 255, 0)')

		await act(async () => {
			await vi.advanceTimersByTimeAsync(501)
		})
		expect(preview).toHaveStyle('background-color: rgb(255, 255, 255)')
	})
})
