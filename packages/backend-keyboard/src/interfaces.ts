import type { Identifier } from 'dnd-core'

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
