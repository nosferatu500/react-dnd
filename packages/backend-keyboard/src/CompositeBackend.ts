/**
 * `CompositeBackend` now lives in `dnd-core`, where `Backend` and
 * `BackendFactory` are defined — running several backends behind one provider
 * is not a keyboard concern, it is what any app needing more than one modality
 * has to do.
 *
 * Re-exported here so that `import { CompositeBackend } from
 * '@nosferatu500/react-dnd-keyboard-backend'` keeps working.
 *
 * @see composeBackends for building one
 */
export { CompositeBackend } from '@nosferatu500/dnd-core'
