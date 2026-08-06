import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Replaces the old CommonJS config that used `vite-react-jsx` — that plugin
 * existed to backport the React 17 automatic JSX runtime to Vite 2 and is
 * unmaintained. @vitejs/plugin-react handles the automatic runtime natively.
 */
export default defineConfig({
	plugins: [react()],
	build: {
		target: 'es2022',
	},
})
