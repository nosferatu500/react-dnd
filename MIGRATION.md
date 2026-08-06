# Migration notes

What changed relative to upstream `react-dnd@16.0.1`, and what you may need to
do about it.

---

## For consumers of the published packages

### React 16 and 17 are no longer supported

`peerDependencies.react` is now `^18.0.0 || ^19.0.0`. Upstream advertised
`>= 16.14` but only ever tested React 16/17 semantics. If you need React 16 or
17, stay on `react-dnd@16.0.1`.

React 18 is the floor because the library is now built on `useSyncExternalStore`
(see below), which React added in 18.0. Both supported majors are asserted by the
same conformance suite — see
[CONTRIBUTING.md](./CONTRIBUTING.md#testing-across-react-versions).

### Collected props are read with `useSyncExternalStore`

A dnd-core monitor *is* an external store: it holds drag state outside React and
announces changes through its own subscription API. `useCollector` previously
mirrored that into `useState` and subscribed from a layout effect, which had two
problems that React 18 made worse.

**Missed updates.** A monitor change landing between render and the subscribing
effect was lost. The old code compensated by re-running the collector on *every*
render — the comment on that line admitted the Dustbin stress test broke without
it. `useSyncExternalStore` re-checks the snapshot when it subscribes, so nothing
is missed and the polling is gone.

**Tearing.** Holding a `useState` mirror of external state means two components
rendering in a single concurrent pass can observe different drag state.
`useSyncExternalStore` is precisely the primitive that makes that impossible.

There is also a measurable side effect. `useDragLayer` subscribed with
`useEffect(() => monitor.subscribeToOffsetChange(...))` and **no dependency
array**, so every render tore both subscriptions down and rebuilt them — during a
drag, that is every pointer move. Subscriptions are now memoized on the monitor.
A regression test asserts the count stays flat across re-renders; it fails
against the old implementation (5 subscriptions after 3 re-renders, vs 2).

No API changed. `useDrag`, `useDrop` and `useDragLayer` have the same signatures
and the same collected output; `useCollector` was always internal.

One timing change worth knowing: the connector reconnect that fires when
collected props change used to run synchronously inside the monitor's change
callback, i.e. against the pre-render DOM. It is now a layout effect keyed on the
collected value, so it runs once the DOM matches what was collected.

### Connectors are now typed as `RefCallback` — `ref={drag}` typechecks again

**This is the headline fix.** React 19 narrowed callback refs to
`(instance) => void | (() => void)`, because a returned *function* is now
interpreted as a ref cleanup. Upstream's connector type was:

```ts
type DragElementWrapper<Options> = (
  elementOrNode: ConnectableElement,
  options?: Options,
) => ReactElement | null
```

Returning `ReactElement | null` is not assignable to `Ref<T>`, so under
`@types/react@19` this failed to compile:

```tsx
const [, drag] = useDrag({ type: 'box' })
return <div ref={drag} />
//          ^^^ Type 'ConnectDragSource' is not assignable to type 'Ref<HTMLDivElement>'
```

`DragElementWrapper` is now an overloaded interface whose ref-callback form
reports `void`, while the element-cloning and ref-object forms keep their old
return types. **Runtime behavior is unchanged** — the connector still returns
the node it was handed, and React 19 ignores non-function return values from
callback refs (verified, not assumed).

**Breaking, at the type level only:** chaining no longer typechecks.

```tsx
// Before — still works at runtime, no longer typechecks, and is a latent hazard
<div ref={(node) => drag(drop(node))} />

// After — call each connector from a block-bodied ref callback
<div
  ref={(node) => {
    drag(node)
    drop(node)
  }}
/>

// Or share a ref object
const ref = useRef(null)
drag(ref)
drop(ref)
return <div ref={ref} />
```

The arrow-with-implicit-return form was always the risky spelling: it hands
React whatever the connector returned. Prefer the block body.

### `DndProvider` no longer loses its global manager on remount

Upstream's refcount cleanup nulled the global manager slot when the count hit
zero, but never restored it when the effect mounted again. React 18 StrictMode
makes that deterministic (mount → unmount → mount), so the slot ended up `null`
while the provider kept using the manager it had captured during render. A
provider mounted *afterwards* then built a **second** manager, and drags could
not cross between the two trees.

The effect now re-asserts ownership of the slot on every mount. There is nothing
to do on your side; if you had worked around this by passing an explicit
`manager` prop, you can stop.

### The packages are now ESM only

Upstream shipped a single `dist/` of ESM-syntax `.js` files in a package with no
`"type": "module"` and no `exports` map — a shape that is neither valid CommonJS
nor valid ESM, and only worked because bundlers are lenient. Rather than paper
over that with a dual build, these packages are now **ESM only**:

```json
"type": "module",
"main": "./dist/index.js",
"types": "./dist/index.d.ts",
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  },
  "./package.json": "./package.json"
}
```

There is no `require` condition, no `dist/cjs`, and no `dist/esm` — one flavour
in one directory.

**`require()` still works.** `require(esm)` is unflagged and stable from Node
20.19.0 / 22.12.0 onward, and `engines.node` is `>= 22.12.0`, so every Node
version these packages support can `require()` them. That is guarded by a test
(`npm run test:modules`) rather than assumed — if it ever stops holding, the
ESM-only decision needs revisiting.

What this means in practice:

| Consumer | Works? |
| --- | --- |
| ESM (`import`) | yes |
| Bundlers (Vite, webpack 5, Rollup, esbuild, Next) | yes |
| `require()` on Node >= 22.12 | yes, via `require(esm)` |
| `require()` on Node < 20.19 | **no** — and those lines are EOL anyway |
| Jest with the default CJS transform | needs ESM support enabled, as for any ESM-only dependency |

**Layout change:** entrypoints moved from `dist/esm/index.mjs` (and upstream's
`dist/index.js`) to `dist/index.js`. Deep imports into `dist/` were never
supported; use the package entrypoint.

TypeScript resolution is now correct for the first time — upstream's `exports`
map had no `types` condition at all (in fact no `exports` map), so users on
`moduleResolution: node16`/`nodenext`/`bundler` could not resolve declarations.
`npm run check:exports` runs [`attw`](https://arethetypeswrong.github.io) with
its `esm-only` profile over all nine packages in CI, so this cannot regress.

### The packages target ES2025, and require Node >= 22.12

`engines.node` moved from `>= 20.19.0` to `>= 22.12.0`. Two reasons:

- **Node 20 reached end-of-life on 2026-04-30.** The supported lines are 22
  (Maintenance LTS), 24 (Active LTS) and 26 (Current).
- ES2024/ES2025 built-ins need it. `Promise.withResolvers` and the `Set`
  methods arrived in Node 22 (V8 12.4).

The TypeScript `target` and `lib` are now `ES2025`, and SWC runs with
`target: esnext`, meaning **nothing is downleveled** — the JavaScript you get is
the language level the sources are written in.

In practice this changed almost no output. Comparing the build before and after
the bump, **97 of 103 emitted files were byte-identical**; the six that differed
were exactly the six files edited by hand. That is expected: ES2023, ES2024 and
ES2025 added very little *syntax* (mostly regex flags and import attributes,
none of which this codebase uses) — their substance is new *built-ins*. So the
target bump is about which built-ins are allowed, not about how code is emitted.

Consumers bundling for older browsers were already transpiling this package's
ES2022 output if they needed to; that has not changed.

### `dnd-core` uses `redux@5` and `queueMicrotask`

Two dependency changes, both about correctness rather than bundle size:

**`redux@4` → `redux@5`.** Redux 4 is CommonJS-only with no `exports` map, which
is a wart inside an otherwise ESM-only dependency chain. Redux 5 ships proper ESM.
`createStore` is marked deprecated in v5's types but emits no runtime warning and
is still the right primitive for a store this small.

The upgrade caught a real modeling error. `Action<Payload>.type` was typed
`Identifier` (`string | symbol`) — but `Identifier` is the type of a drag *item*
type, and every dnd-core action type is a string constant
(`'dnd-core/HOVER'`, …). No reducer has ever matched a symbol. `type` is now
`string`. The store is also explicitly parameterized (`DndStore`,
`DndAction`) instead of falling back to Redux's `UnknownAction`, whose
`[extraProps: string]: unknown` index signature dnd-core's actions deliberately
lack. `DragDropManager.dispatch` is `dispatch(action: any)` in the public
interface, so nothing changed for consumers.

**`@react-dnd/asap` → `queueMicrotask`.** `dnd-core` used `asap()` in exactly one
place, to defer a handler-map delete by one microtask. `@react-dnd/asap` was a
~300-line `MutationObserver`-based scheduler written around 2014, before a
standard existed. `queueMicrotask` has been in every browser since 2018 and Node
11, with the same two guarantees the package was built for: the task runs in its
own turn before the next macrotask, and a throwing task does not prevent the rest
from running. `dnd-core` no longer depends on the package at all.

`@react-dnd/asap` itself is now a one-line wrapper around `queueMicrotask`,
marked `@deprecated`. Its `AsapQueue` and `TaskFactory` exports are gone — they
were implementation detail of the polyfill. Nothing in this repo used them, but
this is a breaking change to that package's surface if you imported them
directly.

### `react-dnd` no longer depends on `hoist-non-react-statics`

It was never imported — a leftover from the decorator API removed in v14. The
dependency, its `@types` peer, and the corresponding `peerDependenciesMeta`
entry are gone. One fewer transitive package, and one fewer CommonJS dependency.

### `react-dnd-test-utils` now requires React >= 18.3

It used to import `act` from `react-dom/test-utils`, which **React 19 removed**.
The only spelling that works on both currently maintained majors is `act` from
the `react` entrypoint, added in 18.3. Its peer range is therefore
`^18.3.0 || ^19.0.0`, and `@testing-library/react` peer is `>= 16`.

`react-dnd` itself needs only React 18.0, so the test helpers are one minor
version stricter than the library.

### `dnd-core`: `mapContainsValue` no longer throws on an empty map

An internal helper destructured `entries.next().value` before checking `done`,
which throws a `TypeError` on an empty `Map`. Rewritten as a plain
`for…of`. Reachable from `HandlerRegistry` lookups.

---

## For contributors to this repository

### Yarn 3 → npm workspaces

`.yarn/`, `.yarnrc.yml` and `yarn.lock` are gone. Use `npm install`.

Sibling dependencies use ordinary semver ranges instead of `workspace:^`, and
`portal:` links became normal workspace links — npm supports neither protocol,
and links local workspaces by version match instead.

`packageExtensions` from `.yarnrc.yml` were dropped; the peer-dependency
conflicts they patched no longer occur with npm's resolver.

### ESLint + Rome → Biome

Rome is archived; Biome is its successor and the repo already used Rome's
formatter. `@react-dnd/eslint-config` is deleted, as are all `.eslintrc.js`
files and the (now inert) `eslint-disable` comments throughout the sources.
`npm run lint` covers lint and format together.

Two rules are deliberately adjusted, both because they contradict something else
in the toolchain:

- `complexity/useLiteralKeys` is **off** — it wants `dataset.foo`, while
  `noPropertyAccessFromIndexSignature` (from `@tsconfig/strictest`) requires
  `dataset['foo']`.
- `correctness/noUnusedPrivateClassMembers` is **off** — it does not see reads
  through `const { xs, ys } = this` destructuring and its autofix deletes live
  fields.
- `a11y/useValidAriaRole` is off for examples and specs, which use non-standard
  `role` values as test hooks.

### Jest 29 → Vitest 4

`@react-dnd/jest-config` is deleted. There is one root `vitest.config.mts`; the
suite runs against `src/` via aliases, so `npm test` no longer needs a build and
coverage describes real source.

Spec-level changes you will notice:

- `jest.fn` → `vi.fn`, `jest.Mocked<T>` → `import type { Mocked } from 'vitest'`
- **`done` callbacks are gone** (Vitest 4 passes a `TestContext` as the second
  argument). Converted to `async` tests: see
  `packages/dnd-core/src/__tests__/deferred.ts`.
- `jest-dom` v7 no longer normalizes CSS color keywords, so
  `toHaveStyle('background-color: white')` must be written as the computed
  `rgb(255, 255, 255)`.
- Fake timers need `vi.useFakeTimers({ shouldAdvanceTime: true })` alongside
  Testing Library's `findBy*`, or its polling never fires and the test deadlocks
  rather than failing.

`reactStrictMode: true` is set globally in `vitest.setup.mts`. That is what
surfaced the `DndProvider` bug above.

### TypeScript 4.9 → 6.0

- `moduleResolution: "Node"` is rejected by TS6; the base config now uses
  `module: "Preserve"` + `moduleResolution: "Bundler"`, which matches the
  ESM-with-`.js`-specifiers sources that SWC transpiles into both flavors.
- `baseUrl` is deprecated in TS6 and removed; `paths` no longer needs it.
- Packages are TypeScript **project references** (`composite: true`), so each
  `tsconfig.json` enumerates all of `src/` rather than just the entry file.
- `verbatimModuleSyntax` is on.

### Build output

`scripts/esmify.mjs` — which renamed every ESM file to `.mjs` and rewrote import
specifiers with string replacement — is replaced by
`scripts/finalize-dist.mjs`, which stamps a `type` manifest into each output
directory and mirrors the declarations next to both JavaScript flavors.

### Removed packages

| Package | Why |
| --- | --- |
| `packages/eslint-config` | ESLint replaced by Biome |
| `packages/jest-config` | Jest replaced by Vitest |
| `packages/test-suite-cra` | Create React App is archived; Vite and Next cover bundler integration |

### New private packages

`packages/compat-react18` exists only to pin an isolated React 18 tree that the
compat suite aliases into. It is never published.

---

## Known gaps

### The docs site does not build

`packages/docsite` is a Gatsby 4 app (2022). Its dependency tree cannot resolve
alongside React 19, and `gatsby-plugin-sharp` does not build on current Node. It
has been removed from the npm workspace so that the library monorepo installs
cleanly; the markdown under `packages/docsite/markdown/` is still maintained and
is the source of truth for the prose docs.

Migrating it (to Astro, Docusaurus, or Next) is a separate piece of work and is
**not** done here.

### One test remains skipped

`DragDropManager.spec.ts` → `'throws in hover() if it contains the same target
twice (even if wrong type)'` was already `it.skip` upstream. It is unrelated to
this migration and is left as-is; see
[docs/upstream-triage.md](./docs/upstream-triage.md).

### `useCollector` still subscribes manually

`react-dnd` collects monitor state with `useState` + a layout-effect
subscription rather than `useSyncExternalStore`. That is the pattern
`useSyncExternalStore` exists to replace, and it is the likely root cause of
several upstream reports about stale collected props under concurrent rendering.
Changing it is a behavioral change that needs its own investigation — see the
triage document.
