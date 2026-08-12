import { useDrop } from '@nosferatu500/react-dnd'
import type { CSSProperties, FC } from 'react'

import { ItemTypes } from './ItemTypes.js'
import type { RowDragItem } from './interfaces.js'

const style: CSSProperties = {
	border: '1px dashed gray',
	padding: '2rem',
	textAlign: 'center',
	minHeight: '6rem',
}

export interface BinProps {
	onDrop: (ids: number[]) => void
}

export const Bin: FC<BinProps> = ({ onDrop }) => {
	const [{ isOver, canDrop }, drop] = useDrop(
		() => ({
			accept: ItemTypes.ROW,
			// Nothing special on this side: the item is whatever the source built,
			// so a multi-item drag is just an item that happens to hold several ids.
			drop: (item: RowDragItem) => {
				onDrop(item.ids)
			},
			collect: (monitor) => ({
				isOver: monitor.isOver(),
				canDrop: monitor.canDrop(),
			}),
		}),
		[onDrop],
	)

	return (
		<div
			ref={drop}
			role="Bin"
			data-testid="bin"
			style={{
				...style,
				backgroundColor: isOver && canDrop ? '#eaf2ff' : 'transparent',
			}}
		>
			Drop rows here
		</div>
	)
}
