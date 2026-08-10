---
path: '/docs/backends/keyboard'
title: 'Keyboard Backend'
---

_New to React DnD? [Read the overview](/docs/overview) before jumping into the docs._

# Keyboard Backend

HTML5 drag and drop is inaccessible by construction: the browser exposes no
keyboard gesture for it, and nothing about a drag is announced. The
`react-dnd-keyboard-backend` package adds a keyboard interaction and a spoken
narration on top of the drag sources and drop targets you already have.

It is not an alternative to the HTML5 or Touch backends — it wraps one of them,
so pointer and keyboard both work.

### Installation

```
npm install react-dnd-keyboard-backend
```

### Usage

```jsx
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { withKeyboard } from 'react-dnd-keyboard-backend'

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

### Options

Pass them as the second argument to `withKeyboard`. The provider's own `options`
continue to go to the wrapped backend untouched.

- **getNextTarget** (default: `documentOrderNavigation`)

  How the arrow keys choose the next drop target.

  `documentOrderNavigation` steps through the eligible targets in document
  order — down/right forward, up/left back — and stops at the ends rather than
  wrapping.

  `spatialNavigation()` picks the nearest eligible target in the direction of
  the arrow key, which is what a grid or a board wants, where <kbd>↓</kbd>
  should cross a row rather than step one cell. It measures with
  `getBoundingClientRect`.

  ```jsx
  import { spatialNavigation, withKeyboard } from 'react-dnd-keyboard-backend'

  withKeyboard(HTML5Backend, { getNextTarget: spatialNavigation() })
  ```

  Anything else is a function of `{ direction, current, candidates, source }`,
  where `candidates` holds every target that accepts the item right now, in
  document order. Return one of them, or `null` to stay put.

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

### Keyboard only

`KeyboardBackend` is the backend without a pointer backend under it. It is
exported for tests and for the rare app where keyboard is the only modality; in
an ordinary app it would leave the mouse unable to drag anything.
