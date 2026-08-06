import type { DragDropManager } from 'dnd-core'

/**
 * Minimal DragDropManager stand-in for backend construction tests.
 * Extracted from TouchBackend.spec.ts so several specs can share it.
 */
export function mockManager(): DragDropManager {
	return {
		getActions: () => null,
		getMonitor: () => null,
		getRegistry: () => null,
	} as any
}
