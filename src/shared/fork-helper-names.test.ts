import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { FORK_COMPUTER_USE_HELPER_NAME, FORK_TERMINAL_HOST_HELPER_NAME } from './fork-identity'

const require = createRequire(import.meta.url)

// The build scripts name the helper bundles and the running app looks them up by name, so the
// two sides must agree or the packaged app cannot find its own helpers.
describe('macOS helper bundle names', () => {
  it('are the same in the build scripts and the app', () => {
    const buildNames: unknown = require('../../config/scripts/build-identity/fork-helper-names.cjs')
    expect(buildNames).toMatchObject({
      COMPUTER_USE_HELPER_NAME: FORK_COMPUTER_USE_HELPER_NAME,
      COMPUTER_USE_HELPER_APP: `${FORK_COMPUTER_USE_HELPER_NAME}.app`,
      TERMINAL_HOST_HELPER_NAME: FORK_TERMINAL_HOST_HELPER_NAME,
      TERMINAL_HOST_HELPER_APP: `${FORK_TERMINAL_HOST_HELPER_NAME}.app`
    })
  })

  it('do not carry the upstream product name', () => {
    expect(FORK_COMPUTER_USE_HELPER_NAME).not.toMatch(/orca/i)
    expect(FORK_TERMINAL_HOST_HELPER_NAME).not.toMatch(/orca/i)
  })
})
