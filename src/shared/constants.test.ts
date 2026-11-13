import { describe, expect, it } from 'vitest'
import {
  getDefaultSettings,
  getDefaultWorkspaceDir,
  getLegacyDefaultWorkspaceDir
} from './constants'
import { FORK_HOME_FOLDER_NAME } from './fork-identity'

describe('stock workspace folders', () => {
  it("keeps upstream's folder name out of a new profile and available for an older one", () => {
    expect(getDefaultWorkspaceDir('/Users/alice')).not.toContain('/orca/')
    expect(getLegacyDefaultWorkspaceDir('/Users/alice')).toBe('/Users/alice/orca/workspaces')
  })
})

describe('getDefaultSettings', () => {
  it('uses platform-consistent separators for the default workspace directory', () => {
    expect(getDefaultSettings('/Users/alice').workspaceDir).toBe(
      `/Users/alice/${FORK_HOME_FOLDER_NAME}/workspaces`
    )
    expect(getDefaultSettings('C:\\Users\\alice').workspaceDir).toBe(
      `C:\\Users\\alice\\${FORK_HOME_FOLDER_NAME}\\workspaces`
    )
  })
})
