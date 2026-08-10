import { render } from '@testing-library/react'
import { fireDragDrop, wrapWithBackend } from 'react-dnd-test-utils'

import Example from '..'

/**
 * The example this covers used to be written with the element-cloning connector
 * form — `drop(preview(<div>{drag(<div />)}</div>))`. Rewriting it to refs is
 * only correct if all three connectors still land on the right nodes, which is
 * exactly what this regression example exists to demonstrate.
 */
describe('Regression: two connectors on one element', () => {
	it('renders with drop and preview sharing a node, and drag on the handle', async () => {
		const TestExample = wrapWithBackend(Example)
		const rendered = render(<TestExample />)

		const box = await rendered.findByText(/Drag me by the handle/)
		const handle = box.firstElementChild as HTMLElement
		expect(handle).toBeInstanceOf(HTMLElement)

		// The box is both the drop target and the preview; the handle is the
		// source. Dragging the handle onto the box must not throw.
		await fireDragDrop(handle, box)
	})
})
