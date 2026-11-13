import { describe, expect, it } from 'vitest'
import { parseGithubRemote } from './github-remote'

describe('parseGithubRemote', () => {
  it('reads owner and name from the remote forms git uses for GitHub', () => {
    const acme = { owner: 'acme', name: 'web.app' }
    for (const remote of [
      'https://github.com/acme/web.app.git',
      'https://github.com/acme/web.app',
      'https://github.com/acme/web.app/',
      'https://x-access-token@github.com/acme/web.app.git',
      'git@github.com:acme/web.app.git',
      'github.com:acme/web.app',
      'ssh://git@github.com/acme/web.app.git',
      'ssh://git@github.com:22/acme/web.app.git',
      'git://github.com/acme/web.app.git',
      'github.com/acme/web.app',
      '  HTTPS://GitHub.com/acme/web.app.git\n'
    ]) {
      expect(parseGithubRemote(remote), remote).toEqual(acme)
    }
  })

  it('refuses a remote that only names github.com somewhere in it', () => {
    for (const remote of [
      'https://evil.example/github.com/acme/web',
      'https://evil.example//github.com/acme/web',
      'https://notgithub.com/acme/web',
      'https://github.com.evil.example/acme/web',
      'git@evil.example:github.com/acme/web',
      'https://github.com@evil.example/acme/web',
      'https://github.com/acme',
      'https://github.com/acme/web/tree/main',
      'https://gitlab.com/acme/web.git',
      ''
    ]) {
      expect(parseGithubRemote(remote), remote).toBeNull()
    }
  })
})
