import type { DropTarget } from 'dnd-core'

import type { DropTargetMonitor } from '../../types/index.js'
import type { DropTargetHookSpec } from '../types.js'

export class DropTargetImpl<O, R, P> implements DropTarget {
	public constructor(
		public spec: DropTargetHookSpec<O, R, P>,
		private monitor: DropTargetMonitor<O, R>,
	) {}

	/**
	 * `monitor.getItem()` is nullable because `collect` can read it with no drag
	 * in progress. These three are different: dnd-core only routes `canDrop`,
	 * `hover` and `drop` to a target while a drag is open — `canDropOnTarget`
	 * returns early unless `isDragging()` — so the item is always there, and the
	 * spec callbacks can keep taking a non-null one.
	 */
	private get draggedItem(): O {
		return this.monitor.getItem() as O
	}

	public canDrop() {
		const spec = this.spec
		return spec.canDrop ? spec.canDrop(this.draggedItem, this.monitor) : true
	}

	public hover() {
		const spec = this.spec
		if (spec.hover) {
			spec.hover(this.draggedItem, this.monitor)
		}
	}

	public drop() {
		const spec = this.spec
		if (spec.drop) {
			return spec.drop(this.draggedItem, this.monitor)
		}
		return
	}
}
