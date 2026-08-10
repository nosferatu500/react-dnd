import {
	fireDragDrop,
	wrapWithBackend,
} from '@nosferatu500/react-dnd-test-utils'
import { cleanup, render } from '@testing-library/react'

import Example from '../index.js'

describe('Integration: Dustbin Single Target', () => {
	afterEach(cleanup)

	it('can simulate a full drag and drop interaction', async () => {
		const TestExample = wrapWithBackend(Example)
		const rendered = render(<TestExample />)
		window.alert = vi.fn()
		const box = (await rendered.findAllByTestId('box'))[0]
		const dustbin = (await rendered.findAllByTestId('dustbin'))[0]
		expect(box).toBeDefined()
		expect(dustbin).toBeDefined()

		await fireDragDrop(box!, dustbin!)
		expect(window.alert).toHaveBeenCalledWith('You dropped Glass into Dustbin!')
	})
})
