---
path: '/docs/backends/keyboard'
title: 'Keyboard Backend'
---

_New to React DnD? [Read the overview](/docs/overview) before jumping into the docs._

# Keyboard Backend

HTML5 drag and drop is inaccessible by construction: the browser exposes no
keyboard gesture for it, and nothing about a drag is announced. The
`@nosferatu500/react-dnd-keyboard-backend` package adds a keyboard interaction and a spoken
narration on top of the drag sources and drop targets you already have.

It is not an alternative to the HTML5 or Touch backends — it wraps one of them,
so pointer and keyboard both work.

### Installation

```
npm install @nosferatu500/react-dnd-keyboard-backend
```

### Usage

```jsx
import { DndProvider } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import { withKeyboard } from '@nosferatu500/react-dnd-keyboard-backend'

class YourApp {
  <DndProvider backend={withKeyboard(HTML5Backend)}>
    {/* Your application */}
  </DndProvider>
}
```

That is the whole integration. Your `useDrag` and `useDrop` calls do not change.

### The interaction

| Key                                       | Focused on a drag source     | While dragging                 |
| ----------------------------------------- | ---------------------------- | ------------------------------ |
| <kbd>Space</kbd> / <kbd>Enter</kbd>       | pick the item up             | drop it on the current target  |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> | —                  | choose a drop target           |
| <kbd>Esc</kbd>                            | —                            | cancel, changing nothing       |
| <kbd>Tab</kbd>                            | move focus as usual          | held, so a drag is not abandoned by accident |

Focus stays on the item being dragged for the whole interaction; only the hover
moves. `isOver` and `canDrop` therefore update exactly as they do under the
mouse, and your existing highlight styles keep working.

Because the drag source holds focus, **give it a visible focus style** — it is
the only thing telling a sighted keyboard user what they are carrying:

```css
[aria-roledescription='draggable item']:focus-visible {
  outline: 3px solid #4c9aff;
  outline-offset: 2px;
}
```

Key presses that are modified (<kbd>Ctrl</kbd>, <kbd>Cmd</kbd>, <kbd>Alt</kbd>),
or that land in an `<input>`, `<textarea>`, `<select>` or contenteditable, are
left to your application.

### What it writes to the DOM

On every connected drag source, and only where you have not already said
otherwise:

```html
<div
  tabindex="0"
  role="button"
  aria-roledescription="draggable item"
  aria-describedby="react-dnd-keyboard-instructions-0"
></div>
```

Attributes you set yourself are kept, and everything is restored when the source
disconnects. A single visually hidden `role="status"` `aria-live="polite"`
region narrates the drag.

The role is `group` rather than `button` when the source contains interactive
content of its own — a `button`, an `a[href]`, a form control, or anything with
a `tabindex`. That is the whole-row drag source, where the row is draggable and
also carries the row's own buttons: a `button` role's children are
presentational, so nesting controls inside one can make them unreachable.
`group` is valid as a container and still carries the `aria-roledescription`,
which is why the role is changed rather than dropped.

It is decided once, when the source connects. A source that grows its first
button later keeps the role it was given; set `role` yourself if the content
varies.

### Options

Pass them as the second argument to `withKeyboard`. The provider's own `options`
continue to go to the wrapped backend untouched.

- **getNextTarget** (default: `documentOrderNavigation`)

  How the arrow keys choose the next drop target.

  Where the hover *starts* is not up to this option. Picking an item up hovers
  the eligible target containing the drag source — the row itself when `drag`
  and `drop` share a ref, or the row a drag handle sits in — and otherwise the
  nearest one in document order. An item starts out where it already is, so
  lifting the last row of a list does not preview it at the top before you have
  pressed anything.

  `documentOrderNavigation` steps through the eligible targets in document
  order — down/right forward, up/left back — and stops at the ends rather than
  wrapping.

  `gridNavigation({ columns })` treats the targets as a row-major grid, so left
  and right move within a row and up and down move a whole row — what a board or
  a calendar wants. It measures nothing, so it behaves identically in a browser
  and under test, and it skips cells that will not accept the item: on a
  chessboard where only the legal moves accept a piece, the hover keeps
  traveling the way you asked until it reaches one that does.

  ```jsx
  import { gridNavigation, withKeyboard } from '@nosferatu500/react-dnd-keyboard-backend'

  withKeyboard(HTML5Backend, { getNextTarget: gridNavigation({ columns: 8 }) })
  ```

  `spatialNavigation()` picks the nearest eligible target in the direction of
  the arrow key, measuring with `getBoundingClientRect`. Use it when the layout
  is not a regular grid — masonry, freely positioned cards, rows of differing
  height.

  ```jsx
  import { spatialNavigation, withKeyboard } from '@nosferatu500/react-dnd-keyboard-backend'

  withKeyboard(HTML5Backend, { getNextTarget: spatialNavigation() })
  ```

  Anything else is a function of
  `{ direction, current, candidates, allTargets, source }`. `candidates` holds
  every target that accepts the item right now, in document order; `allTargets`
  holds every connected target whether it accepts or not, which is what
  layout-aware navigation needs to see the shape of the grid. Return one of the
  candidates, or `null` to stay put.

