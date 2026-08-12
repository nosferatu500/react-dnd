import type { DropTargetMonitor } from '../../../types/index.js'
import { DropTargetImpl } from '../DropTargetImpl.js'

describe('The Hooks DropTargetImpl', () => {
	describe('canDrag()', () => {
		it('can determine if a item can drag', () => {
			const monitor = {
				getItem: () => ({}),
			} as DropTargetMonitor
			let impl = new DropTargetImpl({} as any, monitor)
			expect(impl.canDrop()).toEqual(true)

			impl = new DropTargetImpl(
				{
					canDrop(_item: any, mon: any) {
						expect(mon).toEqual(monitor)
						return false
					},
				} as any,
				monitor,
			)
			expect(impl.canDrop()).toEqual(false)
		})
	})

	describe('hover()', () => {
		it('will not throw if spec.hover is not defined', () => {
			const item = {}
			const monitor = {
				getItem: () => item,
			} as DropTargetMonitor

			const impl = new DropTargetImpl({} as any, monitor)
			impl.hover()
		})

		it('will invoke hover if it is defined', () => {
			const item = {}
			const monitor = {
				getItem: () => item,
			} as DropTargetMonitor

			const hover = vi.fn()
			const impl = new DropTargetImpl(
				{
					hover,
				} as any,
				monitor,
			)
			impl.hover()
			expect(hover.mock.calls.length).toEqual(1)
			expect(hover.mock.calls[0]).toEqual([item, monitor])
		})
	})

	describe('drop()', () => {
		it('will not throw if spec.drop is not defined', () => {
			const item = {}
			const monitor = {
				getItem: () => item,
			} as DropTargetMonitor

			const impl = new DropTargetImpl({} as any, monitor)
			impl.drop()
		})

		it('will invoke drop if it is defined', () => {
			const item = {}
			const monitor = {
				getItem: () => item,
			} as DropTargetMonitor

			const drop = vi.fn()
			const impl = new DropTargetImpl(
				{
					drop,
				} as any,
				monitor,
			)
			impl.drop()
			expect(drop.mock.calls.length).toEqual(1)
			expect(drop.mock.calls[0]?.slice(0, 2)).toEqual([item, monitor])
		})

		it('forwards the abort signal dnd-core hands it', () => {
			// The third argument is how an async `drop` learns it has been
			// superseded; it comes from dnd-core, which creates a controller per
			// drop before the handler runs.
			const item = {}
			const monitor = { getItem: () => item } as DropTargetMonitor
			const drop = vi.fn()
			const impl = new DropTargetImpl({ drop } as any, monitor)
			const { signal } = new AbortController()

			impl.drop(monitor, 'T1', signal)

			expect(drop.mock.calls[0]?.[2]).toBe(signal)
		})
	})
})
