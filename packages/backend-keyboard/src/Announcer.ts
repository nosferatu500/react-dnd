import type { Announcements } from './interfaces.js'

/**
 * Off-screen but still rendered. `display: none` and `hidden` remove the node
 * from the accessibility tree entirely, which would silence the live region and
 * break `aria-describedby`; this clip-based recipe is the standard way to keep
 * text available to assistive technology and nowhere else.
 */
const VISUALLY_HIDDEN =
	'position:fixed;top:0;left:0;width:1px;height:1px;margin:-1px;padding:0;' +
	'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;'

let nextInstanceId = 0

/**
 * Owns the two nodes screen-reader support needs: a polite live region that
 * narrates the drag, and a static block of instructions that every drag source
 * points at with `aria-describedby`.
 */
export class Announcer {
	public readonly instructionsId: string
	private region: HTMLElement | null = null
	private instructions: HTMLElement | null = null

	public constructor(doc: Document, instructionsText: string) {
		this.instructionsId = `react-dnd-keyboard-instructions-${nextInstanceId++}`

		const instructions = doc.createElement('div')
		instructions.id = this.instructionsId
		instructions.setAttribute('style', VISUALLY_HIDDEN)
		instructions.textContent = instructionsText
		this.instructions = instructions

		const region = doc.createElement('div')
		region.setAttribute('role', 'status')
		region.setAttribute('aria-live', 'polite')
		region.setAttribute('aria-atomic', 'true')
		region.setAttribute('style', VISUALLY_HIDDEN)
		this.region = region

		doc.body?.append(instructions, region)
	}

	public announce(message: string): void {
		if (!this.region || !message) {
			return
		}
		// Rewriting identical text is not an announcement — the region has not
		// changed, so nothing is spoken. Clear first to force a fresh one.
		if (this.region.textContent === message) {
			this.region.textContent = ''
		}
		this.region.textContent = message
	}

	/** For tests and debugging: what was last announced. */
	public get lastMessage(): string {
		return this.region?.textContent ?? ''
	}

	public destroy(): void {
		this.region?.remove()
		this.instructions?.remove()
		this.region = null
		this.instructions = null
	}
}

export const defaultAnnouncements: Announcements = {
	instructions:
		'Press space or enter to pick up. While dragging, use the arrow keys to ' +
		'choose a drop target, space or enter to drop, and escape to cancel.',

	pickUp: ({ source, target, targetIndex, targetCount }) =>
		target
			? `Picked up ${source}. Over ${target}, ${targetIndex} of ${targetCount}. ` +
				'Use the arrow keys to move, space to drop, escape to cancel.'
			: `Picked up ${source}. Use the arrow keys to move, space to drop, escape to cancel.`,

	move: ({ target, targetIndex, targetCount }) =>
		target
			? `Over ${target}, ${targetIndex} of ${targetCount}.`
			: 'No drop target.',

	drop: ({ source, target }) =>
		target ? `Dropped ${source} on ${target}.` : `Dropped ${source}.`,

	cancel: ({ source }) => `Cancelled. ${source} returned to where it started.`,

	noTargets: ({ source }) =>
		`Cannot drag ${source}. No drop targets accept it.`,

	cannotDrop: ({ source, target }) =>
		`Cannot drop ${source} on ${target ?? 'this target'}.`,
}
