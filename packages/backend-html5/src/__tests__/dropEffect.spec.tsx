/**
 * What the drop will do, and who gets to say so.
 *
 * Driven through real `useDrag`/`useDrop` components rather than the backend
 * directly, because the precedence is only meaningful as an interaction between
 * a source's options, a target's options and a held modifier — and because the
 * target options have to survive the connector on their way to the backend.
 *
 * jsdom has no `DataTransfer`, so a fake one records what the backend writes to
 * `dropEffect`. That is the whole mechanism: the browser reads that property to
 * pick the cursor and to decide what its own default drop would do.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { FC, ReactNode } from 'react'
import { useState } from 'react'
import type { DropEffect } from 'react-dnd'
import { DndProvider, useDrag, useDrop } from 'react-dnd'

import { HTML5Backend } from '../index.js'
import * as NativeTypes from '../NativeTypes.js'
import type { CopyModifier } from '../types.js'

const CARD = 'CARD'

class FakeDataTransfer {
	public files: File[] = []
	public items: unknown[] = []
	public dropEffect = 'uninitialized'
	public effectAllowed = 'all'
	private store = new Map<string, string>()

	public constructor(public types: string[] = []) {}

	public setData(format: string, data: string) {
		this.store.set(format, String(data))
	}
	public getData(format: string) {
		return this.store.get(format) ?? ''
	}
	public setDragImage() {
		/* jsdom has no drag image */
	}
}

const Card: FC<{ dropEffect?: DropEffect }> = ({ dropEffect }) => {
	const [, drag] = useDrag(() => ({
		type: CARD,
		item: { id: 1 },
		...(dropEffect ? { options: { dropEffect } } : {}),
	}))
	return <div ref={drag} data-testid="card" />
}

const Bin: FC<{
	name: string
	dropEffect?: DropEffect
	accepts?: string
	canDrop?: boolean
	children?: ReactNode
}> = ({ name, dropEffect, accepts = CARD, canDrop = true, children }) => {
	const [, drop] = useDrop(() => ({
		accept: accepts,
		canDrop: () => canDrop,
		...(dropEffect ? { options: { dropEffect } } : {}),
	}))
	return (
		<div ref={drop} data-testid={name}>
			{children}
		</div>
	)
}

function renderApp(ui: ReactNode, copyModifier?: CopyModifier) {
	return render(
		<DndProvider
			backend={HTML5Backend}
			options={copyModifier === undefined ? {} : { copyModifier }}
		>
			{ui}
		</DndProvider>,
	)
}

/**
 * Dispatches a drag event with the given extras.
 *
 * Not `fireEvent`: jsdom implements no `DragEvent`, so Testing Library falls
 * back to `Event`, whose constructor silently drops `altKey` and friends — the
 * modifier tests below passed a held key that never arrived.
 */
function fire(
	node: EventTarget,
	type: string,
	init: Record<string, unknown> = {},
) {
	const event = new Event(type, { bubbles: true, cancelable: true })
	Object.assign(
		event,
		{
			clientX: 0,
			clientY: 0,
			altKey: false,
			ctrlKey: false,
			metaKey: false,
			shiftKey: false,
		},
		init,
	)
	act(() => {
		node.dispatchEvent(event)
	})
	return event
}

/**
 * Walks a drag from the card onto `target` and returns what the backend wrote
 * to `dropEffect` on the last `dragover`.
 */
function dragOver(
	target: HTMLElement,
	modifiers: Record<string, boolean> = {},
) {
	const card = screen.getByTestId('card')
	const dataTransfer = new FakeDataTransfer([])

	fire(card, 'dragstart', { dataTransfer })
	fire(target, 'dragenter', { dataTransfer, ...modifiers })
	fire(target, 'dragover', { dataTransfer, ...modifiers })

	return dataTransfer.dropEffect
}

