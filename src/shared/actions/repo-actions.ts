import { parse, stringify } from 'smol-toml'
import { isActionIcon, type ActionIconId } from './action-icons'
import { FORK_HOME_FOLDER_NAME, FORK_PRODUCT_NAME, LEGACY_HOME_FOLDER_NAME } from '../fork-identity'
import { IMPORTED_ACTION_HEADER } from '../import-source-app'

/** Where an action may run, as the workspace layout's "Can run in" checkboxes (plus this Mac). */
export type ActionTarget = 'local' | 'cloud' | 'mirror'

export const ACTION_TARGETS: readonly ActionTarget[] = ['local', 'cloud', 'mirror']

export type RepoAction = {
  id: string
  name: string
  script: string
  targets: ActionTarget[]
  /** Shared actions live in the repository's actions file (SHARED_ACTIONS_FILES); personal ones on this Mac. */
  shared: boolean
  /** The Run button's icon for this action; unset shows play. */
  icon?: ActionIconId
}

/**
 * Where a repository keeps its shared actions. The app-named file is read first and is where a new
 * file is written; upstream's name is still read, so a repository that already has one keeps its
 * actions and is saved back to the same file.
 */
export const SHARED_ACTIONS_FILES = [
  `.${FORK_HOME_FOLDER_NAME}/actions.toml`,
  `.${LEGACY_HOME_FOLDER_NAME}/actions.toml`
] as const

export const SHARED_ACTIONS_FILE = SHARED_ACTIONS_FILES[0]

/** The shared actions file a repository uses: the first that exists, else the app-named one. */
export function sharedActionsFileFor(exists: (relativePath: string) => boolean): string {
  return SHARED_ACTIONS_FILES.find((file) => exists(file)) ?? SHARED_ACTIONS_FILE
}

/**
 * The workspace layout's per-repository `run_mode`: `concurrent` (default) lets every workspace run
 * at once;
 * `nonconcurrent` stops other workspaces' runs when one starts (shared port, database or Docker).
 */
export type ActionRunMode = 'concurrent' | 'nonconcurrent'

/**
 * The action "Auto-run after setup" starts with no press: the one the person last ran, else the
 * first they made on this Mac. A shared action comes from the repository's files, so it never
 * auto-runs before the person has run it once themselves.
 */
export function autoRunActionFor(
  actions: readonly RepoAction[],
  lastRunActionId: string | null
): RepoAction | undefined {
  const local = actions.filter((action) => action.targets.includes('local'))
  return (
    local.find((action) => `local:${action.id}` === lastRunActionId) ??
    local.find((action) => !action.shared)
  )
}

function isTarget(value: unknown): value is ActionTarget {
  return value === 'local' || value === 'cloud' || value === 'mirror'
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'action'
  )
}

/** Reads the shared actions file: `[[action]]` tables with name, script and targets. */
export function parseSharedActions(text: string): RepoAction[] {
  const document: unknown = parse(text)
  const list =
    document && typeof document === 'object' && 'action' in document ? document.action : []
  if (!Array.isArray(list)) {
    throw new Error('Expected [[action]] tables')
  }
  return list.flatMap((entry: unknown, index) => {
    if (!entry || typeof entry !== 'object') {
      return []
    }
    const name = 'name' in entry && typeof entry.name === 'string' ? entry.name.trim() : ''
    const script = 'script' in entry && typeof entry.script === 'string' ? entry.script : ''
    const raw = 'targets' in entry && Array.isArray(entry.targets) ? entry.targets : ['local']
    const targets = raw.filter(isTarget)
    const icon = 'icon' in entry && isActionIcon(entry.icon) ? entry.icon : undefined
    return name && script.trim()
      ? [
          {
            id: `shared:${index}:${slug(name)}`,
            name,
            script,
            targets,
            shared: true,
            ...(icon ? { icon } : {})
          }
        ]
      : []
  })
}

export function formatSharedActions(actions: readonly RepoAction[]): string {
  const body = stringify({
    action: actions.map((action) => ({
      name: action.name,
      ...(action.icon ? { icon: action.icon } : {}),
      targets: action.targets,
      script: action.script
    }))
  })
  return `# ${FORK_PRODUCT_NAME} actions shared with everyone who works on this repository.\n# icon: a lucide icon name for the Run button (optional).\n# targets: "local", "cloud" (cloud workspace), "mirror" (a cloud workspace's local mirror).\n\n${body}\n`
}

const SECRET_NAME = /(PASS(WORD)?|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|CREDENTIAL)/i

/**
 * Makes a pasted script safe to store: a secret-looking variable set to a literal (or a literal
 * fallback), and any value masked as "***", becomes `${NAME:?…}`, read from Orca's Environment
 * settings at run time. Returns the names to add there.
 */
export function stripScriptSecrets(script: string): { script: string; variables: string[] } {
  const variables = new Set<string>()
  const lines = script.split('\n').map((line) => {
    const match = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line)
    if (!match) {
      return line
    }
    const [, prefix = '', name = '', rawValue = ''] = match
    const value = rawValue.trim()
    const masked = value.includes('***')
    const literal = value !== '' && !value.startsWith('$') && !value.startsWith('"$')
    const literalFallback = new RegExp(`^"?\\$\\{${name}:-[^}$]+\\}"?$`).test(value)
    if (!masked && !(SECRET_NAME.test(name) && (literal || literalFallback))) {
      return line
    }
    variables.add(name)
    return `${prefix}${name}="\${${name}:?Set ${name} in ${FORK_PRODUCT_NAME}: Settings, Environment}"`
  })
  return { script: lines.join('\n'), variables: [...variables] }
}

/**
 * One pasted action from the import source app. Its export starts with a header line naming the
 * action and where it can run (IMPORTED_ACTION_HEADER); without it the person names it in the form.
 */
export function parseImportedAction(text: string): {
  name: string | null
  targets: ActionTarget[]
  script: string
} {
  const header = IMPORTED_ACTION_HEADER.exec(text)
  if (!header) {
    return { name: null, targets: ['local'], script: text }
  }
  const targets: ActionTarget[] = []
  if (header[2] === '1') {
    targets.push('cloud')
  }
  if (header[3] === '1') {
    targets.push('mirror')
  }
  return { name: header[1] ?? null, targets, script: text.slice(header[0].length) }
}
