/**
 * That a *typed* async drop compiles.
 *
 * The runtime supported promises before the types did: `drop` was declared
 * `=> DropResult | undefined`, so `drop: async () => ({ columnId })` was a type
 * error for anyone who had parameterised `useDrop`. It went unnoticed because
 * the tests that exercised it left `DropResult` as its `unknown` default, which
 * a promise satisfies.
 *
 * These assertions are made by `npm run check:types`, which covers specs — the
 * bodies barely matter. Same shape of defect as `getItem()` being typed `T`
 * while returning `T | null`: the runtime and the docs agreed, and the type,
 * which is what people program against, did not.
 */

import type { FC } from 'react'

import { useDrop } from '../useDrop/index.js'

interface Card {
	id: string
}

interface MoveResult {
	columnId: string
}

export const AsyncDrop: FC = () => {
	const [, drop] = useDrop<Card, MoveResult, unknown>(() => ({
		accept: 'card',
		drop: async (item) => {
			await Promise.resolve(item.id)
			return { columnId: 'done' }
		},
	}))
	return <div ref={drop} />
}

export const AsyncDropResolvingToNothing: FC = () => {
	const [, drop] = useDrop<Card, MoveResult, unknown>(() => ({
		accept: 'card',
		// A side effect and no result is the spelling that used to be swallowed.
		drop: async () => {
			await Promise.resolve()
		},
	}))
	return <div ref={drop} />
}

export const SyncDropStillCompiles: FC = () => {
	const [, drop] = useDrop<Card, MoveResult, unknown>(() => ({
		accept: 'card',
		drop: () => ({ columnId: 'done' }),
	}))
	return <div ref={drop} />
}

export const CollectsSettlingState: FC = () => {
	const [{ isSettling, error }] = useDrop<
		Card,
		MoveResult,
		{ isSettling: boolean; error: Error | null }
	>(() => ({
		accept: 'card',
		drop: async () => ({ columnId: 'done' }),
		collect: (monitor) => ({
			isSettling: monitor.isSettling(),
			error: monitor.getDropError<Error>(),
		}),
	}))
	return <div>{isSettling ? 'saving' : (error?.message ?? 'idle')}</div>
}

describe('typed async drops', () => {
	it('compile', () => {
		// The real assertion is `check:types` over this file; this keeps the suite
		// honest about the file being reachable rather than dead code.
		expect(typeof AsyncDrop).toBe('function')
		expect(typeof AsyncDropResolvingToNothing).toBe('function')
		expect(typeof SyncDropStillCompiles).toBe('function')
		expect(typeof CollectsSettlingState).toBe('function')
	})
})
