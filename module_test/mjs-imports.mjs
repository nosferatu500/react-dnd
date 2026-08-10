/**
 * Verifies the ESM entrypoints load and export exactly the recorded public API.
 */
import * as core from '@nosferatu500/dnd-core'
import * as dnd from '@nosferatu500/react-dnd'
import * as htmlBackend from '@nosferatu500/react-dnd-html5-backend'
import * as keyboardBackend from '@nosferatu500/react-dnd-keyboard-backend'
import * as testBackend from '@nosferatu500/react-dnd-test-backend'
import * as testUtils from '@nosferatu500/react-dnd-test-utils'
import * as touchBackend from '@nosferatu500/react-dnd-touch-backend'

import { check } from './common.cjs'

check(core, 'core')
check(dnd, 'dnd')
check(htmlBackend, 'htmlBackend')
check(keyboardBackend, 'keyboardBackend')
check(touchBackend, 'touchBackend')
check(testBackend, 'testBackend')
check(testUtils, 'testUtils')

console.log(`👍 ESM OK on Node ${process.version}`)
