import { setSecretStore } from '../../shared/secret-store'
import { ElectronSecretStore } from '../host/electron-secret-store'
import { registerGithubAppAuthProvider } from '../cloud/github-app-auth-provider'

/** The keychain-backed secret store, and the GitHub App token source that unseals through it. */
export function installElectronSecrets(): void {
  setSecretStore(new ElectronSecretStore())
  // Every gh and HTTPS git call to GitHub uses the GitHub App token, never the keychain's gh login.
  registerGithubAppAuthProvider()
}
