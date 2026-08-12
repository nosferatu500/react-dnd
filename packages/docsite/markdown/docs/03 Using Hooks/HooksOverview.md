---
path: '/docs/api/hooks-overview'
title: 'Overview'
---

_New to React DnD? [Read the overview](/docs/overview) before jumping into the docs._

# Using the Hooks API

Drag-and-drop interactions are inherently _stateful_. Because of this React DnD has been designed to take advantage of the Flux data pattern and model drag-and-drop state using actions and reducers (independent of React). Hooks are the perfect way to utilize a stateful data source in React. In fact, this is the approach taken by many state-management libraries in React!

There are three primary hooks that are provided to wire your components into React DnD, and a fourth is provided to give you a seam into React DnD (for testing or development purposes)

- [`useDrag`](/docs/api/use-drag)
- [`useDrop`](/docs/api/use-drop)
- [`useDragLayer`](/docs/api/use-drag-layer)
- [`useDragDropManager`](/docs/api/use-drag-drop-manager) (_dev/test hook_)

## Basic Example

To start using hooks, let's make a box draggable.

```jsx
import { useDrag } from '@nosferatu500/react-dnd'

function Box() {
  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
		// "type" is required. It is used by the "accept" specification of drop targets.
    type: 'BOX',
		// The collect function utilizes a "monitor" instance (see the Overview for what this is)
		// to pull important pieces of state from the DnD system.
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }))

  return (
    {/* This is optional. The dragPreview will be attached to the dragSource by default */}
    <div ref={dragPreview} style={{ opacity: isDragging ? 0.5 : 1}}>
        {/* The drag ref marks this node as being the "pick-up" node */}
        <div role="Handle" ref={drag} />
    </div>
  )
}
```

Now, let's make something for this to drag into.

```jsx
function Bucket() {
  const [{ canDrop, isOver }, drop] = useDrop(() => ({
    // The type (or types) to accept - strings or symbols
    accept: 'BOX',
    // Props to collect
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  }))

  return (
    <div
      ref={drop}
      role={'Dustbin'}
      style={{ backgroundColor: isOver ? 'red' : 'white' }}
    >
      {canDrop ? 'Release to drop' : 'Drag a box here'}
    </div>
  )
}
```

To explore further, read the individual hook API documentation, or check out the [examples](https://github.com/react-dnd/react-dnd/tree/main/packages/examples) on GitHub.

## A reported hazard with React Compiler

**Status: reported by a consumer, not reproduced here.** It is recorded because
it cost somebody a shipped crash, not because this project has confirmed it.

`useDrag` and `useDrop` accept a *factory* — `useDrag(() => spec, deps)` — which
invites the spec to close over whatever is in scope. A consumer reported that
when such a closure captures the parameters of an enclosing HOC factory, React
Compiler outlines it incorrectly and the result crashes at runtime.

Attempts to reproduce a compiler mis-outlining against this codebase did not
succeed, and if the report is accurate the defect belongs to
[facebook/react](https://github.com/facebook/react/issues) rather than to this
library — there is nothing in `useDrag`/`useDrop` that could be changed to fix
it. It is noted here so that anyone hitting the same crash recognizes the shape
rather than starting from nothing.

If you are using React Compiler and see something like this, two things help:

- Keep the spec factory's captures small and local. Reading values straight from
  props or component-scope state, rather than from an enclosing factory's
  parameters, avoids the shape that was reported.
- Pass an explicit dependency array. The factory form defaults to `[]`, so a
  captured value that changes needs to be listed anyway.

If you can reduce it to a minimal case, please file it upstream at
`facebook/react` — that is where a fix would have to land.
