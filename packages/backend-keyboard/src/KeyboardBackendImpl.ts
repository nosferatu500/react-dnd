import type {
	Backend,
	DragDropActions,
	DragDropManager,
	DragDropMonitor,
	Identifier,
	Unsubscribe,
	XYCoord,
} from '@nosferatu500/dnd-core'

import { Announcer } from './Announcer.js'
import type {
	AnnouncementContext,
	Announcements,
	KeyboardBackendContext,
	KeyboardBackendOptions,
	NavigationCandidate,
	NavigationDirection,
	NavigationRequest,
} from './interfaces.js'
import { initialCandidate, sortByDocumentOrder } from './navigation.js'
import { OptionsReader } from './OptionsReader.js'

const LIFT_KEYS = new Set([' ', 'Spacebar', 'Enter'])
const ARROW_DIRECTIONS: Record<string, NavigationDirection> = {
	ArrowUp: 'up',
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
	Up: 'up',
	Down: 'down',
	Left: 'left',
	Right: 'right',
}

/**
 * Elements that own the space bar and the arrow keys for their own purposes.
 * Picking a drag up from inside one would make the control unusable.
 */
const TEXT_ENTRY = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** Attributes this backend may write, and therefore must be able to restore. */
const MANAGED_ATTRIBUTES = [
	'tabindex',
	'role',
	'aria-roledescription',
	'aria-describedby',
] as const

type ManagedAttribute = (typeof MANAGED_ATTRIBUTES)[number]

/**
 * Elements the platform already makes focusable and announces as interactive.
 * Writing `tabindex`/`role` onto these would either be redundant or actively
 * wrong (a `role="button"` on an anchor loses the link semantics).
 */
const NATIVELY_INTERACTIVE = new Set([
	'A',
	'BUTTON',
	'INPUT',
	'SELECT',
	'TEXTAREA',
])

/**
 * Descendants that make `role="button"` invalid on their ancestor.
 *
 * `button` is a role whose children are presentational: assistive technology is
 * entitled to flatten everything inside it to a label, so a focusable control
 * nested in one may not be reachable at all. A whole-row drag source wrapping
 * the row's own buttons is the common shape, and it is exactly the shape that
 * breaks.
 */
const INTERACTIVE_DESCENDANTS =
	'button, a[href], input, select, textarea, [tabindex]'

interface SourceEntry {
	node: HTMLElement
	restore: Map<ManagedAttribute, string | null>
}

/** The announcements that are spoken, i.e. everything but the static text. */
type SpokenAnnouncement = Exclude<keyof Announcements, 'instructions'>

/**
 * Drives drag and drop from the keyboard, and gives the drag a voice.
 *
 * It is a peer of the pointer backends rather than a layer above them: a
 * backend is exactly "how user input becomes dnd-core actions", and it is
 * already handed the source and target DOM nodes it needs. Because react-dnd
 * takes a single backend per provider, use {@link withKeyboard} to run this
 * alongside HTML5 or Touch — keyboard support is meant to be *additional*
 * to pointer support, never a replacement for it.
 *
 * Focus deliberately stays on the dragged element for the whole interaction.
 * Moving it onto each drop target in turn would mean writing `tabindex` onto
 * every target, fighting the app over focus, and losing the user's place if a
 * target unmounts mid-drag. Instead the hover moves, collected props update as
 * they always do, and the live region says where the item now is.
 */
export class KeyboardBackendImpl implements Backend {
	private options: OptionsReader

	private actions: DragDropActions
	private monitor: DragDropMonitor

	private sources = new Map<string, SourceEntry>()
	private targets = new Map<string, HTMLElement>()

	private announcer: Announcer | null = null
	private isSetUp = false

	/** The source being dragged *by keyboard*, if any. */
	private draggingSourceId: string | null = null
	private hoveredTargetId: string | null = null

	public constructor(
		manager: DragDropManager,
		globalContext?: KeyboardBackendContext,
		options?: KeyboardBackendOptions,
	) {
		this.options = new OptionsReader(globalContext, options)
		this.actions = manager.getActions()
		this.monitor = manager.getMonitor()
	}

	public profile(): Record<string, number> {
		return {
			keyboardSourceNodes: this.sources.size,
			keyboardTargetNodes: this.targets.size,
			keyboardDragging: this.draggingSourceId ? 1 : 0,
		}
	}

	/**
	 * Whether the drag in progress was started from the keyboard.
	 *
	 * `monitor.isDragging()` cannot answer this: to dnd-core a drag is a drag,
	 * whichever backend opened it. Reach it with {@link isKeyboardDrag} rather
	 * than through `getBackend()`, and read `profile()` only for diagnostics.
	 */
	public isKeyboardDragging(): boolean {
		return this.draggingSourceId !== null
	}

