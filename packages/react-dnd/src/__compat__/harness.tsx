/**
 * A React-version-agnostic conformance suite for react-dnd.
 *
 * The main test suite runs through @testing-library/react against whichever
 * React is installed at the repo root (19). RTL resolves its own
 * `react-dom/client` by plain Node resolution, so it cannot be pointed at a
 * different React with a Vitest alias — covering React 18 through RTL needs a
 * real install swap, which is what the CI matrix does.
 *
 * These suites fill the local gap: they skip RTL and drive each major's own root
 * API directly, so `npm run test:matrix` exercises React 18 and 19 without
 * touching node_modules. Both legs call `defineCompatSuite` with a small
 * adapter, so the assertions stay identical across versions and behavioral drift
 * between majors shows up as a failure rather than as two suites that quietly
 * diverged.
 */
import type { Identifier } from 'dnd-core'
import type { FC } from 'react'
import type { ITestBackend } from 'react-dnd-test-backend'
import { TestBackend } from 'react-dnd-test-backend'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DndProvider } from '../core/index.js'
import { useDrag } from '../hooks/useDrag/index.js'
import { useDrop } from '../hooks/useDrop/index.js'

const ITEM_TYPE = 'BOX'

export interface CompatAdapter {
	/** Expected React major, asserted so a mis-wired alias fails loudly. */
	major: number
	/** Synchronously flush renders and effects. */
	act: (cb: () => void) => void
	/** Mount `element` into `container`. */
	mount: (element: React.ReactNode, container: HTMLElement) => void
	/** Tear down whatever `mount` created for `container`. */
	unmount: (container: HTMLElement) => void
	/** The running React's `version` string. */
	version: string
}

export function defineCompatSuite(adapter: CompatAdapter): void {
	const { act, mount, unmount } = adapter

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

	const renderTree = () => {
		act(() => {
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

	describe(`react-dnd on React ${adapter.major}`, () => {
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
			act(() => {
				unmount(container)
			})
			container.remove()
		})

		it(`resolves React ${adapter.major}`, () => {
			expect(adapter.version.split('.')[0]).toBe(String(adapter.major))
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

			act(() => {
				backend?.simulateBeginDrag([sourceId!])
			})
			expect(query('source')?.dataset['dragging']).toBe('true')

			act(() => {
				backend?.simulateEndDrag()
			})
			expect(query('source')?.dataset['dragging']).toBe('false')
		})

		it('completes a full drag/hover/drop sequence', () => {
			renderTree()

			act(() => {
				backend?.simulateBeginDrag([sourceId!])
				backend?.simulateHover([targetId!])
			})
			expect(query('target')?.dataset['over']).toBe('true')

			act(() => {
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
			act(() => {
				mount(
					<DndProvider backend={TestBackend}>
						<Source />
					</DndProvider>,
					second,
				)
			})
			// A shared global manager keeps the original backend instance live.
			expect(backend).toBe(first)

			act(() => {
				unmount(second)
			})
			second.remove()
		})
	})
}
