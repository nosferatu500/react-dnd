import type { TaskFn } from './types.js'

/**
 * Calls a task as soon as possible after returning, in its own microtask.
 *
 * @deprecated Use the platform's `queueMicrotask` directly. This package exists
 * only because it predates it, and `dnd-core` no longer depends on it.
 *
 * The previous implementation was ~300 lines: a hand-rolled task queue driven by
 * `MutationObserver` (with `setTimeout` and `MessageChannel` fallbacks), written
 * around 2014 when no standard microtask scheduler existed. `queueMicrotask`
 * shipped in every browser by 2018 and in Node 11, and provides the same two
 * guarantees this package was built for:
 *
 * - the task runs in its own turn, before the next macrotask
 * - a task that throws is reported as an uncaught error without preventing the
 *   remaining queued tasks from running
 */
export function asap(task: TaskFn): void {
	queueMicrotask(task)
}
