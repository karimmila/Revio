import { isAbsolute } from 'node:path'

/**
 * Names the Mac acts on by itself when a file appears in a checkout: git's own data and hooks,
 * direnv, editor and IDE project settings that run tasks or Lua, and mise's config. The sandbox
 * chooses the file list, so none of these may come from it.
 */
const AUTO_RUN_NAMES = new Set([
  '.git',
  '.gitmodules',
  '.husky',
  '.githooks',
  '.envrc',
  '.vscode',
  '.idea',
  '.zed',
  '.nvim.lua',
  '.nvimrc',
  '.exrc',
  '.lazy.lua',
  '.mise.toml',
  'mise.toml',
  '.mise'
])

// Characters HFS+/APFS ignore in names, so `.g\u200cit` is `.git` on disk (as git's own
// is_hfs_dotgit check).
const IGNORABLE = /[\u200b-\u200f\u202a-\u202e\u206a-\u206f\ufeff]/g

function folded(segment: string): string {
  return segment.normalize('NFC').replace(IGNORABLE, '').toLowerCase()
}

/**
 * Relative, inside the tree, and nothing the Mac runs on its own: anything else is refused.
 * `blockedPrefixes` adds folders such as the repository's relative core.hooksPath.
 */
export function isSafeMirrorPath(path: string, blockedPrefixes: readonly string[] = []): boolean {
  if (!path || isAbsolute(path) || path.includes('\0') || path.includes('\n')) {
    return false
  }
  const parts = path.split('/')
  if (!parts.every((part) => part !== '' && part !== '.' && part !== '..')) {
    return false
  }
  const names = parts.map(folded)
  if (names.some((name) => AUTO_RUN_NAMES.has(name))) {
    return false
  }
  const joined = names.join('/')
  return !blockedPrefixes.some((prefix) => {
    const blocked = folded(prefix).replace(/^\.\//, '').replace(/\/+$/, '')
    return blocked !== '' && (joined === blocked || joined.startsWith(`${blocked}/`))
  })
}
