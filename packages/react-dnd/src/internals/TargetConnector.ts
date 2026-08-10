import type { Backend, Identifier, Unsubscribe } from '@nosferatu500/dnd-core'
import equal from 'fast-deep-equal'
import type { RefObject } from 'react'

import type { DropTargetOptions } from '../types/index.js'
import { isRef } from './isRef.js'
import type { Connector } from './SourceConnector.js'
import { wrapConnectorHooks } from './wrapConnectorHooks.js'

export class TargetConnector implements Connector {
	public hooks = wrapConnectorHooks({
		dropTarget: (node: any, options?: DropTargetOptions) => {
			this.clearDropTarget()
			// See SourceConnector: a ref attachment carries no options, and must
			// not be read as clearing them.
			if (options !== undefined) {
				this.dropTargetOptions = options ?? null
			}
			if (isRef(node)) {
				this.dropTargetRef = node
			} else {
				this.dropTargetNode = node
			}
			this.reconnect()
		},
	})

	private handlerId: Identifier | null = null
	// The drop target may either be attached via ref or connect function
	private dropTargetRef: RefObject<any> | null = null
	private dropTargetNode: any
	private dropTargetOptionsInternal: DropTargetOptions | null = null
	private unsubscribeDropTarget: Unsubscribe | undefined

	private lastConnectedHandlerId: Identifier | null = null
	private lastConnectedDropTarget: any = null
	private lastConnectedDropTargetOptions: DropTargetOptions | null = null
	private readonly backend: Backend

	public constructor(backend: Backend) {
		this.backend = backend
	}

	public get connectTarget(): any {
		return this.dropTarget
	}

	public reconnect(): void {
		// if nothing has changed then don't resubscribe
		const didChange =
			this.didHandlerIdChange() ||
			this.didDropTargetChange() ||
			this.didOptionsChange()

		if (didChange) {
			this.disconnectDropTarget()
		}

		const dropTarget = this.dropTarget
		if (!this.handlerId) {
			return
		}
		if (!dropTarget) {
			this.lastConnectedDropTarget = dropTarget
			return
		}

		if (didChange) {
			this.lastConnectedHandlerId = this.handlerId
			this.lastConnectedDropTarget = dropTarget
			this.lastConnectedDropTargetOptions = this.dropTargetOptions

			this.unsubscribeDropTarget = this.backend.connectDropTarget(
				this.handlerId,
				dropTarget,
				this.dropTargetOptions,
			)
		}
	}

	public receiveHandlerId(newHandlerId: Identifier | null): void {
		if (newHandlerId === this.handlerId) {
			return
		}

		this.handlerId = newHandlerId
		this.reconnect()
	}

	public get dropTargetOptions(): DropTargetOptions | null {
		return this.dropTargetOptionsInternal
	}
	public set dropTargetOptions(options: DropTargetOptions | null) {
		this.dropTargetOptionsInternal = options
	}

	private didHandlerIdChange(): boolean {
		return this.lastConnectedHandlerId !== this.handlerId
	}

	private didDropTargetChange(): boolean {
		return this.lastConnectedDropTarget !== this.dropTarget
	}

	private didOptionsChange(): boolean {
		return !equal(this.lastConnectedDropTargetOptions, this.dropTargetOptions)
	}

	public disconnectDropTarget() {
		if (this.unsubscribeDropTarget) {
			this.unsubscribeDropTarget()
			this.unsubscribeDropTarget = undefined
		}
	}

	private get dropTarget() {
		return this.dropTargetNode || this.dropTargetRef?.current
	}

	private clearDropTarget() {
		this.dropTargetRef = null
		this.dropTargetNode = null
	}
}