- **describeNode** (default: `aria-label`, falling back to text content)

  Turns a connected element into the text used in announcements.

- **announcements**

  Any subset of the spoken strings, for wording or localization. See
  `defaultAnnouncements` for the shape.

  ```jsx
  withKeyboard(HTML5Backend, {
    announcements: {
      drop: ({ source, target }) => `${source} moved to ${target}.`,
    },
  })
  ```

- **applyAriaAttributes** (default: true)

  Whether to make connected drag sources focusable and labelled. Turning this
  off means taking on `tabindex`, `role` and `aria-describedby` yourself — an
  element that cannot take focus cannot be picked up by keyboard at all.

- **announce** (default: true)

  Whether to create and drive the live region.

### Announcing what only your app knows

The backend narrates what it can see: an item was picked up, the hover moved,
something was dropped. It cannot narrate what a drop *meant* — that the card is
now third in the Done column, that the move was rejected, that four rows were
reordered.

`useDragDropAnnounce` returns a function that speaks through the same live
region, so your messages and the backend's queue in one place rather than in two
regions read in an order nobody controls.

```jsx
import { useDragDropAnnounce } from '@nosferatu500/react-dnd-keyboard-backend'

function Column({ title, cards }) {
  const announce = useDragDropAnnounce()

  const [, drop] = useDrop(() => ({
    accept: 'card',
    drop: (item) => {
      const position = move(item)
      announce(`${item.title} moved to ${title}, position ${position} of ${cards.length}.`)
    },
  }))

  return <div ref={drop}>{/* ... */}</div>
}
```

Call it unconditionally: it does nothing when the provider is not using a
keyboard backend, or when that backend has `announce: false`. Keep the messages
short — a live region is read out in full.

### Telling a keyboard drag from a pointer drag

`monitor.isDragging()` deliberately does not distinguish — to dnd-core a drag is
a drag, whichever backend opened it. `isKeyboardDrag(manager)` does, for the
behavior that genuinely differs by modality. A tree that reads drop depth from
the pointer's horizontal offset, for instance, has no pointer to read during a
keyboard drag:

```jsx
import { useDragDropManager } from '@nosferatu500/react-dnd'
import { isKeyboardDrag } from '@nosferatu500/react-dnd-keyboard-backend'

function Row({ item }) {
  const manager = useDragDropManager()

  const [, drop] = useDrop(() => ({
    accept: 'item',
    hover: (dragged, monitor) => {
      const depth = isKeyboardDrag(manager)
        ? dragged.keyboardDepth
        : depthFromOffset(monitor.getClientOffset())
      // ...
    },
  }))

  return <div ref={drop}>{/* ... */}</div>
}
```

Call it whatever backend the provider is using: a pointer-only backend has
nobody to ask, and the answer is `false`.

Ask it inside a callback rather than rendering from it. It reads current state
through the backend and publishes no subscription, so a component that renders
from it will not re-render when the answer changes. Drive the render from a
collected prop and use this only to decide what to show.

`backend.profile()` also reports a `keyboardDragging` count, but `profile()` is
diagnostics — its keys are not API and may change between versions.

### Keyboard only

`KeyboardBackend` is the backend without a pointer backend under it. It is
exported for tests and for the rare app where keyboard is the only modality; in
an ordinary app it would leave the mouse unable to drag anything.
