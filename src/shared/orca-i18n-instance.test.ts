import { describe, expect, it } from 'vitest'
import { createOrcaI18n } from './orca-i18n-instance'
import { FORK_CLI_COMMAND_NAME, FORK_PRODUCT_NAME } from './fork-identity'

describe('createOrcaI18n', () => {
  it('fills the product name and CLI command into fallbacks and catalog entries', () => {
    const { translate } = createOrcaI18n({
      loadCatalog: () => undefined,
      englishResources: { restart: 'Restart {{productName}} to apply it.' }
    })

    expect(translate('restart', 'unused')).toBe(`Restart ${FORK_PRODUCT_NAME} to apply it.`)
    expect(translate('missing', 'Run `{{cliCommand}} status` in {{productName}}.')).toBe(
      `Run \`${FORK_CLI_COMMAND_NAME} status\` in ${FORK_PRODUCT_NAME}.`
    )
  })

  it('lets a caller still pass its own interpolation values beside the defaults', () => {
    const { translate } = createOrcaI18n({ loadCatalog: () => undefined, englishResources: {} })

    expect(translate('k', '{{productName}} found {{count}} repos', { count: 3 })).toBe(
      `${FORK_PRODUCT_NAME} found 3 repos`
    )
  })
})
