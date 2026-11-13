/**
 * "Open in" apps that ship no folder-opening CLI. On macOS `open -a` opens the folder in
 * any of them, so they need no detection: a missing app fails like a missing editor CLI.
 */
export const MAC_OPEN_IN_APPS = [
  { id: 'xcode', label: 'Xcode', app: 'Xcode' },
  { id: 'intellij', label: 'IntelliJ IDEA', app: 'IntelliJ IDEA' },
  { id: 'webstorm', label: 'WebStorm', app: 'WebStorm' },
  { id: 'pycharm', label: 'PyCharm', app: 'PyCharm' },
  { id: 'goland', label: 'GoLand', app: 'GoLand' },
  { id: 'ghostty', label: 'Ghostty', app: 'Ghostty' },
  { id: 'iterm', label: 'iTerm', app: 'iTerm' },
  { id: 'warp', label: 'Warp', app: 'Warp' },
  { id: 'terminal', label: 'Terminal', app: 'Terminal' },
  {
    id: 'github-desktop',
    label: 'GitHub Desktop',
    app: 'GitHub Desktop'
  },
  { id: 'fork', label: 'Fork', app: 'Fork' }
] as const

/** The Open In command for a macOS app: `open -a "<App>"`, which main runs with the folder appended. */
export function macOpenInCommand(app: string): string {
  return `open -a "${app.replace(/["\\$`]/g, '')}"`
}

/**
 * The macOS app bundle name of each Open in preset, so Orca can offer the ones installed on this
 * Mac (the workspace layout lists detected apps without a manual add). The keys are preset ids.
 */
export const OPEN_IN_PRESET_MAC_BUNDLES: Readonly<Record<string, string>> = {
  vscode: 'Visual Studio Code',
  cursor: 'Cursor',
  zed: 'Zed',
  'devin-desktop': 'Devin',
  'antigravity-ide': 'Antigravity',
  ...Object.fromEntries(MAC_OPEN_IN_APPS.map((app) => [app.id, app.app]))
}

/** Where macOS keeps app bundles, for a user whose home folder is `home`. */
export function macAppBundleCandidates(bundle: string, home: string): string[] {
  return [
    `/Applications/${bundle}.app`,
    `${home}/Applications/${bundle}.app`,
    `/System/Applications/${bundle}.app`,
    `/System/Applications/Utilities/${bundle}.app`
  ]
}
