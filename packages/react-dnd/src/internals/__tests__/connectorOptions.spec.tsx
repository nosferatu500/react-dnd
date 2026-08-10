/**
 * Connector options must survive their element remounting.
 *
 * `useDrag`/`useDrop` apply spec options from a layout effect keyed on the
 * options object, while the connector's ref callback runs during commit. On
 * mount the effect runs after the ref, so the ref resetting options to `null`
 * went unnoticed. Toggle the element off and on without changing the options and
 * only the ref runs — the handler reconnected with no options at all, silently
 * dropping `dropEffect` and `previewOptions`.
 *
 * Asserted through a backend that records what it is handed, because that is the
 * whole contract: whatever the spec said must be the third argument to
 * `connectDropTarget`/`connectDragSource` every time.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import type { Backend, BackendFactory } from 'dnd-core'
import type { FC } from 'react'
import { useState } from 'react'

import { DndProvider } from '../../core/index.js'
import { useDrag } from '../../hooks/useDrag/index.js'
import { useDrop } from '../../hooks/useDrop/index.js'

const CARD = 'CARD'

interface Recorder {
	dropTarget: unknown[]
	dragSource: unknown[]
	dragPreview: unknown[]
}

function recordingBackend(recorder: Recorder): BackendFactory {
	return (): Backend => ({
		setup: () => undefined,
		teardown: () => undefined,
		connectDragSource: (_id, _node, options) => {
			recorder.dragSource.push(options)
			return () => undefined
		},
		connectDragPreview: (_id, _node, options) => {
			recorder.dragPreview.push(options)
			return () => undefined
		},
		connectDropTarget: (_id, _node, options) => {
			recorder.dropTarget.push(options)
			return () => undefined
		},
		profile: () => ({}),
	})
}

function renderWith(recorder: Recorder, ui: React.ReactNode) {
	return render(
		<DndProvider backend={recordingBackend(recorder)}>{ui}</DndProvider>,
	)
}

function newRecorder(): Recorder {
	return { dropTarget: [], dragSource: [], dragPreview: [] }
}

/** Options set once and never changed, so the layout effect never re-runs. */
const DROP_OPTIONS = { dropEffect: 'copy' } as const
const DRAG_OPTIONS = { dropEffect: 'link' } as const
const PREVIEW_OPTIONS = { captureDraggingState: true } as const

const Toggler: FC<{ children: (shown: boolean) => React.ReactNode }> = ({
	children,
}) => {
	const [shown, setShown] = useState(true)
	return (
		<>
			<button type="button" onClick={() => setShown((s) => !s)}>
				toggle
			</button>
			{children(shown)}
		</>
	)
}

function remount() {
	const button = screen.getByRole('button')
	fireEvent.click(button)
	fireEvent.click(button)
}

describe('connector options survive a remount', () => {
	it('keeps a drop target’s options', () => {
		const recorder = newRecorder()
		const Bin: FC = () => {
			const [, drop] = useDrop(() => ({ accept: CARD, options: DROP_OPTIONS }))
			return <div ref={drop} data-testid="bin" />
		}

		renderWith(recorder, <Toggler>{(shown) => shown && <Bin />}</Toggler>)
		expect(recorder.dropTarget.at(-1)).toEqual(DROP_OPTIONS)

		recorder.dropTarget.length = 0
		remount()

		// Every connect after the remount, not merely the last: a connect with no
		// options is a window in which the backend has the wrong answer.
		expect(recorder.dropTarget.length).toBeGreaterThan(0)
		for (const options of recorder.dropTarget) {
			expect(options).toEqual(DROP_OPTIONS)
		}
	})

	it('keeps a drag source’s options', () => {
		const recorder = newRecorder()
		const Card: FC = () => {
			const [, drag] = useDrag(() => ({
				type: CARD,
				item: {},
				options: DRAG_OPTIONS,
			}))
			return <div ref={drag} data-testid="card" />
		}

		renderWith(recorder, <Toggler>{(shown) => shown && <Card />}</Toggler>)
		expect(recorder.dragSource.at(-1)).toEqual(DRAG_OPTIONS)

		recorder.dragSource.length = 0
		remount()

		expect(recorder.dragSource.length).toBeGreaterThan(0)
		for (const options of recorder.dragSource) {
			expect(options).toEqual(DRAG_OPTIONS)
		}
	})

	it('keeps preview options', () => {
		const recorder = newRecorder()
		const Card: FC = () => {
			const [, drag, preview] = useDrag(() => ({
				type: CARD,
				item: {},
				previewOptions: PREVIEW_OPTIONS,
			}))
			return (
				<div ref={drag}>
					<div ref={preview} data-testid="preview" />
				</div>
			)
		}

		renderWith(recorder, <Toggler>{(shown) => shown && <Card />}</Toggler>)
		expect(recorder.dragPreview.at(-1)).toEqual(PREVIEW_OPTIONS)

		recorder.dragPreview.length = 0
		remount()

		expect(recorder.dragPreview.length).toBeGreaterThan(0)
		for (const options of recorder.dragPreview) {
			expect(options).toEqual(PREVIEW_OPTIONS)
		}
	})
})

describe('options passed to a connector directly', () => {
	it('are honoured, and win over the spec', () => {
		// The reason the options argument exists at all:
		// `preview(getEmptyImage(), { captureDraggingState: true })`.
		const recorder = newRecorder()
		const Card: FC = () => {
			const [, drag, preview] = useDrag(() => ({ type: CARD, item: {} }))
			return (
				<div ref={drag}>
					<div
						ref={(node) => {
							preview(node, { anchorX: 1 })
						}}
					/>
				</div>
			)
		}

		renderWith(recorder, <Card />)

		expect(recorder.dragPreview).toContainEqual({ anchorX: 1 })
	})

	it('can still be cleared explicitly with null', () => {
		const recorder = newRecorder()
		const Bin: FC = () => {
			const [, drop] = useDrop(() => ({ accept: CARD, options: DROP_OPTIONS }))
			return (
				<div
					ref={(node) => {
						drop(node, null)
					}}
				/>
			)
		}

		renderWith(recorder, <Bin />)

		expect(recorder.dropTarget).toContainEqual(null)
	})
})
