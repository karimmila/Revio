import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const {
  BUILT_ENTRY,
  BUILT_PR_COMMANDS,
  assertCliBuildFresh,
  cliBuildFreshness,
  describeStaleCliBuild
} = createRequire(import.meta.url)('./cli-build-freshness.cjs')

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const REPO_CLI_SOURCES = join(REPO_ROOT, 'src', 'cli')

/** What `build:cli` emits for this checkout: src/cli mirrored into out/cli, tests left out. */
function emittedCliFiles(directory = REPO_CLI_SOURCES) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return emittedCliFiles(path)
    }
    if (!/\.tsx?$/.test(entry.name) || /\.(?:test|spec)\.tsx?$|\.d\.ts$/.test(entry.name)) {
      return []
    }
    return [join('out', 'cli', relative(REPO_CLI_SOURCES, path).replace(/\.tsx?$/, '.js'))]
  })
}

let root
const at = (path, secondsAgo, contents = '') => {
  const full = join(root, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, contents)
  const time = new Date(Date.now() - secondsAgo * 1000)
  utimesSync(full, time, time)
}
const build = (secondsAgo) => {
  for (const path of emittedCliFiles()) {
    at(path, secondsAgo)
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cli-build-freshness-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('CLI build freshness', () => {
  it('looks for files the CLI build really emits', () => {
    const emitted = emittedCliFiles()
    expect(emitted.length).toBeGreaterThan(10)
    for (const path of [BUILT_ENTRY, ...BUILT_PR_COMMANDS]) {
      expect(emitted, `${path} is not in the build output`).toContain(path)
    }
  })

  it('agrees with a real out/cli when this checkout has one', () => {
    if (!existsSync(join(REPO_ROOT, BUILT_ENTRY))) {
      return
    }
    expect(cliBuildFreshness(REPO_ROOT).state).not.toBe('missing')
  })

  it('is fresh when out/cli was built after every source file', () => {
    at('src/cli/index.ts', 600)
    at('src/cli/handlers/pr.ts', 500)
    build(100)
    expect(cliBuildFreshness(root)).toEqual({ state: 'fresh' })
    expect(describeStaleCliBuild(cliBuildFreshness(root))).toBeNull()
    expect(() => assertCliBuildFresh(root)).not.toThrow()
  })

  it('is stale when a source file changed after the build, and names it', () => {
    at('src/cli/index.ts', 600)
    build(300)
    at('src/cli/handlers/pr.ts', 10)
    const freshness = cliBuildFreshness(root)
    expect(freshness).toEqual({ state: 'stale', source: join(root, 'src/cli/handlers/pr.ts') })
    expect(describeStaleCliBuild(freshness)).toContain('pnpm run build:cli')
    expect(() => assertCliBuildFresh(root)).toThrow(/Cannot package/)
  })

  it('does not count tests, or files stamped in the same moment as the build', () => {
    build(300)
    at('src/cli/pr.test.ts', 10)
    at('src/cli/index.ts', 299)
    expect(cliBuildFreshness(root)).toEqual({ state: 'fresh' })
  })

  it('is missing when out/cli was never built or predates the PR commands', () => {
    at('src/cli/index.ts', 600)
    expect(cliBuildFreshness(root)).toEqual({ state: 'missing' })
    at(BUILT_ENTRY, 100)
    expect(cliBuildFreshness(root)).toEqual({ state: 'missing' })
    expect(() => assertCliBuildFresh(root)).toThrow(/out\/cli is not built/)
    for (const missing of BUILT_PR_COMMANDS) {
      build(100)
      rmSync(join(root, missing))
      expect(cliBuildFreshness(root)).toEqual({ state: 'missing' })
    }
  })
})
