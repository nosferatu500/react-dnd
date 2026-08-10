/**
 * The forms a connector accepts, and the one it no longer does.
 *
 * This file was written to cover the element-cloning form — `connect(<div />)`
 * — which had no tests and was quietly reading `element.ref` on React 19. That
 * form has since been removed, so what is left pins the two supported shapes
 * and asserts the removed one fails with something a reader can act on.
 */
import { render } from '@testing-library/react'
import { createRef, useRef } from 'react'

import { wrapConnectorHooks } from '../wrapConnectorHooks.js'

type Connector = (elementOrNode?: unknown, options?: unknown) => unknown

function connectorSpying(seen: unknown[], options: unknown[] = []) {
	const hooks = wrapConnectorHooks({
		dragSource: (node: unknown, opts: unknown) => {
			seen.push(node)
			options.push(opts)
		},
	}) as { dragSource: () => Connector }
	return hooks.dragSource()
}

describe('a connector used as a ref callback', () => {
	it('receives the DOM node', () => {
		const seen: unknown[] = []
		const connect = connectorSpying(seen)

		render(
			<div ref={connect as (node: HTMLDivElement | null) => void}>box</div>,
		)

		// Under StrictMode the ref is attached, detached and reattached, so what
		// matters is that it settles holding the node rather than null.
		expect(seen.at(-1)).toBeInstanceOf(HTMLDivElement)
	})

	it('receives null when the element goes away', () => {
		const seen: unknown[] = []
		const connect = connectorSpying(seen)

		const view = render(
			<div ref={connect as (node: HTMLDivElement | null) => void}>box</div>,
		)
		view.unmount()

		expect(seen.at(-1)).toBeNull()
	})
})

describe('a connector given a ref object', () => {
	it('takes the ref itself, not its current value', () => {
		// This is the documented way to attach two connectors to one element, so
		// the ref object has to survive the wrapper untouched.
		const seen: unknown[] = []
		const connect = connectorSpying(seen)
		const ref = createRef<HTMLDivElement>()

		connect(ref)

		expect(seen).toEqual([ref])
	})

	it('works when the ref is filled in later by React', () => {
		const seen: unknown[] = []
		const connect = connectorSpying(seen)
		let inner: { current: HTMLDivElement | null } | null = null

		function Box() {
			const ref = useRef<HTMLDivElement>(null)
			inner = ref
			connect(ref)
			return <div ref={ref}>box</div>
		}
		render(<Box />)

		expect(seen.at(-1)).toBe(inner)
		expect(
			(inner as unknown as { current: unknown } | null)?.current,
		).toBeInstanceOf(HTMLDivElement)
	})
})

describe('a connector given a node and options', () => {
	it('passes the options through', () => {
		// `preview(getEmptyImage(), { captureDraggingState: true })` is the real
		// caller of this shape.
		const seen: unknown[] = []
		const options: unknown[] = []
		const connect = connectorSpying(seen, options)
		const node = document.createElement('div')

		connect(node, { captureDraggingState: true })

		expect(seen).toEqual([node])
		expect(options).toEqual([{ captureDraggingState: true }])
	})
})

describe('the removed element form', () => {
	it('rejects a React element with a message that says what to do instead', () => {
		const connect = connectorSpying([])

		expect(() => connect(<div>box</div>)).toThrow(
			/Connectors no longer accept a React element.*ref=\{drag\}/s,
		)
	})

	it('rejects a composite element too, rather than treating it as a node', () => {
		const connect = connectorSpying([])
		function Composite() {
			return <div>nope</div>
		}

		expect(() => connect(<Composite />)).toThrow(
			/no longer accept a React element/,
		)
	})
})
