import type { BackendFactory } from 'dnd-core'
import type { ComponentType, Ref } from 'react'
import { forwardRef } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import type { ITestBackend, TestBackendOptions } from 'react-dnd-test-backend'
import { TestBackend } from 'react-dnd-test-backend'

/**
 * Wrap a Component with a DnDContext using the TestBackend
 *
 * @param DecoratedComponent The component to decorate
 * @returns [Component, getBackend] The wrapped component and a utility method
 * to get the test backend instance.
 */
export function wrapWithTestBackend<T>(
	DecoratedComponent: ComponentType<T>,
): [ComponentType<T>, () => ITestBackend | undefined] {
	let backend: ITestBackend | undefined
	const opts: TestBackendOptions = {
		onCreate(be) {
			backend = be
		},
	}
	const result = wrapWithBackend(DecoratedComponent, TestBackend, opts)
	return [result, () => backend]
}

/**
 * Wrap a component with a DndContext providing a backend.
 *
 * @param DecoratedComponent The compoent to decorate
 * @param Backend The backend to use (default=HTML5Backend)
 * @param backendOptions The optional backend options
 */
export function wrapWithBackend<T>(
	DecoratedComponent: ComponentType<T>,
	Backend: BackendFactory = HTML5Backend,
	backendOptions?: unknown,
): ComponentType<T> {
	// Previously this forwarded through an intermediate class component that
	// re-published the ref as a `forwardedRef` prop. That indirection stopped
	// typechecking under @types/react@19 and was never needed: forwardRef can
	// hand the ref straight to the decorated component.
	const Wrapped = forwardRef<unknown, T & object>(function TestContextWrapper(
		props,
		ref: Ref<any>,
	) {
		return (
			<DndProvider backend={Backend} options={backendOptions}>
				<DecoratedComponent ref={ref} {...(props as unknown as T)} />
			</DndProvider>
		)
	})

	Wrapped.displayName = `TestContextWrapper(${
		DecoratedComponent.displayName || DecoratedComponent.name || 'Component'
	})`

	return Wrapped as unknown as ComponentType<T>
}
