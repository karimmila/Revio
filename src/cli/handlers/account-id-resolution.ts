import { RuntimeClientError } from '../runtime-client'
import { FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'

/** One saved account and the names `--account` may call it by (email, label, subject). */
export type AccountChoice = { id: string; names: readonly (string | null | undefined)[] }

/**
 * Resolves `--account` to a saved account id: an exact id first, then a
 * case-insensitive email, label or subject. `system` is the provider's own sign-in
 * (null). A name shared by several accounts — one email in two organizations — is
 * refused with their ids rather than guessing which subscription to bill.
 */
export function resolveAccountId(
  label: string,
  accounts: readonly AccountChoice[],
  query: string,
  { allowSystem }: { allowSystem: boolean }
): string | null {
  if (query === 'system') {
    if (!allowSystem) {
      throw new RuntimeClientError('invalid_argument', `${label} has no system default.`)
    }
    return null
  }
  return resolveSavedAccountId(label, accounts, query)
}

export function resolveSavedAccountId(
  label: string,
  accounts: readonly AccountChoice[],
  query: string
): string {
  const byId = accounts.find((account) => account.id === query)
  if (byId) {
    return byId.id
  }
  const needle = query.toLowerCase()
  const byName = accounts.filter((account) =>
    account.names.some((name) => name?.toLowerCase() === needle)
  )
  if (byName.length === 1) {
    return byName[0].id
  }
  if (byName.length > 1) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Several ${label} accounts match "${query}"; pass one of their ids: ${byName
        .map((account) => account.id)
        .join(', ')}.`
    )
  }
  throw new RuntimeClientError(
    'invalid_argument',
    `No managed ${label} account matches "${query}". Run \`${FORK_CLI_COMMAND_NAME} account list\` to see the saved accounts.`
  )
}
