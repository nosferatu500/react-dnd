---
path: '/examples/regression/chained-connectors'
title: 'Chained Connectors'
---

Two connectors on one element, plus a third on a child. Regression example of
[#1465](https://github.com/react-dnd/react-dnd/pull/1465).

It used to chain the connectors by passing elements through them —
`drop(preview(<div>…</div>))`. Connectors no longer accept elements; both are
called from one block-bodied `ref` callback instead.

<view-source name="07-regression/chained-connectors" component="other-chained-connectors">
</view-source>
