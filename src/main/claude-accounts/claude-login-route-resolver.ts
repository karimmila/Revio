import { chooseClaudeLoginRoute, type ClaudeLoginRoute } from '../../shared/claude-login-route'
import { claudeProviderFromSettings } from '../../shared/claude-provider-env'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { hasClaudeApiKeyEnv, hasClaudeSystemLogin } from './claude-system-login'
import { isOrcaCloudSandboxHost } from './cloud-sandbox-claude'

// Launches arrive in bursts (chat, catalog probe, naming); one login check serves them all.
const SYSTEM_LOGIN_CHECK_TTL_MS = 10_000

export type ClaudeLoginRouteSource = {
  routesToAccount: () => boolean
  /** The login-shell environment, once it is read. */
  resolvedEnv: () => Promise<NodeJS.ProcessEnv>
  readonly userHome: string
}

type LoginSettings = Partial<
  Pick<GlobalSettings, 'agentDefaultEnv' | 'revioClaudeAuth' | 'revioLayout'>
>

/** The login a Claude launch on this host uses; see ClaudeLoginRoute for the order. */
export class ClaudeLoginRouteResolver {
  private systemLoginCheck: { at: number; result: Promise<boolean> } | null = null

  constructor(
    private readonly source: ClaudeLoginRouteSource,
    private readonly getSettings: () => LoginSettings,
    private readonly hasSystemLogin: typeof hasClaudeSystemLogin = hasClaudeSystemLogin
  ) {}

  async route(): Promise<ClaudeLoginRoute> {
    if (this.source.routesToAccount()) {
      return 'managed'
    }
    const env = await this.source.resolvedEnv()
    const settings = this.getSettings()
    return chooseClaudeLoginRoute({
      managedAccount: this.source.routesToAccount(),
      provider: claudeProviderFromSettings(settings) !== 'subscription',
      apiKey: hasClaudeApiKeyEnv(env) || hasClaudeApiKeyEnv(settings.agentDefaultEnv?.claude),
      systemLogin: await this.systemLoginStored(env)
    })
  }

  /** The workspace layout prompts for a sign-in only when no login at all can run Claude. */
  async requiresSignIn(): Promise<boolean> {
    if (this.getSettings().revioLayout !== true || isOrcaCloudSandboxHost()) {
      return false
    }
    return (await this.route()) === 'none'
  }

  private systemLoginStored(env: NodeJS.ProcessEnv): Promise<boolean> {
    const now = Date.now()
    if (!this.systemLoginCheck || now - this.systemLoginCheck.at > SYSTEM_LOGIN_CHECK_TTL_MS) {
      this.systemLoginCheck = {
        at: now,
        result: this.hasSystemLogin({ env, userHome: this.source.userHome }).catch(() => false)
      }
    }
    return this.systemLoginCheck.result
  }
}
