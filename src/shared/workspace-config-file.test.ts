import { describe, expect, it } from 'vitest'
import { FORK_CLI_COMMAND_NAME } from './fork-identity'
import {
  LEGACY_WORKSPACE_CONFIG_FILE,
  WORKSPACE_CONFIG_FILE,
  pickWorkspaceConfigFile
} from './workspace-config-file'

describe('workspace config file name', () => {
  it("is named after this app's command", () => {
    expect(WORKSPACE_CONFIG_FILE).toBe(`${FORK_CLI_COMMAND_NAME}.yaml`)
    expect(WORKSPACE_CONFIG_FILE).not.toBe(LEGACY_WORKSPACE_CONFIG_FILE)
  })

  it("reads this app's file when the repo has both", () => {
    expect(pickWorkspaceConfigFile(() => true)).toBe(WORKSPACE_CONFIG_FILE)
  })

  it("falls back to upstream's file name", () => {
    expect(pickWorkspaceConfigFile((name) => name === LEGACY_WORKSPACE_CONFIG_FILE)).toBe(
      LEGACY_WORKSPACE_CONFIG_FILE
    )
    expect(pickWorkspaceConfigFile(() => false)).toBe(LEGACY_WORKSPACE_CONFIG_FILE)
  })
})
