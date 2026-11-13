export type GithubRepoRef = { owner: string; name: string }

// The host must be github.com itself: a remote such as https://evil.example/github.com/o/n, or
// one on notgithub.com, is not a GitHub repository and must not be cloned or brokered as one.
const URL_STYLE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/\s]+@)?github\.com(?::\d+)?\//i
const SCP_STYLE = /^(?:[^@/\s:]+@)?github\.com:/i
const OWNER_AND_NAME = /^([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/

/** Reads owner/name from a GitHub remote URL (https, ssh, or scp-style). */
export function parseGithubRemote(url: string): GithubRepoRef | null {
  const remote = url.trim()
  const host = URL_STYLE.exec(remote) ?? SCP_STYLE.exec(remote)
  const match = host ? OWNER_AND_NAME.exec(remote.slice(host[0].length)) : null
  return match?.[1] && match[2] ? { owner: match[1], name: match[2] } : null
}
