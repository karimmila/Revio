import { quotePosixShell } from '../shell/launch/shell-argument-quoting'
import { REPO_ACTION_EXIT_MARKER } from '../actions/repo-action-agent-bridge'

/**
 * A cloud agent's action runs show in the workspace's Run tab by pull only: the action script
 * appends its output to a log file in the sandbox, and this Mac reads the logs over the ssh route
 * it opens itself (the dock's Run tab). Nothing in the sandbox ever calls this Mac.
 */
export const CLOUD_ACTIONS_DIR = '/vercel/.orca-actions'
export const CLOUD_ACTION_RUNS_DIR = `${CLOUD_ACTIONS_DIR}/runs`
const KEEP_RUNS = 20

/**
 * The person's script, run in a subshell whose output goes both to the caller and to a new log,
 * `<runs>/<start time in ns>-<pid>.log`, between a "▶ name" line and a "■ name exited N" line (the
 * Run tab's own markers). Names sort by start time, so the newest run is the last name.
 */
export function loggedCloudActionScript(name: string, script: string): string {
  const quotedName = quotePosixShell(name)
  const runs = quotePosixShell(CLOUD_ACTION_RUNS_DIR)
  return [
    `mkdir -p ${runs} && chmod 700 ${runs}`,
    `ls -1 ${runs}/*.log 2>/dev/null | head -n -${KEEP_RUNS} | xargs -r rm -f --`,
    `__orca_log=${runs}/"$(date +%s%N)-$$.log"`,
    `printf '\\033[2m▶ %s\\033[0m\\n' ${quotedName} > "$__orca_log"`,
    '(',
    script,
    ') 2>&1 | tee -a "$__orca_log"',
    '__orca_code=${PIPESTATUS[0]}',
    `printf '\\033[2m${REPO_ACTION_EXIT_MARKER} %s exited %s\\033[0m\\n' ${quotedName} "$__orca_code" >> "$__orca_log"`,
    'exit "$__orca_code"'
  ].join('\n')
}

/**
 * What the Run tab runs in the sandbox to follow the agent's runs: the newest log from its first
 * line, switching to a newer run when one starts. It lives only as long as this Mac's ssh session.
 * Until a run starts it says `waitingLine` (dimmed), and it turns the terminal's echo off: keys
 * typed into a tab that only reads would echo back and look like a shell that never answers.
 */
export function cloudActionRunsFollow(waitingLine: string): string {
  return [
    'stty -echo 2>/dev/null',
    `printf '\\033[2m%s\\033[0m\\n' ${quotePosixShell(waitingLine)}`,
    `d=${quotePosixShell(CLOUD_ACTION_RUNS_DIR)}; cur=; tp=`,
    `trap 'kill $tp 2>/dev/null' EXIT`,
    'while :; do n=$(ls -1 "$d"/*.log 2>/dev/null | tail -n 1)',
    `if [ -n "$n" ] && [ "$n" != "$cur" ]; then if [ -n "$tp" ]; then kill "$tp" 2>/dev/null; fi; printf '\\n'`,
    'cur=$n',
    'tail -n +1 -F "$cur" 2>/dev/null & tp=$!; fi',
    'sleep 1; done'
  ].join('; ')
}
