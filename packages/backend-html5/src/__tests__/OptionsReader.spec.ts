import { OptionsReader } from '../OptionsReader.js'

describe('The HTML5Backend Options Reader', () => {
	describe('window injection', () => {
		it('uses an undefined window when no window is available', () => {
			const mockWindow = globalThis.window
			try {
				// The cast is needed because globalThis.window is not declared
				// optional; deleting it is the only way to simulate a non-DOM host.
				delete (globalThis as { window?: Window }).window
				expect(globalThis.window).toBeUndefined()
				const options = new OptionsReader(undefined)
				expect(options.window).toBeUndefined()
			} finally {
				globalThis.window = mockWindow
			}
		})
	})
})
