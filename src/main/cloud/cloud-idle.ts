import type { Sandbox } from '@vercel/sandbox'
import { runSandboxScript } from './cloud-sandbox-run'

/** When each cloud workspace last showed activity Orca can see from this Mac. */
const lastBusyAt = new Map<string, number>()

/**
 * The renderer's view: the workspace the person has open and the workspaces where an agent or
 * chat is working. Both count as busy right now.
 */
export function reportCloudActivity(environmentIds: readonly string[]): void {
  const now = Date.now()
  for (const environmentId of environmentIds) {
    lastBusyAt.set(environmentId, now)
  }
}

/** A workspace seen for the first time starts its idle clock now, not at the epoch. */
export function idleSinceMs(environmentId: string, now = Date.now()): number {
  const last = lastBusyAt.get(environmentId)
  if (last === undefined) {
    lastBusyAt.set(environmentId, now)
    return 0
  }
  return now - last
}

export function markCloudBusy(environmentId: string): void {
  lastBusyAt.set(environmentId, Date.now())
}

// Inside the sandbox: the last time any terminal printed (a pty's mtime moves on every write) and
// whether a terminal runs a foreground job other than its shell (`claude -p`, a build, a server
// in the foreground). Background jobs (nohup, setsid) do not keep a workspace awake.
const ACTIVITY_SCRIPT = `now=$(date +%s)
last=$(stat -c %Y /dev/pts/[0-9]* 2>/dev/null | sort -n | tail -1)
busy=$(ps -eo stat=,tty=,comm= | awk '$1 ~ /[+]/ && $2 ~ /^pts/ && $3 !~ /^(bash|zsh|sh|dash|fish|login)$/' | head -1)
echo "$now \${last:-0} \${busy:+busy}"`

export async function sandboxActivity(
  sandbox: Sandbox
): Promise<{ idleMs: number; foregroundJob: boolean }> {
  const out =
    (await runSandboxScript(sandbox, ACTIVITY_SCRIPT, { signal: AbortSignal.timeout(20_000) }))
      .trim()
      .split('\n')
      .pop() ?? ''
  const [now = '0', last = '0', busy] = out.split(/\s+/)
  return {
    idleMs: Math.max(0, (Number(now) - Number(last)) * 1000),
    foregroundJob: busy === 'busy'
  }
}
