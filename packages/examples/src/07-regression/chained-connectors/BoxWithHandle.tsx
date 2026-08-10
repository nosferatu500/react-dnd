import { useDrag, useDrop } from '@nosferatu500/react-dnd'
import type { CSSProperties, FC } from 'react'

import { ItemTypes } from './ItemTypes.js'

const style: CSSProperties = {
	border: '1px dashed gray',
	padding: '0.5rem 1rem',
	marginBottom: '.5rem',
	backgroundColor: 'white',
	width: '20rem',
}
const handleStyle: CSSProperties = {
	backgroundColor: 'green',
	width: '1rem',
	height: '1rem',
	display: 'inline-block',
	marginRight: '0.75rem',
	cursor: 'move',
}

/**
 * Two connectors on one element, and a third on a child.
 *
 * This used to read `return drop(preview(<div>{drag(<div />)}</div>))`, cloning
 * each element to inject a ref. Connectors no longer accept elements; both
 * connectors are called from one block-bodied ref callback instead.
 *
 * The block body matters: `ref={(node) => drop(preview(node))}` would return
 * whatever the connector handed back, and React 19 treats a function returned
 * from a callback ref as a cleanup.
 */
export const BoxWithHandle: FC = () => {
	const [, drop] = useDrop(() => ({
		accept: ItemTypes.BOX,
	}))
	const [{ isDragging }, drag, preview] = useDrag(() => ({
		type: ItemTypes.BOX,
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	}))
	const opacity = isDragging ? 0.4 : 1

	return (
		<div
			style={{ ...style, opacity }}
			ref={(node) => {
				drop(node)
				preview(node)
			}}
		>
			<div style={handleStyle} ref={drag} />
			Drag me by the handle, the whole box should drag
		</div>
	)
}
