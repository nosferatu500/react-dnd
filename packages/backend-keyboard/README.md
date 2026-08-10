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

	// Notified of every arrow key, whether or not the hover moves.
	onNavigate: (event) => {},

	// Any subset of the spoken strings. See `defaultAnnouncements`.
	announcements: {
		drop: ({ source, target }) => `${source} moved to ${target}.`,
	},

	// Turn off the automatic parts if you would rather do them yourself.
	// `applyAriaAttributes` also takes an object, one key per attribute.
	applyAriaAttributes: true,
	announce: true,
})
```

### Choosing which attributes the backend writes

`applyAriaAttributes` takes `true` (the default), `false`, or an object naming
attributes individually. Anything left out of the object stays on:

```tsx
// Our own focus management, the backend's ARIA.
withKeyboard(HTML5Backend, { applyAriaAttributes: { tabIndex: false } })
```

| Key | Attribute |
| --- | --- |
| `tabIndex` | `tabindex="0"`, on sources the platform does not already focus |
| `role` | `role="button"`, or `role="group"` when the source wraps controls |
| `roleDescription` | `aria-roledescription="draggable item"` |
| `describedBy` | `aria-describedby`, pointing at the shared instructions |

Reach for this only for sources that say nothing about an attribute — an
attribute the element **already carries is never overwritten** whatever this is
set to, so a source with its own `role` keeps it without any configuration, and
one with its own `aria-describedby` gets the instructions appended rather than
replaced.

Two things to know before turning one off. A source that cannot take focus
cannot be picked up from the keyboard at all, so `tabIndex: false` means giving
drag sources focus another way. And `aria-roledescription` is only exposed on an
element that has a role, so `role: false` with `roleDescription` left on means
giving the element a role yourself.

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

### Sub-position: `onNavigate`

Some drags have somewhere to go that is not another drop target — the indent
level of a row in a tree, the insertion point between two cards, anything that
is "the same target, somewhere else within it".

A drop target cannot express that. dnd-core treats a `hover` whose target ids
are unchanged as no change at all, so re-hovering the same target dispatches
nothing that any collector re-renders for. Sub-position is *application* state,
and `onNavigate` is the event that drives it:

```tsx
withKeyboard(HTML5Backend, {
	onNavigate: (event) => {
		// Left and right indent; up and down keep moving between rows.
		if (event.direction === 'left' || event.direction === 'right') {
			setDepth((d) => clamp(d + (event.direction === 'right' ? 1 : -1)))
			event.preventDefault()
		}
	},
})
```

It fires on **every** arrow key press during a drag, before the hover moves and
whether or not it moves at all — including at the ends of a list, where the
default navigation stays put. `preventDefault()` keeps the key press for the
application: `getNextTarget` is not consulted and the hover stays where it is.
The key is taken from the page either way, so a list never scrolls underneath a
drag.

The event carries the same `{ direction, current, candidates, allTargets,
source }` that `getNextTarget` gets, and `current` is where the hover was as the
key was pressed.

**Say what you did.** The backend announces only its own moves, so a key press
the application handled is silent unless it speaks:

```tsx
onNavigate: (event) => {
	if (event.direction === 'right') {
		announce(`Indented to level ${next}.`)
		event.preventDefault()
	}
}
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
