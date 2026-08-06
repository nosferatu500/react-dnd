import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'

// `ReactDOM.render` was removed in React 19 (and warned loudly from 18).
// `createRoot` is the concurrent root API, available from React 18 onward.
const container = document.getElementById('root')
if (!container) {
	throw new Error('#root container is missing from index.html')
}

createRoot(container).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
