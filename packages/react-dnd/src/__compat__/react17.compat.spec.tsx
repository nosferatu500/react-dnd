/**
 * React 17 leg of the compat suite. Run via `npm run test:react17`.
 *
 * React 17 has no `react-dom/client`, so this uses the legacy `ReactDOM.render`
 * root and the `react-dom/test-utils` copy of `act` (which React 19 removed).
 */
import * as React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import { defineCompatSuite } from './harness.js'

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
