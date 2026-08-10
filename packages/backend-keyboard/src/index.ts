import type { BackendFactory, DragDropManager } from 'dnd-core'

import { CompositeBackend } from './CompositeBackend.js'
import type {
	KeyboardBackendContext,
	KeyboardBackendOptions,
} from './interfaces.js'
import { KeyboardBackendImpl } from './KeyboardBackendImpl.js'

export { defaultAnnouncements } from './Announcer.js'
export { CompositeBackend } from './CompositeBackend.js'
export type {
	AnnouncementContext,
	Announcements,
	AnnouncingBackend,
	GetNextTarget,
	KeyboardBackendContext,
	KeyboardBackendOptions,
	NavigationCandidate,
	NavigationDirection,
	NavigationRequest,
} from './interfaces.js'
export type { GridNavigationOptions } from './navigation.js'
export {
	documentOrderNavigation,
	gridNavigation,
	spatialNavigation,
} from './navigation.js'
export { defaultDescribeNode } from './OptionsReader.js'
export { useDragDropAnnounce } from './useDragDropAnnounce.js'

/**
 * Keyboard-only drag and drop.
 *
 * Usually you want {@link withKeyboard} instead — on its own this backend
 * leaves an app unusable with a mouse. Reach for it directly when keyboard is
 * genuinely the only modality, or in tests.
 */
export const KeyboardBackend: BackendFactory = function createBackend(
	manager: DragDropManager,
	context?: KeyboardBackendContext,
	options?: KeyboardBackendOptions,
): KeyboardBackendImpl {
	return new KeyboardBackendImpl(manager, context, options)
}

/**
 * Adds keyboard drag and drop to any pointer backend, without changing a line
 * of `useDrag`/`useDrop` in the app.
 *
 * ```tsx
 * import { HTML5Backend } from 'react-dnd-html5-backend'
 * import { withKeyboard } from 'react-dnd-keyboard-backend'
 *
 * <DndProvider backend={withKeyboard(HTML5Backend)}>
 *   <App />
 * </DndProvider>
 * ```
 *
 * Connected drag sources become focusable and describe themselves to assistive
 * technology; space or enter picks one up, the arrow keys choose a drop target,
 * space or enter drops, escape cancels, and a polite live region narrates each
 * step. See {@link KeyboardBackendOptions} to override the navigation model,
 * the wording, or either of the automatic behaviors.
 *
 * @param base the pointer backend to extend, e.g. `HTML5Backend`
 * @param keyboardOptions options for the keyboard half only; the provider's own
 * `options` continue to go to `base` untouched
 */
export function withKeyboard(
	base: BackendFactory,
	keyboardOptions: KeyboardBackendOptions = {},
): BackendFactory {
	return function createBackend(
		manager: DragDropManager,
		context?: unknown,
		options?: unknown,
	): CompositeBackend {
		const keyboard = new KeyboardBackendImpl(
			manager,
			context as KeyboardBackendContext | undefined,
			{
				// A root chosen for the pointer backend is the right root for the
				// keyboard one too, unless it has been told otherwise.
				rootElement: (options as { rootElement?: Node } | undefined)
					?.rootElement,
				...keyboardOptions,
			},
		)
		return new CompositeBackend([base(manager, context, options), keyboard])
	}
}
