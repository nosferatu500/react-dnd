# react-dnd-test-utils

Testing helpers for React DnD apps. Requires React >= 18.3.

Part of [React DnD](https://github.com/nosferatu500/react-dnd) — a maintained
fork of [react-dnd/react-dnd](https://github.com/react-dnd/react-dnd).

## Install

```sh
npm install react-dnd-test-utils
```

## Supported React versions

`^18.3.0 || ^19.0.0` (stricter than `react-dnd` itself, see below)

React 16 and 17 are not supported; use the upstream `16.0.1` release if you
need them.

`react-dnd-test-utils` re-exports `act` from the `react` entrypoint, which only
exists from React 18.3 — React 19 removed `react-dom/test-utils` entirely, and
that was the only other place `act` ever lived. `react-dnd` itself needs just
React 18.0, so these helpers are one minor version stricter than the library.

## Module format

**ESM only.** There is no CommonJS build. `require()` still works on Node
>= 22.12, where `require(esm)` is stable, and every modern bundler handles it
natively.

## Documentation

https://github.com/nosferatu500/react-dnd#readme

## License

MIT. See [LICENSE](./LICENSE); the original React DnD copyright is retained.
