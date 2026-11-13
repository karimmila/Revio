import { FORK_URL_SCHEME, isAppLinkProtocol } from './fork-identity'
import { LEGACY_NAME } from './legacy-name-migration'

/** "Copy link": a link that opens a workspace, or one of its chats, in this app. */
export type RevioLink = { worktreeId: string; sessionId?: string }

const PREFIX = `${FORK_URL_SCHEME}://workspace`

/**
 * An app link's route (`workspace`, `settings`, `new` or `loadout`) and its query. Links copied
 * by builds before 2026-11-10 put the legacy name in front (`<scheme>://<legacy>/workspace?...`)
 * and sit in PR descriptions, so they still open.
 */
function appLinkRoute(value: string): { route: string; params: URLSearchParams } | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (!isAppLinkProtocol(url.protocol)) {
    return null
  }
  const path = `${url.host}${url.pathname}`.replace(/\/$/, '')
  const legacyPrefix = `${LEGACY_NAME}/`
  const route = path.startsWith(legacyPrefix) ? path.slice(legacyPrefix.length) : path
  return { route, params: url.searchParams }
}

export function buildRevioLink(link: RevioLink): string {
  const params = new URLSearchParams({ id: link.worktreeId })
  if (link.sessionId) {
    params.set('chat', link.sessionId)
  }
  return `${PREFIX}?${params.toString()}`
}

export function parseRevioLink(value: string): RevioLink | null {
  const link = appLinkRoute(value)
  if (link?.route !== 'workspace') {
    return null
  }
  const worktreeId = link.params.get('id')
  const sessionId = link.params.get('chat')
  return worktreeId ? { worktreeId, ...(sessionId ? { sessionId } : {}) } : null
}

/** A shared loadout: the agent, model and effort set travel in the link itself. */
export type SharedLoadout = { agent: string; model: string; effort?: string; label: string }

export function buildLoadoutLink(loadout: SharedLoadout): string {
  const params = new URLSearchParams({
    agent: loadout.agent,
    model: loadout.model,
    label: loadout.label
  })
  if (loadout.effort) {
    params.set('effort', loadout.effort)
  }
  return `${FORK_URL_SCHEME}://loadout?${params.toString()}`
}

function parseLoadout(params: URLSearchParams): SharedLoadout | null {
  const agent = params.get('agent')?.trim()
  const model = params.get('model')?.trim()
  if (!agent || !model) {
    return null
  }
  const effort = params.get('effort')?.trim()
  const label = params.get('label')?.trim().slice(0, 80) || model
  return { agent, model, label, ...(effort ? { effort } : {}) }
}

/** Every app link route: a workspace or chat, a settings page, the Create card, or a shared
 * loadout. */
export type RevioRoute =
  | ({ kind: 'workspace' } & RevioLink)
  | { kind: 'settings'; page: string }
  | { kind: 'create' }
  | { kind: 'loadout'; loadout: SharedLoadout }

export function parseRevioRoute(value: string): RevioRoute | null {
  const workspace = parseRevioLink(value)
  if (workspace) {
    return { kind: 'workspace', ...workspace }
  }
  const link = appLinkRoute(value)
  if (link?.route === 'settings') {
    const page = link.params.get('page') ?? 'general'
    return /^[\w:-]+$/.test(page) ? { kind: 'settings', page } : null
  }
  if (link?.route === 'loadout') {
    const loadout = parseLoadout(link.params)
    return loadout ? { kind: 'loadout', loadout } : null
  }
  return link?.route === 'new' ? { kind: 'create' } : null
}

/** The first app route among launch or open-url arguments, as the raw link. */
export function revioLinkFromArguments(argv: readonly string[]): string | null {
  return argv.find((value) => parseRevioRoute(value) !== null) ?? null
}
