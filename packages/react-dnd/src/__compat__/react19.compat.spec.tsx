/**
 * React 19 leg of the compat suite. Run via `npm run test:react19`.
 *
 * React 19 is the version installed at the repo root, so this leg needs no
 * aliasing. It exists so all three supported majors are asserted by the *same*
 * harness — the main Testing Library suite covers React 19 far more deeply, but
 * only this file makes the cross-version comparison apples-to-apples.
 */
import * as React from 'react'
import { act } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'

import { defineCompatSuite } from './harness.js'

const roots = new WeakMap<HTMLElement, Root>()

defineCompatSuite({
	major: 19,
	version: React.version,
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
