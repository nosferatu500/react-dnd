# react-dnd-keyboard-backend

Keyboard and screen-reader accessible drag and drop for
[react-dnd](https://github.com/react-dnd/react-dnd).

HTML5 drag and drop is inaccessible by construction: there is no keyboard
gesture for it, and nothing in it is announced. This backend adds a keyboard
interaction and a spoken narration on top of the drag sources and drop targets
you already have — without changing a line of `useDrag` or `useDrop`.

## Install

```sh
npm install react-dnd-keyboard-backend
```

## Use

Wrap the pointer backend you already use. Keyboard support is *additional* to
pointer support, never a replacement for it.

```tsx
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { withKeyboard } from 'react-dnd-keyboard-backend'

export function App() {
	return (
		<DndProvider backend={withKeyboard(HTML5Backend)}>
			<Board />
		</DndProvider>
	)
}
```

That is the whole integration. Every connected drag source becomes focusable and
describes itself to assistive technology, and:

| Key | While focused on a drag source | While dragging |
| --- | --- | --- |
| <kbd>Space</kbd> / <kbd>Enter</kbd> | pick the item up | drop it on the current target |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> | — | choose a drop target |
| <kbd>Esc</kbd> | — | cancel, leaving everything as it was |
| <kbd>Tab</kbd> | move focus as usual | held, so the drag cannot be abandoned by accident |

Focus stays on the item being dragged for the whole interaction. Only the *hover*
moves, so `isOver` and `canDrop` update exactly as they do under the mouse and
your existing highlight styles work unchanged.

Modified presses (<kbd>Ctrl</kbd>, <kbd>Cmd</kbd>, <kbd>Alt</kbd>) and presses
inside an `<input>`, `<textarea>`, `<select>` or contenteditable are left to the
application, so an inline rename box inside a card still types normally.

## What it writes to the DOM

On each connected drag source, and only where the application has not already
said otherwise:

```html
<div
  tabindex="0"
  role="button"
  aria-roledescription="draggable item"
  aria-describedby="react-dnd-keyboard-instructions-0"
>
```

Attributes you set yourself are never overwritten, and everything is restored
when the source disconnects. A single visually hidden `role="status"`
`aria-live="polite"` region narrates the drag:

> Picked up Knight on b1. Over c3, 3 of 8. Use the arrow keys to move, space to
> drop, escape to cancel.

## Options

```tsx
withKeyboard(HTML5Backend, {
	// How arrow keys choose the next target.
	// Default: documentOrderNavigation
	getNextTarget: spatialNavigation(),

	// How an element is described in announcements.
	// Default: aria-label, falling back to trimmed text content
	describeNode: (node) => node.dataset.label ?? 'item',

	// Any subset of the spoken strings. See `defaultAnnouncements`.
	announcements: {
		drop: ({ source, target }) => `${source} moved to ${target}.`,
	},

	// Turn off the automatic parts if you would rather do them yourself.
	applyAriaAttributes: true,
	announce: true,
})
```

### Navigation

`documentOrderNavigation` (the default) steps through the eligible drop targets
in document order — down/right go forward, up/left go back — and stops at the
ends rather than wrapping. It needs no measurement, so it behaves identically in
a browser and under test.

`spatialNavigation()` picks the nearest eligible target in the direction of the
arrow key, which is what you want on a grid or a board, where <kbd>↓</kbd> should
cross a row rather than step one cell. It reads `getBoundingClientRect`, so it
needs real layout.

Anything else is a function:

```ts
withKeyboard(HTML5Backend, {
	getNextTarget: ({ direction, current, candidates }) => {
		// `candidates` holds every target that accepts the item right now,
		// in document order. Return one of them, or null to stay put.
	},
})
```

## Keyboard-only

`KeyboardBackend` is the backend on its own, without a pointer backend under it.
It is exported for tests and for the rare app where keyboard is genuinely the
only modality; in an ordinary app it would leave the mouse unable to drag
anything.

## License

MIT
