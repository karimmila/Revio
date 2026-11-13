import { describe, expect, it } from 'vitest'
import {
  pendingCreationOpensNativeChat,
  withPendingChatInput,
  type PendingWorktreeCreation,
  type WorktreeCreationRequest
} from './pending-worktree-creation'

const cloudRequest: WorktreeCreationRequest = {
  repoId: 'repo',
  name: 'squid',
  setupDecision: 'inherit',
  agent: 'claude',
  agentLaunchRoute: 'structured-native-chat',
  pendingFirstAgentMessageRename: false,
  note: '',
  startupPlan: null,
  quickPrompt: '',
  quickTelemetry: null,
  ephemeralVmRecipe: { sourceRepoId: 'repo', recipeId: 'vercel', projectId: 'p' }
}

function pending(request: WorktreeCreationRequest): PendingWorktreeCreation {
  return {
    creationId: 'creation',
    phase: 'provisioning-vm',
    status: 'creating',
    startedAt: 1,
    indeterminate: true,
    loaderVisible: true,
    heldChatMessage: 'Add a test',
    request
  }
}

describe('cloud creations in the workspace layout', () => {
  it('open their chat while the machine is set up only when the layout asked for it', () => {
    expect(pendingCreationOpensNativeChat(pending(cloudRequest))).toBe(false)
    expect(
      pendingCreationOpensNativeChat(pending({ ...cloudRequest, simpleCloudSetup: true }))
    ).toBe(true)
  })

  it('send the message queued during setup as the chat’s first message', () => {
    const request: WorktreeCreationRequest = { ...cloudRequest, simpleCloudSetup: true }
    expect(withPendingChatInput(pending(request), request)).toMatchObject({
      quickPrompt: 'Add a test',
      promptDelivery: 'auto-submit'
    })
    // Classic layout keeps the setup card, so nothing typed there is carried over.
    expect(withPendingChatInput(pending(cloudRequest), cloudRequest).quickPrompt).toBe('')
  })
})
