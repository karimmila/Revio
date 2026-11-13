// The CLI agents run (`pr create`, `pr push`, `pr checks`, …) is compiled from src/cli into
// out/cli by `build:cli`. Nothing else rebuilds it: electron-vite's dev server and its build both
// leave out/cli alone. A stale out/cli gives agents commands that are missing or behave like an
// older build, and they then fall back to the person's own `gh`. This answers whether out/cli is
// at least as new as its sources, for the packaging guard and the dev launcher's warning.
const { readdirSync, statSync } = require('node:fs')
const { join } = require('node:path')

const SOURCE_DIRECTORY = join('src', 'cli')
const BUILT_ENTRY = join('out', 'cli', 'index.js')
// The command files agents depend on most; an output without them predates the PR commands.
// The compiler mirrors src/cli into out/cli, so each one sits where its source does.
const BUILT_PR_COMMANDS = [
  join('out', 'cli', 'handlers', 'pr.js'),
  join('out', 'cli', 'specs', 'pr.js')
]
const TEST_FILE = /\.(?:test|spec)\.[cm]?tsx?$|test-fixtures?\.ts$/
// Checkouts and copies stamp files a moment apart; only a real edit is further off than this.
const CLOCK_SLACK_MS = 2000

function mtimeMs(path) {
  try {
    return statSync(path).mtimeMs
  } catch {
    return null
  }
}

function newestSource(directory) {
  let newest = { path: null, mtimeMs: 0 }
  let entries
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return newest
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      const nested = newestSource(path)
      if (nested.mtimeMs > newest.mtimeMs) {
        newest = nested
      }
    } else if (/\.[cm]?tsx?$/.test(entry.name) && !TEST_FILE.test(entry.name)) {
      const at = mtimeMs(path) ?? 0
      if (at > newest.mtimeMs) {
        newest = { path, mtimeMs: at }
      }
    }
  }
  return newest
}

/**
 * `fresh`, or why not: `missing` (never built, or built before the PR commands existed) or
 * `stale` (a source file changed after the build), with the file that proves it.
 */
function cliBuildFreshness(root) {
  const builtAt = mtimeMs(join(root, BUILT_ENTRY))
  if (builtAt === null || BUILT_PR_COMMANDS.some((path) => mtimeMs(join(root, path)) === null)) {
    return { state: 'missing' }
  }
  const newest = newestSource(join(root, SOURCE_DIRECTORY))
  if (newest.path !== null && newest.mtimeMs > builtAt + CLOCK_SLACK_MS) {
    return { state: 'stale', source: newest.path }
  }
  return { state: 'fresh' }
}

/** One line for a person: what is wrong and the command that fixes it; null when fresh. */
function describeStaleCliBuild(freshness) {
  if (freshness.state === 'fresh') {
    return null
  }
  const reason =
    freshness.state === 'missing'
      ? 'out/cli is not built'
      : `out/cli is older than ${freshness.source}`
  return `${reason}: agents would get an old command-line tool. Run \`pnpm run build:cli\`.`
}

/** Packaging refuses a stale CLI, so a build made without `build:cli` cannot ship one. */
function assertCliBuildFresh(root) {
  const problem = describeStaleCliBuild(cliBuildFreshness(root))
  if (problem) {
    throw new Error(`Cannot package: ${problem}`)
  }
}

/** The dev launcher's warning: the dev server never rebuilds out/cli. */
function warnWhenCliBuildIsStale(root, warn = console.warn) {
  const problem = describeStaleCliBuild(cliBuildFreshness(root))
  if (problem) {
    warn(`[orca-dev] WARNING: ${problem}`)
  }
  return problem
}

module.exports = {
  BUILT_ENTRY,
  BUILT_PR_COMMANDS,
  assertCliBuildFresh,
  cliBuildFreshness,
  describeStaleCliBuild,
  warnWhenCliBuildIsStale
}
