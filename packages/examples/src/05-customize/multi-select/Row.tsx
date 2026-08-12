import { useDrag } from '@nosferatu500/react-dnd'
import type { CSSProperties, FC } from 'react'

import { ItemTypes } from './ItemTypes.js'
import type { RowDragItem } from './interfaces.js'

const style: CSSProperties = {
	border: '1px solid #ccc',
	backgroundColor: 'white',
	padding: '0.5rem 1rem',
	marginBottom: '.25rem',
	cursor: 'move',
	userSelect: 'none',
}

export interface RowProps {
	id: number
	name: string
	selected: boolean
	/** Every currently selected id, so a drag can carry the whole selection. */
	selection: number[]
	onToggle: (id: number) => void
	/** Called when a drag starts on a row that was not selected. */
	onSelectOnly: (id: number) => void
}

export const Row: FC<RowProps> = ({
	id,
	name,
	selected,
	selection,
	onToggle,
	onSelectOnly,
}) => {
	const [{ isDragging }, drag] = useDrag(
		() => ({
			type: ItemTypes.ROW,

			// A function rather than an object, so the selection is read when the
			// drag actually starts rather than on every render.
			item: (): RowDragItem => {
				if (selected) {
					return { ids: selection }
				}
				// Grabbing an unselected row drags only that row, and makes the
				// selection match what is being dragged — the behaviour every file
				// manager has. `item()` runs exactly once, at drag start, which is
				// the only hook there is for this.
				onSelectOnly(id)
				return { ids: [id] }
			},

			// The whole point. By default only the row you grabbed reports
			// `isDragging`; this makes every row in the dragged set report it, so
			// they all dim together.
			isDragging: (monitor) =>
				monitor.getItem<RowDragItem>()?.ids.includes(id) ?? false,

			collect: (monitor) => ({ isDragging: monitor.isDragging() }),
		}),
		[id, selected, selection, onSelectOnly],
	)

	return (
		<li
			ref={drag}
			role="option"
			aria-selected={selected}
			tabIndex={0}
			data-testid={`row-${id}`}
			onClick={() => onToggle(id)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					onToggle(id)
				}
			}}
			style={{
				...style,
				opacity: isDragging ? 0.3 : 1,
				borderColor: selected ? '#4c9aff' : '#ccc',
				backgroundColor: selected ? '#eaf2ff' : 'white',
			}}
		>
			{name}
		</li>
	)
}
