import { invariant } from 'dnd-core'
import { isValidElement } from 'react'

/**
 * Wraps each connector hook so it can be handed a DOM node, a ref object, or
 * `null`.
 *
 * It used to accept a `ReactElement` as well, cloning it and injecting the
 * connector as its `ref` — the calling convention the `DragSource`/`DropTarget`
 * decorators generated, and the reason this module once needed `cloneElement`,
 * a composite-component check and ref merging. The decorators were removed
 * upstream in v14; the calling convention outlived them until now.
 *
 * Passing an element fails loudly rather than being taken for a DOM node. It
 * would otherwise be handed to the backend and blow up somewhere less
 * explicable, several frames from the mistake.
 */
function wrapConnectorHook(hook: (node: any, options?: any) => void) {
	// `options` is deliberately not defaulted. Passing `null` through when the
	// caller supplied nothing is indistinguishable from clearing the options, and
	// the connectors used to take it as exactly that — so `<div ref={drop} />`
	// wiped whatever the `useDrop` spec had set. It went unnoticed because the
	// layout effect that applies spec options normally runs *after* the ref and
	// put them back; on a remount, where only the ref runs, it did not.
	return (elementOrNode: any = null, options?: any) => {
		invariant(
			!isValidElement(elementOrNode),
			'Connectors no longer accept a React element. Attach the connector with ' +
				'a ref instead: `<div ref={drag} />`, or `drag(ref)` with a ref ' +
				'object. See MIGRATION.md.',
		)

		hook(elementOrNode, options)

		// Returned so untyped `drag(drop(node))` chaining keeps working at
		// runtime. The public type reports `void`, because React 19 reads a
		// *function* returned from a callback ref as a cleanup and chaining was
		// always the hazardous spelling — but silently returning `undefined`
		// would make existing JavaScript disconnect its handlers instead of
		// failing.
		return elementOrNode
	}
}

export function wrapConnectorHooks(hooks: any) {
	const wrappedHooks: any = {}

	for (const key of Object.keys(hooks)) {
		const wrapped = wrapConnectorHook(hooks[key])
		wrappedHooks[key] = () => wrapped
	}

	return wrappedHooks
}
