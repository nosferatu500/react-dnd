/**
 * Verifies the ESM entrypoints load and export exactly the recorded public API.
 */
import * as core from 'dnd-core'
import * as dnd from 'react-dnd'
import * as htmlBackend from 'react-dnd-html5-backend'
import * as testBackend from 'react-dnd-test-backend'
import * as testUtils from 'react-dnd-test-utils'
import * as touchBackend from 'react-dnd-touch-backend'

import { check } from './common.cjs'

check(core, 'core')
check(dnd, 'dnd')
check(htmlBackend, 'htmlBackend')
check(touchBackend, 'touchBackend')
check(testBackend, 'testBackend')
check(testUtils, 'testUtils')

console.log(`👍 ESM OK on Node ${process.version}`)
