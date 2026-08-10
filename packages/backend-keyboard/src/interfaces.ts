import type { Identifier } from '@nosferatu500/dnd-core'

/**
 * A backend that can speak to assistive technology. Implemented by
 * `KeyboardBackendImpl`, and forwarded by `CompositeBackend`, so
 * `useDragDropAnnounce()` can find it through the manager without knowing which
 * backend it got.
 */
export interface AnnouncingBackend {
	announce(message: string): void
}

/**
 * A backend that knows whether the drag in progress is being driven from the
 * keyboard. Implemented by `KeyboardBackendImpl` and forwarded by
 * `CompositeBackend`, the same way {@link AnnouncingBackend} is.
 *
 * Prefer {@link isKeyboardDrag}, which asks the question through the manager
 * rather than making the caller reach for `getBackend()` and know what it got.
 */
export interface KeyboardDragBackend {
	isKeyboardDragging(): boolean
}

export interface KeyboardBackendContext {
	window?: Window
	document?: Document
}

/**
 * The direction an arrow key asks for. `forward`/`backward` are what the
 * default, document-order navigation collapses the four arrows down to;
 * geometry-aware navigators use the four compass directions instead.
 */
export type NavigationDirection =
	| 'forward'
	| 'backward'
	| 'up'
	| 'down'
	| 'left'
	| 'right'

export interface NavigationCandidate {
	targetId: string
	node: HTMLElement
}

export interface NavigationRequest {
	direction: NavigationDirection
	/** The target currently hovered, or `null` before the first move. */
	current: NavigationCandidate | null
	/**
	 * Every target that can be dropped on right now, in document order.
	 * Recomputed on each keystroke, so a `canDrop` that changes mid-drag is
	 * respected.
	 */
	candidates: NavigationCandidate[]
	/**
	 * Every connected drop target still in the document, in document order,
	 * whether or not it accepts the dragged item.
	 *
	 * Layout-aware navigators need this: on a board where only the legal moves
	 * accept the item, `candidates` is a handful of scattered squares and says
	 * nothing about the shape of the grid they sit in. `allTargets` is the grid.
	 */
	allTargets: NavigationCandidate[]
	/** The node the drag was lifted from. */
	source: HTMLElement | null
}

/**
 * Chooses where an arrow key moves to. Returning `null` leaves the hover where
 * it is — which is what the default does at the ends of the list, rather than
 * wrapping around and silently moving the item past where the user expected.
 */
export type GetNextTarget = (
	request: NavigationRequest,
) => NavigationCandidate | null

/** A {@link NavigationRequest} the application can take over. */
export interface NavigationEvent extends NavigationRequest {
	/**
	 * Keeps this arrow key for the application: {@link GetNextTarget} is not
	 * consulted and the hover stays exactly where it is.
	 *
	 * The key press is still taken from the page either way — a drag in progress
	 * owns the arrow keys, so they never scroll the list underneath it.
	 */
	preventDefault(): void
}

/**
 * Called on every arrow key press during a drag, before the hover is moved.
 *
 * This is where sub-position lives — the indent level of a row in a tree, the
 * insertion point between two cards, anything that is "the same drop target,
 * somewhere else within it". A drop target cannot express that: dnd-core's
 * dirtiness reducer treats a `hover` whose `targetIds` are unchanged as no
 * change at all, so re-hovering the same target dispatches nothing that any
 * collector will re-render for. Sub-position is application state, and this is
 * the event that drives it.
 *
 * Call {@link NavigationEvent.preventDefault} to keep the key press — a tree
 * typically takes left and right for indentation and lets up and down move the
 * hover as usual.
 *
 * The backend announces only what it did itself, so an application that handles
 * a key here should say what happened with `useDragDropAnnounce()`. Silence
 * after a key press is indistinguishable from a key that did nothing.
 */
export type OnNavigate = (event: NavigationEvent) => void

export interface AnnouncementContext {
	/** The dragged item, as returned by the drag source's `item()`. */
	item: unknown
	itemType: Identifier | null
	/** Human-readable description of the dragged element. */
	source: string
	/** Human-readable description of the hovered target, if any. */
	target: string | null
	/** 1-based position of the hovered target among the eligible ones. */
	targetIndex: number
	targetCount: number
	dropResult?: unknown
}

/**
 * Every string spoken to a screen reader. Override any subset — for
 * localization, or to say something more specific than a generic description of
 * the DOM node.
 */
export interface Announcements {
	/** Static text referenced by every source's `aria-describedby`. */
	instructions: string
	pickUp: (context: AnnouncementContext) => string
	move: (context: AnnouncementContext) => string
	drop: (context: AnnouncementContext) => string
	cancel: (context: AnnouncementContext) => string
	noTargets: (context: AnnouncementContext) => string
	cannotDrop: (context: AnnouncementContext) => string
}

export interface KeyboardBackendOptions {
	/**
	 * Where the `keydown` listener is attached. Defaults to the document, which
	 * is what makes a source pickable from wherever it is focused.
	 */
	rootElement?: Node | undefined
	/** Defaults to {@link documentOrderNavigation}. */
	getNextTarget?: GetNextTarget | undefined
	/**
	 * Notified of every arrow key press during a drag, whether or not the hover
	 * ends up moving, and able to take the key press for itself. See
	 * {@link OnNavigate}.
	 */
	onNavigate?: OnNavigate | undefined
	/**
	 * Turns a connected element into the text used in announcements. Defaults to
	 * its `aria-label`, falling back to its trimmed text content.
	 */
	describeNode?: ((node: HTMLElement) => string) | undefined
	announcements?: Partial<Announcements> | undefined
	/**
	 * Whether to make connected drag sources focusable and labelled. On by
	 * default — an unfocusable drag source cannot be picked up by keyboard at
	 * all, so turning this off means taking on `tabindex`, `role` and
	 * `aria-describedby` yourself.
	 */
	applyAriaAttributes?: boolean | undefined
	/** Whether to create and drive the live region. On by default. */
	announce?: boolean | undefined
}
