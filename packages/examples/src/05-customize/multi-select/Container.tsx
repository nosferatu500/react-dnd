import type { FC } from 'react'
import { useCallback, useState } from 'react'

import { Bin } from './Bin.js'
import type { Row as RowData } from './interfaces.js'
import { MultiDragLayer } from './MultiDragLayer.js'
import { Row } from './Row.js'

const ROWS: RowData[] = [
	{ id: 1, name: 'Write the proposal' },
	{ id: 2, name: 'Review the designs' },
	{ id: 3, name: 'Fix the flaky test' },
	{ id: 4, name: 'Update the changelog' },
	{ id: 5, name: 'Ship it' },
]

/**
 * Dragging several items at once.
 *
 * There is no multi-drag API to learn: a drag carries whatever object the
 * source's `item` returns, so carrying *several* ids is just a different
 * object. The two things worth knowing are both visible here — a custom
 * `isDragging` is what makes every selected row dim rather than only the one
 * you grabbed, and a drag layer is the only way to preview more than one item,
 * because the browser's drag image is a picture of a single element.
 *
 * The selection lives in the application, where it already lives in any app
 * that has one. Click a row to select it; click again to deselect.
 */
export const Container: FC = () => {
	const [selection, setSelection] = useState<number[]>([])
	const [dropped, setDropped] = useState<number[] | null>(null)

	const toggle = useCallback((id: number) => {
		setSelection((current) =>
			current.includes(id)
				? current.filter((value) => value !== id)
				: [...current, id],
		)
	}, [])

	const selectOnly = useCallback((id: number) => {
		setSelection([id])
	}, [])

	const handleDrop = useCallback((ids: number[]) => {
		setDropped(ids)
		setSelection([])
	}, [])

	return (
		<div>
			<p>
				Click rows to select them, then drag any selected row — the whole
				selection comes with it. Dragging an unselected row drags just that one.
			</p>

			<div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
				{/* A multi-select list is a listbox of options, which is also what
				    gives `aria-selected` somewhere valid to live. */}
				<ul
					role="listbox"
					aria-multiselectable="true"
					aria-label="Tasks"
					style={{ flex: 1, listStyle: 'none', padding: 0, margin: 0 }}
				>
					{ROWS.map((row) => (
						<Row
							key={row.id}
							id={row.id}
							name={row.name}
							selected={selection.includes(row.id)}
							selection={selection}
							onToggle={toggle}
							onSelectOnly={selectOnly}
						/>
					))}
				</ul>

				<div style={{ flex: 1 }}>
					<Bin onDrop={handleDrop} />
					<p data-testid="result">
						{dropped === null
							? 'Nothing dropped yet.'
							: `Dropped ${dropped.length} row(s): ${dropped.join(', ')}`}
					</p>
				</div>
			</div>

			<MultiDragLayer />
		</div>
	)
}
