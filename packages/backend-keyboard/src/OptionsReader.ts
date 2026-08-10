import { defaultAnnouncements } from './Announcer.js'
import type {
	Announcements,
	AriaAttributeOptions,
	GetNextTarget,
	KeyboardBackendContext,
	KeyboardBackendOptions,
	OnNavigate,
} from './interfaces.js'
import { documentOrderNavigation } from './navigation.js'

/**
 * Turns `aria-label` — or failing that the element's own text — into something
 * worth speaking. Truncated because an announcement is read aloud in full, and
 * a card's entire body is not a useful thing to hear on every arrow key.
 */
export function defaultDescribeNode(node: HTMLElement): string {
	const label = node.getAttribute('aria-label')
	if (label) {
		return label
	}
	const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
	if (!text) {
		return 'item'
	}
	return text.length > 80 ? `${text.slice(0, 79)}…` : text
}

export class OptionsReader {
	private globalContext: KeyboardBackendContext | undefined
	private args: KeyboardBackendOptions

	public constructor(
		globalContext?: KeyboardBackendContext,
		options?: KeyboardBackendOptions,
	) {
		this.globalContext = globalContext
		this.args = options ?? {}
	}

	public get window(): Window | undefined {
		return (
			this.globalContext?.window ??
			(typeof window !== 'undefined' ? window : undefined)
		)
	}

	public get document(): Document | undefined {
		return this.globalContext?.document ?? this.window?.document
	}

	/**
	 * Defaults to the document rather than to an element: a drag source can be
	 * focused from anywhere, including inside a portal that is not a descendant
	 * of any app root.
	 */
	public get rootElement(): Node | undefined {
		return this.args.rootElement ?? this.document
	}

	public get getNextTarget(): GetNextTarget {
		return this.args.getNextTarget ?? documentOrderNavigation
	}

	public get onNavigate(): OnNavigate | undefined {
		return this.args.onNavigate
	}

	public get describeNode(): (node: HTMLElement) => string {
		return this.args.describeNode ?? defaultDescribeNode
	}

	/**
	 * Resolved per attribute, so the caller never has to handle the boolean and
	 * the object forms separately. Anything unstated is on.
	 */
	public get ariaAttributes(): Required<AriaAttributeOptions> {
		const option = this.args.applyAriaAttributes ?? true
		if (typeof option === 'boolean') {
			return {
				tabIndex: option,
				role: option,
				roleDescription: option,
				describedBy: option,
			}
		}
		return {
			tabIndex: option.tabIndex ?? true,
			role: option.role ?? true,
			roleDescription: option.roleDescription ?? true,
			describedBy: option.describedBy ?? true,
		}
	}

	public get announce(): boolean {
		return this.args.announce ?? true
	}

	public get announcements(): Announcements {
		return { ...defaultAnnouncements, ...this.args.announcements }
	}
}
