import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  CLOUD_PR_COMMAND_NAME,
  CLOUD_PR_COMMAND_PATH,
  CLOUD_PR_COMMAND_SCRIPT
} from './cloud-pr-command'

const hasPython = spawnSync('python3', ['--version']).status === 0

describe.skipIf(!hasPython)('cloud sandbox pull-request command', () => {
  let root: string
  let repo: string
  let command: string
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GH_TOKEN: 'placeholder' }
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8', env })
  const run = (...args: string[]): { status: number | null; stdout: string; stderr: string } => {
    const result = spawnSync('python3', [command, '--print-request', ...args], {
      cwd: repo,
      encoding: 'utf8',
      env
    })
    return { status: result.status, stdout: result.stdout, stderr: result.stderr }
  }

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'cloud-pr-command-'))
    repo = join(root, 'app')
    command = join(root, CLOUD_PR_COMMAND_NAME)
    writeFileSync(command, CLOUD_PR_COMMAND_SCRIPT)
    chmodSync(command, 0o755)
    execFileSync('git', ['init', '-q', '-b', 'main', repo], { env })
    git('config', 'user.email', 't@example.com')
    git('config', 'user.name', 't')
    git('remote', 'add', 'origin', 'https://github.com/acme/web-app.git')
    git('commit', '-q', '--allow-empty', '-m', 'first')
    git('checkout', '-q', '-b', 'me/add-notes')
  })
  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('lives at a fixed path the prompt can name', () => {
    expect(CLOUD_PR_COMMAND_PATH.endsWith(`/${CLOUD_PR_COMMAND_NAME}`)).toBe(true)
  })

  it('builds the create request from the title and the body file, exactly as given', () => {
    const body = 'Adds the notes page.\n\n- "quoted" text\n- $HOME and `code` stay as written\n'
    writeFileSync(join(root, 'body.md'), body)
    const title = 'Add notes: "quotes", $vars & <tags>'
    const result = run(
      'create',
      '--title',
      title,
      '--body-file',
      join(root, 'body.md'),
      '--draft',
      '--base',
      'main'
    )
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({
      method: 'POST',
      url: 'https://api.github.com/repos/acme/web-app/pulls',
      body: { title, head: 'me/add-notes', base: 'main', body, draft: true }
    })
  })

  it('leaves draft out unless asked, and refuses an empty title or a missing body file', () => {
    writeFileSync(join(root, 'body.md'), 'Body')
    const plain = run('create', '--title', 'T', '--body-file', join(root, 'body.md'), '--base', 'm')
    expect(JSON.parse(plain.stdout).body).toEqual({
      title: 'T',
      head: 'me/add-notes',
      base: 'm',
      body: 'Body'
    })
    const empty = run('create', '--title', '  ', '--body-file', join(root, 'body.md'))
    expect(empty.status).not.toBe(0)
    expect(empty.stderr).toContain('--title must not be empty')
    const missing = run('create', '--title', 'T', '--body-file', join(root, 'nope.md'))
    expect(missing.status).not.toBe(0)
    expect(missing.stderr).toContain('could not read --body-file')
  })

  it('reads the checks of the branch’s last commit', () => {
    const sha = git('rev-parse', 'HEAD').trim()
    expect(JSON.parse(run('checks').stdout)).toEqual({
      method: 'GET',
      url: `https://api.github.com/repos/acme/web-app/commits/${sha}/check-runs?per_page=100`,
      body: null
    })
  })

  it('says so when origin is not a GitHub repository', () => {
    git('remote', 'set-url', 'origin', 'https://gitlab.com/acme/web-app.git')
    const result = run('checks')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('origin is not a GitHub repository')
    git('remote', 'set-url', 'origin', 'git@github.com:acme/web-app.git')
    expect(JSON.parse(run('checks').stdout).url).toContain('/repos/acme/web-app/commits/')
  })
})
