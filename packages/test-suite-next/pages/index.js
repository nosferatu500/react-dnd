import { DndProvider } from '@nosferatu500/react-dnd'
import { componentIndex } from '@nosferatu500/react-dnd-examples'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import { memo, useCallback, useMemo, useState } from 'react'

const exampleNames = Object.keys(componentIndex)

const App = memo(() => (
	<DndProvider backend={HTML5Backend}>
		<AppGuts />
	</DndProvider>
))
App.displayName = 'App'

function AppGuts() {
	const [name, setName] = useState('chessboard')
	const Example = useMemo(() => componentIndex[name], [name])

	return (
		<div className="App">
			<select onChange={useCallback((evt) => setName(evt.target.value), [])}>
				{exampleNames.map((n) => (
					<option key={n} value={n}>
						{n}
					</option>
				))}
			</select>
			{typeof window !== 'undefined' ? <Example /> : null}
		</div>
	)
}

export default App
