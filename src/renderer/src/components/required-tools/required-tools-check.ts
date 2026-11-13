import { useCallback, useEffect, useState } from 'react'
import type { RequiredTool } from '../../../../shared/missing-tool-install'

/** What this computer has; null while a probe has not answered. */
export type RequiredToolsPresence = {
  git: boolean | null
  gh: boolean | null
  claude: boolean | null
  /** Any agent CLI at all, so a Codex-only setup is not told to install Claude. */
  anyAgent: boolean | null
}

export const UNKNOWN_REQUIRED_TOOLS: RequiredToolsPresence = {
  git: null,
  gh: null,
  claude: null,
  anyAgent: null
}

/**
 * The tools to tell the person about. Unknown is never "missing": a slow or failed probe must not
 * show a false alarm. Claude is only named when no agent CLI was found at all.
 */
export function missingRequiredTools(presence: RequiredToolsPresence): RequiredTool[] {
  const missing: RequiredTool[] = []
  if (presence.git === false) {
    missing.push('git')
  }
  if (presence.gh === false) {
    missing.push('gh')
  }
  if (presence.claude === false && presence.anyAgent === false) {
    missing.push('claude')
  }
  return missing
}

export type RequiredToolsCheck = {
  presence: RequiredToolsPresence
  checking: boolean
  /** Probes again with a fresh login-shell PATH, so a tool installed a moment ago is found. */
  recheck: () => void
}

/** Probes this computer for git, gh and an agent CLI on mount and on window focus. */
export function useRequiredToolsCheck(): RequiredToolsCheck {
  const [presence, setPresence] = useState<RequiredToolsPresence>(UNKNOWN_REQUIRED_TOOLS)
  const [checking, setChecking] = useState(false)

  const probe = useCallback((force: boolean) => {
    const api = window.api?.preflight
    if (!api) {
      return
    }
    setChecking(true)
    const tools = api
      .check(force ? { force: true } : undefined)
      .then((status) => {
        setPresence((current) => ({
          ...current,
          git: status.git.installed,
          gh: status.gh.installed
        }))
      })
      .catch(() => undefined)
    const agents = (
      force ? api.refreshAgents().then((result) => result.agents) : api.detectAgents()
    )
      .then((ids) => {
        setPresence((current) => ({
          ...current,
          claude: ids.includes('claude'),
          anyAgent: ids.length > 0
        }))
      })
      .catch(() => undefined)
    void Promise.all([tools, agents]).finally(() => setChecking(false))
  }, [])

  // Coming back from Terminal after an install: a cached "missing" must be probed afresh.
  const hasMissing = missingRequiredTools(presence).length > 0
  useEffect(() => {
    probe(false)
  }, [probe])
  useEffect(() => {
    const onFocus = (): void => probe(hasMissing)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [hasMissing, probe])

  const recheck = useCallback(() => probe(true), [probe])
  return { presence, checking, recheck }
}
