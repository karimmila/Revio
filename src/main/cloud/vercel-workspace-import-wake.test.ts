import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as VercelWorkspaceIo from './vercel-workspace-io'

type FakeCommand = { script: string; sudo: boolean; cwd?: string }

type State = {
  dir: string
  creates: { snapshotId: string }[]
  commands: FakeCommand[]
  written: { path: string; content: string }[]
  failScript: RegExp | null
  changesOutput: string
}

const h = vi.hoisted((): State => ({
  dir: '',
  creates: [],
  commands: [],
  written: [],
  failScript: null,
  changesOutput: 'REVIO_IMPORT_CHANGES=applied'
}))

function fakeSandbox() {
  return {
    name: 'sbx',
    writeFiles: async (files: { path: string; content: string | Uint8Array }[]) => {
      for (const file of files) {
        h.written.push({ path: file.path, content: Buffer.from(file.content).toString('utf8') })
      }
    },
    runCommand: async (args: { args: string[]; sudo?: boolean; cwd?: string }) => {
      const script = args.args[1] ?? ''
      h.commands.push({ script, sudo: args.sudo === true, cwd: args.cwd })
      const failing = h.failScript?.test(script) ?? false
      const output = script.includes('REVIO_IMPORT_CHANGES=') ? h.changesOutput : ''
      return {
        logs: async function* () {
          if (output) {
            yield { data: `${output}\n` }
          }
        },
        wait: async () => ({ exitCode: failing ? 1 : 0 })
      }
    },
    delete: async () => undefined
  }
}

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: async (args: { source: { snapshotId: string } }) => {
      h.creates.push({ snapshotId: args.source.snapshotId })
      return fakeSandbox()
    }
  }
}))
vi.mock('./cloud-repo-store', () => ({
  cloudDataRoot: () => h.dir,
  readRepoFile: () => ({
    builds: [{ state: 'succeeded', snapshotId: 'snap_build0001', commit: 'b'.repeat(40) }],
    config: { setupScript: '', vcpus: 2 }
  })
}))
vi.mock('../vercel-cloud/vercel-cloud-auth', () => ({
  vercelScope: async () => ({ token: 't', teamId: 'team', projectId: 'prj' }),
  readVercelStatus: async () => ({ state: 'disconnected' })
}))
vi.mock('./cloud-github', () => ({
  GH_PLACEHOLDER_TOKEN: 'gh',
  githubRepoOf: async () => ({ owner: 'me', name: 'app' }),
  remoteBranchOfRef: () => null,
  sandboxNetworkPolicy: () => ({})
}))
vi.mock('./cloud-github-access', () => ({ githubTokenForRepo: async () => null }))
vi.mock('./cloud-claude-token', () => ({ readCloudClaudeToken: () => null }))
vi.mock('./cloud-ssh-access', () => ({
  SANDBOX_SSH_BRIDGE_PORT: 2222,
  prepareWorkspaceKey: async () => 'key',
  removeWorkspaceKey: () => undefined
}))
vi.mock('../ssh/pinned-host-keys', () => ({ forgetPinnedHostKey: () => undefined }))
vi.mock('./vercel-workspace-connection', () => ({ connectionResult: async () => '{}' }))
vi.mock('./cloud-sandbox-env', () => ({
  applyWorkspaceSandboxEnvironment: async () => undefined,
  cloudSetupScriptContent: () => '',
  workspaceSandboxEnvironment: () => ({})
}))
vi.mock('./cloud-session-length', () => ({
  CREATE_TIMEOUT_MS: 1,
  extendToPlanLimit: async () => undefined,
  readVercelLimits: async () => null
}))
vi.mock('./cloud-agent-actions', () => ({
  afterCloudResume: () => undefined,
  writeCloudAgentActions: async () => undefined
}))
vi.mock('./cloud-pending-sandboxes', () => ({
  markSandboxPending: () => undefined,
  clearSandboxPending: () => undefined
}))
vi.mock('./cloud-log', () => ({ cloudInfo: () => undefined, bestEffort: () => () => undefined }))
vi.mock('./vercel-workspace-io', async (importOriginal) => ({
  ...(await importOriginal<typeof VercelWorkspaceIo>()),
  cloudGitIdentity: async () => ({ name: null, email: null })
}))

import { setCloudWorkspaceRepoResolver, vercelWorkspaceHandler } from './vercel-workspace-provider'
import { prepareCloudRestore } from './cloud-archive-restore'
import { readAsleepCloudPayloadOutcome } from '../workspace-import/asleep-cloud-payload'

