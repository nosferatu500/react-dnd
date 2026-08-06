/**
 * React 18 leg of the compat suite. Run via `npm run test:react18`.
 *
 * Uses the concurrent `createRoot` API and the `act` export that React added to
 * the `react` entrypoint in 18.3 — the only spelling that also works on 19.
 */
import * as React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'

import { defineCompatSuite } from './harness.js'

const roots = new WeakMap<HTMLElement, Root>()

defineCompatSuite({
	major: 18,
	version: React.version,
	// React's `act` is typed as returning a Thenable; the harness only ever
	// passes synchronous callbacks, so the result is safe to drop.
	act: (cb) => {
		act(cb)
	},
	mount: (element, container) => {
		let root = roots.get(container)
		if (!root) {
			root = createRoot(container)
			roots.set(container, root)
		}
		root.render(element)
	},
	unmount: (container) => {
		roots.get(container)?.unmount()
		roots.delete(container)
	},
})
