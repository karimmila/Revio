import type { RevioPrompts } from '../../../../shared/revio-layout-settings-types'
import { FORK_CLI_COMMAND_NAME, FORK_PRODUCT_NAME } from '../../../../shared/fork-identity'
import { SHARED_ACTIONS_FILE, SHARED_ACTIONS_FILES } from '../../../../shared/actions/repo-actions'
import { CLOUD_PR_COMMAND_PATH } from '../../../../shared/cloud/cloud-pr-command'

export type RevioPromptId = keyof RevioPrompts

/**
 * Prompts behind the workspace layout's one-click agent actions; Settings > Prompts overrides them.
 */
export const DEFAULT_REVIO_PROMPTS: Required<RevioPrompts> = {
  review: [
    'Review the changes on this branch against its base: the commits since the merge base, plus',
    'staged, unstaged and untracked files. Report real bugs, risky changes and missing tests, most',
    'severe first, each with file:line. Do not edit files, commit or push.'
  ].join(' '),
  createPr: [
    'Open a pull request for this branch. Commit any uncommitted work with a clear message, push the',
    'branch, then open the pull request with a short title and a description written from the diff.',
    'Reply with the PR link.'
  ].join(' '),
  fixErrors: [
    "This branch's pull request has failing checks. Read the failing checks and their logs, find",
    'the cause, fix it, run the relevant tests locally, then commit and push the fix. Reply with',
    'what failed and what you changed.'
  ].join(' '),
  resolveConflicts: [
    "This branch's pull request has merge conflicts with its base. Fetch the base branch, merge it",
    'into this branch, resolve every conflict keeping the intent of both sides, run the relevant',
    'tests, then commit and push. Reply with the files you resolved and any judgement calls.'
  ].join(' ')
}

/**
 * Appended to a cloud workspace's prompts that use `gh`: the sandbox firewall passes only REST
 * calls for its own repository (GraphQL reaches every repository the token covers, so it is
 * closed), and `gh pr create/view/checks` are GraphQL. The sandbox has one command that makes the
 * allowed calls; the plain `gh api` form stays as the fallback for a sandbox without it.
 */
export const CLOUD_GITHUB_REST_NOTE = [
  'This workspace runs in a cloud sandbox where GitHub allows only REST calls for this repository:',
  '`gh pr create`, `gh pr view` and `gh pr checks` use GraphQL and are refused, and',
  '`gh auth status` reports the token as invalid although pushes and REST calls work.',
  `Use \`${CLOUD_PR_COMMAND_PATH}\` instead.`,
  `To open the pull request, write the description to a file and run \`${CLOUD_PR_COMMAND_PATH} create --title "<title>" --body-file <file>\``,
  '(add `--draft` for a draft, `--base <branch>` for another base branch); it pushes first and',
  'prints the PR link, and when the branch already has a pull request it pushes and prints that link.',
  `To push commits, run \`${CLOUD_PR_COMMAND_PATH} push\`. To read the checks, run \`${CLOUD_PR_COMMAND_PATH} checks\`;`,
  'for the log of a failing run, `gh run view <id> --log-failed`.',
  'Do not run `gh pr create` and do not write the pull request call by hand.',
  'Only when that command does not exist, use `gh api repos/{owner}/{repo}/pulls -f head=<branch>',
  '-f base=<base> -f title=<title> -f body=<body>` (add `-F draft=true` for a draft) with the real',
  'title and description, and `gh api repos/{owner}/{repo}/commits/<sha>/check-runs` for checks.',
  'If the command fails, stop and report the exact error.',
  'Merging, deleting branches and changing other repositories are not possible from the sandbox.'
].join(' ')

/** The command agents run to reach this app: the installed name, or the dev build's own. */
export function revioCliCommandName(dev: boolean = import.meta.env.DEV): string {
  return dev ? 'orca-dev' : FORK_CLI_COMMAND_NAME
}

