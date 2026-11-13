import { describe, expect, it } from 'vitest'
import {
  communityCatalogSource,
  isAnyDefaultCatalogEnabled,
  isCommunityCatalogUrl,
  isDisabledDefaultCatalogUrl,
  officialCatalogSource
} from './plugin-default-catalogs'
import { parsePluginInstallLink } from './plugin-install-link'

const UPSTREAM_OFFICIAL = 'https://github.com/stablyai/orca-plugins.git'
const UPSTREAM_COMMUNITY = 'git@github.com:stablyai/orca-community-plugins.git'

// fork-identity.json ships both catalog services null.
describe('default plugin catalogs in this build', () => {
  it('names no official or community catalog', () => {
    expect(officialCatalogSource()).toBeNull()
    expect(communityCatalogSource()).toBeNull()
    expect(isAnyDefaultCatalogEnabled()).toBe(false)
  })

  it('treats the upstream catalogs as turned off, and any other catalog as the user’s own', () => {
    expect(isDisabledDefaultCatalogUrl(UPSTREAM_OFFICIAL)).toBe(true)
    expect(isDisabledDefaultCatalogUrl(UPSTREAM_COMMUNITY)).toBe(true)
    expect(isDisabledDefaultCatalogUrl('https://github.com/acme/catalog.git')).toBe(false)
    expect(isCommunityCatalogUrl(UPSTREAM_COMMUNITY)).toBe(true)
  })

  it('refuses install links that would reach a turned-off catalog', () => {
    expect(parsePluginInstallLink('orca://plugins/acme.dusk')).toBeNull()
    expect(parsePluginInstallLink('orca://plugins/acme.dusk?catalog=official')).toBeNull()
    expect(parsePluginInstallLink('orca://plugins/acme.dusk?catalog=community')).toBeNull()
    expect(
      parsePluginInstallLink(
        `orca://plugins/acme.dusk?catalog=${encodeURIComponent(UPSTREAM_COMMUNITY)}`
      )
    ).toBeNull()
    expect(
      parsePluginInstallLink(
        `orca://plugins/acme.dusk?catalog=${encodeURIComponent('https://github.com/acme/catalog.git')}`
      )?.catalog
    ).toMatchObject({ kind: 'url' })
  })
})
