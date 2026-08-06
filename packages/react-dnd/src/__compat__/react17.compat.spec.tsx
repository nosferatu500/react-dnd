/**
 * React 17 leg of the compat suite. Run via `npm run test:react17`.
 *
 * React 17 has no `react-dom/client`, so this uses the legacy `ReactDOM.render`
 * root and the `react-dom/test-utils` copy of `act` (which React 19 removed).
 */
import * as React from 'react'
import reactDom from 'react-dom'
import { act } from 'react-dom/test-utils'

import { defineCompatSuite } from './harness.js'

/**
 * @types/react-dom@19 removed the legacy root API from its declarations, but the
 * functions are present at runtime in React 17 — which is exactly what this leg
 * is here to exercise.
 */
const ReactDOM = reactDom as unknown as {
	render: (element: React.ReactElement, container: HTMLElement) => void
	unmountComponentAtNode: (container: HTMLElement) => boolean
}

defineCompatSuite({
	major: 17,
	version: React.version,
	act,
	mount: (element, container) => {
		ReactDOM.render(element as React.ReactElement, container)
	},
	unmount: (container) => {
		ReactDOM.unmountComponentAtNode(container)
	},
})
