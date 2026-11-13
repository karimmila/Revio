import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

const OWN_WORKSPACE_NOTE = `Always acts on the ${FORK_PRODUCT_NAME} workspace that contains the current directory and on its checked-out branch; it takes no remote, refspec or other repository.`
const SIGN_IN_NOTE = `${FORK_PRODUCT_NAME} pushes and calls GitHub with its own GitHub sign-in (Settings > Account). No \`gh auth login\` or Git credential is needed, and no token is printed or passed to the caller.`

export const PR_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['pr', 'push'],
    summary: "Push this workspace's branch to GitHub",
    usage: 'orca pr push [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      OWN_WORKSPACE_NOTE,
      SIGN_IN_NOTE,
      'Commit first: this pushes commits, not uncommitted changes. It never force-pushes.'
    ],
    examples: ['orca pr push']
  },
  {
    path: ['pr', 'create'],
    summary: "Push this workspace's branch and open its pull request",
    usage:
      'orca pr create --title <title> [--body <text> | --body-file <path|->] [--base <branch>] [--draft] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'title', 'body', 'body-file', 'base', 'draft'],
    notes: [
      OWN_WORKSPACE_NOTE,
      SIGN_IN_NOTE,
      'Commit first. The base defaults to the repository default branch.',
      'If the branch already has a pull request, the push updates it and its link is printed.',
      'If GitHub is not connected, the error says what to do: sign in, or install the GitHub App on the repository owner.'
    ],
    examples: [
      'orca pr create --title "Add login form" --body-file pr-body.md',
      'orca pr create --title "Fix flaky test" --body "Why and what." --draft'
    ]
  },
  {
    path: ['pr', 'checks'],
    summary: "List the checks of this workspace's pull request, with failing job logs on request",
    usage: 'orca pr checks [--logs] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'logs'],
    notes: [
      OWN_WORKSPACE_NOTE,
      SIGN_IN_NOTE,
      'Each line is the state (failed, running, passed or skipped), the check name and its link.',
      '--logs adds, for each failing check, its annotations, the failed steps and the end of each failing job log. It reads at most 5 failing checks.',
      'Checks start a short time after a push: when the list is empty or still running, wait and run it again.'
    ],
    examples: ['orca pr checks', 'orca pr checks --logs']
  }
]
