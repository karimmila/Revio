import { describe, expect, it, vi } from 'vitest'
import { FORK_CLI_COMMAND_NAME, FORK_PRODUCT_NAME } from '../../shared/fork-identity'

const readRepoActions = vi.hoisted(() => vi.fn())
vi.mock('../actions/repo-actions-store', () => ({ readRepoActions }))
const runSandboxScript = vi.hoisted(() => vi.fn(async () => ''))
vi.mock('./cloud-sandbox-run', () => ({ runSandboxScript }))

const { cloudActionScriptFiles, cloudAgentStandingInstruction, writeCloudAgentActions } =
  await import('./cloud-agent-actions')
const { loggedCloudActionScript } = await import('../../shared/cloud/cloud-action-runs')
const { CLOUD_PR_COMMAND_INSTRUCTION, CLOUD_PR_COMMAND_PATH, CLOUD_PR_COMMAND_SCRIPT } =
  await import('../../shared/cloud/cloud-pr-command')
const { CLOUD_OPEN_URL_COMMAND_PATH, CLOUD_OPEN_URL_COMMAND_SCRIPT } =
  await import('../../shared/cloud/cloud-desktop-browser')
const { cloudRepoActionsInstruction } =
  await import('../native-chat/revio-repo-actions-instruction')

const devServer = { name: 'Dev server', script: '# start\npnpm dev', targets: ['cloud' as const] }
const macOnly = {
  name: 'Open app',
  script: 'open http://localhost:3000',
  targets: ['local' as const]
}

describe('cloudActionScriptFiles', () => {
  it('writes only cloud actions, named by position, starting like the Run tab', () => {
    const files = cloudActionScriptFiles([macOnly, devServer], '/vercel/my repo')
    expect(files).toEqual([
      {
        path: '/vercel/.orca-actions/1.sh',
        content: `[ -f /vercel/.orca-cloud-script-env ] && . /vercel/.orca-cloud-script-env\ncd '/vercel/my repo' || exit 1\n${loggedCloudActionScript('Dev server', '# start\npnpm dev')}\n`,
        mode: 0o755
      }
    ])
  })
})

describe('cloudRepoActionsInstruction', () => {
  it('lists the cloud actions with their command and says honestly where they run', () => {
    const text = cloudRepoActionsInstruction([macOnly, devServer], (i) => `/x/${i + 1}.sh`)
    expect(text).toContain('- "Dev server": pnpm dev (run: `bash -l /x/1.sh`)')
    expect(text).not.toContain('Open app')
    expect(text).toContain(`there is no \`${FORK_CLI_COMMAND_NAME} action run\` here`)
    expect(text).toContain(
      `also shows in the workspace's Run tab in ${FORK_PRODUCT_NAME}, under the action's name`
    )
  })

  it('bounds the list like the Mac instruction', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ ...devServer, name: `A${i}` }))
    const text = cloudRepoActionsInstruction(many, (i) => `/x/${i + 1}.sh`)
    expect(text.match(/^- "/gm)).toHaveLength(12)
    expect(text).toContain('… and 3 more')
  })

  it('says so when no action runs in the cloud', () => {
    expect(cloudRepoActionsInstruction([macOnly], () => '')).toBe(
      `This repository has no ${FORK_PRODUCT_NAME} actions that run in a cloud workspace.`
    )
  })
})

describe('cloudAgentStandingInstruction', () => {
  it('tells every session to use the pull-request command, with its three subcommands', () => {
    const text = cloudAgentStandingInstruction([devServer])
    expect(text).toContain(CLOUD_PR_COMMAND_INSTRUCTION)
    expect(text).toContain(`use only \`${CLOUD_PR_COMMAND_PATH}\``)
    expect(text).toContain(
      `\`${CLOUD_PR_COMMAND_PATH} create --title "<title>" --body-file <file>\``
    )
    expect(text).toContain(`\`${CLOUD_PR_COMMAND_PATH} push\``)
    expect(text).toContain(`\`${CLOUD_PR_COMMAND_PATH} checks\``)
    expect(text).toContain('`gh pr create`, `gh pr view` and `gh pr checks` do not work here')
    expect(text).toContain('Do not write the pull request call by hand')
  })

  it('names only subcommands the installed command has', () => {
    const named = [
      ...CLOUD_PR_COMMAND_INSTRUCTION.matchAll(
        new RegExp(`${CLOUD_PR_COMMAND_PATH.replace(/[.]/g, '\\.')} (\\w+)`, 'g')
      )
    ].map((match) => match[1])
    expect(new Set(named)).toEqual(new Set(['create', 'push', 'checks']))
    for (const subcommand of named) {
      expect(CLOUD_PR_COMMAND_SCRIPT).toContain(`add_parser("${subcommand}")`)
    }
  })

  it('keeps the actions first and the desktop browser command last', () => {
    const text = cloudAgentStandingInstruction([devServer])
    expect(text.indexOf('"Dev server"')).toBeLessThan(text.indexOf('Pull requests:'))
    expect(text.indexOf('Pull requests:')).toBeLessThan(
      text.indexOf(`${CLOUD_OPEN_URL_COMMAND_PATH} <url>`)
    )
  })
})

describe('writeCloudAgentActions', () => {
  it('hands the instruction over in a variable, then writes the scripts', async () => {
    readRepoActions.mockReturnValue({ actions: [devServer] })
    const writeFiles = vi.fn(async () => undefined)
    await writeCloudAgentActions(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the function reads only the fields set here
      { writeFiles } as never,
      { id: 'r1', path: '/Users/me/repo' },
      '/vercel/repo'
    )
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the function reads only the fields set here
    const [, script, options] = runSandboxScript.mock.calls[0] as unknown as [
      unknown,
      string,
      { env: Record<string, string> }
    ]
    expect(script).toContain("os.environ['ORCA_ACTIONS_MEMORY']")
    expect(script).not.toContain('pnpm dev')
    expect(options.env.ORCA_ACTIONS_MEMORY).toContain('"Dev server"')
    expect(writeFiles).toHaveBeenCalledWith(
      [expect.objectContaining({ path: '/vercel/.orca-actions/1.sh' })],
      { signal: undefined }
    )
    // The pull-request command comes with them, executable, at the path the prompts name.
    expect(writeFiles).toHaveBeenCalledWith(
      [
        { path: CLOUD_PR_COMMAND_PATH, content: CLOUD_PR_COMMAND_SCRIPT, mode: 0o755 },
        { path: CLOUD_OPEN_URL_COMMAND_PATH, content: CLOUD_OPEN_URL_COMMAND_SCRIPT, mode: 0o755 }
      ],
      { signal: undefined }
    )
    // The agent's instructions name the command that shows a page on the desktop.
    expect(options.env.ORCA_ACTIONS_MEMORY).toContain(`${CLOUD_OPEN_URL_COMMAND_PATH} <url>`)
    expect(options.env.ORCA_ACTIONS_MEMORY).toBe(cloudAgentStandingInstruction([devServer]))
  })

  it('never fails the create when the sandbox refuses', async () => {
    readRepoActions.mockReturnValue({ actions: [devServer] })
    runSandboxScript.mockRejectedValueOnce(new Error('exit 1'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await expect(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the function reads only the fields set here
      writeCloudAgentActions({ writeFiles: vi.fn() } as never, { id: 'r1', path: '/r' }, '/v')
    ).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