describe('who decides the drop effect', () => {
	it('defaults to move', () => {
		renderApp(
			<>
				<Card />
				<Bin name="bin" />
			</>,
		)
		expect(dragOver(screen.getByTestId('bin'))).toBe('move')
	})

	it('lets the drop target say what dropping there does', () => {
		renderApp(
			<>
				<Card />
				<Bin name="archive" dropEffect="move" />
				<Bin name="duplicate" dropEffect="copy" />
			</>,
		)

		expect(dragOver(screen.getByTestId('archive'))).toBe('move')
		expect(dragOver(screen.getByTestId('duplicate'))).toBe('copy')
	})

	it('falls back to the drag source when the target has no opinion', () => {
		renderApp(
			<>
				<Card dropEffect="link" />
				<Bin name="bin" />
			</>,
		)
		expect(dragOver(screen.getByTestId('bin'))).toBe('link')
	})

	it('gives the target the last word over the source', () => {
		// The divergence from upstream #3531, which put the source first. A card
		// dragged onto "Archive" moves and onto "Duplicate to…" copies; the source
		// cannot know which, and the platform splits it the same way — the source
		// constrains with effectAllowed, the target states dropEffect.
		renderApp(
			<>
				<Card dropEffect="link" />
				<Bin name="bin" dropEffect="copy" />
			</>,
		)
		expect(dragOver(screen.getByTestId('bin'))).toBe('copy')
	})

	it('uses the innermost target that can accept the item', () => {
		renderApp(
			<>
				<Card />
				<Bin name="outer" dropEffect="link">
					<Bin name="inner" dropEffect="copy" />
				</Bin>
			</>,
		)
		expect(dragOver(screen.getByTestId('inner'))).toBe('copy')
	})

	it('skips a nested target that refuses the item', () => {
		renderApp(
			<>
				<Card />
				<Bin name="outer" dropEffect="link">
					<Bin name="inner" dropEffect="copy" canDrop={false} />
				</Bin>
			</>,
		)
		expect(dragOver(screen.getByTestId('inner'))).toBe('link')
	})

	it('does not let an outer effect describe a drop on an inner target', () => {
		// The inner target accepts and says nothing, so it is a plain move — the
		// outer target's 'copy' would be describing a drop that is not happening
		// there.
		renderApp(
			<>
				<Card />
				<Bin name="outer" dropEffect="copy">
					<Bin name="inner" />
				</Bin>
			</>,
		)
		expect(dragOver(screen.getByTestId('inner'))).toBe('move')
	})

	it('still forces copy for native payloads', () => {
		// Files and URLs are not the page's to move.
		renderApp(<Bin name="bin" accepts={NativeTypes.FILE} />)
		const bin = screen.getByTestId('bin')
		const dataTransfer = new FakeDataTransfer(['Files'])

		fire(bin, 'dragenter', { dataTransfer })
		fire(bin, 'dragover', { dataTransfer })

		expect(dataTransfer.dropEffect).toBe('copy')

		// End the native drag. A native source is registered by the backend
		// itself, so leaving one dangling keeps dnd-core's handler count above
		// zero, `teardown()` never runs, and the next provider in this file dies
		// with "Cannot have two HTML5 backends at the same time".
		fire(bin, 'drop', { dataTransfer })
	})
})

describe('the copy modifier', () => {
	it('is alt by default', () => {
		renderApp(
			<>
				<Card />
				<Bin name="bin" />
			</>,
		)
		expect(dragOver(screen.getByTestId('bin'), { altKey: true })).toBe('copy')
	})

	it('can be another key', () => {
		renderApp(
			<>
				<Card />
				<Bin name="bin" />
			</>,
			'ctrl',
		)
		const bin = screen.getByTestId('bin')
		expect(dragOver(bin, { ctrlKey: true })).toBe('copy')
		expect(dragOver(bin, { altKey: true })).toBe('move')
	})

	it('can be a predicate', () => {
		renderApp(
			<>
				<Card />
				<Bin name="bin" />
			</>,
			(event) => event.shiftKey && event.metaKey,
		)
		const bin = screen.getByTestId('bin')
		expect(dragOver(bin, { shiftKey: true })).toBe('move')
		expect(dragOver(bin, { shiftKey: true, metaKey: true })).toBe('copy')
	})

	it('can be turned off', () => {
		renderApp(
			<>
				<Card />
				<Bin name="bin" />
			</>,
			false,
		)
		expect(dragOver(screen.getByTestId('bin'), { altKey: true })).toBe('move')
	})

	it('does not override an explicit effect', () => {
		// An app that has said what dropping here means should not have it
		// silently changed by a held key.
		renderApp(
			<>
				<Card />
				<Bin name="bin" dropEffect="link" />
			</>,
		)
		expect(dragOver(screen.getByTestId('bin'), { altKey: true })).toBe('link')
	})
})

describe('a target whose element remounts', () => {
	it('still reports its own effect afterwards', () => {
		// The regression that made this feature look broken in practice: the
		// connector's ref callback used to reset the target's options, and the
		// layout effect that applies them is keyed on the options object, so it
		// did not re-run to put them back. Toggling a target off and on silently
		// dropped its `dropEffect`.
		const Toggling: FC = () => {
			const [shown, setShown] = useState(true)
			return (
				<>
					<Card />
					<button type="button" onClick={() => setShown((s) => !s)}>
						toggle
					</button>
					{shown && <Bin name="bin" dropEffect="copy" />}
				</>
			)
		}

		renderApp(<Toggling />)
		expect(dragOver(screen.getByTestId('bin'))).toBe('copy')

		const button = screen.getByRole('button')
		fireEvent.click(button)
		fireEvent.click(button)

		expect(dragOver(screen.getByTestId('bin'))).toBe('copy')
	})
})

describe('the resolved effect reaches the drop result', () => {
	it('reports what the target chose', () => {
		// An array, not `let x: T | null = null`: TypeScript narrows that to `never`
		// because it cannot see the callback assign to it.
		const dropResults: Array<{ dropEffect?: string } | null> = []

		const Source: FC = () => {
			const [, drag] = useDrag(() => ({
				type: CARD,
				item: { id: 1 },
				end: (_item, monitor) => {
					dropResults.push(monitor.getDropResult())
				},
			}))
			return <div ref={drag} data-testid="card" />
		}

		renderApp(
			<>
				<Source />
				<Bin name="bin" dropEffect="copy" />
			</>,
		)

		const card = screen.getByTestId('card')
		const bin = screen.getByTestId('bin')
		const dataTransfer = new FakeDataTransfer([])

		fire(card, 'dragstart', { dataTransfer })
		fire(bin, 'dragenter', { dataTransfer })
		fire(bin, 'dragover', { dataTransfer })
		fire(bin, 'drop', { dataTransfer })

		expect(dropResults.at(-1)?.dropEffect).toBe('copy')
	})
})