	// public for test
	public get window(): Window | undefined {
		return this.options.window
	}
	public get document(): Document | undefined {
		return this.options.document
	}
	/** The live region, for assertions. `null` when announcements are off. */
	public get liveRegionText(): string {
		return this.announcer?.lastMessage ?? ''
	}

	/**
	 * Speaks an arbitrary message through the same live region the backend uses.
	 *
	 * For what the application knows and the backend cannot: the backend can say
	 * *"Dropped Knight on c3"* because it can read the DOM, but only the app can
	 * say *"Knight moved to c3, 3 of 8 legal moves remaining"*. Reach it from
	 * React with `useDragDropAnnounce()`.
	 *
	 * A no-op when `announce: false`, and before the backend is set up — the
	 * live region lives exactly as long as the backend does, so that it is torn
	 * down with it rather than left in the document.
	 *
	 * dnd-core sets a backend up when the first drag source or drop target
	 * registers, so in practice this is live for as long as the tree has any
	 * drag and drop in it. Callers never have to check either way.
	 */
	public announce(message: string): void {
		this.announcer?.announce(message)
	}

	public setup(): void {
		const root = this.options.rootElement
		if (!root?.addEventListener || this.isSetUp) {
			return
		}
		// Capture, so that a drag in progress claims the arrow and escape keys
		// before the application's own handlers scroll a list or close a dialog.
		root.addEventListener('keydown', this.handleKeyDown as EventListener, true)
		this.isSetUp = true
		this.ensureAnnouncer()
	}

	public teardown(): void {
		const root = this.options.rootElement
		if (this.draggingSourceId !== null) {
			this.cancelDrag({ announce: false })
		}
		root?.removeEventListener?.(
			'keydown',
			this.handleKeyDown as EventListener,
			true,
		)
		this.isSetUp = false

		for (const [sourceId, entry] of this.sources) {
			this.restoreAttributes(entry)
			this.sources.delete(sourceId)
		}
		this.targets.clear()
		this.announcer?.destroy()
		this.announcer = null
	}

	public connectDragSource(sourceId: string, node: HTMLElement): Unsubscribe {
		const entry: SourceEntry = { node, restore: new Map() }
		this.sources.set(sourceId, entry)
		this.ensureAnnouncer()
		this.applyAttributes(entry)

		return (): void => {
			if (this.draggingSourceId === sourceId) {
				// The element being dragged went away. Ending the drag is the only
				// safe move; leaving it live would strand dnd-core mid-operation.
				this.cancelDrag()
			}
			this.restoreAttributes(entry)
			this.sources.delete(sourceId)
		}
	}

	public connectDropTarget(targetId: string, node: HTMLElement): Unsubscribe {
		this.targets.set(targetId, node)

		return (): void => {
			this.targets.delete(targetId)
			if (this.hoveredTargetId === targetId) {
				this.hoveredTargetId = null
			}
		}
	}

	/**
	 * Nothing to connect: a keyboard drag has no drag image, and the custom
	 * drag-layer path reads offsets from the monitor, which this backend
	 * publishes from the source's own bounding box.
	 */
	public connectDragPreview(): Unsubscribe {
		return (): void => {
			/* no-op */
		}
	}

	private ensureAnnouncer(): void {
		if (this.announcer || !this.options.announce) {
			return
		}
		const doc = this.document
		if (!doc?.body) {
			return
		}
		this.announcer = new Announcer(doc, this.options.announcements.instructions)
	}

	// -------------------------------------------------------------------------
	// DOM attributes
	// -------------------------------------------------------------------------

	private applyAttributes(entry: SourceEntry): void {
		const apply = this.options.ariaAttributes
		const { node } = entry
		const tagName = node.tagName.toUpperCase()

		if (
			apply.tabIndex &&
			!node.hasAttribute('tabindex') &&
			!NATIVELY_INTERACTIVE.has(tagName)
		) {
			this.setAttribute(entry, 'tabindex', '0')
		}
		if (
			apply.role &&
			!node.hasAttribute('role') &&
			!NATIVELY_INTERACTIVE.has(tagName)
		) {
			// `group` rather than `button` when the source wraps controls of its
			// own. Dropping the role entirely is not an option: `aria-roledescription`
			// is only exposed on an element that has a role, so a bare `div` would
			// silently lose "draggable item" as well.
			this.setAttribute(
				entry,
				'role',
				node.querySelector(INTERACTIVE_DESCENDANTS) ? 'group' : 'button',
			)
		}
		if (apply.roleDescription && !node.hasAttribute('aria-roledescription')) {
			this.setAttribute(entry, 'aria-roledescription', 'draggable item')
		}

		const instructionsId = this.announcer?.instructionsId
		if (apply.describedBy && instructionsId) {
			const existing = node.getAttribute('aria-describedby')
			if (!existing?.split(/\s+/).includes(instructionsId)) {
				this.setAttribute(
					entry,
					'aria-describedby',
					existing ? `${existing} ${instructionsId}` : instructionsId,
				)
			}
		}
	}

