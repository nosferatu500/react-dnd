import type { BackendFactory } from '@nosferatu500/dnd-core'
import { DndProvider } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import type {
	ITestBackend,
	TestBackendOptions,
} from '@nosferatu500/react-dnd-test-backend'
import { TestBackend } from '@nosferatu500/react-dnd-test-backend'
import type { ComponentType, Ref } from 'react'

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
	// `ref` is an ordinary prop in React 19, so this is a plain function
	// component. It went through `forwardRef` before that, and before *that*
	// through an intermediate class that re-published the ref as a
	// `forwardedRef` prop — neither indirection is needed now, and `forwardRef`
	// itself is deprecated.
	function Wrapped({ ref, ...props }: T & object & { ref?: Ref<any> }) {
		return (
			<DndProvider backend={Backend} options={backendOptions}>
				<DecoratedComponent ref={ref} {...(props as unknown as T)} />
			</DndProvider>
		)
	}

	Wrapped.displayName = `TestContextWrapper(${
		DecoratedComponent.displayName || DecoratedComponent.name || 'Component'
	})`

	return Wrapped as unknown as ComponentType<T>
}
