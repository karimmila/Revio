import type { CreateHostedReviewResult } from '../../../../shared/source-control/hosted-review/hosted-review-contracts'
import { extractExecError } from '../../../git/exec-error'
import {
  githubAppNotInstalledOwner,
  isGithubAppSignInRequired
} from '../../../git/command-runner/github-app-auth'
import { isHostCommandMissing } from '../../../git/command-runner/github-cli-host-fallback'
import { requiredToolInstallHint } from '../../../../shared/missing-tool-install'
export function classifyCreatePRError(error: unknown): CreateHostedReviewResult {
  // Blocked before gh ran: the message is our own and names the next step.
  if (isGithubAppSignInRequired(error) || githubAppNotInstalledOwner(error) !== null) {
    return {
      ok: false,
      code: 'auth_required',
      error: `Create PR failed: ${error instanceof Error ? error.message : String(error)}`,
      reason: 'auth_required'
    }
  }
  if (isHostCommandMissing(error, 'gh')) {
    return {
      ok: false,
      code: 'unknown',
      error: `Create PR failed: the GitHub CLI (gh) is not installed. ${requiredToolInstallHint('gh', process.platform)}, then try again.`,
      reason: 'create_failed'
    }
  }
  const { stderr, stdout } = extractExecError(error)
  const message = `${stderr}\n${stdout}`.trim()
  if (message) {
    console.warn('createGitHubPullRequest failed:', message)
  }
  const lower = message.toLowerCase()
  if (
    lower.includes('not logged') ||
    lower.includes('not authenticated') ||
    lower.includes('authentication') ||
    lower.includes('gh auth login') ||
    lower.includes('http 401')
  ) {
    return {
      ok: false,
      code: 'auth_required',
      error:
        'Create PR failed: GitHub refused the sign-in. Next step: sign in with GitHub again in Settings > Account.',
      reason: 'auth_required'
    }
  }
  if (lower.includes('already exists') || lower.includes('a pull request already exists')) {
    return {
      ok: false,
      code: 'already_exists',
      error: 'A pull request already exists for this branch.',
      reason: 'existing_review'
    }
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return {
      ok: false,
      code: 'unknown_completion',
      error: 'PR creation may have completed. Refreshing branch review state...',
      reason: 'creation_unconfirmed'
    }
  }
  if (lower.includes('validation failed') || lower.includes('http 422')) {
    return {
      ok: false,
      code: 'validation',
      error:
        'Create PR failed: GitHub rejected the pull request. Check the base branch and branch state, then try again.',
      reason: 'rejected'
    }
  }
  return {
    ok: false,
    code: 'unknown',
    error: 'Create PR failed: GitHub could not create the pull request. Try again in a moment.',
    reason: 'create_failed'
  }
}

export function parseCreatePRPayload(stdout: string): { number: number; url: string } | null {
  const trimmed = stdout.trim()
  if (!trimmed) {
    return null
  }
  try {
    const parsed = JSON.parse(trimmed) as { number?: unknown; url?: unknown }
    const number = Number(parsed.number)
    const url = typeof parsed.url === 'string' ? parsed.url.trim() : ''
    if (Number.isInteger(number) && number > 0 && url) {
      return { number, url }
    }
  } catch {
    // Fall through to URL parsing for older gh versions without --json support.
  }
  // Enterprise PR URLs use the same path shape on custom hosts.
  const urlMatch = trimmed.match(/https?:\/\/[^\s/]+\/[^\s/]+\/[^\s/]+\/pull\/(\d+)/)
  if (!urlMatch) {
    return null
  }
  return { number: Number(urlMatch[1]), url: urlMatch[0] }
}
