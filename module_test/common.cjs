const api = require('./api.json')

/**
 * Asserts that a package's runtime exports match the recorded public API
 * exactly — nothing missing, nothing unexpected.
 *
 * `require(esm)` hands back a module namespace object, which carries the named
 * exports plus a `default` that Node synthesises for interop. That `default` is
 * not part of the public API, so it is ignored here.
 */
function check(imported, libKey) {
	console.log('checking', libKey)
	const apiKeys = api[libKey]

	Object.keys(imported).forEach((key) => {
		if (key === 'default') {
			return
		}
		if (!apiKeys[key]) {
			throw new Error(`${libKey}: unexpected export: ${key}`)
		}
	})
	Object.keys(apiKeys).forEach((key) => {
		if (!imported[key]) {
			throw new Error(`${libKey}: missing export: ${key}`)
		}
	})
}

module.exports = { check }