/**
 * Appended to a local workspace's prompts that push, open a pull request or read its checks. The
 * agent's own `git` and `gh` use whatever logins the person has on this Mac, often none; the app's
 * commands do the push, the pull request and the check reads with the app's GitHub sign-in, and
 * the agent never sees a token.
 */
export function localGithubNote(command: string = revioCliCommandName()): string {
  return [
    `This workspace runs on this Mac, where \`git push\`, \`gh pr create\` and \`gh pr checks\` may have no GitHub login. Use ${FORK_PRODUCT_NAME}'s own commands instead; they use ${FORK_PRODUCT_NAME}'s GitHub sign-in.`,
    `To push commits, run \`${command} pr push\`.`,
    `To open the pull request, write the description to a file and run \`${command} pr create --title "<title>" --body-file <file>\` (add \`--draft\` for a draft, \`--base <branch>\` for another base branch); it pushes first and prints the PR link, and when the branch already has a pull request it pushes and prints that link.`,
    `To read the pull request's checks, run \`${command} pr checks\`; add \`--logs\` for the failed steps and the end of each failing job log.`,
    `Use only these \`${command} pr\` commands for pushing, for the pull request and for its checks. Do not run \`gh\` or \`git push\` yourself, and do not call the GitHub API another way.`,
    'If a command fails or is not found, stop and report the exact error; do not try another way to push or to open the pull request.',
    'If a command says to sign in or to install the GitHub App, stop and tell the user what it said.'
  ].join(' ')
}

const USES_GH = /(^|[^\w-])gh\s/
const USES_PULL_REQUEST = /\bpull request\b/i

/**
 * A prompt for a workspace. One that runs `gh` or works on a pull request gets the note for where
 * it runs: REST-only `gh api` in a cloud sandbox, the app's own push and PR commands on this Mac.
 */
export function promptForWorkspace(
  prompt: string,
  cloud: boolean,
  command: string = revioCliCommandName()
): string {
  if (!USES_GH.test(prompt) && !USES_PULL_REQUEST.test(prompt)) {
    return prompt
  }
  return `${prompt}\n\n${cloud ? CLOUD_GITHUB_REST_NOTE : localGithubNote(command)}`
}

export function revioPrompt(prompts: RevioPrompts | undefined, id: RevioPromptId): string {
  const custom = prompts?.[id]?.trim()
  return custom ? custom : DEFAULT_REVIO_PROMPTS[id]
}

/**
 * The Create PR instruction: the Create PR preferences, the draft request, and, with Settings > Git >
 * "Include link to workspace in PR description" on, the workspace's Orca link for the PR body.
 */
export function createPrPrompt({
  prompts,
  draft,
  workspaceLink
}: {
  prompts: RevioPrompts | undefined
  draft: boolean
  workspaceLink: string | null
}): string {
  const parts = [revioPrompt(prompts, 'createPr')]
  if (draft) {
    parts.push('Open it as a draft pull request.')
  }
  if (workspaceLink) {
    parts.push(
      `End the PR description with a link to this ${FORK_PRODUCT_NAME} workspace: ${workspaceLink}`
    )
  }
  return parts.join(' ')
}

/** The body GitHub's compare form starts with when the workspace link setting is on. */
export function manualPrBody(workspaceLink: string): string {
  return `\n\n---\n${FORK_PRODUCT_NAME} workspace: ${workspaceLink}`
}

/** "Add action > Ask agent": the agent writes a Run-button action into the shared actions file. */
export const ADD_ACTION_PROMPT = [
  `Add a Run-button action for this repository to \`${SHARED_ACTIONS_FILES[1]}\` when that file exists,`,
  `else to \`${SHARED_ACTIONS_FILE}\` (create it if it is missing). Look at`,
  'the project (package.json scripts, Makefile, README) and pick the command',
  'people run most while working, usually the dev server or the test suite. Append one `[[action]]`',
  'table with `name`, `script`, `targets = ["local"]` and an optional `icon` (a lucide name such as',
  '"server", "test-tube" or "rocket"). Keep any existing actions. Do not commit. Reply with the',
  'action you added.'
].join(' ')
