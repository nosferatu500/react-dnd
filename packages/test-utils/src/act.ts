import { act as reactAct } from 'react'

/**
 * `act` moved entrypoints across React majors:
 *
 * - React 17/18 exposed it from `react-dom/test-utils`
 * - React 18.3 added it to the `react` entrypoint and deprecated the old one
 * - React 19 **removed** `react-dom/test-utils` entirely
 *
 * Importing from `react` is the only spelling that works on both currently
 * supported majors, which is why this package requires React >= 18.3 even
 * though `react-dnd` itself still supports React 17.
 */
export const act = reactAct
