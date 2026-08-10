---
path: '/docs/api/drag-layer-monitor'
title: 'DragLayerMonitor'
---

_New to React DnD? [Read the overview](/docs/overview) before jumping into the docs._

# DragLayerMonitor

`DragLayerMonitor` is an object passed to a collecting function of a [drag layer](/docs/api/use-drag-layer). Its methods let you get information about the global drag state.

### Methods

- **`isDragging()`**: Returns `true` if a drag operation is in progress. Returns `false` otherwise.

- **`getItemType()`**: Returns a string or a symbol identifying the type of the current dragged item. Returns `null` if no item is being dragged.

- **`getItem()`**: Returns a plain object representing the currently dragged item, or `null` if no item is being dragged — the return type is `T | null`, so narrow it before use. Every drag source specifies the item through `spec.item` on [`useDrag`](/docs/api/use-drag). Inside `drop`, `hover`, `canDrop` and `end` the item is passed to you as an argument instead, and is never null there.

- **`getInitialClientOffset()`**: Returns the `{ x, y }` client offset of the pointer at the time when the current drag operation has started. Returns `null` if no item is being dragged.

- **`getInitialSourceClientOffset()`**: Returns the `{ x, y }` client offset of the drag source component's root DOM node at the time when the current drag operation has started. Returns `null` if no item is being dragged.

- **`getClientOffset()`**: Returns the last recorded `{ x, y }` client offset of the pointer while a drag operation is in progress. Returns `null` if no item is being dragged.

- **`getDifferenceFromInitialOffset()`**: Returns the `{ x, y }` difference between the last recorded client offset of the pointer and the client offset when current the drag operation has started. Returns `null` if no item is being dragged.

- **`getSourceClientOffset()`**: Returns the projected `{ x, y }` client offset of the drag source component's root DOM node, based on its position at the time when the current drag operation has started, and the movement difference. Returns `null` if no item is being dragged.
