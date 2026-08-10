import type { DragDropManager } from '@nosferatu500/dnd-core'
import type { ITestBackend } from '@nosferatu500/react-dnd-test-backend'
import { TestBackend } from '@nosferatu500/react-dnd-test-backend'
import { act, render } from '@testing-library/react'
import type { FC } from 'react'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'

import { DndProvider } from '../../core/index.js'
import { useDrag } from '../useDrag/index.js'
import { useDragDropManager } from '../useDragDropManager.js'

/**
 * Regression tests for React 18+ StrictMode, which mounts effects, tears them
 * down, then mounts them again. Anything that registers on first mount and does
 * not re-register is silently lost — the failure mode behind upstream
 * react-dnd/react-dnd#3452 (`useDrag` preview ref) and the sibling-provider
 * reports #3119 / #3178.
 *
 * Note the whole main suite already runs with `reactStrictMode: true` (see
 * vitest.setup.mts); these tests pin the specific behaviors.
 */
describe('StrictMode double-mount', () => {
	let backend: ITestBackend | undefined
	let handlerId: string | null = null
	let previewNode: Element | null = null
	let seenManager: DragDropManager | undefined

	const Draggable: FC = () => {
		const [{ isDragging, id }, drag, preview] = useDrag(() => ({
			type: 'BOX',
			item: { id: 1 },
			collect: (m) => ({
				isDragging: m.isDragging(),
				id: m.getHandlerId(),
			}),
		}))
		handlerId = id == null ? null : String(id)
		seenManager = useDragDropManager()
		return (
			<div>
				<div
					data-testid="preview"
					ref={(node) => {
						previewNode = node
						preview(node)
					}}
				/>
				<div data-testid="source" data-dragging={isDragging} ref={drag} />
			</div>
		)
	}

	function mount() {
		backend = undefined
		handlerId = null
		previewNode = null
		seenManager = undefined
		return render(
			<StrictMode>
				<DndProvider
					backend={TestBackend}
					options={{
						onCreate(be: ITestBackend) {
							backend = be
						},
					}}
				>
					<Draggable />
				</DndProvider>
			</StrictMode>,
		)
	}

	it('leaves the drag source registered and collecting after the remount', () => {
		const r = mount()
		expect(handlerId).toBeTruthy()

		// If the post-remount subscription were lost, `isDragging` would stay
		// false here even though the manager reports a drag in progress.
		act(() => {
			backend?.simulateBeginDrag([handlerId!])
		})
		expect(r.getByTestId('source').dataset['dragging']).toBe('true')

		act(() => {
			backend?.simulateEndDrag()
		})
		expect(r.getByTestId('source').dataset['dragging']).toBe('false')
	})

	it('leaves the drag preview connected after the remount (#3452)', () => {
		mount()
		// StrictMode's teardown/setup cycle must end with the preview attached to
		// the live node, not to the one from the discarded first mount.
		expect(previewNode).toBeInstanceOf(HTMLElement)
		expect(previewNode?.isConnected).toBe(true)
	})

	it('shares one manager between providers mounted in sequence (#3119, #3178)', () => {
		// The global-singleton refcount used to be decremented to zero by
		// StrictMode's teardown, which nulled the shared slot. The next provider
		// then built a *second* manager, so drags could not cross between the two
		// trees. Compare manager identity across two sequential mounts.
		const first = mount()
		const firstManager = seenManager
		expect(firstManager).toBeDefined()

		const second = mount()
		expect(seenManager).toBe(firstManager)

		first.unmount()
		second.unmount()
	})
})
