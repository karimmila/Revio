import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { reconcileClaudeAgentViewConfig } from './agent-view-config'
import { ownership, markerName } from './agent-view-binding-plan'
import {
  installClaudeAgentView,
  refreshClaudeAgentView,
  removeClaudeAgentView
} from './agent-view-install'

/*
 * A Mac can have the upstream app installed beside this one. Its Claude agent view lives in the
 * same ~/.claude folder: a marker file, a keybinding and a legacy skill folder, all under upstream
 * names. Nothing this app does there may change a byte of them.
 */
const UPSTREAM_MARKER = 'orca-agent-view.json'
const UPSTREAM_OWNER = 'stablyai/orca/claude-agent-view'
const UPSTREAM_BINDING = 'command:orca-agent-view'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function claudeHomeWithUpstreamInstall(): { root: string; snapshot: () => Record<string, string> } {
  const root = mkdtempSync(join(tmpdir(), 'agent-view-upstream-'))
  roots.push(root)
  writeFileSync(
    join(root, UPSTREAM_MARKER),
    JSON.stringify({
      owner: UPSTREAM_OWNER,
      setup: 'attempted',
      binding: { context: 'Chat', chord: 'ctrl+alt+g' }
    })
  )
  writeFileSync(
    join(root, 'keybindings.json'),
    `{
  // upstream wrote this binding
  "bindings": [{ "context": "Chat", "bindings": { "ctrl+alt+g": "${UPSTREAM_BINDING}" } }]
}`
  )
  const legacy = join(root, 'skills', 'orca-agent-view', '.claude-plugin')
  mkdirSync(legacy, { recursive: true })
  writeFileSync(join(legacy, 'orca-managed.json'), JSON.stringify({ owner: UPSTREAM_OWNER }))
  const files = [
    UPSTREAM_MARKER,
    'keybindings.json',
    join('skills', 'orca-agent-view', '.claude-plugin', 'orca-managed.json')
  ]
  return {
    root,
    snapshot: () =>
      Object.fromEntries(files.map((file) => [file, readFileSync(join(root, file), 'utf8')]))
  }
}

it('uses identifiers that are not the upstream ones', () => {
  expect(markerName).not.toBe(UPSTREAM_MARKER)
  expect(ownership.owner).not.toBe(UPSTREAM_OWNER)
  expect(markerName).toBe('revio-agent-view.json')
  expect(ownership.owner).toBe('dev.revio.app/claude-agent-view')
})

it.each([
  ['off', false, {}],
  ['retired', false, { retired: true }]
] as const)(
  'leaves the upstream marker, binding and skill folder as they are when %s',
  async (_name, enabled, options) => {
    const home = claudeHomeWithUpstreamInstall()
    const before = home.snapshot()

    await reconcileClaudeAgentViewConfig(join(home.root, 'settings.json'), enabled, options)
    await refreshClaudeAgentView(join(home.root, 'settings.json'))
    removeClaudeAgentView(join(home.root, 'settings.json'))

    expect(home.snapshot()).toEqual(before)
    expect(readdirSync(home.root).sort()).toEqual(['keybindings.json', UPSTREAM_MARKER, 'skills'])
  }
)

it('takes back only its own binding and marker, beside an upstream install', async () => {
  const home = claudeHomeWithUpstreamInstall()
  const before = home.snapshot()
  const settings = join(home.root, 'settings.json')

  installClaudeAgentView(settings)
  const installed = readFileSync(join(home.root, 'keybindings.json'), 'utf8')
  expect(installed).toContain('command:revio-agent-view')
  expect(installed).toContain(UPSTREAM_BINDING)
  expect(readdirSync(home.root)).toContain(markerName)

  await reconcileClaudeAgentViewConfig(settings, false, { retired: true })

  const after = readFileSync(join(home.root, 'keybindings.json'), 'utf8')
  expect(after).not.toContain('command:revio-agent-view')
  expect(after).toContain(UPSTREAM_BINDING)
  expect(after).toContain('// upstream wrote this binding')
  expect(readdirSync(home.root)).not.toContain(markerName)
  expect(readFileSync(join(home.root, UPSTREAM_MARKER), 'utf8')).toBe(before[UPSTREAM_MARKER])
  expect(
    home.snapshot()[join('skills', 'orca-agent-view', '.claude-plugin', 'orca-managed.json')]
  ).toBe(before[join('skills', 'orca-agent-view', '.claude-plugin', 'orca-managed.json')])
})
