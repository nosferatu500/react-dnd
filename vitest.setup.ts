import '@testing-library/jest-dom/vitest'

import { configure } from '@testing-library/react'

configure({
	// react-dnd's effects settle on the microtask queue; the default 1s timeout
	// is generous, but a tighter one surfaces hangs in CI instead of stalling.
	asyncUtilTimeout: 2000,
	reactStrictMode: true,
})
