import { describe, expect, it } from 'vitest'
import {
  CLOUD_GITHUB_REST_NOTE,
  DEFAULT_REVIO_PROMPTS,
  createPrPrompt,
  manualPrBody,
  promptForWorkspace,
  revioCliCommandName
} from './revio-prompts'
import { FORK_PRODUCT_NAME } from '../../../../shared/fork-identity'
import { CLOUD_PR_COMMAND_PATH } from '../../../../shared/cloud/cloud-pr-command'

const LINK = 'revio://workspace?id=wt-1'

describe('createPrPrompt', () => {
  it('sends the Create PR preferences alone by default', () => {
    expect(createPrPrompt({ prompts: undefined, draft: false, workspaceLink: null })).toBe(
      DEFAULT_REVIO_PROMPTS.createPr
    )
  })

  it('asks for a draft and the workspace link when asked', () => {
    const prompt = createPrPrompt({
      prompts: { createPr: 'Ship it.' },
      draft: true,
      workspaceLink: LINK
    })
    expect(prompt).toBe(
      `Ship it. Open it as a draft pull request. End the PR description with a link to this ${FORK_PRODUCT_NAME} workspace: ${LINK}`
    )
  })

  it('puts the link after a separator in a manual PR body', () => {
    expect(manualPrBody(LINK)).toContain(`${FORK_PRODUCT_NAME} workspace: ${LINK}`)
  })
})

describe('promptForWorkspace', () => {
  it('tells a cloud workspace to use REST when the prompt works on a pull request', () => {
    const prompt = DEFAULT_REVIO_PROMPTS.createPr
    expect(promptForWorkspace(prompt, true)).toBe(`${prompt}\n\n${CLOUD_GITHUB_REST_NOTE}`)
    expect(promptForWorkspace('Run `gh run list`.', true)).toContain(CLOUD_GITHUB_REST_NOTE)
    expect(promptForWorkspace('Review the diff.', true)).toBe('Review the diff.')
  })

  it("tells a local workspace to push and open the pull request through the app's command", () => {
    for (const id of ['createPr', 'fixErrors', 'resolveConflicts'] as const) {
      const sent = promptForWorkspace(DEFAULT_REVIO_PROMPTS[id], false, 'revio')
      expect(sent).toContain('`revio pr push`')
      expect(sent).toContain('`revio pr create --title "<title>" --body-file <file>`')
      expect(sent).not.toContain(CLOUD_GITHUB_REST_NOTE)
      // The agent must not fall back to the person's own gh or to a plain push.
      expect(sent).toContain('Use only these `revio pr` commands')
      expect(sent).toContain('Do not run `gh` or `git push` yourself')
      expect(sent).toContain('stop and report the exact error')
    }
  })

  it('gives a cloud workspace one command for the pull request and its checks', () => {
    for (const id of ['createPr', 'fixErrors', 'resolveConflicts'] as const) {
      const sent = promptForWorkspace(DEFAULT_REVIO_PROMPTS[id], true)
      expect(sent).toContain(
        `\`${CLOUD_PR_COMMAND_PATH} create --title "<title>" --body-file <file>\``
      )
      expect(sent).toContain(`\`${CLOUD_PR_COMMAND_PATH} checks\``)
      expect(sent).toContain('do not write the pull request call by hand')
    }
  })

  it("reads failing checks through the app's command on this Mac, and through REST in the cloud", () => {
    const local = promptForWorkspace(DEFAULT_REVIO_PROMPTS.fixErrors, false, 'revio')
    expect(local).toContain('`revio pr checks`; add `--logs`')
    expect(DEFAULT_REVIO_PROMPTS.fixErrors).not.toContain('gh ')
    const cloud = promptForWorkspace(DEFAULT_REVIO_PROMPTS.fixErrors, true)
    expect(cloud).toContain('check-runs')
    expect(cloud).toContain('`gh run view <id> --log-failed`')
    expect(cloud).not.toContain('pr checks --logs')
  })

  it('leaves a local review prompt alone: it must not push', () => {
    expect(promptForWorkspace(DEFAULT_REVIO_PROMPTS.review, false, 'revio')).toBe(
      DEFAULT_REVIO_PROMPTS.review
    )
  })

  it('names the dev command in a dev build', () => {
    expect(revioCliCommandName(true)).toBe('orca-dev')
    expect(revioCliCommandName(false)).toBe('revio')
  })
})
