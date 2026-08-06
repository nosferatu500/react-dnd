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
| `npm run test:matrix` | the shared conformance suite on React 18 and 19 |
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

## Testing across React versions

The main suite uses `@testing-library/react`, which requires React >= 18, and
resolves its own `react-dom/client` through Node — so it always runs on whatever
React is installed at the repo root (currently 19).

React 18 is covered locally by `packages/react-dnd/src/__compat__`, which drives
each major's own root API directly and shares one assertion set
(`harness.tsx`). Each leg has its own Vitest config; the 18 leg aliases React
into `packages/compat-react18/node_modules`, a private workspace that exists only
to pin an isolated, self-consistent React 18 tree.

Adding an assertion to `harness.tsx` applies it to both majors at once. That is
the point: behavioral drift between versions shows up as a failure rather than as
suites that quietly diverged.

Full end-to-end coverage of React 18 (through Testing Library, not just the
compat harness) happens in CI, which reinstalls React at each matrix version.

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
