# React _DnD_

Drag and Drop for React.

> **This is a maintained fork of [react-dnd/react-dnd](https://github.com/react-dnd/react-dnd),
> published as `@nosferatu500/*` and starting at `19.0.0`.** The scope keeps it
> clearly distinct from upstream on npm; the major matches the React version it
> targets, and skips 17 and 18 rather than implying releases that never existed.

## Why this fork

A maintained continuation of [`react-dnd`](https://www.npmjs.com/package/react-dnd)
by Dan Abramov and its contributors, preserving the complete git history.
Upstream's last release was `16.0.1` in June 2022 and its last commit to `main`
was in July 2025; it predates React 18's StrictMode effect semantics and React
19's ref-cleanup contract, and has shipped no fix for either.

The starting point was not a wish list. Upstream's **published** `16.0.1`
tarball does not match the shape its own repository is configured to build — no
`exports` map, no `module` field, no `files` field, and 44 files of ESM syntax
in a package that never declares `"type": "module"`. It is well-formed only for
bundlers lenient enough not to care, which is the most plausible root cause of
the single largest cluster of open issues upstream. The most basic documented
usage, `<div ref={drag} />`, does not compile under `@types/react@19`.

This fork targets React 19 and builds on it directly — `useSyncExternalStore`,
`ref` as a prop, context rendered as its own provider — rather than emulating
any of it.

### Comparison: upstream `16.0.1` vs this fork

| Aspect | Upstream 16.0.1 (Jun 2022) | This fork (19.x) |
| --- | --- | --- |
| **Maintenance** | No release since 2022 | Actively maintained |
| **React support** | Advertised `>= 16.14`; only 16/17 semantics tested | 19 only |
| **`<div ref={drag} />`** | Does not compile on `@types/react@19` | Compiles; connectors are `RefCallback` |
| **Module format** | ESM syntax, no `"type": "module"`, no `exports` map | ESM only, `exports` with a `types` condition, verified by [`attw`](https://arethetypeswrong.github.io) in CI |
| **Node** | Undeclared | `>= 22.12`, ES2025 shipped un-downleveled |
| **Accessibility** | None — no keyboard gesture exists, and nothing is announced | `react-dnd-keyboard-backend`: full keyboard drag with live-region narration |
| **Backends per provider** | One — a mouse *or* a finger | Any number, via `composeBackends` |
| **Async drops** | `drop: async () => …` silently swallowed its result | Supported, with `monitor.isSettling()` |
| **Collected props** | `useState` mirror, re-collected every render | `useSyncExternalStore` |
| **Runtime dependencies** | `redux@4` (CJS-only), `@react-dnd/asap`, `invariant`, `shallowequal` | `redux@5`, `queueMicrotask`, `fast-deep-equal` |
| **Published packages** | 9 | 7 |
| **Toolchain** | Yarn 3, Jest 29, ESLint + Rome, TypeScript 4.9 | npm workspaces, Vitest 4, Biome, TypeScript 6 |
| **Tests** | Jest | Vitest, 387 tests, StrictMode always on |

Beyond the packaging: a dozen behavioral defects are fixed, several of them
page-wide in effect — a single mounted `useDrop` used to disable HTML5 dragging
for the whole document, a drop from another library's drag threw out of an event
handler, and a dragged file could leave drag and drop broken for every later
provider. Each is listed in [MIGRATION.md](./MIGRATION.md) with the mechanism
and, where upstream had a patch open, why this fixes it differently.

### Migrating from upstream

Only the package *names* change; every import *name* is the same. Across an
entire monorepo — nine packages and the full example gallery — the migration
came to two lines of source changes. [MIGRATION.md](./MIGRATION.md) is the full
record of every breaking change and what to do about it;
[CHANGELOG.md](./CHANGELOG.md) has the release history.

## Supported versions

| | Supported |
| --- | --- |
| React | `^19.0.0` |
| Node | `>= 22.12` (Node 20 reached EOL 2026-04-30) |
| TypeScript (for consumers) | `>= 5.0` — `exports` carries `types` |
| Module format | **ESM only** (`require()` still works via `require(esm)`) |
| Language level | **ES2025**, shipped un-downleveled |

React 16, 17 and 18 are **no longer supported**. Use upstream `react-dnd@16.0.1`
if you need them — this fork has no earlier release, so there is no older version
of it to fall back to.

## Install

```sh
npm install @nosferatu500/react-dnd @nosferatu500/react-dnd-html5-backend
```

## Quick start

```tsx
import { DndProvider, useDrag, useDrop } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'

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
| [`@nosferatu500/react-dnd`](./packages/react-dnd) | React bindings: `DndProvider`, `useDrag`, `useDrop`, `useDragLayer` |
| [`@nosferatu500/react-dnd-html5-backend`](./packages/backend-html5) | HTML5 drag-and-drop backend |
| [`@nosferatu500/react-dnd-touch-backend`](./packages/backend-touch) | Touch/pointer backend |
| [`@nosferatu500/react-dnd-keyboard-backend`](./packages/backend-keyboard) | Keyboard and screen-reader accessible backend; wraps another backend |
| [`@nosferatu500/react-dnd-test-backend`](./packages/backend-test) | Backend that scripts drags for tests |
| [`@nosferatu500/react-dnd-test-utils`](./packages/test-utils) | Test helpers |
| [`@nosferatu500/dnd-core`](./packages/dnd-core) | Backend-agnostic drag-and-drop state machine |

## Developing

```sh
npm install          # npm workspaces; there is no Yarn here anymore
npm run build        # turbo: swc emits ESM, tsc emits declarations alongside
npm test             # Vitest against src/, on the installed React (19)
npm run test:react-root # the same suite against createRoot, without Testing Library
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
