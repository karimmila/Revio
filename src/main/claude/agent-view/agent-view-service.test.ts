import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { ClaudeAgentViewService } from './agent-view-service'
import { reconcileClaudeAgentViewConfig } from './agent-view-config'
import { markerName } from './agent-view-binding-plan'
import { ensureClaudeAgentViewPlugin, ensureClaudeAgentViewPluginAsync } from './agent-view-plugin'
import { claudeAgentViewChord } from './agent-view-keybindings'
import {
  captureLoginShellEnvironment,
  resetLoginShellEnvironmentCacheForTests,
  resolveLoginShellEnvironment
} from '../../startup/login-shell-environment'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  vi.unstubAllEnvs()
  vi.useRealTimers()
  resetLoginShellEnvironmentCacheForTests()
})

it.each([{}, { claudeSubagentNavigationEnabled: true }])(
  'prepares navigation automatically, serializing config changes and respecting shortcut removals: %j',
  async (enabled) => {
    const root = await mkdtemp(join(tmpdir(), 'revio-agent-view-service-'))
    roots.push(root)
    const config = join(root, 'default')
    vi.stubEnv('CLAUDE_CONFIG_DIR', config)
    const profile = join(root, 'account')
    const reconcileConfig = vi.fn(reconcileClaudeAgentViewConfig)
    const ensurePlugin = vi.fn(ensureClaudeAgentViewPluginAsync)
    const service = new ClaudeAgentViewService(join(root, 'orca'), {
      reconcileConfig,
      ensurePlugin,
      listProfiles: async () => [profile],
      loginEnv: async () => ({ CLAUDE_CONFIG_DIR: config })
    })
    await Promise.all(Array.from({ length: 100 }, () => service.reconcile(enabled)))
    expect(reconcileConfig).toHaveBeenCalledTimes(2)
    expect(ensurePlugin).toHaveBeenCalledOnce()
    expect(service.read(config)?.pluginDir).toBeTruthy()
    expect(service.read(config)?.pluginDir).toBe(ensureClaudeAgentViewPlugin(join(root, 'orca')))
    await writeFile(join(profile, 'keybindings.json'), '{"bindings":[]}')
    await service.reconcile({ claudeSubagentNavigationEnabled: false })
    expect(service.read(config)).toBeUndefined()
    expect(
      claudeAgentViewChord(await readFile(join(config, 'keybindings.json'), 'utf8'))
    ).toBeUndefined()
    expect(JSON.parse(await readFile(join(config, 'revio-agent-view.json'), 'utf8')).setup).toBe(
      'pending'
    )
    expect(JSON.parse(await readFile(join(profile, 'revio-agent-view.json'), 'utf8')).setup).toBe(
      'attempted'
    )
    await reconcileClaudeAgentViewConfig(join(config, 'settings.json'), false)
    await service.reconcile(enabled)
    expect(claudeAgentViewChord(await readFile(join(config, 'keybindings.json'), 'utf8'))).toBe(
      'ctrl+alt+g'
    )
    expect(await readFile(join(profile, 'keybindings.json'), 'utf8')).toBe('{"bindings":[]}')
    const calls = reconcileConfig.mock.calls.length
    for (let pane = 0; pane < 100; pane++) {
      service.read(config)
    }
    expect(reconcileConfig).toHaveBeenCalledTimes(calls)
    await service.prepareProfile(join(root, 'new-account'))
    expect(
      claudeAgentViewChord(await readFile(join(root, 'new-account', 'keybindings.json'), 'utf8'))
    ).toBe('ctrl+alt+g')
    await service.prepareProfile(join(root, 'new-account'))
    expect(reconcileConfig).toHaveBeenCalledTimes(calls + 1)
  }
)

it('cleans an owned shortcut in a cached login-shell config on a fresh disabled service', async () => {
  const root = await mkdtemp(join(tmpdir(), 'revio-agent-view-cached-home-'))
  roots.push(root)
  const config = join(root, 'process-config')
  const cachedConfig = join(root, 'shell-config')
  vi.stubEnv('CLAUDE_CONFIG_DIR', config)
  const spawner = vi.fn(async () => ({ CLAUDE_CONFIG_DIR: cachedConfig }))
  await captureLoginShellEnvironment({ spawner })
  await reconcileClaudeAgentViewConfig(join(cachedConfig, 'settings.json'), true)
  const bindings = join(cachedConfig, 'keybindings.json')
  expect(claudeAgentViewChord(await readFile(bindings, 'utf8'))).toBe('ctrl+alt+g')
  const loginEnv = vi.fn(resolveLoginShellEnvironment)
  const service = new ClaudeAgentViewService(join(root, 'orca'), {
    reconcileConfig: reconcileClaudeAgentViewConfig,
    ensurePlugin: ensureClaudeAgentViewPluginAsync,
    listProfiles: async () => [],
    loginEnv
  })
  await service.reconcile({ claudeSubagentNavigationEnabled: false })
  expect(claudeAgentViewChord(await readFile(bindings, 'utf8'))).toBeUndefined()
  expect(
    JSON.parse(await readFile(join(cachedConfig, 'revio-agent-view.json'), 'utf8')).setup
  ).toBe('pending')
  expect(loginEnv.mock.calls).toEqual([[{ cachedOnly: true }]])
  expect(spawner).toHaveBeenCalledOnce()
})

it('writes nothing in the workspace layout and takes back an older install', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-view-retired-'))
  roots.push(root)
  const fresh = join(root, 'fresh')
  const installed = join(root, 'installed')
  const edited = join(root, 'edited')
  await mkdir(fresh)
  await reconcileClaudeAgentViewConfig(join(installed, 'settings.json'), true)
  await mkdir(edited)
  await writeFile(
    join(edited, 'keybindings.json'),
    '{"bindings":[{"context":"Chat","bindings":{"ctrl+k":"chat:submit"}}]}'
  )
  await reconcileClaudeAgentViewConfig(join(edited, 'settings.json'), true)
  vi.stubEnv('CLAUDE_CONFIG_DIR', fresh)
  const service = new ClaudeAgentViewService(join(root, 'orca'), {
    reconcileConfig: reconcileClaudeAgentViewConfig,
    ensurePlugin: ensureClaudeAgentViewPluginAsync,
    listProfiles: async () => [installed, edited],
    loginEnv: async () => ({ CLAUDE_CONFIG_DIR: fresh })
  })

  await service.reconcile({ revioLayout: true, agentStatusHooksEnabled: true })

  expect(await readdir(fresh)).toEqual([])
  expect(await readdir(installed)).toEqual([])
  // This app's marker is gone; the person's keybindings file and its backup stay.
  expect(await readdir(edited)).not.toContain(markerName)
  expect(await readdir(edited)).toEqual(['keybindings.json', 'keybindings.json.bak'])
  expect(JSON.parse(await readFile(join(edited, 'keybindings.json'), 'utf8'))).toEqual({
    bindings: [{ context: 'Chat', bindings: { 'ctrl+k': 'chat:submit' } }]
  })
  expect(service.read(fresh)).toBeUndefined()
})
