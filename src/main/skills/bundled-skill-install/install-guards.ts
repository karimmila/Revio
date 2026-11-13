import {
  getAppEnvironment,
  hasAppEnvironment,
  type AppEnvironment
} from '../../../shared/app-environment'
import type { BundledSkillSource } from './bundled-skill-sources'

/*
 * Why: a development build runs on the same machine as the installed upstream Orca.app and
 * would write the same user-level skill folders (~/.agents/skills, ~/.claude/skills, every
 * agent's global skill home, and the backups beside them). Starting a dev build once replaced
 * Orca's own orca-cli, orca-computer-use and orchestration skills with this fork's text, which
 * told agents to run a command only a packaged build installs. So only a packaged build may
 * install or update bundled skills. The app knows from AppEnvironment; the CLI has none and
 * reads the flag the `orca-dev` launcher exports.
 */
export function isDevelopmentBuild(
  env: NodeJS.ProcessEnv = process.env,
  app: Pick<AppEnvironment, 'isPackaged'> | null = hasAppEnvironment() ? getAppEnvironment() : null
): boolean {
  // A daemon started from a dev checkout reports itself packaged; it inherits the dev app's env.
  if (env.NODE_ENV === 'development') {
    return true
  }
  if (app) {
    return !app.isPackaged()
  }
  return env.ORCA_DEV_CLI_INVOCATION === '1'
}

// Upstream ships orca-* plus these un-prefixed names; Orca.app owns those folders on this machine.
const UPSTREAM_UNPREFIXED_SKILL_NAMES = new Set([
  'orchestration',
  'computer-use',
  'jira-tickets',
  'linear-tickets'
])

export function isUpstreamOrcaSkillName(name: string): boolean {
  return name.startsWith('orca-') || UPSTREAM_UNPREFIXED_SKILL_NAMES.has(name)
}

/**
 * Why: the planner treats a folder named after a source or one of its aliases as ours when its
 * digest is in `releasedDigests`, and then updates, renames or retires it. Orca's copies carry
 * Orca's released digests, so a source or alias with an upstream name would claim them. The
 * generator already refuses such names; this keeps a hand-built source list from doing it.
 */
export function ownedBundledSkillSources(
  sources: readonly BundledSkillSource[]
): BundledSkillSource[] {
  return sources
    .filter((source) => !isUpstreamOrcaSkillName(source.name))
    .map(({ aliases, ...rest }) => {
      const owned = aliases?.filter((alias) => !isUpstreamOrcaSkillName(alias)) ?? []
      return owned.length > 0 ? { ...rest, aliases: owned } : rest
    })
}
