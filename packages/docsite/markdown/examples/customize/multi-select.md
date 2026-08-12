---
path: '/examples/customize/multi-select'
title: 'Multi-Select Drag'
---

Dragging several items at once. Click rows to select them, then drag any
selected row — the whole selection comes with it. Dragging an unselected row
drags just that one, the way a file manager behaves.

There is no multi-drag API to learn. A drag carries whatever object the source's
`item` returns, so carrying *several* ids is only a different object:

```jsx
item: () => ({ ids: selected.includes(id) ? selected : [id] })
```

Two things make it work as a user expects, and both are existing API:

**Every selected row has to look like it is moving.** By default only the row
you grabbed reports `isDragging`, because dnd-core scopes it to the source that
started the drag. A custom `isDragging` widens it to the whole dragged set:

```jsx
isDragging: (monitor) => monitor.getItem()?.ids.includes(id) ?? false
```

**The preview has to say how many.** The browser's drag image is a picture of
the single element the drag started from — `setDragImage` takes one node — so
"3 items" cannot be expressed that way. A
[drag layer](/docs/api/use-drag-layer) is the only place to draw it, and it
already receives the item:

```jsx
const { item, isDragging, offset } = useDragLayer((monitor) => ({
  item: monitor.getItem(),
  isDragging: monitor.isDragging(),
  offset: monitor.getClientOffset(),
}))
```

The drop target needs nothing special — `drop(item)` receives the object the
source built, ids and all.

<view-source name="05-customize/multi-select" component="customize-multi-select">
</view-source>
