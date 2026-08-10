/**
 * The claim this package makes is that an existing app becomes keyboard
 * operable by changing the backend and nothing else. These components are
 * written exactly as the documentation writes them — no keyboard handlers, no
 * ARIA, no refs beyond the connectors — and are driven entirely by key presses.
 *
 * Runs under StrictMode like the rest of the suite, so the double mount that
 * connectors go through is covered too.
 */

import { DndProvider, useDrag, useDrop } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import { fireEvent, render, screen } from '@testing-library/react'
import type { FC } from 'react'

import { withKeyboard } from '../index.js'

const BOX = 'BOX'
const dropped: string[] = []

const Box: FC<{ name: string }> = ({ name }) => {
	const [{ isDragging }, drag] = useDrag(() => ({
		type: BOX,
		item: { name },
		end: (_item, monitor) => {
			const result = monitor.getDropResult<{ name: string }>()
			if (result) {
				dropped.push(`${name} → ${result.name}`)
			}
		},
		collect: (monitor) => ({ isDragging: monitor.isDragging() }),
	}))

	return (
		<div ref={drag} data-testid={`box-${name}`}>
			{name}
			{isDragging ? ' (dragging)' : ''}
		</div>
	)
}

const Bin: FC<{ name: string; accepts?: string }> = ({
	name,
	accepts = BOX,
}) => {
	const [{ isOver, canDrop }, drop] = useDrop(() => ({
		accept: accepts,
		drop: () => ({ name }),
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
		}),
	}))

	return (
		<div ref={drop} data-testid={`bin-${name}`}>
			{name}
			{canDrop ? ' [open]' : ''}
			{isOver ? ' [over]' : ''}
		</div>
	)
}

function renderApp(ui: React.ReactNode) {
	return render(
		<DndProvider backend={withKeyboard(HTML5Backend)}>{ui}</DndProvider>,
	)
}

function press(element: Element, key: string) {
	fireEvent.keyDown(element, { key })
}

beforeEach(() => {
	dropped.length = 0
})

describe('a stock react-dnd app, driven from the keyboard', () => {
	it('lifts, moves and drops without a single component change', () => {
		renderApp(
			<>
				<Box name="Glass" />
				<Bin name="Kitchen" />
				<Bin name="Garage" />
			</>,
		)
		const box = screen.getByTestId('box-Glass')

		press(box, ' ')
		expect(box).toHaveTextContent('Glass (dragging)')
		expect(screen.getByTestId('bin-Kitchen')).toHaveTextContent('[over]')

		press(box, 'ArrowDown')
		expect(screen.getByTestId('bin-Kitchen')).not.toHaveTextContent('[over]')
		expect(screen.getByTestId('bin-Garage')).toHaveTextContent('[over]')

		press(box, ' ')
		expect(dropped).toEqual(['Glass → Garage'])
		expect(box).not.toHaveTextContent('(dragging)')
	})

	it('leaves everything untouched when the drag is cancelled', () => {
		renderApp(
			<>
				<Box name="Glass" />
				<Bin name="Kitchen" />
			</>,
		)
		const box = screen.getByTestId('box-Glass')

		press(box, ' ')
		press(box, 'Escape')

		expect(dropped).toEqual([])
		expect(box).not.toHaveTextContent('(dragging)')
		expect(screen.getByTestId('bin-Kitchen')).not.toHaveTextContent('[over]')
	})

	it('only visits the bins that accept the item', () => {
		renderApp(
			<>
				<Box name="Glass" />
				<Bin name="Kitchen" />
				<Bin name="Freezer" accepts="FOOD" />
				<Bin name="Garage" />
			</>,
		)
		const box = screen.getByTestId('box-Glass')

		press(box, ' ')
		press(box, 'ArrowDown')

		expect(screen.getByTestId('bin-Garage')).toHaveTextContent('[over]')
		expect(screen.getByTestId('bin-Freezer')).not.toHaveTextContent('[over]')
	})

	it('announces the drag through a polite live region', () => {
		renderApp(
			<>
				<Box name="Glass" />
				<Bin name="Kitchen" />
			</>,
		)
		press(screen.getByTestId('box-Glass'), ' ')

		const status = screen.getByRole('status')
		expect(status).toHaveAttribute('aria-live', 'polite')
		expect(status).toHaveTextContent('Picked up Glass. Over Kitchen, 1 of 1.')
	})

	it('makes the box reachable by tab and describes it', () => {
		renderApp(
			<>
				<Box name="Glass" />
				<Bin name="Kitchen" />
			</>,
		)
		const box = screen.getByTestId('box-Glass')

		expect(box).toHaveAttribute('tabindex', '0')
		expect(box).toHaveAttribute('aria-roledescription', 'draggable item')
		expect(box).toHaveAccessibleDescription(/Press space or enter to pick up/)
	})

	it('still drags with the mouse — the HTML5 backend is untouched', () => {
		renderApp(
			<>
				<Box name="Glass" />
				<Bin name="Kitchen" />
			</>,
		)
		expect(screen.getByTestId('box-Glass')).toHaveAttribute('draggable', 'true')
	})
})
