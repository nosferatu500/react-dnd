---
path: '/docs/backends/composing'
title: 'Composing Backends'
---

_New to React DnD? [Read the overview](/docs/overview) before jumping into the docs._

# Composing Backends

A `DndProvider` takes exactly one backend. That has meant choosing between a
mouse and a finger — an app using the [HTML5 backend](/docs/backends/html5) does
not work on a tablet, and one using the [Touch backend](/docs/backends/touch)
does not work with a mouse. `composeBackends` runs several at once.

```jsx
import { composeBackends } from '@nosferatu500/dnd-core'
import { DndProvider } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import { TouchBackend } from '@nosferatu500/react-dnd-touch-backend'

const backend = composeBackends(HTML5Backend, TouchBackend)

function App() {
  return (
    <DndProvider backend={backend}>
      {/* ... */}
    </DndProvider>
  )
}
```

Nothing else changes. `useDrag` and `useDrop` are untouched, every backend
connects to the same DOM nodes, and one unsubscribe undoes all of them.

Build the composed backend **outside** your component, or memoize it. Creating a
new one on every render tears the whole thing down and rebuilds it.

### Options

Each backend is handed the provider's `context` and `options`, so options
meaningful to only one of them can be passed straight through:

```jsx
<DndProvider backend={backend} options={{ rootElement: myRoot }}>
```

When two backends need *different* values for the same option, wrap one in a
factory of your own:

```jsx
const touch = (manager, context, options) =>
  TouchBackend(manager, context, { ...options, delayTouchStart: 200 })

const backend = composeBackends(HTML5Backend, touch)
```

### Choose backends that respond to different gestures

**Nothing arbitrates a gesture between backends.** Each one sees the events it
listens for and decides on its own whether to start a drag, so composing two
that answer the *same* gesture means both will try.

The default pairing is safe: the HTML5 backend starts on `dragstart`, the Touch
backend on `touchstart`, and those never overlap. The combination to avoid is
`TouchBackend`'s `enableMouseEvents`, which makes it listen for `mousedown`
as well — with the HTML5 backend alongside it, a single mouse press reaches
both. If you need mouse support, that is what the HTML5 backend is already
doing.

### Setup and teardown

Backends are set up in the order given and torn down in reverse. If one throws
while setting up, the ones already started are torn back down before the error
propagates — both the HTML5 and Touch backends refuse to be set up twice on the
same root, so a half-composed provider would otherwise refuse every later mount
with *"Cannot have two … backends at the same time."*

`profile()` merges every backend's counters, **summing** keys they share. Two
backends connected to one drag source report `sourceNodes: 2`; that is the total
across backends, not a count of nodes.

### Keyboard support

[`withKeyboard`](/docs/backends/keyboard) is a special case of this, and you can
keep using it:

```jsx
import { withKeyboard } from '@nosferatu500/react-dnd-keyboard-backend'

const backend = withKeyboard(HTML5Backend)
```

To combine all three, compose first and add the keyboard last:

```jsx
const backend = withKeyboard(composeBackends(HTML5Backend, TouchBackend))
```

`CompositeBackend`, the class behind all of this, is exported from
`@nosferatu500/dnd-core` — and still re-exported from the keyboard package,
where it used to live. Prefer `composeBackends` to constructing it directly.
