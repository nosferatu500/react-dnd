# Contributing

## Prerequisites

- Node `>= 20.19`
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
| `npm run build` | Turborepo: SWC emits `dist/cjs` + `dist/esm`, `tsc -b` emits declarations |
| `npm run lint` | Biome — lint **and** format (replaces ESLint + Rome) |
| `npm run check:types` | `tsc` over every source and spec under `@tsconfig/strictest` |
| `npm run check:exports` | `attw` — that `import` and `require` each resolve correctly typed entrypoints |
| `npm test` | Vitest, run against `src/` on the installed React |
| `npm run test:matrix` | the shared conformance suite on React 17, 18 and 19 |
| `npm run test:modules` | that the built ESM and CJS entrypoints load in Node |

Run `npm run lint:fix` to apply Biome's safe fixes.

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

React 17 and 18 are covered by `packages/react-dnd/src/__compat__`, which drives
each major's own root API directly and shares one assertion set
(`harness.tsx`). Each leg has its own Vitest config that aliases React into
`packages/compat-react1{7,8}/node_modules` — private workspaces that exist only
to pin an isolated, self-consistent React tree.

Adding an assertion to `harness.tsx` applies it to all three majors at once.
That is the point: behavioral drift between versions shows up as a failure
rather than as suites that quietly diverged.

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
