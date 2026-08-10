import type { DragDropManager } from '@nosferatu500/dnd-core'
import { createContext } from 'react'

/**
 * The React context type
 */
export interface DndContextType {
	dragDropManager: DragDropManager | undefined
}

/**
 * Create the React Context
 */
export const DndContext = createContext<DndContextType>({
	dragDropManager: undefined,
})
