/*
 * "fetch failed", "The operation was aborted due to timeout" and "getaddrinfo ENOTFOUND" all mean
 * the same thing to a person: the service could not be reached. Callers swap such an error for a
 * sentence that names the service and says what to do.
 */
const NETWORK_FAILURE_TEXT =
  /fetch failed|failed to fetch|network\s?error|net::ERR_|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|socket hang up|aborted due to timeout|other side closed/i

export function isNetworkFailure(error: unknown): boolean {
  if (typeof error === 'string') {
    return NETWORK_FAILURE_TEXT.test(error)
  }
  if (!(error instanceof Error)) {
    return false
  }
  // Not AbortError: that is also how a person's own Cancel arrives.
  if (error.name === 'TimeoutError') {
    return true
  }
  if (NETWORK_FAILURE_TEXT.test(error.message)) {
    return true
  }
  // undici wraps the socket error: TypeError('fetch failed', { cause }).
  return error.cause !== undefined && error.cause !== error && isNetworkFailure(error.cause)
}

/** "Could not reach <service>. Check your internet connection and try again." */
export function unreachableServiceMessage(service: string): string {
  return `Could not reach ${service}. Check your internet connection and try again.`
}
