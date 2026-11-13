import { getSecretStore, hasSecretStore } from '../../shared/secret-store'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

export const KEYCHAIN_UNAVAILABLE = `${FORK_PRODUCT_NAME} cannot reach the macOS keychain, so it will not store this secret. Unlock the keychain or restart ${FORK_PRODUCT_NAME}, then try again.`

/**
 * Seals a cloud secret with the OS keychain, base64 for the file. There is no plaintext fallback:
 * an owner-only file still lands in backups and sync folders, so without a keychain Orca refuses.
 */
export function sealCloudSecret(text: string): string {
  if (!hasSecretStore() || !getSecretStore().isEncryptionAvailable()) {
    throw new Error(KEYCHAIN_UNAVAILABLE)
  }
  return getSecretStore().encryptString(text).toString('base64')
}
