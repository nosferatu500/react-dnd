---
path: '/docs/api/use-drop'
title: 'useDrop'
---

<!--alex disable hook -->

_New to React DnD? [Read the overview](/docs/overview) before jumping into the docs._

# useDrop

The `useDrop` hook provides a way for you to wire in your component into the DnD system as a _drop target_. By passing in a specification into the `useDrop` hook, you can specify including what types of data items the drop-target will `accept`, what props to `collect`, and more. This function returns an array containing a ref to attach to the Drop Target node and the collected props.

```jsx
import { useDrop } from '@nosferatu500/react-dnd'

function myDropTarget(props) {
  const [collectedProps, drop] = useDrop(() => ({
    accept
  }))

  return <div ref={drop}>Drop Target</div>
}
```

#### Parameters

- **`spec`** A specification object or a function that creates a specification object. See below for details on the specification object
- **`deps`** A dependency array used for memoization. This behaves like the built-in `useMemo` React hook. The default value is an empty array for function spec, and an array containing the spec for an object spec.

#### Return Value Array

- **`[0] - Collected Props`**: An object containing collected properties from the collect function. If no `collect` function is defined, an empty object is returned.
- **`[1] - DropTarget Ref`**: A connector function for the drop target. This must be attached to the drop-target portion of the DOM.

### Specification Object Members

- **`accept`**: Required. A string, a symbol, or an array of either. This drop target will only react to the items produced by the [drag sources](/docs/api/drag-source) of the specified type or types. Read the [overview](/docs/overview) to learn more about the items and types.

* **`options`**: Optional. A plain object optionally containing:

  - **`dropEffect`**: Optional. What dropping on this target does: `'move'`, `'copy'`, `'link'` or `'none'`. The browser uses it to pick the cursor, and it is reported back to the drag source as `monitor.getDropResult().dropEffect`.

    This takes precedence over the drag source's own `dropEffect` and over the copy modifier, because the target is what knows what dropping *there* means — the same card dropped on "Archive" moves and dropped on "Duplicate to…" copies. It mirrors how the platform splits the two: a source constrains with `effectAllowed`, a target states `dropEffect`.

    With nested targets, only the innermost one that accepts the item is consulted.

    There is no callback form; the spec is already re-evaluated wherever you write it:

    ```jsx
    const [, drop] = useDrop(
      () => ({ accept: 'card', options: { dropEffect: locked ? 'copy' : 'move' } }),
      [locked],
    )
    ```

* **`drop(item, monitor)`**: Optional. Called when a compatible item is dropped on the target. You may return undefined, a plain object, or a **promise** of either — see [Asynchronous drops](#asynchronous-drops). If you return an object, it is going to become _the drop result_ and will be available to the drag source in its `endDrag` method as `monitor.getDropResult()`. This is useful in case you want to perform different actions depending on which target received the drop. If you have nested drop targets, you can test whether a nested target has already handled `drop` by checking `monitor.didDrop()` and `monitor.getDropResult()`. Both this method and the source's `endDrag` method are good places to fire Flux actions. This method will not be called if `canDrop()` is defined and returns `false`.

* **`hover(item, monitor)`**: Optional. Called when an item is hovered over the component. You can check `monitor.isOver({ shallow: true })` to test whether the hover happens over _only_ the current target, or over a nested one. Unlike `drop()`, this method will be called even if `canDrop()` is defined and returns `false`. You can check `monitor.canDrop()` to test whether this is the case.

* **`canDrop(item, monitor)`**: Optional. Use it to specify whether the drop target is able to accept the item. If you want to always allow it, omit this method. Specifying it is handy if you'd like to disable dropping based on some predicate over `props` or `monitor.getItem()`. _Note: You may not call `monitor.canDrop()` inside this method._

- **`collect`**: Optional. The collecting function. It should return a plain object of the props to return for injection into your component. It receives two parameters, `monitor` and `props`. Read the [overview](/docs/overview) for an introduction to the monitors and the collecting function. See the collecting function described in detail in the next section.

### Asynchronous drops

A drop that has to reach a server can return a promise. The resolved value
becomes the drop result, and `monitor.isSettling()` covers the wait:

```jsx
const [{ isSettling }, drop] = useDrop(() => ({
  accept: 'card',
  drop: async (item) => {
    await moveCard(item.id, columnId)
    return { columnId }
  },
  collect: (monitor) => ({ isSettling: monitor.isSettling() }),
}))

return <div ref={drop}>{isSettling ? 'Saving…' : children}</div>
```

**The drag ends when it always ended** — it is not held open while the promise
is in flight. For the HTML5 backend the browser's drag genuinely ends at `drop`:
no pointer capture, no more `dragover`, no cursor carrying anything. A monitor
still reporting `isDragging()` after that would be describing a drag that does
not exist, and a promise that never settled would leave the library unable to
start another drag. Settling is a separate, later phase.

| | during the drag | while settling | after |
| --- | --- | --- | --- |
| `isDragging()` | `true` | `false` | `false` |
| `didDrop()` | `false` | `true` | `true` |
| `isSettling()` | `false` | `true` | `false` |
| `getDropResult()` | `null` | `null` | the resolved value |

`isSettling()` is scoped: a drop target reports only drops on itself, so one
column saving does not put every other column into a saving state, and a drag
source reports drops of its own item. Read it from the **source** when the drop
unmounts the target it landed on, which is common — the source is then the only
party still around to render progress. `useDragLayer`'s is unscoped.

A rejection is recorded on `monitor.getDropError()` and also handed to
`reportError`, so a failed save reaches your error reporting even if nothing
renders it:

```jsx
collect: (monitor) => ({
  isSettling: monitor.isSettling(),
  error: monitor.getDropError(),
})
```

`spec.end` on the drag source is unchanged: it fires when the drag ends, not
when the drop settles, and sees `getDropResult()` as `null` for an async drop.
Use `monitor.didDrop()` to know a drop happened and `monitor.isSettling()` to
know the answer is still coming.

There is no cancellation and no `AbortSignal` — an app that needs one owns its
own promise and can wire that up itself.
