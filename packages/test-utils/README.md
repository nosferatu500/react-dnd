# react-dnd-test-utils

Testing helpers for React DnD apps. Requires React >= 18.3.

Part of [React DnD](https://github.com/nosferatu500/react-dnd) — a maintained
fork of [react-dnd/react-dnd](https://github.com/react-dnd/react-dnd).

## Install

```sh
npm install react-dnd-test-utils
```

## Supported React versions

`^17.0.2 || ^18.0.0 || ^19.0.0` (this package needs React >= 18.3, see below)

React 16 is not supported; use the upstream `16.0.1` release if you need it.

`react-dnd-test-utils` re-exports `act` from the `react` entrypoint, which only
exists from React 18.3. React 19 removed `react-dom/test-utils` entirely, so
there is no spelling that covers React 17 as well. `react-dnd` itself still
supports React 17.

## Documentation

https://github.com/nosferatu500/react-dnd#readme

## License

MIT. See [LICENSE](./LICENSE); the original React DnD copyright is retained.
