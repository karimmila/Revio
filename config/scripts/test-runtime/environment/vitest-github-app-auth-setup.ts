// Production gh calls refuse to spawn without the GitHub App token (src/main/git/command-runner/
// github-app-auth.ts). Unit suites that drive the gh runner get a signed-in fake through the same
// global slot; suites about the signed-out or uncovered paths replace it themselves.
const SLOT = Symbol.for('orca.host.githubAppAuthProvider')

Reflect.set(globalThis, SLOT, {
  host: () => 'github.com',
  login: () => 'test-user',
  token: async () => 'test-github-app-token',
  peekToken: () => null,
  coverage: async () => 'unknown'
})
