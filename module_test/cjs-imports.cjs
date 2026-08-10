/**
 * Verifies that `require()` still works against these ESM-only packages.
 *
 * The packages ship ESM exclusively — there is no `require` condition in their
 * exports maps. `require(esm)` is nonetheless stable on every Node version this
 * repo supports (unflagged from 20.19.0 and 22.12.0 onward, and `engines.node`
 * is `>= 22.12.0`), so CommonJS consumers keep working without a dual build.
 *
 * This is the specific risk of going ESM-only, so it is worth a test rather than
 * an assumption. If it ever fails, the ESM-only decision needs revisiting.
 */
const core = require('dnd-core')
const dnd = require('react-dnd')
const htmlBackend = require('react-dnd-html5-backend')
const keyboardBackend = require('react-dnd-keyboard-backend')
const testBackend = require('react-dnd-test-backend')
const testUtils = require('react-dnd-test-utils')
const touchBackend = require('react-dnd-touch-backend')

const { check } = require('./common.cjs')

check(core, 'core')
check(dnd, 'dnd')
check(htmlBackend, 'htmlBackend')
check(touchBackend, 'touchBackend')
check(keyboardBackend, 'keyboardBackend')
check(testBackend, 'testBackend')
check(testUtils, 'testUtils')

console.log(`👍 require(esm) OK on Node ${process.version}`)
