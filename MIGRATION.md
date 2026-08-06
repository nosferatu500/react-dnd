# Migration notes

What changed relative to upstream `react-dnd@16.0.1`, and what you may need to
do about it.

---

## For consumers of the published packages

### React 16 is no longer supported

`peerDependencies.react` is now `^17.0.2 || ^18.0.0 || ^19.0.0`. Upstream
advertised `>= 16.14` but only ever tested React 16/17 semantics. If you are on
React 16, stay on `react-dnd@16.0.1`.

React 17, 18 and 19 are each asserted by the same conformance suite in CI — see
[CONTRIBUTING.md](./CONTRIBUTING.md#testing-across-react-versions).

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
return types. **Runtime behaviour is unchanged** — the connector still returns
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

### Published packages resolve types correctly for both `import` and `require`

Upstream's `exports` map had no `types` condition, so TypeScript users on
`moduleResolution: node16`/`nodenext`/`bundler` could not resolve declarations
for the ESM entrypoint at all. Each package now ships:

```json
"exports": {
  ".": {
    "import": { "types": "./dist/esm/index.d.ts", "default": "./dist/esm/index.js" },
    "require": { "types": "./dist/cjs/index.d.ts", "default": "./dist/cjs/index.js" }
  }
}
```

`npm run check:exports` runs [`attw`](https://arethetypeswrong.github.io) over
every package in CI, so this cannot regress.

**Layout change:** the ESM build is `dist/esm/*.js` (with
`dist/esm/package.json` declaring `"type": "module"`) instead of
`dist/esm/*.mjs`. Deep imports into `dist/` were never supported and are still
not; if you were reaching into `dist/esm/index.mjs` directly, use the package
entrypoint.

### `react-dnd-test-utils` now requires React >= 18.3

It used to import `act` from `react-dom/test-utils`, which **React 19 removed**.
The only spelling that works on both currently maintained majors is `act` from
the `react` entrypoint, added in 18.3. Its peer range is therefore
`^18.3.0 || ^19.0.0`, and `@testing-library/react` peer is `>= 16`.

`react-dnd` itself still supports React 17 — only the test helpers are stricter.

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
- `jest-dom` v7 no longer normalises CSS colour keywords, so
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
  ESM-with-`.js`-specifiers sources that SWC transpiles into both flavours.
- `baseUrl` is deprecated in TS6 and removed; `paths` no longer needs it.
- Packages are TypeScript **project references** (`composite: true`), so each
  `tsconfig.json` enumerates all of `src/` rather than just the entry file.
- `verbatimModuleSyntax` is on.

### Build output

`scripts/esmify.mjs` — which renamed every ESM file to `.mjs` and rewrote import
specifiers with string replacement — is replaced by
`scripts/finalize-dist.mjs`, which stamps a `type` manifest into each output
directory and mirrors the declarations next to both JavaScript flavours.

### Removed packages

| Package | Why |
| --- | --- |
| `packages/eslint-config` | ESLint replaced by Biome |
| `packages/jest-config` | Jest replaced by Vitest |
| `packages/test-suite-cra` | Create React App is archived; Vite and Next cover bundler integration |

### New private packages

`packages/compat-react17` and `packages/compat-react18` exist only to pin an
isolated React tree that the compat suites alias into. They are never published.

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
Changing it is a behavioural change that needs its own investigation — see the
triage document.
