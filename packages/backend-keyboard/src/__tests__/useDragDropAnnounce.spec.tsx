import { fireEvent, render, screen } from '@testing-library/react'
import type { BackendFactory } from 'dnd-core'
import type { FC, ReactNode } from 'react'
import { DndProvider, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import { KeyboardBackend, useDragDropAnnounce, withKeyboard } from '../index.js'

/**
 * Every case renders a real drop target. The live region is created when the
 * backend is set up, which dnd-core does when the first handler registers — a
 * provider with no drag and drop in it has no region, and nothing to say.
 */
const Bin: FC = () => {
	const [, drop] = useDrop(() => ({ accept: 'card' }))
	return <div ref={drop} data-testid="bin" />
}

const Announcer: FC<{ message: string }> = ({ message }) => {
	const announce = useDragDropAnnounce()
	return (
		<button type="button" onClick={() => announce(message)}>
			say it
		</button>
	)
}

function renderWith(backend: BackendFactory, children: ReactNode) {
	return render(
		<DndProvider backend={backend}>
			<Bin />
			{children}
		</DndProvider>,
	)
}

function status() {
	return screen.queryByRole('status')
}

describe('useDragDropAnnounce', () => {
	it('speaks through the live region the backend already owns', () => {
		renderWith(
			withKeyboard(HTML5Backend),
			<Announcer message="Knight moved to c3, 3 of 8." />,
		)

		fireEvent.click(screen.getByRole('button'))

		expect(status()).toHaveTextContent('Knight moved to c3, 3 of 8.')
		// One region, not a competing second one.
		expect(screen.getAllByRole('status')).toHaveLength(1)
	})

	it('works with the keyboard backend on its own', () => {
		renderWith(KeyboardBackend, <Announcer message="standalone" />)

		fireEvent.click(screen.getByRole('button'))

		expect(status()).toHaveTextContent('standalone')
	})

	it('is a no-op when no backend can announce', () => {
		// An app on the plain HTML5 backend should not have to feature-detect.
		renderWith(HTML5Backend, <Announcer message="nobody is listening" />)

		expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
		expect(status()).toBeNull()
	})

	it('is a no-op when announcements are turned off', () => {
		renderWith(
			withKeyboard(HTML5Backend, { announce: false }),
			<Announcer message="silenced" />,
		)

		expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
		expect(status()).toBeNull()
	})

	it('shares the one region with the backend, so the last word wins', () => {
		// The point of routing through the backend rather than mounting a second
		// live region: two regions would be read in an order nobody controls.
		const DroppableBin: FC = () => {
			const announce = useDragDropAnnounce()
			const [, drop] = useDrop(() => ({
				accept: 'card',
				drop: () => {
					announce('Card filed under Done, 4 items.')
					return undefined
				},
			}))
			return <div ref={drop} data-testid="droppable" />
		}

		render(
			<DndProvider backend={withKeyboard(HTML5Backend)}>
				<DroppableBin />
				<Announcer message="from the app" />
			</DndProvider>,
		)

		fireEvent.click(screen.getByRole('button'))

		expect(screen.getAllByRole('status')).toHaveLength(1)
		expect(status()).toHaveTextContent('from the app')
	})

	it('leaves no live region behind when the tree unmounts', () => {
		const view = renderWith(
			withKeyboard(HTML5Backend),
			<Announcer message="x" />,
		)
		expect(status()).not.toBeNull()

		view.unmount()

		expect(status()).toBeNull()
	})
})
