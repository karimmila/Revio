import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { getSecretStore, hasSecretStore } from '../../shared/secret-store'
import { writeSecureFile } from '../../shared/secure-file'
import { getProfileUserDataPath } from '../orca-profiles/profile-storage-paths'
import {
  AGENT_CREDENTIAL_NAMES,
  type AgentCredentialName,
  type AgentCredentialStatus
} from '../../shared/agent-credentials-types'

const SEALED = 'orca-agent-credentials:v1:sealed:'
const PLAIN = 'orca-agent-credentials:v1:plaintext:'

export type AgentCredentials = Partial<Record<AgentCredentialName, string>>

const storedCredentialsSchema = z.record(z.string(), z.unknown())

function file(): string {
  return join(getProfileUserDataPath(), 'agent-credentials.enc')
}

function decode(raw: string): string | null {
  if (raw.startsWith(SEALED)) {
    return getSecretStore().decryptString(Buffer.from(raw.slice(SEALED.length), 'base64'))
  }
  return raw.startsWith(PLAIN)
    ? Buffer.from(raw.slice(PLAIN.length), 'base64').toString('utf8')
    : null
}

export function readAgentCredentials(): AgentCredentials {
  if (!existsSync(file())) {
    return {}
  }
  try {
    const parsed = storedCredentialsSchema.safeParse(
      JSON.parse(decode(readFileSync(file(), 'utf8')) ?? '{}')
    )
    const credentials: AgentCredentials = {}
    if (parsed.success) {
      for (const name of AGENT_CREDENTIAL_NAMES) {
        const value = parsed.data[name]
        if (typeof value === 'string' && value) {
          credentials[name] = value
        }
      }
    }
    return credentials
  } catch {
    return {}
  }
}

export function agentCredentialStatus(): AgentCredentialStatus {
  const credentials = readAgentCredentials()
  return {
    anthropicApiKey: Boolean(credentials.anthropicApiKey),
    anthropicAuthToken: Boolean(credentials.anthropicAuthToken),
    openaiApiKey: Boolean(credentials.openaiApiKey)
  }
}

/** An empty value removes the secret. */
export function setAgentCredential(name: AgentCredentialName, value: string): void {
  const credentials = readAgentCredentials()
  const trimmed = value.trim()
  if (trimmed) {
    credentials[name] = trimmed
  } else {
    delete credentials[name]
  }
  const json = JSON.stringify(credentials)
  const sealed = hasSecretStore() && getSecretStore().isEncryptionAvailable()
  writeSecureFile(
    file(),
    sealed
      ? `${SEALED}${getSecretStore().encryptString(json).toString('base64')}`
      : `${PLAIN}${Buffer.from(json, 'utf8').toString('base64')}`
  )
}
