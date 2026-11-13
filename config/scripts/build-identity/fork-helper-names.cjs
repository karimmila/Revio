// Bundle names of the macOS helpers, from the fork's product name. They show in the macOS
// Accessibility and Screen Recording lists and in Activity Monitor. src/shared/fork-identity.ts
// builds the same names for the running app; fork-helper-names.test.ts keeps the two in step.
const forkIdentity = require('../../../src/shared/fork-identity.json')

const COMPUTER_USE_HELPER_NAME = `${forkIdentity.productName} Computer Use`
const TERMINAL_HOST_HELPER_NAME = `${forkIdentity.productName} Terminal Host`

module.exports = {
  PRODUCT_NAME: forkIdentity.productName,
  CLI_COMMAND_NAME: forkIdentity.cliCommandName,
  COMPUTER_USE_HELPER_NAME,
  COMPUTER_USE_HELPER_APP: `${COMPUTER_USE_HELPER_NAME}.app`,
  TERMINAL_HOST_HELPER_NAME,
  TERMINAL_HOST_HELPER_APP: `${TERMINAL_HOST_HELPER_NAME}.app`
}
