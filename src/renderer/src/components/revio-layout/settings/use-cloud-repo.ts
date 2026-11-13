import React from 'react'
import type {
  CloudBuild,
  CloudRepoConfig,
  CloudRepoState
} from '../../../../../shared/cloud/cloud-types'

const MAX_LOG_CHARS = 200_000

/** One repository's cloud scripts and builds, kept current by the main process's build events. */
export function useCloudRepo(repoId: string): {
  state: CloudRepoState | null
  log: string
  error: string | null
  save: (config: CloudRepoConfig) => Promise<void>
  build: () => void
  cancel: () => void
  showLog: (buildId: string) => void
} {
  const api = window.api.cloud
  const [state, setState] = React.useState<CloudRepoState | null>(null)
  const [log, setLog] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const logBuildRef = React.useRef<string | null>(null)
  const reload = React.useCallback(() => {
    void api
      ?.repoState(repoId)
      .then(setState)
      .catch((reason: unknown) => setError(String(reason)))
  }, [api, repoId])
  React.useEffect(reload, [reload])
  React.useEffect(() => {
    return api?.onBuildEvent((event) => {
      if (event.repoId !== repoId) {
        return
      }
      setState((current) =>
        current
          ? {
              ...current,
              builds: [
                event.build,
                ...current.builds.filter((entry: CloudBuild) => entry.id !== event.build.id)
              ]
            }
          : current
      )
      if (event.log && logBuildRef.current === event.build.id) {
        setLog((current) => (current + event.log).slice(-MAX_LOG_CHARS))
      }
    })
  }, [api, repoId])
  const showLog = React.useCallback(
    (buildId: string) => {
      logBuildRef.current = buildId
      void api?.buildLog(buildId).then(setLog)
    },
    [api]
  )
  return {
    state,
    log,
    error,
    save: async (config) => {
      await api?.saveConfig(repoId, config)
      setState((current) => (current ? { ...current, config } : current))
    },
    build: () => {
      setError(null)
      void api
        ?.startBuild(repoId)
        .then((started) => {
          logBuildRef.current = started.id
          setLog('')
        })
        .catch((reason: unknown) =>
          setError(reason instanceof Error ? reason.message : String(reason))
        )
    },
    cancel: () => void api?.cancelBuild(repoId),
    showLog
  }
}
