# Contributing

## Prerequisites

- Node `>= 22.12`
- npm `>= 10` (this repo uses **npm workspaces**; Yarn is no longer used)

## Getting started

```sh
npm install
npm run build
npm test
```

`npm install` links the workspace packages together. Sibling packages are
declared with ordinary semver ranges (e.g. `"dnd-core": "^16.0.1"`) rather than
Yarn's `workspace:` protocol, which npm does not support — npm links a local
workspace automatically when its version satisfies the range.

## Checks

`npm run ci` runs everything the pipeline does. The individual pieces:

| Command | What it guards |
| --- | --- |
| `npm run build` | Turborepo: SWC emits `dist/*.js`, `tsc -b` emits declarations alongside |
| `npm run lint` | Biome — lint **and** format (replaces ESLint + Rome) |
| `npm run check:types` | `tsc` over every source and spec under `@tsconfig/strictest` |
| `npm run check:exports` | `attw` (`esm-only` profile) — that the entrypoints resolve correct types |
| `npm test` | Vitest, run against `src/` on the installed React |
| `npm run test:react-root` | the library against React's own `createRoot`, with no Testing Library |
| `npm run test:modules` | that the built entrypoints load by `import` and by `require(esm)` |

Run `npm run lint:fix` to apply Biome's safe fixes.

## Language level

`target` and `lib` are **ES2025** and SWC does no downleveling, so whatever you
write is what ships.

`lib` runs slightly ahead of the runtime floor (`engines.node` is 22.12), so TS
will happily let you call a built-in that Node 22 does not have. Before reaching
for something very new, check its availability — `RegExp.escape`, for instance,
is Node 24+, which is why `vitest.aliases.mjs` still escapes by hand. CI's lowest
leg runs the floor exactly so this is caught.

One deliberate omission: `union()` in `backend-html5` does **not** use the ES2025
`Set` methods, because `Set.prototype.union` would raise that package's *browser*
floor to Chrome 122 / Safari 17 / Firefox 127 for no gain over
`[...new Set([...a, ...b])]`.

> Avoid `biome check --write --unsafe`. Two of its unsafe fixes are actively
> wrong for this codebase: `noUnusedPrivateClassMembers` deletes private fields
> that are only read through `const { x } = this` destructuring, and
> `useValidAriaRole` strips the non-standard `role` attributes the example
> components use as test hooks. Both are configured off or scoped in
> `biome.json`, but `--unsafe` can still surprise you elsewhere.

## Testing

React 19 is the only supported major, so there is no version matrix. The main
suite runs through `@testing-library/react`, which resolves its own
`react-dom/client` through Node and therefore always uses the React installed at
the repo root.

`packages/react-dnd/src/__compat__` is the one suite that does not use Testing
Library: it mounts with `createRoot` directly, so a regression RTL happens to
paper over still fails. It has its own Vitest config
(`vitest.react-root.config.mts`) purely to skip `vitest.setup.mts`, which imports
RTL. Run it with `npm run test:react-root`.

That directory used to hold a cross-version harness with a React 18 leg aliased
into a private pinned workspace. Both are gone; the RTL-free coverage was worth
keeping on its own.

### React must not complain

`vitest.console-guard.mts` is a setup file for both configs. It records anything
React writes to `console.error`/`console.warn` that looks like a warning or a
deprecation, and throws from `afterEach`, so the test that caused it fails.

This replaced a `onConsoleLog` hook that had never worked: throwing from that
hook happens inside Vitest's log handler rather than inside the test, so the
message printed and the run still went green. That is how "Accessing element.ref
was removed in React 19" survived on every element-form connector call. If you
add a case React legitimately warns about, widen the pattern deliberately —
do not reach for a local `console.error` mock.

## Releasing

Versions are bumped with `npm version --workspaces`, which also updates sibling
ranges. `npm run release` runs a clean CI pass and then `turbo run release`,
which publishes each package with provenance.

## The docs site

`packages/docsite` is **not** in the npm workspace. It is a Gatsby 4 app whose
dependency tree cannot resolve alongside React 19 on modern Node. Its markdown
under `packages/docsite/markdown/` is still the source of truth for the prose
docs — please keep it current — but the site itself needs migrating before it
can build again. See `MIGRATION.md`.
