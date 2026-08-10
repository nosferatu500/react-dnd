import type { DropEffect } from '@nosferatu500/dnd-core'

export type HTML5BackendContext = Window | undefined

/**
 * Which held key means "copy instead of move".
 *
 * `false` turns the modifier off entirely, so only an explicit `dropEffect`
 * decides. A predicate covers anything the four names cannot — a chord, or a
 * key that depends on the platform.
 */
export type CopyModifier =
	| 'alt'
	| 'ctrl'
	| 'meta'
	| 'shift'
	| false
	| ((event: DragEvent) => boolean)

/**
 * Configuration options for the HTML5Backend
 */
export interface HTML5BackendOptions {
	/**
	 * The root DOM node to use for subscribing to events. Default=Window
	 */
	rootElement: Node

	/**
	 * Which modifier key switches the drop effect to 'copy'. Default: `'alt'`.
	 *
	 * Alt is the browser's own convention on Windows and Linux, but it is not
	 * universal — macOS Finder copies with alt and *aliases* with cmd+alt, and
	 * plenty of apps use ctrl. Before this was configurable, alt was the only
	 * option and apps that wanted another key had to fake the events.
	 */
	copyModifier?: CopyModifier
}

/** The part of a drag source's options this backend reads. */
export interface DragSourceConnectOptions {
	dropEffect?: DropEffect
}

/** The part of a drop target's options this backend reads. */
export interface DropTargetConnectOptions {
	dropEffect?: DropEffect
}
