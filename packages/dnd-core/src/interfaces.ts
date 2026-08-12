export type Identifier = string | symbol
/**
 * What a drop does, as far as the user's cursor is concerned — the four values
 * `DataTransfer.dropEffect` accepts.
 *
 * Declared here rather than in `react-dnd` because both the React layer (which
 * takes it as a source/target option) and the backends (which resolve it and
 * write it to the event) need the same vocabulary, and a backend must not
 * depend on React.
 */
export type DropEffect = 'none' | 'copy' | 'link' | 'move'
export type SourceType = Identifier
export type TargetType = Identifier | Identifier[]
export type Unsubscribe = () => void
export type Listener = () => void

export interface XYCoord {
	x: number
	y: number
}

export enum HandlerRole {
	SOURCE = 'SOURCE',
	TARGET = 'TARGET',
}

export interface Backend {
	setup(): void
	teardown(): void
	connectDragSource(sourceId: any, node?: any, options?: any): Unsubscribe
	connectDragPreview(sourceId: any, node?: any, options?: any): Unsubscribe
	connectDropTarget(targetId: any, node?: any, options?: any): Unsubscribe
	profile(): Record<string, number>
}

export interface DragDropMonitor {
	subscribeToStateChange(
		listener: Listener,
		options?: {
			handlerIds?: Identifier[]
		},
	): Unsubscribe
	subscribeToOffsetChange(listener: Listener): Unsubscribe
	canDragSource(sourceId: Identifier | undefined): boolean
	canDropOnTarget(targetId: Identifier | undefined): boolean

	/**
	 * Returns true if a drag operation is in progress, and either the owner initiated the drag, or its isDragging()
	 * is defined and returns true.
	 */
	isDragging(): boolean
	isDraggingSource(sourceId: Identifier | undefined): boolean
	isOverTarget(
		targetId: Identifier | undefined,
		options?: {
			shallow?: boolean
		},
	): boolean

	/**
	 * Returns a string or a symbol identifying the type of the current dragged item. Returns null if no item is being dragged.
	 */
	getItemType(): Identifier | null

	/**
	 * Returns a plain object representing the currently dragged item. Every drag source must specify it by returning an object
	 * from its beginDrag() method. Returns null if no item is being dragged.
	 */
	getItem(): any
	getSourceId(): Identifier | null
	getTargetIds(): Identifier[]
	/**
	 * Returns a plain object representing the last recorded drop result. The drop targets may optionally specify it by returning an
	 * object from their drop() methods. When a chain of drop() is dispatched for the nested targets, bottom up, any parent that
	 * explicitly returns its own result from drop() overrides the child drop result previously set by the child. Returns null if
	 * called outside endDrag().
	 */
	getDropResult(): any
	/**
	 * Returns true if some drop target has handled the drop event, false otherwise. Even if a target did not return a drop result,
	 * didDrop() returns true. Use it inside endDrag() to test whether any drop target has handled the drop. Returns false if called
	 * outside endDrag().
	 */
	didDrop(): boolean
	/**
	 * Whether a drop whose handler returned a promise is still waiting on it.
	 *
	 * The drag itself is already over — `isDragging()` goes false at drop time as
	 * it always did, because for a pointer backend the browser's drag really has
	 * ended. Settling is the separate, later phase.
	 *
	 * With no argument, true while *any* drop is in flight. With a handler id,
	 * true only while a drop that handler took part in is — either as the target
	 * that returned the promise or as the source the item came from.
	 */
	isSettling(handlerId?: Identifier): boolean
	/**
	 * The reason the last asynchronous drop rejected, or `null`.
	 *
	 * The rejection is *also* rethrown into the environment's uncaught-error
	 * handling, so recording it here is for rendering a retry rather than for
	 * making sure somebody notices.
	 */
	getDropError(): any
	isSourcePublic(): boolean | null
	/**
	 * Returns the { x, y } client offset of the pointer at the time when the current drag operation has started.
	 * Returns null if no item is being dragged.
	 */
	getInitialClientOffset(): XYCoord | null
	/**
	 * Returns the { x, y } client offset of the drag source component's root DOM node at the time when the current drag
	 * operation has started. Returns null if no item is being dragged.
	 */
	getInitialSourceClientOffset(): XYCoord | null

	/**
	 * Returns the last recorded { x, y } client offset of the pointer while a drag operation is in progress.
	 * Returns null if no item is being dragged.
	 */
	getClientOffset(): XYCoord | null

	/**
	 * Returns the projected { x, y } client offset of the drag source component's root DOM node, based on its position at the time
	 * when the current drag operation has started, and the movement difference. Returns null if no item is being dragged.
	 */
	getSourceClientOffset(): XYCoord | null

