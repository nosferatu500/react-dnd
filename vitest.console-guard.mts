import { afterEach, beforeEach } from 'vitest'

/**
 * Fails any test that makes React complain.
 *
 * A stray `act()` warning or a deprecation notice is a real defect in a library
 * that lives inside effects and refs, so it should stop the build rather than
 * scroll past in the log.
 *
 * This used to be Vitest's `onConsoleLog` hook throwing on a match. It never
 * worked: the throw happens inside Vitest's log handler, not inside the test,
 * so the message was printed and the run still exited green. That was how
 * "Accessing element.ref was removed in React 19" went unnoticed on every
 * element-form connector call.
 *
 * Collected during the test and thrown from `afterEach` rather than thrown from
 * `console.error` itself: React calls `console.error` from inside render, and
 * throwing there surfaces as a confusing render failure instead of the warning
 * that actually happened.
 */
const REACT_COMPLAINT = new RegExp(
	[
		'not wrapped in act',
		// The React 18 and earlier prefix. React 19 dropped it, which is why
		// matching on it alone was not enough.
		'Warning:',
		'was removed in React',
		'is deprecated',
		'will be removed in',
		'Each child in a list',
		'cannot be used as a JSX component',
		'Cannot update a component',
		'Maximum update depth',
	].join('|'),
)

let captured: string[] = []
let originalError: typeof console.error
let originalWarn: typeof console.warn

function record(args: unknown[]) {
	const text = args.map((arg) => String(arg)).join(' ')
	if (REACT_COMPLAINT.test(text)) {
		captured.push(text)
	}
}

beforeEach(() => {
	captured = []
	originalError = console.error
	originalWarn = console.warn
	console.error = (...args: unknown[]) => {
		record(args)
		originalError(...args)
	}
	console.warn = (...args: unknown[]) => {
		record(args)
		originalWarn(...args)
	}
})

afterEach(() => {
	console.error = originalError
	console.warn = originalWarn
	if (captured.length > 0) {
		const messages = captured.join('\n')
		captured = []
		throw new Error(`Unexpected React warning during test:\n${messages}`)
	}
})
