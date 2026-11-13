const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

/*
 * The macOS app ships GitHub's `gh` (MIT) so GitHub features work on a Mac that never installed
 * it. gh has no npm package, so the pinned release archive is downloaded once into a git-ignored
 * cache, checked against the SHA-256 from that release's checksums file, and copied into
 * Contents/Resources/gh. The app prefers a `gh` on PATH and falls back to this one.
 *
 * To move the pin: change the version and both hashes from
 * https://github.com/cli/cli/releases/download/v<version>/gh_<version>_checksums.txt
 */
const BUNDLED_GH_VERSION = '2.93.0'
const BUNDLED_GH_ARCHIVES = {
  arm64: {
    name: `gh_${BUNDLED_GH_VERSION}_macOS_arm64`,
    sha256: 'a86be4e0a86c26456cf71177d6572d6f1165cf1679e532b72f7f15918ee51fd2'
  },
  x64: {
    name: `gh_${BUNDLED_GH_VERSION}_macOS_amd64`,
    sha256: '009425b9d175c482037fe25181817fd6b1ea3ae1f51cfae0e18f29f33d3152ac'
  }
}
const BUNDLED_GH_CACHE_DIR = 'resources/bundled-gh'
const BUNDLED_GH_RESOURCE_DIR = 'gh'
const SKIP_ENV = 'REVIO_SKIP_BUNDLED_GH'

const bundledGhMacExtraResources = [
  { from: `${BUNDLED_GH_CACHE_DIR}/darwin-\${arch}`, to: BUNDLED_GH_RESOURCE_DIR }
]

// afterPack signs it like the other standalone helpers; app signing must not rewrite it.
const bundledGhMacSignIgnore = [`/Contents/Resources/${BUNDLED_GH_RESOURCE_DIR}/gh$`]

function bundledGhCacheDir(arch, projectDir = join(__dirname, '..')) {
  return join(projectDir, BUNDLED_GH_CACHE_DIR, `darwin-${arch}`)
}

function isCachedVersion(dir) {
  try {
    return (
      existsSync(join(dir, 'gh')) &&
      readFileSync(join(dir, 'VERSION'), 'utf8').trim() === BUNDLED_GH_VERSION
    )
  } catch {
    return false
  }
}

function defaultDownload(url, destination) {
  execFileSync('curl', ['-fsSL', '--retry', '3', '--max-time', '300', '-o', destination, url], {
    stdio: ['ignore', 'inherit', 'inherit']
  })
}

/**
 * Makes sure the pinned gh for `arch` ('arm64' | 'x64') is in the cache, downloading it when it
 * is not. Throws when the download fails or the hash differs; REVIO_SKIP_BUNDLED_GH=1 skips it
 * (the app then needs a `gh` on PATH).
 */
function ensureBundledGh(arch, options = {}) {
  const { projectDir, env = process.env, download = defaultDownload, log = console.log } = options
  if (env[SKIP_ENV] === '1') {
    log(`[bundled-gh] skipped (${SKIP_ENV}=1); the app will need gh on PATH`)
    return null
  }
  const archive = BUNDLED_GH_ARCHIVES[arch]
  if (!archive) {
    throw new Error(`[bundled-gh] no pinned gh for macOS ${arch}`)
  }
  const cacheDir = bundledGhCacheDir(arch, projectDir)
  if (isCachedVersion(cacheDir)) {
    return cacheDir
  }
  const url = `https://github.com/cli/cli/releases/download/v${BUNDLED_GH_VERSION}/${archive.name}.zip`
  const scratch = mkdtempSync(join(tmpdir(), 'bundled-gh-'))
  try {
    const zipPath = join(scratch, 'gh.zip')
    log(`[bundled-gh] downloading ${url}`)
    try {
      download(url, zipPath)
    } catch (error) {
      throw new Error(
        `[bundled-gh] could not download ${url}: ${error instanceof Error ? error.message : String(error)}. ` +
          `Retry, or set ${SKIP_ENV}=1 to package without gh.`
      )
    }
    const sha256 = createHash('sha256').update(readFileSync(zipPath)).digest('hex')
    if (sha256 !== archive.sha256) {
      throw new Error(
        `[bundled-gh] ${archive.name}.zip has SHA-256 ${sha256}, expected ${archive.sha256}`
      )
    }
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', scratch], { stdio: 'inherit' })
    rmSync(cacheDir, { recursive: true, force: true })
    mkdirSync(cacheDir, { recursive: true })
    copyFileSync(join(scratch, archive.name, 'bin', 'gh'), join(cacheDir, 'gh'))
    copyFileSync(join(scratch, archive.name, 'LICENSE'), join(cacheDir, 'LICENSE'))
    chmodSync(join(cacheDir, 'gh'), 0o755)
    // Written last: a cache without it is treated as incomplete and fetched again.
    writeFileSync(join(cacheDir, 'VERSION'), `${BUNDLED_GH_VERSION}\n`)
    return cacheDir
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

/** The packaged gh, or null when this build was packaged without one. */
function packagedGhPath(resourcesDir) {
  const path = join(resourcesDir, BUNDLED_GH_RESOURCE_DIR, 'gh')
  return existsSync(path) ? path : null
}

module.exports = {
  BUNDLED_GH_VERSION,
  BUNDLED_GH_ARCHIVES,
  BUNDLED_GH_CACHE_DIR,
  BUNDLED_GH_RESOURCE_DIR,
  bundledGhCacheDir,
  bundledGhMacExtraResources,
  bundledGhMacSignIgnore,
  ensureBundledGh,
  packagedGhPath
}

if (require.main === module) {
  const arch = process.argv[2] ?? process.arch
  const dir = ensureBundledGh(arch)
  console.log(dir ? `[bundled-gh] ready: ${dir}` : '[bundled-gh] skipped')
}
