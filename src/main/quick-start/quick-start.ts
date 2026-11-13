import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { ipcMain } from 'electron'
import { z } from 'zod'
import type { QuickStartRequest, QuickStartResult } from '../../shared/quick-start-types'
import { ghExecFileAsync } from '../git/command-runner/gh-exec-file'

export type QuickStartRunner = {
  run: (command: string, args: string[], cwd: string) => Promise<string>
  gh: (args: string[], cwd: string) => Promise<string>
  write: (path: string, text: string) => Promise<void>
  exists: (path: string) => boolean
}

async function runOrThrow(command: string, args: string[], cwd: string): Promise<string> {
  const result = await runProcess({
    program: command,
    args,
    cwd,
    timeoutMs: 10 * 60_000,
    maxOutputBytes: 16 * 1024 * 1024
  })
  if (result.timedOut) {
    throw new Error(`${command} timed out.`)
  }
  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim()
    throw new Error(
      `${command} ${args.join(' ')} exited with code ${result.code ?? 'unknown'}${detail ? `: ${detail}` : ''}`
    )
  }
  return result.stdout
}

const nodeRunner: QuickStartRunner = {
  run: runOrThrow,
  gh: async (args, cwd) => (await ghExecFileAsync(args, { cwd })).stdout,
  write: (path, text) => writeFile(path, text, 'utf8'),
  exists: existsSync
}

const quickStartRequestSchema = z.object({
  repoPath: z.string(),
  name: z.string().regex(/^[\w.-]+$/),
  template: z.enum(['none', 'empty', 'nextjs']),
  publishToGithub: z.unknown().optional()
})

const GITIGNORE = [
  'node_modules/',
  '.env*',
  '!.env.example',
  '.DS_Store',
  'dist/',
  '.next/',
  ''
].join('\n')

/** The Quick start on a freshly created local repository: a template, then GitHub. */
export async function applyQuickStart(
  request: QuickStartRequest,
  runner: QuickStartRunner = nodeRunner
): Promise<QuickStartResult> {
  const cwd = request.repoPath
  try {
    if (request.template === 'empty') {
      if (!runner.exists(join(cwd, 'README.md'))) {
        await runner.write(join(cwd, 'README.md'), `# ${request.name}\n`)
      }
      if (!runner.exists(join(cwd, '.gitignore'))) {
        await runner.write(join(cwd, '.gitignore'), GITIGNORE)
      }
    }
    if (request.template === 'nextjs') {
      await runner.run(
        'npx',
        [
          '--yes',
          'create-next-app@latest',
          '.',
          '--ts',
          '--eslint',
          '--app',
          '--use-npm',
          '--yes',
          '--skip-install'
        ],
        cwd
      )
    }
    if (request.template !== 'none') {
      await runner.run('git', ['add', '-A'], cwd)
      await runner.run('git', ['commit', '-m', 'Initial commit'], cwd)
    }
    if (!request.publishToGithub) {
      return { ok: true }
    }
    const created = await runner.gh(
      [
        'repo',
        'create',
        request.name,
        '--private',
        '--source',
        cwd,
        '--remote',
        'origin',
        '--push'
      ],
      cwd
    )
    const url = created.match(/https:\/\/github\.com\/\S+/)?.[0]
    return url ? { ok: true, githubUrl: url } : { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function registerQuickStartHandlers(): void {
  ipcMain.handle('quickStart:apply', (_event, request: unknown) => {
    const parsed = quickStartRequestSchema.safeParse(request)
    if (!parsed.success) {
      return { ok: false, error: 'Invalid request.' }
    }
    const { repoPath, name, template, publishToGithub } = parsed.data
    return applyQuickStart({ repoPath, name, template, publishToGithub: publishToGithub === true })
  })
}
