/** Icons an action can show on the Run button, as lucide names. `play` is the default. */
export const ACTION_ICONS = [
  { id: 'play', label: 'Play', keywords: 'run start' },
  { id: 'terminal', label: 'Terminal', keywords: 'shell command console' },
  { id: 'server', label: 'Server', keywords: 'dev backend api' },
  { id: 'globe', label: 'Globe', keywords: 'web browser site preview' },
  { id: 'monitor', label: 'Monitor', keywords: 'desktop app screen' },
  { id: 'smartphone', label: 'Phone', keywords: 'mobile ios android' },
  { id: 'test-tube', label: 'Test tube', keywords: 'test spec unit' },
  { id: 'flask-conical', label: 'Flask', keywords: 'test experiment lab' },
  { id: 'list-checks', label: 'Checklist', keywords: 'test lint check' },
  { id: 'bug', label: 'Bug', keywords: 'debug fix' },
  { id: 'hammer', label: 'Hammer', keywords: 'build compile make' },
  { id: 'wrench', label: 'Wrench', keywords: 'fix tool setup configure' },
  { id: 'package', label: 'Package', keywords: 'install dependencies npm bundle' },
  { id: 'box', label: 'Box', keywords: 'container docker' },
  { id: 'rocket', label: 'Rocket', keywords: 'deploy ship release launch' },
  { id: 'cloud', label: 'Cloud', keywords: 'deploy remote upload' },
  { id: 'database', label: 'Database', keywords: 'db migrate seed sql' },
  { id: 'refresh-cw', label: 'Refresh', keywords: 'reload restart sync' },
  { id: 'zap', label: 'Lightning', keywords: 'fast quick dev' },
  { id: 'sparkles', label: 'Sparkles', keywords: 'format magic ai generate' },
  { id: 'paintbrush', label: 'Paintbrush', keywords: 'format style prettier lint' },
  { id: 'code', label: 'Code', keywords: 'typecheck compile source' },
  { id: 'file-text', label: 'Document', keywords: 'docs storybook' },
  { id: 'book-open', label: 'Book', keywords: 'docs storybook read' },
  { id: 'eye', label: 'Eye', keywords: 'watch preview view' },
  { id: 'gauge', label: 'Gauge', keywords: 'benchmark performance' },
  { id: 'cpu', label: 'Chip', keywords: 'worker process' },
  { id: 'shield', label: 'Shield', keywords: 'security audit' },
  { id: 'git-branch', label: 'Branch', keywords: 'git' },
  { id: 'upload', label: 'Upload', keywords: 'push publish' },
  { id: 'download', label: 'Download', keywords: 'pull fetch' },
  { id: 'trash-2', label: 'Trash', keywords: 'clean clear reset' }
] as const

export type ActionIconId = (typeof ACTION_ICONS)[number]['id']

export const DEFAULT_ACTION_ICON: ActionIconId = 'play'

export function isActionIcon(value: unknown): value is ActionIconId {
  return ACTION_ICONS.some((icon) => icon.id === value)
}

/** The icons whose name, label or keywords contain every word of the query. */
export function searchActionIcons(query: string): (typeof ACTION_ICONS)[number][] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return ACTION_ICONS.filter((icon) => {
    const haystack = `${icon.id} ${icon.label} ${icon.keywords}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
