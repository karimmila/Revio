import { spawnProcess } from '@orca/process-host'
import { resolveStructuredAgentCommand } from '../native-chat/structured-agent-command-resolution'
import type { GlobalSettings } from '../../shared/global-settings-types'

// `cursor-agent login` opens the browser and exits once Cursor confirms the sign-in.
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

export function runCursorAgentLogin(
  settings: Partial<Pick<GlobalSettings, 'agentCmdOverrides' | 'agentDefaultEnv'>>
): Promise<void> {
  const { command, prefixArgs } = resolveStructuredAgentCommand(
    'cursor',
    settings,
    {},
    { command: 'cursor-agent' }
  )
  return new Promise((resolve, reject) => {
    const child = spawnProcess({
      program: command,
      args: [...prefixArgs, 'login'],
      env: { ...process.env, ...settings.agentDefaultEnv?.cursor },
      stdio: 'ignore'
    })
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Cursor sign-in timed out.'))
    }, LOGIN_TIMEOUT_MS)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`cursor-agent login exited with code ${code ?? 'unknown'}.`))
      }
    })
  })
}