	/**
	 * Returns the { x, y } difference between the last recorded client offset of the pointer and the client offset when the current
	 * drag operation has started. Returns null if no item is being dragged.
	 */
	getDifferenceFromInitialOffset(): XYCoord | null
}

export interface HandlerRegistry {
	addSource(
		type: SourceType,
		source: DragSource,
		options?: AddSourceOptions,
	): Identifier
	addTarget(type: TargetType, target: DropTarget): Identifier
	containsHandler(handler: DragSource | DropTarget): boolean
	getSource(sourceId: Identifier, includePinned?: boolean): DragSource
	getSourceType(sourceId: Identifier): SourceType
	getTargetType(targetId: Identifier): TargetType
	getTarget(targetId: Identifier): DropTarget
	isSourceId(handlerId: Identifier): boolean
	isTargetId(handlerId: Identifier): boolean
	removeSource(sourceId: Identifier): void
	removeTarget(targetId: Identifier): void
	pinSource(sourceId: Identifier): void
	unpinSource(): void
}

export interface Action<Payload> {
	/**
	 * Action types are always string constants (see actions/dragDrop/types.ts).
	 * This was previously `Identifier`, i.e. `string | symbol` — that is the type
	 * of a drag *item* type, and it never belonged here. No reducer has ever
	 * matched a symbol.
	 */
	type: string
	payload: Payload
}
export interface SentinelAction {
	type: string
}

export type ActionCreator<Payload> = (args: any[]) => Action<Payload>

export interface BeginDragOptions {
	publishSource?: boolean
	clientOffset?: XYCoord
	getSourceClientOffset?: (sourceId: Identifier | undefined) => XYCoord
}

export interface InitCoordsPayload {
	clientOffset: XYCoord | null
	sourceClientOffset: XYCoord | null
}

export interface BeginDragPayload {
	itemType: Identifier
	item: any
	sourceId: Identifier
	clientOffset: XYCoord | null
	sourceClientOffset: XYCoord | null
	isSourcePublic: boolean
}

export interface HoverPayload {
	targetIds: Identifier[]
	clientOffset: XYCoord | null
}

export interface HoverOptions {
	clientOffset?: XYCoord
}

export interface DropPayload {
	dropResult: any
}

export interface DropPendingPayload {
	/** Identifies this one contribution, so a superseded settle can be ignored. */
	dropId: number
	targetId: Identifier
	sourceId: Identifier | null
}

export interface DropSettledPayload {
	dropId: number
	targetId: Identifier
	result: any
	error: unknown
}

export interface TargetIdPayload {
	targetId: Identifier
}

export interface SourceIdPayload {
	sourceId: Identifier
	/** @see AddSourceOptions.backendOwned */
	backendOwned?: boolean
}

export interface AddSourceOptions {
	/**
	 * Marks a source the *backend* registered for its own machinery, rather than
	 * one an application component asked for — the HTML5 backend's stand-in for
	 * a dragged file being the only case today.
	 *
	 * Such a source does not count towards the handler refcount that decides
	 * whether the backend should be set up. That question is "does anything in
	 * the application still need this backend?", and a handler the backend
	 * created for itself cannot answer it: counting it means that while a native
	 * drag is in flight the backend holds itself up, and an application that
	 * unmounts before the drag ends can never be torn down.
	 */
	backendOwned?: boolean
}

export interface DragDropActions {
	beginDrag(
		sourceIds?: Identifier[],
		options?: any,
	): Action<BeginDragPayload> | undefined
	publishDragSource(): SentinelAction | undefined
	hover(targetIds: Identifier[], options?: any): Action<HoverPayload>
	drop(options?: any): void
	endDrag(): SentinelAction
}

export interface DragDropManager {
	getMonitor(): DragDropMonitor
	getBackend(): Backend
	getRegistry(): HandlerRegistry
	getActions(): DragDropActions
	dispatch(action: any): void
}

export type BackendFactory = (
	manager: DragDropManager,
	globalContext?: any,
	configuration?: any,
) => Backend

export interface DragSource {
	beginDrag(monitor: DragDropMonitor, targetId: Identifier): void
	endDrag(monitor: DragDropMonitor, targetId: Identifier): void
	canDrag(monitor: DragDropMonitor, targetId: Identifier): boolean
	isDragging(monitor: DragDropMonitor, targetId: Identifier): boolean
}

export interface DropTarget {
	canDrop(monitor: DragDropMonitor, targetId: Identifier): boolean
	hover(monitor: DragDropMonitor, targetId: Identifier): void
	/**
	 * @param signal aborted if the drop is superseded before its result is used.
	 * Only meaningful to a target that returns a promise; an implementation that
	 * ignores it is still valid.
	 */
	drop(monitor: DragDropMonitor, targetId: Identifier, signal: AbortSignal): any
}
