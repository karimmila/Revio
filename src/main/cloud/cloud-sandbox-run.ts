import type { Sandbox } from '@vercel/sandbox'

const FLUSH_MS = 250

/**
 * Runs a bash script in the sandbox and streams its output, batched, to `onLog`. A non-zero exit
 * throws with the script's last lines, which is what a person needs to see first.
 */
export async function runSandboxScript(
  sandbox: Sandbox,
  script: string,
  options: {
    cwd?: string
    env?: Record<string, string>
    sudo?: boolean
    signal?: AbortSignal
    onLog?: (text: string) => void
  } = {}
): Promise<string> {
  const command = await sandbox.runCommand({
    cmd: 'bash',
    args: ['-lc', script],
    cwd: options.cwd,
    env: options.env,
    sudo: options.sudo,
    detached: true,
    signal: options.signal
  })
  let pending = ''
  let tail = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = (): void => {
    timer = null
    if (pending) {
      options.onLog?.(pending)
      pending = ''
    }
  }
  for await (const entry of command.logs({ signal: options.signal })) {
    pending += entry.data
    tail = (tail + entry.data).slice(-4000)
    timer ??= setTimeout(flush, FLUSH_MS)
  }
  if (timer) {
    clearTimeout(timer)
  }
  flush()
  const finished = await command.wait({ signal: options.signal })
  if (finished.exitCode !== 0) {
    const last = tail.trim().split('\n').slice(-5).join('\n')
    throw new Error(`exit ${finished.exitCode}${last ? `: ${last}` : ''}`)
  }
  return tail
}
