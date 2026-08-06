# React _DnD_

Drag and Drop for React.

> **This is a maintained fork of [react-dnd/react-dnd](https://github.com/react-dnd/react-dnd).**
> Upstream's last release (`16.0.1`, mid-2022) predates React 18's StrictMode
> effect semantics and React 19's ref-cleanup contract, and it has not shipped a
> fix for either. This fork targets **React 17, 18 and 19**, with each major
> covered by CI. See [MIGRATION.md](./MIGRATION.md) for what changed and
> [docs/upstream-triage.md](./docs/upstream-triage.md) for how upstream's open
> issues map onto this codebase.

## Supported versions

| | Supported |
| --- | --- |
| React | `^17.0.2 \|\| ^18.0.0 \|\| ^19.0.0` |
| Node (for building/testing this repo) | `>= 20.19` |
| TypeScript (for consumers) | `>= 5.0` — `exports` carries `types` |
| Module format | **ESM only** (`require()` still works on Node >= 20.19 via `require(esm)`) |

React 16 is **no longer supported**. If you need it, use `react-dnd@16.0.1`
from upstream.

## Install

```sh
npm install react-dnd react-dnd-html5-backend
```

## Quick start

```tsx
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

function Card({ id }: { id: string }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'CARD',
    item: { id },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }))

  // Connectors are ref callbacks. Do not return their result from a ref —
  // React 19 treats a returned function as a ref cleanup.
  return <div ref={drag} style={{ opacity: isDragging ? 0.4 : 1 }} />
}

export function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <Card id="a" />
    </DndProvider>
  )
}
```

To attach several connectors to one node, call each from a block-bodied ref
callback (or pass them a shared ref object):

```tsx
<div
  ref={(node) => {
    drag(node)
    drop(node)
  }}
/>
```

## Packages

| Package | Description |
| --- | --- |
| [`react-dnd`](./packages/react-dnd) | React bindings: `DndProvider`, `useDrag`, `useDrop`, `useDragLayer` |
| [`react-dnd-html5-backend`](./packages/backend-html5) | HTML5 drag-and-drop backend |
| [`react-dnd-touch-backend`](./packages/backend-touch) | Touch/pointer backend |
| [`react-dnd-test-backend`](./packages/backend-test) | Backend that scripts drags for tests |
| [`react-dnd-test-utils`](./packages/test-utils) | Test helpers (requires React >= 18.3) |
| [`dnd-core`](./packages/dnd-core) | Backend-agnostic drag-and-drop state machine |

## Developing

```sh
npm install          # npm workspaces; there is no Yarn here anymore
npm run build        # turbo: swc emits ESM, tsc emits declarations alongside
npm test             # Vitest against src/, on the installed React (19)
npm run test:matrix  # the same conformance suite on React 17, 18 and 19
npm run ci           # everything CI runs
```

Useful individual checks:

| Command | What it guards |
| --- | --- |
| `npm run check:types` | TypeScript 6, `@tsconfig/strictest`, all sources + specs |
| `npm run lint` | Biome (lint + format); replaces ESLint and Rome |
| `npm run check:exports` | `attw` (`esm-only` profile) — that the entrypoints resolve correct types |
| `npm run test:modules` | that the published entrypoints load, by `import` **and** by `require(esm)` |

## Documentation

The docs site lives in [`packages/docsite`](./packages/docsite) and is **not
currently part of the npm workspace** — it is a Gatsby 4 app that cannot install
alongside React 19 on Node 26. Its markdown is still the source of truth for the
prose docs and is kept up to date. See [MIGRATION.md](./MIGRATION.md).

## Credits

React DnD was created by [Dan Abramov](https://github.com/gaearon) and
maintained by [Chris Trevino](https://github.com/darthtrevino) and many
[contributors](https://github.com/react-dnd/react-dnd/graphs/contributors). This
fork stands entirely on their work.

Big thanks to [BrowserStack](https://www.browserstack.com) for letting the
maintainers use their service to debug browser issues.

<img src="/assets/browserstack-logo-600x315.png" height="80" title="BrowserStack Logo" alt="BrowserStack Logo" />

## License

MIT — see [LICENSE](./LICENSE). Original copyright is retained.
