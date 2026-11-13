// Local packaged fork builds signed with the team's self-signed code-signing certificate.
//
// Why: an ad-hoc signature changes with every build, so macOS treats each update as a new app:
// Keychain items ("Revio Safe Storage") prompt again and TCC grants are lost. A fixed
// certificate gives every build the same designated requirement (`certificate root = H"…"`).
// The certificate is not trusted by Gatekeeper and nothing is notarized, so a teammate opens the
// first install with System Settings › Privacy & Security › Open Anyway (docs/cloud-workspaces.md, "Signed local builds").
//
// electron-builder looks identities up with `security find-identity -v`, which leaves out an
// untrusted certificate, so with ORCA_FORK_SIGN_IDENTITY set its own signing is turned off and
// afterSign signs the app with @electron/osx-sign directly. Release builds never take this path.
const { execFileSync } = require('node:child_process')

const SHA1_PATTERN = /^[0-9A-Fa-f]{40}$/

/** The fork identity from the environment, or null for the default (unsigned local) build. */
function readForkSigning(env, { isMacRelease }) {
  const identity = env.ORCA_FORK_SIGN_IDENTITY?.trim()
  if (isMacRelease || !identity) {
    return null
  }
  if (!SHA1_PATTERN.test(identity)) {
    throw new Error('ORCA_FORK_SIGN_IDENTITY must be the certificate SHA-1 (40 hex characters).')
  }
  const keychain = env.ORCA_FORK_SIGN_KEYCHAIN?.trim() || null
  return { identity: identity.toUpperCase(), keychain }
}

/**
 * codesign arguments for one nested binary or bundle. No hardened runtime and no timestamp:
 * neither is needed without notarization, and without the runtime, library validation cannot
 * reject Electron's nested frameworks.
 */
function forkCodesignArgs(signing, target, { entitlements, deep = false } = {}) {
  const args = ['--force']
  if (deep) {
    args.push('--deep')
  }
  args.push('--sign', signing.identity)
  if (signing.keychain) {
    args.push('--keychain', signing.keychain)
  }
  if (entitlements) {
    args.push('--entitlements', entitlements)
  }
  args.push(target)
  return args
}

/** @electron/osx-sign options for the outer app; `ignore` keeps afterPack's signed files intact. */
function forkOsxSignOptions(signing, { appPath, entitlements, ignore }) {
  return {
    app: appPath,
    identity: signing.identity,
    ...(signing.keychain ? { keychain: signing.keychain } : {}),
    identityValidation: false,
    platform: 'darwin',
    type: 'distribution',
    preAutoEntitlements: false,
    ignore,
    optionsForFile: () => ({ entitlements, hardenedRuntime: false })
  }
}

/** codesign fails when the signing keychain is locked; the hint names the fix. */
function withKeychainHint(signing, error) {
  const hint = signing.keychain
    ? ` If ${signing.keychain} is locked, unlock it with \`security unlock-keychain\` and build again.`
    : ''
  return new Error(`Fork signing failed: ${error instanceof Error ? error.message : error}.${hint}`)
}

async function signAppWithForkIdentity(signing, options) {
  const { sign } = await import('@electron/osx-sign')
  try {
    await sign(forkOsxSignOptions(signing, options))
  } catch (error) {
    throw withKeychainHint(signing, error)
  }
  execFileSync('codesign', ['--verify', '--deep', '--strict', options.appPath], {
    stdio: 'inherit'
  })
}

module.exports = {
  forkCodesignArgs,
  forkOsxSignOptions,
  readForkSigning,
  signAppWithForkIdentity
}
