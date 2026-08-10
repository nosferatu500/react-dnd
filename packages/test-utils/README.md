# react-dnd-test-utils

Testing helpers for React DnD apps.

Part of [React DnD](https://github.com/nosferatu500/react-dnd) — a maintained
fork of [react-dnd/react-dnd](https://github.com/react-dnd/react-dnd).

## Install

```sh
npm install react-dnd-test-utils
```

## Supported React versions

`^19.0.0`

React 16, 17 and 18 are not supported. Use the upstream `16.0.1` release for
React 16/17.

`react-dnd-test-utils` uses `act` from the `react` entrypoint. React 19 removed
`react-dom/test-utils`, which was the only other place `act` ever lived.

## Module format

**ESM only.** There is no CommonJS build. `require()` still works on Node
>= 22.12, where `require(esm)` is stable, and every modern bundler handles it
natively.

## Documentation

https://github.com/nosferatu500/react-dnd#readme

## License

MIT. See [LICENSE](./LICENSE); the original React DnD copyright is retained.
