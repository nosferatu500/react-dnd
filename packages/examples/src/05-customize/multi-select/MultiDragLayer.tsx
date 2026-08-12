import { useDragLayer } from '@nosferatu500/react-dnd'
import type { CSSProperties, FC } from 'react'

import { ItemTypes } from './ItemTypes.js'
import type { RowDragItem } from './interfaces.js'

const layerStyle: CSSProperties = {
	position: 'fixed',
	pointerEvents: 'none',
	zIndex: 100,
	left: 0,
	top: 0,
	width: '100%',
	height: '100%',
}

const badgeStyle: CSSProperties = {
	display: 'inline-block',
	backgroundColor: '#4c9aff',
	color: 'white',
	borderRadius: '1rem',
	padding: '0.25rem 0.75rem',
	fontSize: '0.85rem',
	boxShadow: '0 1px 4px rgba(0,0,0,.3)',
}

/**
 * A preview for a drag carrying more than one row.
 *
 * The browser's own drag image is a picture of the *one* element the drag
 * started on — `setDragImage` takes a single node — so "3 items" cannot be
 * expressed that way. A drag layer is the only place a multi-item preview can
 * be drawn, which is why the library does not try to provide one: what it
 * should look like is a design decision.
 */
export const MultiDragLayer: FC = () => {
	const { item, itemType, isDragging, offset } = useDragLayer((monitor) => ({
		item: monitor.getItem<RowDragItem>(),
		itemType: monitor.getItemType(),
		isDragging: monitor.isDragging(),
		offset: monitor.getClientOffset(),
	}))

	if (!isDragging || itemType !== ItemTypes.ROW || !offset || !item) {
		return null
	}

	const count = item.ids.length

	return (
		<div style={layerStyle} data-testid="drag-layer">
			<div
				style={{
					transform: `translate(${offset.x + 12}px, ${offset.y + 12}px)`,
				}}
			>
				<span style={badgeStyle}>
					{count} {count === 1 ? 'item' : 'items'}
				</span>
			</div>
		</div>
	)
}
