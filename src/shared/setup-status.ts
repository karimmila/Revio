/** A workspace's setup run, from the status file its runner writes (setup-runner-script-text.ts). */
export type SetupStatus = 'running' | 'succeeded' | 'failed'

export function parseSetupStatus(text: string | null): SetupStatus | null {
  const value = text?.trim()
  if (!value) {
    return null
  }
  if (value === 'running') {
    return 'running'
  }
  return value === '0' ? 'succeeded' : /^\d+$/.test(value) ? 'failed' : null
}
