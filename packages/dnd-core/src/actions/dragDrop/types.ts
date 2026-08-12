export const INIT_COORDS = 'dnd-core/INIT_COORDS'
export const BEGIN_DRAG = 'dnd-core/BEGIN_DRAG'
export const PUBLISH_DRAG_SOURCE = 'dnd-core/PUBLISH_DRAG_SOURCE'
export const HOVER = 'dnd-core/HOVER'
export const DROP = 'dnd-core/DROP'
/** A drop handler returned a promise; its result is not known yet. */
export const DROP_PENDING = 'dnd-core/DROP_PENDING'
/** That promise resolved or rejected. Dispatched after the drag has ended. */
export const DROP_SETTLED = 'dnd-core/DROP_SETTLED'
export const END_DRAG = 'dnd-core/END_DRAG'
