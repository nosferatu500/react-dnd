import type { Backend } from 'dnd-core'
import { TargetConnector } from '../TargetConnector.js'

describe('TargetConnector', () => {
	it('unsubscribes drop target when clearing handler id', () => {
		const connectDropTarget = vi.fn()
		const backend: Backend = {
			setup: vi.fn(),
			teardown: vi.fn(),
			connectDragSource: vi.fn(),
			connectDragPreview: vi.fn(),
			connectDropTarget,
			profile: vi.fn(),
		}
		const connector = new TargetConnector(backend)
		const unsubscribeDropTarget = vi.fn()
		connectDropTarget.mockReturnValueOnce(unsubscribeDropTarget)

		connector.receiveHandlerId('test')
		connector.hooks.dropTarget()({})
		expect(backend.connectDropTarget).toHaveBeenCalled()
		expect(unsubscribeDropTarget).not.toHaveBeenCalled()
		connectDropTarget.mockClear()

		connector.receiveHandlerId(null)
		expect(backend.connectDropTarget).not.toHaveBeenCalled()
		expect(unsubscribeDropTarget).toHaveBeenCalled()
	})

	/**
	 * The comparator behind these used to be `@react-dnd/shallowequal`, a
	 * published package whose only consumers were these three call sites. It is
	 * now `fast-deep-equal`, already a dependency for collected props. Nothing
	 * covered the reconnect-on-options-change path either way, so a swap here
	 * would have been invisible.
	 */
	describe('reconnecting when the options change', () => {
		function setup() {
			const connectDropTarget = vi.fn().mockReturnValue(vi.fn())
			const backend: Backend = {
				setup: vi.fn(),
				teardown: vi.fn(),
				connectDragSource: vi.fn(),
				connectDragPreview: vi.fn(),
				connectDropTarget,
				profile: vi.fn(),
			}
			const connector = new TargetConnector(backend)
			connector.receiveHandlerId('test')
			return { connector, connectDropTarget }
		}

		it('reconnects when an option value changes', () => {
			const { connector, connectDropTarget } = setup()
			// Options go through the hook, not the setter: the hook resets them, so
			// setting them first would be overwritten.
			connector.hooks.dropTarget()({}, { dropEffect: 'move' })
			connectDropTarget.mockClear()

			connector.dropTargetOptions = { dropEffect: 'copy' }
			connector.reconnect()

			expect(connectDropTarget).toHaveBeenCalledWith(
				'test',
				expect.anything(),
				{ dropEffect: 'copy' },
			)
		})

		it('does not reconnect for a fresh object with the same values', () => {
			// The whole reason a comparator is here: a spec factory builds a new
			// options object on every render, and reconnecting on each one would
			// tear the handler down and rebuild it continuously.
			const { connector, connectDropTarget } = setup()
			connector.hooks.dropTarget()({}, { dropEffect: 'move' })
			connectDropTarget.mockClear()

			connector.dropTargetOptions = { dropEffect: 'move' }
			connector.reconnect()

			expect(connectDropTarget).not.toHaveBeenCalled()
		})

		it('compares nested option values by value, not by identity', () => {
			// Where deep equality is strictly better than the shallow comparator it
			// replaced: this would have counted as a change and reconnected.
			const { connector, connectDropTarget } = setup()
			connector.hooks.dropTarget()({}, { nested: { a: 1 } })
			connectDropTarget.mockClear()

			connector.dropTargetOptions = { nested: { a: 1 } } as never
			connector.reconnect()

			expect(connectDropTarget).not.toHaveBeenCalled()
		})
	})
})
