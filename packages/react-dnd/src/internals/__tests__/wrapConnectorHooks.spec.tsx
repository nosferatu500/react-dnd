/**
 * Covers the element-cloning form of a connector — `connect(<div />)` rather
 * than `<div ref={connect} />`. It is the pre-hooks calling convention, it is
 * still supported, and it had no tests at all, which is how it came to be
 * reading `element.ref` on React 19 (removed there, and logged to stderr on
 * every call) without anything noticing.
 *
 * The suite's `onConsoleLog` guard fails on React deprecation output, so these
 * tests also lock that access out: reintroducing `element.ref` turns them red.
 */
import { render } from '@testing-library/react'
import type { ReactElement, Ref } from 'react'
import { createRef, useRef } from 'react'

import { wrapConnectorHooks } from '../wrapConnectorHooks.js'

type Connector = (element: unknown, options?: unknown) => ReactElement

function connectorSpying(seen: unknown[]) {
	const hooks = wrapConnectorHooks({
		dragSource: (node: unknown) => seen.push(node),
	}) as { dragSource: () => Connector }
	return hooks.dragSource()
}

describe('the element form of a connector', () => {
	it('connects an element that carries no ref of its own', () => {
		const seen: unknown[] = []
		const connect = connectorSpying(seen)

		render(connect(<div data-testid="box">box</div>))

		// Under StrictMode the ref is attached, detached and reattached, so what
		// matters is that it settles holding the node rather than null.
		expect(seen.at(-1)).toBeInstanceOf(HTMLDivElement)
	})

	it('keeps a ref object the element already had, and adds its own', () => {
		const seen: unknown[] = []
		const connect = connectorSpying(seen)
		const existing = createRef<HTMLDivElement>()

		render(connect(<div ref={existing}>box</div>))

		expect(existing.current).toBeInstanceOf(HTMLDivElement)
		expect(seen.at(-1)).toBe(existing.current)
	})

	it('keeps a callback ref the element already had', () => {
		const seen: unknown[] = []
		const connect = connectorSpying(seen)
		const received: unknown[] = []

		// Block body, not `ref={(node) => received.push(node)}`: React 19 reads a
		// returned function as a cleanup, so the narrowed `RefCallback` rejects
		// any implicit return — the same trap the connector types encode.
		render(
			connect(
				<div
					ref={(node) => {
						received.push(node)
					}}
				>
					box
				</div>,
			),
		)

		expect(received.at(-1)).toBeInstanceOf(HTMLDivElement)
		expect(seen.at(-1)).toBe(received.at(-1))
	})

	it('reads the ref through props, where React 19 keeps it', () => {
		// The distinguishing case: a ref applied by the *parent* of the connected
		// element. Under React 19 it is visible only as `props.ref`.
		const seen: unknown[] = []
		const connect = connectorSpying(seen)
		let inner: Ref<HTMLDivElement> | null = null

		function Box() {
			const ref = useRef<HTMLDivElement>(null)
			inner = ref
			return connect(<div ref={ref}>box</div>)
		}

		render(<Box />)

		expect((inner as unknown as { current: unknown } | null)?.current).toBe(
			seen.at(-1),
		)
	})

	it('refuses a composite component, which it cannot attach a DOM ref to', () => {
		const connect = connectorSpying([])
		function Composite() {
			return <div>nope</div>
		}

		expect(() => connect(<Composite />)).toThrow(
			/Only native element nodes can now be passed to React DnD connectors/,
		)
	})
})
