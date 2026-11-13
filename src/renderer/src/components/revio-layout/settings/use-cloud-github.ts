import React from 'react'
import type { CloudGithubStatus } from '../../../../../shared/cloud/cloud-types'

function errorText(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ''
  )
}

export type CloudGithubControls = {
  status: CloudGithubStatus | null
  error: string | null
  /**
   * Runs one GitHub IPC call, clears the last error first, then re-reads the status. Resolves once
   * the call settles, so a caller can keep its own pending state until then.
   */
  act: (call: (() => Promise<unknown>) | undefined) => Promise<void>
}

/** Reads the GitHub status and re-reads it on every GitHub event from main. */
export function useCloudGithub(): CloudGithubControls {
  const [status, setStatus] = React.useState<CloudGithubStatus | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const load = React.useCallback(() => {
    void window.api.cloud
      ?.githubStatus()
      .then(setStatus)
      .catch((reason: unknown) => setError(errorText(reason)))
  }, [])
  React.useEffect(load, [load])
  React.useEffect(
    () =>
      window.api.cloud?.onGithubEvent((event) => {
        setError(event.error)
        load()
      }),
    [load]
  )
  const act = React.useCallback(
    async (call: (() => Promise<unknown>) | undefined): Promise<void> => {
      setError(null)
      await call?.()
        .then(load)
        .catch((reason: unknown) => setError(errorText(reason)))
    },
    [load]
  )
  return { status, error, act }
}
