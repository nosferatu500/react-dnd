/**
 * react-dnd driven against React's own root API, with no Testing Library.
 *
 * The main suite renders through `@testing-library/react`, which wraps
 * `createRoot`, owns `act` and cleans up between tests. That is the right tool
 * for almost everything, but it means the library is never exercised against
 * the API a consumer actually calls. This file mounts with `createRoot`
 * directly, so a regression that RTL happens to paper over still fails.
 *
 * It used to be a cross-version harness with a React 18 leg pinned in its own
 * workspace, and an adapter so both majors ran identical assertions. React 18
 * is no longer supported, so the adapter and the second install are gone; what
 * remains is the RTL-free coverage, which was always worth having on its own.
 *
 * Run by `npm run test:react-root`, not by `npm test` — it needs a config
 * without the Testing Library setup file.
 */
import type { Identifier } from 'dnd-core'
import type { FC, ReactNode } from 'react'
import * as React from 'react'
import { act } from 'react'
import type { ITestBackend } from 'react-dnd-test-backend'
import { TestBackend } from 'react-dnd-test-backend'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DndProvider } from '../core/index.js'
import { useDrag } from '../hooks/useDrag/index.js'
import { useDrop } from '../hooks/useDrop/index.js'

const ITEM_TYPE = 'BOX'

const roots = new WeakMap<HTMLElement, Root>()

function mount(element: ReactNode, container: HTMLElement) {
	let root = roots.get(container)
	if (!root) {
		root = createRoot(container)
		roots.set(container, root)
	}
	root.render(element)
}

function unmount(container: HTMLElement) {
	roots.get(container)?.unmount()
	roots.delete(container)
}

/** React's `act` is typed as returning a Thenable; these callbacks are sync. */
function flush(callback: () => void) {
	act(callback)
}

let container: HTMLDivElement
let backend: ITestBackend | undefined
let sourceId: Identifier | null = null
let targetId: Identifier | null = null
let dropped: unknown = null
let connectorReturn: unknown

const Source: FC = () => {
	const [{ isDragging, handlerId }, drag] = useDrag(() => ({
		type: ITEM_TYPE,
		item: { id: 'source-1' },
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
			handlerId: monitor.getHandlerId(),
		}),
	}))
	sourceId = handlerId
	return (
		<div
			data-testid="source"
			data-dragging={isDragging}
			ref={(node) => {
				// Capture what the connector hands back, so the suite can assert
				// React never receives something it would treat as a cleanup.
				connectorReturn = (drag as (n: Element | null) => unknown)(node)
			}}
		>
			source
		</div>
	)
}

const Target: FC = () => {
	const [{ isOver, handlerId }, drop] = useDrop(() => ({
		accept: ITEM_TYPE,
		drop: (item) => {
			dropped = item
			return undefined
		},
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			handlerId: monitor.getHandlerId(),
		}),
	}))
	targetId = handlerId
	return (
		<div data-testid="target" data-over={isOver} ref={drop}>
			target
		</div>
	)
}

function renderTree() {
	flush(() => {
		mount(
			<DndProvider
				backend={TestBackend}
				options={{
					onCreate(be: ITestBackend) {
						backend = be
					},
				}}
			>
				<Source />
				<Target />
			</DndProvider>,
			container,
		)
	})
}

const query = (id: string) =>
	container.querySelector<HTMLElement>(`[data-testid="${id}"]`)

describe('react-dnd against createRoot', () => {
	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		backend = undefined
		sourceId = null
		targetId = null
		dropped = null
		connectorReturn = undefined
	})

	afterEach(() => {
		flush(() => {
			unmount(container)
		})
		container.remove()
	})

	it('runs on the React major this library supports', () => {
		// A mis-wired alias or a stray second copy of React fails here first,
		// rather than as a confusing failure further down.
		expect(React.version.split('.')[0]).toBe('19')
	})

	it('mounts a provider, a drag source and a drop target', () => {
		renderTree()
		expect(query('source')).not.toBeNull()
		expect(query('target')).not.toBeNull()
		expect(backend).toBeDefined()
		expect(sourceId).not.toBeNull()
		expect(targetId).not.toBeNull()
	})

	it('collects isDragging through the monitor subscription', () => {
		renderTree()
		expect(query('source')?.dataset['dragging']).toBe('false')

		flush(() => {
			backend?.simulateBeginDrag([sourceId as Identifier])
		})
		expect(query('source')?.dataset['dragging']).toBe('true')

		flush(() => {
			backend?.simulateEndDrag()
		})
		expect(query('source')?.dataset['dragging']).toBe('false')
	})

	it('completes a full drag/hover/drop sequence', () => {
		renderTree()

		flush(() => {
			backend?.simulateBeginDrag([sourceId as Identifier])
			backend?.simulateHover([targetId as Identifier])
		})
		expect(query('target')?.dataset['over']).toBe('true')

		flush(() => {
			backend?.simulateDrop()
			backend?.simulateEndDrag()
		})
		expect(dropped).toEqual({ id: 'source-1' })
	})

	it('never returns a function from a connector used as a ref', () => {
		// React 19 interprets a function returned from a callback ref as a
		// cleanup. Returning one here would silently unregister the handler.
		renderTree()
		expect(query('source')).toBeInstanceOf(HTMLElement)
		expect(typeof connectorReturn).not.toBe('function')
	})

	it('shares one global manager across sibling providers', () => {
		// Regression guard for the StrictMode refcount bug: a provider mounting
		// after another unmounted-and-remounted must reuse the same manager.
		renderTree()
		const first = backend

		const second = document.createElement('div')
		document.body.appendChild(second)
		flush(() => {
			mount(
				<DndProvider backend={TestBackend}>
					<Source />
				</DndProvider>,
				second,
			)
		})
		// A shared global manager keeps the original backend instance live.
		expect(backend).toBe(first)

		flush(() => {
			unmount(second)
		})
		second.remove()
	})
})
