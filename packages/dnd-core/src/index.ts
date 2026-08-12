// Running several backends behind one provider. Also part of the
// backend-authoring contract: `Backend` and `BackendFactory` are defined here,
// so a combinator over them belongs here rather than in whichever backend
// happened to need it first.
export {
	CompositeBackend,
	composeBackends,
	getComposedBackends,
} from './classes/CompositeBackend.js'
export * from './createDragDropManager.js'
export * from './interfaces.js'
// Part of the backend-authoring contract, not an accident of packaging: every
// backend asserts its own preconditions, and they should all report them the
// same way. This lived in a separate published `@react-dnd/invariant` package
// until it was the only thing that package did.
export { invariant } from './utils/invariant.js'
