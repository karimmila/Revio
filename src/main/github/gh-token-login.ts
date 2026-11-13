import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

export type GhTokenLoginResult = { ok: true } | { ok: false; error: string }

/**
 * Retired: `gh auth login --with-token` stored the token in gh's keyring, which every later gh
 * call then read from the keychain. GitHub access now comes from the GitHub App sign-in only.
 */
export async function loginGhWithToken(
  _token: string,
  _host = 'github.com'
): Promise<GhTokenLoginResult> {
  return {
    ok: false,
    error: `${FORK_PRODUCT_NAME} uses its GitHub App sign-in. Sign in with GitHub in Settings > Account.`
  }
}
