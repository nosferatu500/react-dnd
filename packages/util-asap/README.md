# @react-dnd/asap

**Deprecated.** Use the platform's `queueMicrotask` instead.

This package predates `queueMicrotask` — it was a ~300-line `MutationObserver`
based microtask scheduler. `queueMicrotask` has been available in every browser
since 2018 and in Node 11, with the same guarantees, so `asap()` is now a
one-line wrapper around it and `dnd-core` no longer depends on this package at
all.

Part of [React DnD](https://github.com/nosferatu500/react-dnd) — a maintained
fork of [react-dnd/react-dnd](https://github.com/react-dnd/react-dnd).

## Install

```sh
npm install @react-dnd/asap
```

## Supported React versions

`^18.0.0 || ^19.0.0`

React 16 and 17 are not supported; use the upstream `16.0.1` release if you
need them.

## Module format

**ESM only.** There is no CommonJS build. `require()` still works on Node
>= 22.12, where `require(esm)` is stable, and every modern bundler handles it
natively.

## Documentation

https://github.com/nosferatu500/react-dnd#readme

## License

MIT. See [LICENSE](./LICENSE); the original React DnD copyright is retained.
