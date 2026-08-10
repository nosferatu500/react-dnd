import './App.css'

import { DndProvider } from '@nosferatu500/react-dnd'
import { componentIndex } from '@nosferatu500/react-dnd-examples'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import {
	gridNavigation,
	withKeyboard,
} from '@nosferatu500/react-dnd-keyboard-backend'
import { memo, useCallback, useMemo, useState } from 'react'

const exampleNames = Object.keys(componentIndex)

/**
 * Every example in the gallery is keyboard operable, and not one of them was
 * written with the keyboard in mind — swapping the backend here is the whole
 * integration. That is the claim `react-dnd-keyboard-backend` makes, and this
 * app is where it is checked by hand against a real browser and a real screen
 * reader.
 *
 * `gridNavigation` rather than the default document order because the gallery
 * leads with the chessboard: on a grid, down should cross a row. Eight columns,
 * and squares that will not accept the piece are skipped, so the arrow keys walk
 * the board's legal moves rather than its cells.
 */
const backend = withKeyboard(HTML5Backend, {
	getNextTarget: gridNavigation({ columns: 8 }),
})

const App = memo(() => (
	<DndProvider backend={backend}>
		<AppGuts />
	</DndProvider>
))
App.displayName = 'App'

function AppGuts() {
	const [name, setName] = useState('chessboard')
	const Example = useMemo(() => componentIndex[name], [name])

	return (
		<div className="App">
			<select
				onChange={useCallback(
					(evt: React.ChangeEvent<HTMLSelectElement>) =>
						setName(evt.target.value),
					[],
				)}
			>
				{exampleNames.map((n) => (
					<option key={n} value={n}>
						{n}
					</option>
				))}
			</select>
			<p className="hint">
				Tab to an item, then press space to pick it up, the arrow keys to move
				it, space to drop, escape to cancel.
			</p>
			<Example />
		</div>
	)
}

export default App
