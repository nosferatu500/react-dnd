# react-dnd-keyboard-backend

Keyboard and screen-reader accessible drag and drop for
[react-dnd](https://github.com/react-dnd/react-dnd).

HTML5 drag and drop is inaccessible by construction: there is no keyboard
gesture for it, and nothing in it is announced. This backend adds a keyboard
interaction and a spoken narration on top of the drag sources and drop targets
you already have — without changing a line of `useDrag` or `useDrop`.

## Install

```sh
npm install @nosferatu500/react-dnd-keyboard-backend
```

## Supported React versions

`^19.0.0`

React 16, 17 and 18 are not supported. Use the upstream `16.0.1` release for
React 16/17.

## Use

Wrap the pointer backend you already use. Keyboard support is *additional* to
pointer support, never a replacement for it.

```tsx
import { DndProvider } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import { withKeyboard } from '@nosferatu500/react-dnd-keyboard-backend'

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

The role is `group` rather than `button` when the source contains interactive
content of its own — a `button`, an `a[href]`, a form control, or anything with
a `tabindex`. A `button` role's children are presentational, so a whole-row drag
source wrapping the row's own buttons would make them unreachable. `group` is
valid as a container and still carries the `aria-roledescription`, which is why
the role changes rather than being dropped. It is decided once, when the source
connects.

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

Picking an item up starts the hover **where the item already is**: on the
eligible drop target containing the source — the row itself when `drag` and
`drop` share a ref, or the row a drag handle sits in — and otherwise on the
nearest one in document order. So lifting the last row of a list announces *that*
row, rather than previewing the item at the top of the list before the first
arrow key. `getNextTarget` takes over from there.

`documentOrderNavigation` (the default) steps through the eligible drop targets
in document order — down/right go forward, up/left go back — and stops at the
ends rather than wrapping. It needs no measurement, so it behaves identically in
a browser and under test.

`gridNavigation({ columns })` treats the targets as a row-major grid: left and
right move within a row, up and down move a whole row. It measures nothing, so
it behaves the same in a browser and under test. Cells that will not accept the
item are skipped over — on a board where only the legal moves accept a piece,
the hover keeps traveling in the direction you asked for until it reaches one
that does.

`spatialNavigation()` picks the nearest eligible target in the direction of the
arrow key. Reach for it when the layout is not a regular grid — masonry, a
calendar with varying row heights, freely positioned cards. It reads
`getBoundingClientRect`, so it needs real layout and degrades to document order
under jsdom.

Anything else is a function:

```ts
withKeyboard(HTML5Backend, {
	getNextTarget: ({ direction, current, candidates, allTargets }) => {
		// `candidates` holds every target that accepts the item right now, in
		// document order; `allTargets` holds every connected target whether it
		// accepts or not, which is what layout-aware navigation needs. Return one
		// of the candidates, or null to stay put.
	},
})
```

## Announcing what the app knows

The backend narrates what it can see — picked up, moved, dropped. It cannot
narrate what a drop *meant*: that the card is now third in Done, that the move
was rejected, that four rows were reordered. `useDragDropAnnounce` speaks
through the same live region, so app messages and backend messages queue in one
place instead of two competing regions:

```tsx
import { useDragDropAnnounce } from '@nosferatu500/react-dnd-keyboard-backend'

function Column({ title }) {
	const announce = useDragDropAnnounce()

	const [, drop] = useDrop(() => ({
		accept: 'card',
		drop: (item) => {
			const position = move(item)
			announce(`${item.title} moved to ${title}, position ${position}.`)
		},
	}))

	return <div ref={drop} />
}
```

Call it unconditionally. It does nothing if the provider is not using a keyboard
backend, or if that backend was configured with `announce: false`. Keep messages
short — they are read out in full.

## Telling a keyboard drag from a pointer drag

`monitor.isDragging()` deliberately does not distinguish — to dnd-core a drag is
a drag, whichever backend opened it. But some behavior genuinely differs by
modality: a tree that computes drop depth from the pointer's horizontal offset
has no pointer to read during a keyboard drag and needs another way in.

```tsx
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
			// …
		},
	}))

	return <div ref={drop} />
}
```

Call it whatever backend the provider is using — a pointer-only backend has
nobody to ask and the answer is `false`.

**Ask it inside a callback; do not render from it.** It reads current state
through the backend and publishes no subscription, so a component that renders
from it will not re-render when the answer changes. To *show* something for the
duration of a keyboard drag, drive the render from a collected prop and consult
this only to decide what to show.

`backend.profile()` also reports `keyboardDragging`, but `profile()` is
diagnostics — its keys are not API and may change.

## Keyboard-only

`KeyboardBackend` is the backend on its own, without a pointer backend under it.
It is exported for tests and for the rare app where keyboard is genuinely the
only modality; in an ordinary app it would leave the mouse unable to drag
anything.

## License

MIT
