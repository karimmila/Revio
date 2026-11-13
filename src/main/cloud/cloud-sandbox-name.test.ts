import { describe, expect, it } from 'vitest'
import { FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'
import { workspaceSandboxName } from './cloud-sandbox-name'

describe('workspaceSandboxName', () => {
  it("names a new sandbox after the fork's command, without the recipe's orca- id prefix", () => {
    expect(workspaceSandboxName('orca-0123456789abcdef0123456789')).toBe(
      `${FORK_CLI_COMMAND_NAME}-0123456789abcdef01`
    )
    expect(workspaceSandboxName('custom-id')).toBe(`${FORK_CLI_COMMAND_NAME}-custom-id`)
  })
})
