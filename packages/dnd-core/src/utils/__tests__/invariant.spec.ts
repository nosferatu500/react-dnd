/**
 * `invariant` shipped as its own package for years with no tests at all, which
 * is a lot of trust for something whose behavior changes with `NODE_ENV` and
 * whose whole job is to be believable when it throws.
 */
import { invariant } from '../invariant.js'

describe('invariant', () => {
	const realEnv = process.env['NODE_ENV']

	afterEach(() => {
		process.env['NODE_ENV'] = realEnv
	})

	it('does nothing when the condition holds', () => {
		expect(() => invariant(true, 'nope')).not.toThrow()
		expect(() => invariant(1, 'nope')).not.toThrow()
		expect(() => invariant('yes', 'nope')).not.toThrow()
	})

	it('throws for every falsy condition, not just false', () => {
		for (const falsy of [false, 0, '', null, undefined, Number.NaN]) {
			expect(() => invariant(falsy, 'boom')).toThrow('boom')
		}
	})

	it('names the error so it is recognisable in a stack trace', () => {
		try {
			invariant(false, 'boom')
			expect.unreachable()
		} catch (error) {
			expect((error as Error).name).toBe('Invariant Violation')
		}
	})

	it('interpolates %s in order', () => {
		expect(() => invariant(false, 'expected %s, got %s', 'a', 'b')).toThrow(
			'expected a, got b',
		)
	})

	it('leaves a stray %s alone when no argument was passed for it', () => {
		expect(() => invariant(false, 'expected %s')).toThrow('expected undefined')
	})

	it('hides its own frame so the caller is what you see first', () => {
		try {
			invariant(false, 'boom')
			expect.unreachable()
		} catch (error) {
			expect((error as { framesToPop?: number }).framesToPop).toBe(1)
		}
	})

	it('still throws in production, with the message stripped', () => {
		// The point of the pattern: the check must not be compiled out, or
		// production takes code paths development never does. Only the text goes.
		process.env['NODE_ENV'] = 'production'

		expect(() => invariant(true, undefined as unknown as string)).toThrow(
			'invariant requires an error message argument',
		)
		expect(() => invariant(false, 'boom')).toThrow('boom')
	})

	it('explains itself when a minified build lost the message', () => {
		expect(() => invariant(false, undefined as unknown as string)).toThrow(
			/Minified exception occurred/,
		)
	})
})
