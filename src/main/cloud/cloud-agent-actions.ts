import type { Sandbox } from '@vercel/sandbox'
import type { RepoAction } from '../../shared/actions/repo-actions'
import { SOURCE_CLOUD_SCRIPT_ENV } from '../../shared/cloud/cloud-script-env-file'
import { quotePosixShell } from '../../shared/shell/launch/shell-argument-quoting'
import { readRepoActions } from '../actions/repo-actions-store'
import { cloudRepoActionsInstruction } from '../native-chat/revio-repo-actions-instruction'
import { redactSecrets } from './cloud-errors'
import { runSandboxScript } from './cloud-sandbox-run'
import { writeCloudPrCommand } from './cloud-pr-command-install'
import { CLOUD_PR_COMMAND_INSTRUCTION } from '../../shared/cloud/cloud-pr-command'
import { CLOUD_DESKTOP_BROWSER_INSTRUCTION } from '../../shared/cloud/cloud-desktop-browser'
import { readRepoFile } from './cloud-repo-store'
import { sandboxScriptEnv } from './cloud-sandbox-env'
import { CLOUD_ACTIONS_DIR, loggedCloudActionScript } from '../../shared/cloud/cloud-action-runs'

const MAX_SCRIPT_FILES = 12

function scriptPath(index: number): string {
  return `${CLOUD_ACTIONS_DIR}/${index + 1}.sh`
}

/**
 * Each cloud action as the Run tab would start it: the cloud script variables, the workspace's
 * repository folder, then the person's script, its output also kept in a run log that this Mac's
 * Run tab follows. Files are named by position, never by the action's name, so a name cannot
 * pick a path.
 */
export function cloudActionScriptFiles(
  actions: readonly Pick<RepoAction, 'name' | 'script' | 'targets'>[],
  repoDir: string
): { path: string; content: string; mode: number }[] {
  return actions
    .filter((action) => action.targets.includes('cloud'))
    .slice(0, MAX_SCRIPT_FILES)
    .map((action, index) => ({
      path: scriptPath(index),
      content: `${SOURCE_CLOUD_SCRIPT_ENV}\ncd ${quotePosixShell(repoDir)} || exit 1\n${loggedCloudActionScript(action.name, action.script)}\n`,
      mode: 0o755
    }))
}

/**
 * Puts the instruction in a marked block of the sandbox user's `~/.claude/CLAUDE.md`, which Claude
 * Code loads for every session (chats and terminals), replacing the block a previous write left.
 * The text arrives in an environment variable, so nothing in it is parsed by a shell.
 */
const WRITE_MEMORY = `rm -rf ${CLOUD_ACTIONS_DIR} && mkdir -p ${CLOUD_ACTIONS_DIR} && chmod 700 ${CLOUD_ACTIONS_DIR}
python3 - <<'PY'
import os, re
path = os.path.expanduser('~/.claude/CLAUDE.md')
os.makedirs(os.path.dirname(path), exist_ok=True)
try:
    text = open(path).read()
except FileNotFoundError:
    text = ''
start, end = '<!-- orca:actions -->', '<!-- /orca:actions -->'
block = start + '\\n' + os.environ['ORCA_ACTIONS_MEMORY'].strip() + '\\n' + end
pattern = re.compile(re.escape(start) + '.*?' + re.escape(end), re.S)
if pattern.search(text):
    text = pattern.sub(lambda match: block, text)
else:
    text = text.rstrip('\\n') + ('\\n\\n' if text.strip() else '') + block + '\\n'
open(path, 'w').write(text)
PY`

/**
 * Everything a cloud workspace's agent is told in every session: its actions, the one command
 * for pull requests and the one command for the desktop's browser.
 */
export function cloudAgentStandingInstruction(
  actions: readonly Pick<RepoAction, 'name' | 'script' | 'targets'>[]
): string {
  return [
    cloudRepoActionsInstruction(actions, scriptPath),
    CLOUD_PR_COMMAND_INSTRUCTION,
    CLOUD_DESKTOP_BROWSER_INSTRUCTION
  ].join('\n\n')
}

/**
 * A cloud workspace's agent runs in its sandbox, where `orca action run` reaches the sandbox's own
 * Orca server, which has no actions and no Run tab; there is no channel back to this Mac, and none
 * is added (a sandbox must not drive this Mac). So the agent gets the cloud actions as files plus
 * the bounded list, and is told to run them itself; the files log each run, which this Mac pulls
 * into the Run tab. Written at create and on each wake, so edits made while it slept arrive.
 * Failures only reach the main log: actions are a convenience.
 */
export async function writeCloudAgentActions(
  sandbox: Sandbox,
  repo: { id: string; path: string },
  repoDir: string,
  signal?: AbortSignal
): Promise<void> {
  try {
    const actions = readRepoActions(repo).actions
    await runSandboxScript(sandbox, WRITE_MEMORY, {
      env: { ORCA_ACTIONS_MEMORY: cloudAgentStandingInstruction(actions) },
      signal
    })
    const files = cloudActionScriptFiles(actions, repoDir)
    if (files.length > 0) {
      await sandbox.writeFiles(files, { signal })
    }
  } catch (error) {
    console.warn(`[cloud] Could not give the agent its actions: ${redactSecrets(String(error))}`)
  }
  // With the actions, so every create and every wake also brings the pull-request command.
  await writeCloudPrCommand(sandbox, signal)
}

/**
 * What runs once a sandbox has resumed, outside the recipe's lifetime and its abort signal:
 * terminals reconnect once resume returns, and neither of these may delay that.
 */
export function afterCloudResume(
  sandbox: Sandbox,
  repo: { id: string; path: string },
  repoDir: string
): void {
  void writeCloudAgentActions(sandbox, repo, repoDir)
  const wake = readRepoFile(repo.id).config.wakeScript
  if (wake.trim()) {
    // The Wake script restarts servers and Docker, which do not survive a stop.
    void runSandboxScript(sandbox, wake, { cwd: repoDir, env: sandboxScriptEnv(repo.id) }).catch(
      (error: unknown) =>
        console.warn(`[cloud] Wake script failed: ${redactSecrets(String(error))}`)
    )
  }
}
