import React from 'react'
import type { SettingsNavigationTarget } from '@/lib/settings-navigation-types'

/**
 * Which page the workspace layout's settings show. Kept outside the app store because it is view
 * state that resets each time settings close, and nothing persists it.
 */
export type RevioSettingsPageId =
  | 'general'
  | 'account'
  | 'appearance'
  | 'shortcuts'
  | 'models'
  | 'git'
  | 'agents'
  | 'prompts'
  | 'environment'
  | 'mcp'
  | 'cloud'
  | 'experimental'
  | 'advanced'
  | 'import'
  | 'remote'
  | `repo:${string}`

type RevioSettingsView = {
  readonly page: RevioSettingsPageId
}

const PAGE_IDS: readonly RevioSettingsPageId[] = [
  'general',
  'account',
  'appearance',
  'shortcuts',
  'models',
  'git',
  'agents',
  'prompts',
  'environment',
  'mcp',
  'cloud',
  'experimental',
  'advanced',
  'import',
  'remote'
]

/** A deep link's page name, or General when it names none of the pages. */
export function revioSettingsPageFrom(name: string): RevioSettingsPageId {
  if (name.startsWith('repo:') && name.length > 'repo:'.length) {
    return `repo:${name.slice('repo:'.length)}`
  }
  return PAGE_IDS.find((page) => page === name) ?? 'general'
}

const INITIAL_VIEW: RevioSettingsView = { page: 'general' }

let view: RevioSettingsView = INITIAL_VIEW
const listeners = new Set<() => void>()

function setView(next: RevioSettingsView): void {
  view = next
  for (const listener of listeners) {
    listener()
  }
}

export function useRevioSettingsView(): RevioSettingsView {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => view
  )
}

export function openRevioSettingsPage(page: RevioSettingsPageId): void {
  setView({ page })
}

type UpstreamPane = SettingsNavigationTarget['pane']

/** Upstream panes whose setting lives on one of this layout's pages; every other pane opens General. */
const PAGE_FOR_UPSTREAM_PANE: Partial<Record<UpstreamPane, RevioSettingsPageId>> = {
  integrations: 'account',
  'orca-account': 'account',
  linear: 'account',
  tasks: 'account',
  accounts: 'agents',
  agents: 'agents',
  git: 'git',
  appearance: 'appearance',
  terminal: 'appearance',
  shortcuts: 'shortcuts',
  experimental: 'experimental',
  browser: 'experimental',
  voice: 'experimental',
  advanced: 'advanced',
  privacy: 'advanced',
  dev: 'advanced'
}

/**
 * Notices and commands across the app deep-link into upstream settings panes. The workspace layout
 * never shows those panes, so each link lands on the page here that holds the setting instead.
 */
export function revioSettingsPageForTarget(
  target: Pick<SettingsNavigationTarget, 'pane' | 'repoId'>
): RevioSettingsPageId {
  if (target.repoId && (target.pane === 'repo' || target.pane === 'quick-commands')) {
    return `repo:${target.repoId}`
  }
  return PAGE_FOR_UPSTREAM_PANE[target.pane] ?? 'general'
}

/** Leaving settings starts the next visit on the General page. */
export function resetRevioSettingsView(): void {
  setView(INITIAL_VIEW)
}
