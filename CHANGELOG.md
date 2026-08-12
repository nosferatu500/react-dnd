# Changelog

Notable changes to the published `@nosferatu500/*` packages.

Seven packages are published from this repository:

| | |
| --- | --- |
| `@nosferatu500/react-dnd` | the React bindings |
| `@nosferatu500/dnd-core` | the backend-agnostic state machine |
| `@nosferatu500/react-dnd-html5-backend` | pointer drag and drop |
| `@nosferatu500/react-dnd-touch-backend` | touch drag and drop |
| `@nosferatu500/react-dnd-keyboard-backend` | keyboard drag and drop, and screen-reader announcements |
| `@nosferatu500/react-dnd-test-backend` | a backend for tests |
| `@nosferatu500/react-dnd-test-utils` | helpers for tests |


The major tracks the **React** major these packages target, which is the thing
most likely to make an install wrong. That is why the fork starts at 19 rather
than continuing upstream's 16.

---

## Coming from upstream `react-dnd`

This is a maintained fork of [`react-dnd/react-dnd`](https://github.com/react-dnd/react-dnd),
whose last release was `16.0.1` in June 2022. If you are moving an existing app
across, the short version:

**1. Swap the packages.** Only the package *names* change; every import *name*
is the same.

```diff
- import { DndProvider, useDrag, useDrop } from 'react-dnd'
- import { HTML5Backend } from 'react-dnd-html5-backend'
+ import { DndProvider, useDrag, useDrop } from '@nosferatu500/react-dnd'
+ import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
```

`@react-dnd/asap`, `@react-dnd/invariant` and `@react-dnd/shallowequal` have no
scoped equivalent — they are gone. `invariant` is exported from
`@nosferatu500/dnd-core` if you were importing it.

**2. Check your environment.** React `^19.0.0`, Node `>= 22.12.0`, ESM only.
`require()` still works on supported Node versions via `require(esm)`. For React
16 or 17, stay on upstream `react-dnd@16.0.1`.

**3. Fix the four things that can need a code change.** In a whole monorepo —
nine packages and the full example gallery — this came to two lines, so expect
it to be small:

- `<div ref={drag} />` now **typechecks**, which was the headline fix. Nothing
  to do.
- Chained `ref={(node) => drag(drop(node))}` no longer typechecks. Use a
  block-bodied ref callback, or share a ref object.
- Passing a React element to a connector — `drop(<div />)`, the convention the
  removed decorator API generated — now throws. Attach connectors with refs.
- `monitor.getItem()` is typed `T | null`. It always *returned* null when
  nothing was being dragged and the docs always said so; only the type
  disagreed. Usually one `?.` in a `collect` or a custom `isDragging`.

**[MIGRATION.md](./MIGRATION.md) is the full record** — every breaking change,
why it was made, and what to do about it. This file summarises; that file
explains.

---

## 19.2.0 — 2026-08-12

### Added — a drop can be asynchronous

A `drop` handler that returns a promise now works. It used to be **silently
swallowed**: the returned value was spread into the drop result, and
`{ ...promise }` is `{}`, so the resolved value reached nobody and the promise
itself was discarded. The side effect still ran, which is why it looked like it
worked until something depended on the outcome.

```tsx
const [{ isSettling }, drop] = useDrop(() => ({
  accept: 'card',
  drop: async (item) => {
    await moveCard(item.id, columnId)
    return { columnId }
  },
  collect: (monitor) => ({ isSettling: monitor.isSettling() }),
}))
```

**The drag still ends when it always ended.** It is not held open while the
promise is in flight: for the HTML5 backend the browser's drag genuinely ends at
`drop`, so a monitor still reporting `isDragging()` would describe a drag that
does not exist, and a promise that never settled would wedge the library.
Settling is a separate, later phase.

| | during the drag | while settling | after |
| --- | --- | --- | --- |
| `isDragging()` | `true` | `false` | `false` |
| `didDrop()` | `false` | `true` | `true` |
| `isSettling()` | `false` | `true` | `false` |
| `getDropResult()` | `null` | `null` | the resolved value |

`isSettling()` is scoped on the source and target monitors — a target reports
only drops on itself, so one column saving does not put every other column into
a "saving…" state — and unscoped on `useDragLayer`, which is page-level.

A rejection is recorded on `monitor.getDropError()` *and* handed to
`reportError`, so a failure is never silent even if nothing renders it.

`spec.end` is unchanged: it fires when the drag ends, not when the drop settles.
Backends are untouched — a custom backend calls `drop()` then `endDrag()` as
before and never learns a promise was involved.

`drop` also receives an **`AbortSignal`** as its third argument, aborted when
the drop can no longer affect anything — today, when a new drag begins and takes
the drop result slot with it. Pass it to `fetch`; an `AbortError` that follows
is neither reported nor recorded, because the abort was ours. Compose
`AbortSignal.any([signal, AbortSignal.timeout(ms)])` for a deadline.

### Added — several backends behind one provider

`composeBackends` runs more than one backend at a time, which react-dnd has
never allowed — a provider takes exactly one, so supporting a mouse and a finger
meant choosing ([#3483](https://github.com/react-dnd/react-dnd/issues/3483)):

```tsx
import { composeBackends } from '@nosferatu500/dnd-core'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import { TouchBackend } from '@nosferatu500/react-dnd-touch-backend'

<DndProvider backend={composeBackends(HTML5Backend, TouchBackend)}>
  <App />
</DndProvider>
```

Nothing in the application changes — `useDrag` and `useDrop` are untouched, and
every backend connects to the same nodes. Each is handed the provider's
`context` and `options`; wrap one in a factory of your own when they need
different options.

**Nothing arbitrates a gesture between backends**, so compose ones that respond
to *different* gestures. HTML5 (`dragstart`) and Touch (`touchstart`) do not
overlap by default; `TouchBackend`'s `enableMouseEvents` makes it listen for
`mousedown` too, which is the one combination where both could try to start the
same drag. That combination is **not verified** — it needs a real browser and a
touchscreen.

This is the machinery `withKeyboard` was already built on, generalised.
`CompositeBackend` moves from `@nosferatu500/react-dnd-keyboard-backend` to
`@nosferatu500/dnd-core`, where `Backend` and `BackendFactory` are defined, and
is still re-exported from the keyboard package so existing imports keep working.

### Docs — dragging several items at once

No API change: a drag carries whatever object `item` returns, so a multi-item
drag is only an item that holds several ids. That has always worked; nothing
said so. `useDrag`'s docs now cover the pattern, and there is a runnable
[multi-select example](/examples/customize/multi-select) with tests pinning it.

The two non-obvious parts are both existing API. A custom `isDragging` is what
makes *every* selected row look like it is moving rather than only the one you
grabbed — the default is scoped to the source that started the drag, which is
right for the common case and wrong for this one. And the count has to be drawn
in a drag layer, because the browser's drag image is a picture of a single node.

### Performance — `canDrop` is consulted once per event, not twice

The HTML5 backend asked each drop target the same question twice per `dragover`
— once to decide whether to cancel the browser's default, and again to resolve
the `dropEffect`, scanning the target list from opposite ends. `canDrop` is
application code and `dragover` fires continuously, so a predicate that walks a
tree did all of it twice for nothing.

Measured, so as not to oversell it: the backend's own per-`dragover` bookkeeping
is ~3µs and flat from one nested target to ten — 0.02% of a 60fps frame. This
changes nothing inside the library. It halves how often *your* `canDrop` runs.

### Fixed — a dragged file could disable drag and drop page-wide

If a file was dragged over the app and the component under it unmounted before
the drag ended, **every later `DndProvider` failed to mount** with *"Cannot have
two HTML5 backends at the same time."* It looked like unrelated drag and drop
just stopping after a stray file drag.

dnd-core decides whether a backend should be set up by counting registered
handlers, and the HTML5 backend registers a source of its own so a dragged file
has something to be — so while a native drag was in flight the backend held that
count up itself, it never reached zero, and `teardown()` never ran. A handler a
backend registers for itself no longer counts, and teardown now ends a native
drag it is still holding. Nothing to do on your side.

Custom backends that register their own sources should mark them:
`registry.addSource(type, source, { backendOwned: true })`. The two-argument
call is unchanged.

### Breaking

- The monitor interfaces gained `isSettling()` and `getDropError()`. Anything
  **implementing** `DragSourceMonitor`, `DropTargetMonitor`, `DragLayerMonitor`
  or dnd-core's `DragDropMonitor` — a hand-rolled test double, most likely —
  must add them. Using the monitors is unaffected.
- `drop: async () => {}` used to make `getDropResult()` `{}` synchronously. It
  is now `null` until the promise settles, then `{}`.

---

## 19.1.0 — 2026-08-10

**`@nosferatu500/react-dnd-keyboard-backend` only.** Every other package is
unchanged at `19.0.0`.

Five changes from an integration review by a consumer of the fork. Two are fixes
to behavior that was wrong; three are new API for things the backend gave no way
to express.

### Fixed

- **A drag source that wraps controls no longer gets `role="button"`.** The role
  was chosen from the source's own tag name, so a whole-row drag source that
  also carried the row's buttons — the common sortable-list shape — got a role
  whose children are presentational, and assistive technology may not reach the
  nested controls at all. Such sources now get `role="group"`, which is valid as
  a container and still carries the `aria-roledescription`. The role could not
  simply be dropped: `aria-roledescription` is only exposed on an element that
  has a role, so a bare `div` would have silently lost *"draggable item"* too.

  Interactive descendants are detected with
  `button, a[href], input, select, textarea, [tabindex]`, once, when the source
  connects. A source whose first button appears later keeps the role it was
  given; set `role` yourself if the content varies.

  **If you have a CSS or test selector matching `[role="button"]` on drag
  sources, check it.**

- **Picking an item up starts the hover where the item already is.** The first
  eligible target was hovered unconditionally, so lifting the last row of a list
  immediately previewed it at the *top* — `isOver` lit up on the wrong row and
  the live region announced *"Over row 1 of 5"* for an item nobody had moved.

  The hover now prefers the eligible target containing the source (the row
  itself when `drag` and `drop` share a ref, or the row a drag handle sits in),
  then the nearest one in document order, then the first.

  **This changes which target sees `hover` at pick-up.**

### Added

- **`isKeyboardDrag(manager)`** — whether the drag in progress was started from
  the keyboard. `monitor.isDragging()` deliberately does not distinguish, but
  behavior that reads the pointer has nothing to read during a keyboard drag.
  Returns `false` for a provider using a pointer-only backend, so it is always
  safe to call.

  Ask it inside a callback rather than rendering from it: it publishes no
  subscription, so a component rendering from it will not re-render when the
  answer changes. If you were reading
  `manager.getBackend().profile().keyboardDragging`, this replaces it —
  `profile()` is diagnostics and its keys are not API.

- **An `onNavigate` option**, called on every arrow key press during a drag,
  before the hover moves and whether or not it moves at all. This is where
  sub-position lives: the indent level of a tree row, the insertion point
  between two cards, anything that is "the same drop target, somewhere else
  within it".

  A drop target cannot express that — dnd-core treats a `hover` whose target ids
  are unchanged as no change, so re-hovering the same target re-renders nothing.

  ```tsx
  withKeyboard(HTML5Backend, {
  	onNavigate: (event) => {
  		if (event.direction === 'left' || event.direction === 'right') {
  			setDepth((d) => clamp(d + (event.direction === 'right' ? 1 : -1)))
  			event.preventDefault()
  		}
  	},
  })
  ```

  `event.preventDefault()` keeps the key press for your application:
  `getNextTarget` is not consulted and the hover stays put. The key is taken
  from the page either way, so a list never scrolls underneath a drag. The
  backend announces only the moves it makes itself, so say something with
  `useDragDropAnnounce()` when you handle a key here — silence is
  indistinguishable from a key that did nothing.

- **`applyAriaAttributes` takes an object**, so the four attributes can be
  chosen individually. Anything left out stays on:

  ```tsx
  // Your own focus management, the backend's ARIA.
  withKeyboard(HTML5Backend, { applyAriaAttributes: { tabIndex: false } })
  ```

  Keys are `tabIndex`, `role`, `roleDescription` and `describedBy`. `true` and
  `false` mean what they did.

  Worth knowing, and now stated in the option's own JSDoc rather than only in
  prose: **an attribute the element already carries is never overwritten**,
  whatever this is set to. A source with its own `role` keeps it; a source with
  its own `aria-describedby` gets the instructions appended rather than
  replaced. Reach for this option only to stop the backend writing an attribute
  on sources that have said nothing.

### Notes

Nothing here is API-breaking, and no existing option or export changed meaning.
The two fixes above do change observable behavior, which is why they are called
out.

---

## 19.0.0 — 2026-08-10

The first release of the fork, from upstream `react-dnd@16.0.1`. All seven
packages.

Upstream's published `16.0.1` tarball does not match the shape its own
repository is configured to build — no `exports` map, no `module` field, no
`files` field, and 44 files of ESM syntax in a package without
`"type": "module"`. That single defect is the most plausible root cause of the
largest cluster of open issues upstream, and dealing with it properly is what
made this a new major rather than a patch release.

### Breaking

- **Renamed to the `@nosferatu500` scope**, so the fork can never be mistaken
  for an upstream release. Import names are unchanged.
- **React 19 only.** `peerDependencies.react` is `^19.0.0`. React 18 support was
  dropped; upstream advertised `>= 16.14` but only ever tested 16/17 semantics.
- **ESM only.** One `dist/`, `"type": "module"`, a real `exports` map with a
  `types` condition, and a `files` allowlist. There is no `require` condition,
  no `dist/cjs` and no `dist/esm`. `require()` still works on Node `>= 22.12`
  via `require(esm)`, which is asserted by a test rather than assumed.
- **Node `>= 22.12.0`**, and the TypeScript `target`/`lib` are `ES2025` with
  nothing downleveled.
- **Connectors are typed `RefCallback`**, returning `void`. This is the headline
  fix: React 19 narrowed callback refs, so upstream's
  `ReactElement | null` return made `<div ref={drag} />` — the most basic
  documented usage — fail to compile. Chained `drag(drop(node))` no longer
  typechecks as a consequence; it still works at runtime.
- **Connectors no longer accept a React element.** `drop(<div />)` throws with a
  migration message.
- **`monitor.getItem()` is typed `T | null`** on all three monitors. The
  callbacks that hand you the item — `drop`, `hover`, `canDrop`, `end` — are
  unchanged and still non-null.
- **Three packages are no longer published.** `@react-dnd/asap` was a deprecated
  one-line wrapper imported by nothing; `@react-dnd/invariant` moved into
  `dnd-core`, which exports it; `@react-dnd/shallowequal` was replaced by
  `fast-deep-equal`, already a dependency.
- **`useDrag`'s `spec.begin` check is gone.** It threw about an API removed two
  majors earlier.

### Added

- **`@nosferatu500/react-dnd-keyboard-backend`**, a new package. HTML5 drag and
  drop has no keyboard gesture and announces nothing, so an app built on the
  HTML5 backend alone is not merely awkward without a pointer — it is
  inoperable. `withKeyboard(HTML5Backend)` composes keyboard support alongside
  pointer support in one line, with no change to `useDrag` or `useDrop`. Space
  or enter picks up, arrows choose a target, space or enter drops, escape
  cancels, and a polite live region narrates each step.
- **Drop targets can say what dropping does.** `useDrop` gained a `dropEffect`
  option and the HTML5 backend gained `copyModifier` — the most-requested
  feature in the upstream backlog, which had two competing PRs and no
  resolution. Resolved innermost-target first, then source, then modifier, then
  `'move'`; alt is no longer hard-coded.

### Fixed

- **`DndProvider` no longer loses its global manager on remount.** The refcount
  cleanup nulled the slot and never restored it, so under StrictMode a
  later-mounted provider built a *second* manager and drags could not cross
  between trees — which is what "cannot have two HTML5 backends" looks like from
  the outside.
- **Connectors reattach after a disconnect-then-reconnect**, which is exactly
  what StrictMode's teardown/setup cycle produces.
- **Connector options survive an element remount.** A drop target or drag source
  silently lost its `options` when its element unmounted and remounted without
  the options object changing — a target's `dropEffect` reverting to `'move'`,
  `previewOptions` like `captureDraggingState` quietly reverting to defaults.
- **The HTML5 backend no longer swallows every native drop.** It used to cancel
  the browser's drop handling for *any* unaccepted native drag, so mounting the
  backend stopped every `<input>`, `<textarea>` and contenteditable on the page
  from accepting dropped text — including ones outside your provider. The cancel
  is now decided from the payload: files and URLs still cancel, text and HTML do
  not.
- **The HTML5 backend no longer cancels drags it does not own.** An
  unconditional `preventDefault()` on `dragstart` cancelled the drag of *any*
  `draggable` element in the document. A single mounted `useDrop` was enough to
  disable HTML5 dragging page-wide.
- **The HTML5 backend no longer throws on a drop it did not start.** A drop from
  another library's drag threw an uncaught
  `Invariant Violation: Cannot call hover while not dragging` out of an event
  handler.
- **Throttled hover no longer dispatches the wrong frame's targets.** When two
  `dragover` events landed in one animation frame — what crossing a target
  boundary during a fast drag looks like — the frame reported the target the
  pointer had just *left*, at coordinates inside the one it had just entered.
- **The touch backend no longer leaks its start listener** when a delay option
  is configured, which is the common mobile configuration, and **no longer
  queues stale start timers** that could begin a drag after the interaction was
  abandoned.
- **`dnd-core` no longer throws on an empty handler map**, and **duplicate
  `targetIds` are rejected again** — a check that had been moved behind a type
  filter upstream and stopped catching most duplicates.
- **`react-dnd-test-utils` imports `act` from `react`**, not from
  `react-dom/test-utils`, which React 19 deleted — the helpers could not load at
  all on React 19.

### Changed

- **Collected props are read with `useSyncExternalStore`.** A monitor *is* an
  external store; mirroring it into `useState` missed updates landing between
  render and subscribe, and could tear under concurrent rendering. It also
  removed real subscription churn: `useDragLayer` had no dependency array on its
  subscriptions, so it resubscribed on every render — during a drag, every
  pointer move.
- **`dnd-core` uses `redux@5` and `queueMicrotask`.** Redux 4 is CommonJS-only,
  a wart in an otherwise ESM-only chain, and the upgrade caught a real action
  modeling error. `@react-dnd/asap` was a ~300-line 2014-era scheduler for a
  problem `queueMicrotask` solves.
- **`react-dnd` no longer depends on `hoist-non-react-statics`** — never
  imported, a leftover from the removed decorator API.

---

## Before 19.0.0

This repository's history continues upstream's, but its changelog does not: the
entries that used to be in this file covered `react-dnd` up to 2021 and describe
a package under a different name, on React versions none of these packages
support. They are still in this file's git history, and upstream's releases are
at [react-dnd/react-dnd/releases](https://github.com/react-dnd/react-dnd/releases).
