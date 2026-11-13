import { redactSecrets } from './cloud-errors'

/** Cloud lines in Orca's main log, always with credentials redacted. */
export function cloudInfo(line: string): void {
  console.info(`[cloud] ${redactSecrets(line)}`)
}

export function cloudWarn(context: string, error: unknown): void {
  const text = error instanceof Error ? error.message : String(error)
  console.warn(`[cloud] ${context}: ${redactSecrets(text)}`)
}

/** A `.catch` for best-effort work: the flow goes on, the failure still reaches the log. */
export function bestEffort(context: string): (error: unknown) => void {
  return (error) => cloudWarn(context, error)
}
