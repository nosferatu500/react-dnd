---
path: '/docs/api/drag-source-monitor'
title: 'DragSourceMonitor'
---

_New to React DnD? [Read the overview](/docs/overview) before jumping into the docs._

# DragSourceMonitor

`DragSourceMonitor` is an object passed to a collecting function of a [dragging source](/docs/api/use-drag). Its methods let you get information about the drag state of a specific drag source. The specific drag source bound to that monitor is called the monitor's _owner_ below.

### Methods

- **`canDrag()`**: Returns `true` if no drag operation is in progress, and the owner's `canDrag()` returns `true` or is not defined.

- **`isDragging()`**: Returns `true` if a drag operation is in progress, and either the owner initiated the drag, or its `isDragging()` is defined and returns `true`.

- **`getItemType()`**: Returns a string or a symbol identifying the type of the current dragged item. Returns `null` if no item is being dragged.

- **`getItem()`**: Returns a plain object representing the currently dragged item, or `null` if no item is being dragged — the return type is `T | null`, so narrow it before use. Every drag source specifies the item through `spec.item` on [`useDrag`](/docs/api/use-drag). Inside `drop`, `hover`, `canDrop` and `end` the item is passed to you as an argument instead, and is never null there.

- **`getDropResult()`**: Returns a plain object representing the last recorded drop result. The drop targets may optionally specify it by returning an object from their `drop()` methods. When a chain of `drop()` is dispatched for the nested targets, bottom up, any parent that explicitly returns its own result from `drop()` overrides the child drop result previously set by the child. Returns `null` if called outside `endDrag()`.

- **`didDrop()`** Returns `true` if some drop target has handled the drop event, `false` otherwise. Even if a target did not return a drop result, `didDrop()` returns `true`. Use it inside `endDrag()` to test whether any drop target has handled the drop. Returns `false` if called outside `endDrag()`.

- **`isSettling()`**: Returns `true` while a drop of **this source's** item is still waiting on the promise the target's `drop` handler returned. The drag is already over by then, so this is the later phase — and it is usually the source that wants to render "saving…", because a drop commonly unmounts the target it landed on, leaving the source as the only party still around. See [async drops](/docs/api/use-drop#asynchronous-drops).

- **`getDropError()`**: Returns the reason the last asynchronous drop rejected, or `null`. The rejection is also handed to `reportError`, so this is for rendering a retry rather than for making sure the failure is noticed.

- **`getInitialClientOffset()`**: Returns the `{ x, y }` client offset of the pointer at the time when the current drag operation has started. Returns `null` if no item is being dragged.

- **`getInitialSourceClientOffset()`**: Returns the `{ x, y }` client offset of the drag source component's root DOM node at the time when the current drag operation has started. Returns `null` if no item is being dragged.

- **`getClientOffset()`**: Returns the last recorded `{ x, y }` client offset of the pointer while a drag operation is in progress. Returns `null` if no item is being dragged.

- **`getDifferenceFromInitialOffset()`**: Returns the `{ x, y }` difference between the last recorded client offset of the pointer and the client offset when the current drag operation has started. Returns `null` if no item is being dragged.

- **`getSourceClientOffset()`**: Returns the projected `{ x, y }` client offset of the drag source component's root DOM node, based on its position at the time when the current drag operation has started, and the movement difference. Returns `null` if no item is being dragged.
