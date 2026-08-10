/**
 * `act` comes from the `react` entrypoint.
 *
 * It used to live in `react-dom/test-utils`, which React 19 deleted outright.
 * That history is why this module exists at all; now that React 19 is the only
 * supported major there is nothing to reconcile, and this is a plain re-export
 * kept so callers have one import site if the entrypoint ever moves again.
 */
export { act } from 'react'