const COMMIT = 'c'.repeat(40)

function writePayload(dir: string): void {
  mkdirSync(join(dir, 'new-files'), { recursive: true })
  mkdirSync(join(dir, 'transcripts'), { recursive: true })
  writeFileSync(join(dir, 'changes.patch'), 'diff --git a/x b/x\n')
  writeFileSync(join(dir, 'new-files', 'notes.md'), 'new\n')
  writeFileSync(join(dir, 'commits.bundle'), 'bundle')
  writeFileSync(
    join(dir, 'transcripts', 'sess-1.jsonl'),
    `${JSON.stringify({ type: 'user', cwd: '/old/place', message: 'hi' })}\n`
  )
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({ sourceCwd: '/old/place', patch: true, untracked: ['notes.md'], bundle: true })
  )
}

async function wake(): Promise<{ exitCode: number | null; stderr: string }> {
  let stderr = ''
  const result = await vercelWorkspaceHandler({
    mode: 'create',
    context: { instanceId: 'i-1', recipeId: 'vercel', repoPath: '/repo', branch: 'feat' },
    onStderr: (text) => {
      stderr += text
    }
  })
  return { exitCode: result.exitCode, stderr: stderr + result.stderr }
}

let payload: string

beforeEach(() => {
  h.dir = mkdtempSync(join(tmpdir(), 'import-wake-'))
  h.creates = []
  h.commands = []
  h.written = []
  h.failScript = null
  h.changesOutput = 'REVIO_IMPORT_CHANGES=applied'
  payload = join(h.dir, 'imp')
  writePayload(payload)
  setCloudWorkspaceRepoResolver(() => 'repo-1')
  prepareCloudRestore({
    repoId: 'repo-1',
    branch: 'feat',
    snapshotId: null,
    commit: COMMIT,
    importPayloadDir: payload
  })
})
afterEach(() => {
  rmSync(h.dir, { recursive: true, force: true })
})

describe('waking an imported cloud workspace', () => {
  it('starts from the build, checks out its commit and applies what it kept', async () => {
    const result = await wake()
    expect(result.exitCode).toBe(0)
    expect(h.creates).toEqual([{ snapshotId: 'snap_build0001' }])
    const paths = h.written.map((file) => file.path)
    expect(paths).toEqual([
      '/tmp/revio-import/changes.patch',
      '/tmp/revio-import/new-files/notes.md',
      '/tmp/revio-import/commits.bundle',
      '/tmp/revio-import/transcripts/sess-1.jsonl'
    ])
    const transcript = h.written.find((file) => file.path.endsWith('sess-1.jsonl'))
    expect(JSON.parse(transcript?.content.trim() ?? '{}').cwd).toBe('/vercel/app')

    const checkout = h.commands.find((command) => command.script.includes('git checkout'))
    expect(checkout?.script).toContain('commits.bundle')
    expect(checkout?.script).toContain(`git checkout -q -f -B 'feat' '${COMMIT}'`)
    // The bundle is fetched before the checkout that needs its commit.
    expect(checkout?.script.indexOf('commits.bundle')).toBeLessThan(
      checkout?.script.indexOf('git checkout') ?? 0
    )
    const apply = h.commands.find((command) => command.script.includes('git apply'))
    expect(apply?.cwd).toBe('/vercel/app')
    const transcripts = h.commands.find((command) => command.script.includes('.claude/projects'))
    expect(transcripts?.sudo).toBe(true)
    expect(transcripts?.script).toContain("'-vercel-app'")
    expect(readAsleepCloudPayloadOutcome(payload)).toBe('applied')
  })

  it('records a diff kept aside, which the app then reports', async () => {
    h.changesOutput = 'REVIO_IMPORT_CHANGES=kept-aside'
    expect((await wake()).exitCode).toBe(0)
    expect(readAsleepCloudPayloadOutcome(payload)).toBe('kept-aside')
  })

  it('leaves the Mac copy unmarked when the sandbox did not take everything', async () => {
    h.failScript = /\.claude\/projects/
    expect((await wake()).exitCode).toBe(1)
    expect(readAsleepCloudPayloadOutcome(payload)).toBeNull()
    expect(existsSync(join(payload, 'manifest.json'))).toBe(true)
  })

  it('creates a plain cloud workspace when no import was armed', async () => {
    rmSync(join(payload, 'manifest.json'))
    expect((await wake()).exitCode).toBe(0)
    expect(h.written).toEqual([])
    expect(h.commands.some((command) => command.script.includes('git apply'))).toBe(false)
  })
})