	private setAttribute(
		entry: SourceEntry,
		name: ManagedAttribute,
		value: string,
	): void {
		if (!entry.restore.has(name)) {
			entry.restore.set(name, entry.node.getAttribute(name))
		}
		entry.node.setAttribute(name, value)
	}

	private restoreAttributes(entry: SourceEntry): void {
		for (const [name, previous] of entry.restore) {
			if (previous === null) {
				entry.node.removeAttribute(name)
			} else {
				entry.node.setAttribute(name, previous)
			}
		}
		entry.restore.clear()
	}

	// -------------------------------------------------------------------------
	// Key handling
	// -------------------------------------------------------------------------

	private handleKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented) {
			return
		}
		// A chord is someone else's shortcut, not a drag instruction.
		if (event.metaKey || event.ctrlKey || event.altKey) {
			return
		}

		if (this.draggingSourceId !== null) {
			this.handleKeyDownWhileDragging(event)
			return
		}

		if (!LIFT_KEYS.has(event.key)) {
			return
		}
		const sourceId = this.findSourceFor(event.target)
		if (sourceId === null || this.isTextEntry(event.target)) {
			return
		}
		if (this.beginDrag(sourceId)) {
			event.preventDefault()
		}
	}

	private handleKeyDownWhileDragging(event: KeyboardEvent): void {
		if (event.key === 'Escape' || event.key === 'Esc') {
			event.preventDefault()
			this.cancelDrag()
			return
		}
		if (LIFT_KEYS.has(event.key)) {
			event.preventDefault()
			this.dropOnHoveredTarget()
			return
		}
		const direction = ARROW_DIRECTIONS[event.key]
		if (direction) {
			event.preventDefault()
			this.move(direction)
			return
		}
		if (event.key === 'Tab') {
			// Tabbing away would leave a drag running with no way to steer it. The
			// interaction owns focus until it is dropped or cancelled.
			event.preventDefault()
		}
	}

	private findSourceFor(eventTarget: EventTarget | null): string | null {
		if (!eventTarget) {
			return null
		}
		for (const [sourceId, entry] of this.sources) {
			if (
				entry.node === eventTarget ||
				entry.node.contains(eventTarget as Node)
			) {
				return sourceId
			}
		}
		return null
	}

	private isTextEntry(eventTarget: EventTarget | null): boolean {
		const element = eventTarget as HTMLElement | null
		if (!element?.tagName) {
			return false
		}
		return (
			TEXT_ENTRY.has(element.tagName.toUpperCase()) || element.isContentEditable
		)
	}

	// -------------------------------------------------------------------------
	// The drag itself
	// -------------------------------------------------------------------------

	private beginDrag(sourceId: string): boolean {
		const entry = this.sources.get(sourceId)
		if (!entry || !this.monitor.canDragSource(sourceId)) {
			return false
		}

		this.actions.beginDrag([sourceId], {
			publishSource: true,
			clientOffset: centerOf(entry.node),
			getSourceClientOffset: this.getSourceClientOffset,
		})
		if (!this.monitor.isDragging()) {
			return false
		}
		this.draggingSourceId = sourceId
		this.hoveredTargetId = null

		const candidates = this.eligibleTargets()
		if (candidates.length === 0) {
			// Nothing accepts it. Say so and unwind, rather than leaving the user
			// in a drag with no way forward.
			this.announceEvent('noTargets', candidates)
			this.endDrag()
			return true
		}

		const initial = initialCandidate(candidates, entry.node)
		if (initial) {
			this.hoverOn(initial)
		}
		this.announceEvent('pickUp', candidates)
		return true
	}

	private move(direction: NavigationDirection): void {
		const candidates = this.eligibleTargets()
		// Looked up among the candidates rather than remembered, so that a target
		// which stopped accepting the item mid-drag is treated as "nowhere" and
		// navigation re-enters the list from the end the key points at.
		const current =
			candidates.find((c) => c.targetId === this.hoveredTargetId) ?? null

		const request: NavigationRequest = {
			direction,
			current,
			candidates,
			allTargets: this.mountedTargets(),
			source: this.draggingSource(),
		}

		// Before the move rather than after it, and regardless of whether the move
		// happens at all: the application's own sub-position is exactly the thing
		// a hover cannot express.
		if (this.notifyNavigate(request)) {
			return
		}

		const next = this.options.getNextTarget(request)
		if (!next || next.targetId === this.hoveredTargetId) {
			return
		}

		this.hoverOn(next)
		this.announceEvent('move', candidates)
	}

	/** @returns whether the application took the key press for itself. */
	private notifyNavigate(request: NavigationRequest): boolean {
		const onNavigate = this.options.onNavigate
		if (!onNavigate) {
			return false
		}
		let prevented = false
		onNavigate({
			...request,
			preventDefault: () => {
				prevented = true
			},
		})
		return prevented
	}

	private hoverOn(candidate: NavigationCandidate): void {
		this.hoveredTargetId = candidate.targetId
		this.actions.hover([candidate.targetId], {
			clientOffset: centerOf(candidate.node),
		})
	}

	private dropOnHoveredTarget(): void {
		const targetId = this.hoveredTargetId
		const candidates = this.eligibleTargets()
		// Eligibility, not just `canDropOnTarget`: the hovered target may have
		// been unmounted since it was hovered, and dnd-core would still happily
		// drop on it because it is registered until the next microtask.
		const isEligible = candidates.some((c) => c.targetId === targetId)
		if (!targetId || !isEligible) {
			this.announceEvent('cannotDrop', candidates)
			return
		}

		this.actions.drop()
		// Read while the operation is still open; `endDrag` clears the result.
		const dropResult = this.monitor.getDropResult()
		this.announceEvent('drop', candidates, dropResult)
		this.endDrag()
	}

	private cancelDrag({ announce = true } = {}): void {
		const candidates = this.eligibleTargets()
		if (this.monitor.isDragging()) {
			// Clear the hover first so `isOver` collectors settle before the drag
			// disappears out from under them.
			this.actions.hover([])
		}
		if (announce) {
			this.announceEvent('cancel', candidates)
		}
		this.endDrag()
	}

	private endDrag(): void {
		if (this.monitor.isDragging()) {
			this.actions.endDrag()
		}
		this.draggingSourceId = null
		this.hoveredTargetId = null
	}

	/** Connected targets still in the document, in document order. */
	private mountedTargets(): NavigationCandidate[] {
		const doc = this.document
		const mounted: NavigationCandidate[] = []
		for (const [targetId, node] of this.targets) {
			if (doc && !doc.contains(node)) {
				continue
			}
			mounted.push({ targetId, node })
		}
		return sortByDocumentOrder(mounted)
	}

	/** Of those, the ones that accept the dragged item right now. */
	private eligibleTargets(): NavigationCandidate[] {
		return this.mountedTargets().filter(({ targetId }) =>
			this.monitor.canDropOnTarget(targetId),
		)
	}

	private draggingSource(): HTMLElement | null {
		return this.draggingSourceId
			? (this.sources.get(this.draggingSourceId)?.node ?? null)
			: null
	}

	private getSourceClientOffset = (sourceId: string): XYCoord | null => {
		const node = this.sources.get(sourceId)?.node
		if (!node) {
			return null
		}
		const rect = node.getBoundingClientRect()
		return { x: rect.left, y: rect.top }
	}

	// -------------------------------------------------------------------------
	// Announcements
	// -------------------------------------------------------------------------

	private announceEvent(
		kind: SpokenAnnouncement,
		candidates: NavigationCandidate[],
		dropResult?: unknown,
	): void {
		if (!this.announcer) {
			return
		}
		this.announcer.announce(
			this.options.announcements[kind](this.context(candidates, dropResult)),
		)
	}

	private context(
		candidates: NavigationCandidate[],
		dropResult?: unknown,
	): AnnouncementContext {
		const describe = this.options.describeNode
		const sourceNode = this.draggingSource()
		const index = candidates.findIndex(
			(c) => c.targetId === this.hoveredTargetId,
		)
		const hovered =
			index === -1 ? null : (candidates[index] as NavigationCandidate)

		return {
			item: this.monitor.getItem(),
			itemType: this.monitor.getItemType() as Identifier | null,
			source: sourceNode ? describe(sourceNode) : 'item',
			target: hovered ? describe(hovered.node) : null,
			targetIndex: index + 1,
			targetCount: candidates.length,
			dropResult,
		}
	}
}

function centerOf(node: HTMLElement): XYCoord {
	const rect = node.getBoundingClientRect()
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}
