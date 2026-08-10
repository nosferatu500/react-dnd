---
path: '/docs/testing'
title: 'Testing'
---

_New to React DnD? [Read the overview](/docs/overview) before jumping into the docs._

# Testing

React DnD is test-friendly. The whole interaction — your components rendering,
the drag itself, and the side effects you run in response to it — can be tested,
and not every approach needs a real browser event system.

The examples in this repository are covered by tests under
`packages/examples/src/**/__tests__`, which are the best worked examples to copy
from.

### Testing components in isolation

There is nothing to unwrap. `useDrag` and `useDrop` are hooks, so a component
that uses them needs a `DndProvider` above it and nothing else. Render it with
whichever backend suits the test — [the test backend](/docs/backends/test) when
you want to script the drag, the [HTML5 backend](/docs/backends/html5) when you
want to fire real DOM events.

`react-dnd-test-utils` has a helper that does the wrapping:

```jsx
import { render } from '@testing-library/react'
import { wrapWithBackend } from 'react-dnd-test-utils'

import Box from './components/Box'

it('renders', () => {
  const TestBox = wrapWithBackend(Box)
  render(<TestBox name="test" />)
})
```

`wrapWithBackend(Component, Backend?, backendOptions?)` defaults to the HTML5
backend. Use `wrapWithTestBackend(Component)` when you also need the backend
instance — it returns `[Component, getBackend]`.

### Testing the interaction with DOM events

Fire the real drag events. `react-dnd-test-utils` bundles the sequences, each
wrapped in `act` and awaited, so collected props have settled by the time the
call returns:

```jsx
import { render } from '@testing-library/react'
import { fireDragDrop, wrapWithBackend } from 'react-dnd-test-utils'

import Example from './Example'

it('drops the bottle in the glass bin', async () => {
  const TestExample = wrapWithBackend(Example)
  const rendered = render(<TestExample />)

  const [glassBin] = await rendered.findAllByTestId('dustbin')
  const [bottle] = await rendered.findAllByTestId('box')

  await fireDragDrop(bottle, glassBin)

  expect(glassBin.textContent).toContain('Bottle')
})
```

| Helper | Fires |
| --- | --- |
| `fireDrag(source)` | `dragstart` |
| `fireDragHover(source, target)` | `dragstart`, `dragenter`, `dragover` |
| `fireDragDrop(source, target)` | the above plus `drop` |
| `fireReleaseDrag()` | `drop` on `window`, to end a drag that hit nothing |

This runs in jsdom, which implements neither `DragEvent` nor `DataTransfer`.
Anything that depends on them — the drag preview image, native file drops — will
not behave as it does in a browser, and neither will anything that reads layout,
since every element measures as zero. You can attach your own `dataTransfer`
object to the event if you need one.

### Testing the interaction without the DOM

[The test backend](/docs/backends/test) drives dnd-core directly, so it needs no
events at all. Use it when you care about the drag logic rather than the DOM
plumbing:

```jsx
import { render } from '@testing-library/react'
import { simulateDragDrop, wrapWithTestBackend } from 'react-dnd-test-utils'

import Box from './components/Box'
import Bin from './components/Bin'

it('drops without any DOM events', () => {
  const [TestExample, getBackend] = wrapWithTestBackend(Example)
  const rendered = render(<TestExample />)

  simulateDragDrop(
    rendered.getByTestId('box'),
    rendered.getByTestId('bin'),
    getBackend(),
  )
})
```

`simulateDrag`, `simulateDragHover` and `simulateDragDrop` take the source and
target — either an element carrying a `data-handler-id`, or a handler id string —
plus the backend. `getHandlerId(el)` reads the id off an element if you want to
call `backend.simulate*` yourself.

Collect `handlerId` in your component to make elements addressable:

```jsx
const [{ handlerId }, drag] = useDrag(() => ({
  type: 'box',
  collect: (monitor) => ({ handlerId: monitor.getHandlerId() }),
}))

return <div ref={drag} data-handler-id={handlerId} />
```

### Testing keyboard drag and drop

With [the keyboard backend](/docs/backends/keyboard) there is nothing special to
simulate — press keys:

```jsx
import { fireEvent, render, screen } from '@testing-library/react'

fireEvent.keyDown(screen.getByTestId('box'), { key: ' ' })
fireEvent.keyDown(screen.getByTestId('box'), { key: 'ArrowDown' })
fireEvent.keyDown(screen.getByTestId('box'), { key: ' ' })
```
