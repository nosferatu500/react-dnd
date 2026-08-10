import type { ReactElement } from 'react'
import { cloneElement, isValidElement } from 'react'

function throwIfCompositeComponentElement(element: ReactElement<any>) {
	// Custom components can no longer be wrapped directly in React DnD 2.0
	// so that we don't need to depend on findDOMNode() from react-dom.
	if (typeof element.type === 'string') {
		return
	}

	const displayName =
		(element.type as any).displayName || element.type.name || 'the component'

	throw new Error(
		`Only native element nodes can now be passed to React DnD connectors.You can either wrap ${displayName} into a <div>, or turn it into a drag source or a drop target itself.`,
	)
}

function wrapHookToRecognizeElement(hook: (node: any, options: any) => void) {
	return (elementOrNode = null, options = null) => {
		// When passed a node, call the hook straight away.
		if (!isValidElement(elementOrNode)) {
			const node = elementOrNode
			hook(node, options)
			// return the node so it can be chained (e.g. when within callback refs
			// <div ref={node => connectDragSource(connectDropTarget(node))}/>
			return node
		}

		// If passed a ReactElement, clone it and attach this function as a ref.
		// This helps us achieve a neat API where user doesn't even know that refs
		// are being used under the hood.
		const element: ReactElement | null = elementOrNode
		throwIfCompositeComponentElement(element as any)

		// When no options are passed, use the hook directly
		const ref = options ? (node: Element) => hook(node, options) : hook
		return cloneWithRef(element, ref)
	}
}

export function wrapConnectorHooks(hooks: any) {
	const wrappedHooks: any = {}

	Object.keys(hooks).forEach((key) => {
		const hook = hooks[key]

		// ref objects should be passed straight through without wrapping
		if (key.endsWith('Ref')) {
			wrappedHooks[key] = hooks[key]
		} else {
			const wrappedHook = wrapHookToRecognizeElement(hook)
			wrappedHooks[key] = () => wrappedHook
		}
	})

	return wrappedHooks
}

function setRef(ref: any, node: any) {
	if (typeof ref === 'function') {
		ref(node)
	} else {
		ref.current = node
	}
}

function cloneWithRef(element: any, newRef: any): ReactElement<any> {
	// `element.props.ref`, not `element.ref`. React 19 made `ref` an ordinary
	// prop and reading it off the element logs "Accessing element.ref was
	// removed in React 19… It will be removed from the JSX Element type in a
	// future release."
	//
	// The string-ref guard that used to sit here is gone with it: React 19
	// removed string refs outright, so `previousRef` can only be a function or
	// a ref object now.
	const previousRef = element.props?.ref

	if (!previousRef) {
		// When there is no ref on the element, use the new ref directly
		return cloneElement(element, {
			ref: newRef,
		})
	} else {
		return cloneElement(element, {
			ref: (node: any) => {
				setRef(previousRef, node)
				setRef(newRef, node)
			},
		})
	}
}
