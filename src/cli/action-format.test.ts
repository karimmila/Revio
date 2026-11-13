import { describe, expect, it } from 'vitest'
import { formatActionList, formatActionRun, scriptPreview } from './action-format'
import { normalizeCommandPositionals, parseArgs, validateCommandAndFlags } from './args'
import { ACTION_COMMAND_SPECS } from './specs/action'
import { parseActionLocation, parseActionWaitMs } from './handlers/action'
import { FORK_CLI_COMMAND_NAME } from '../shared/fork-identity'

describe('orca action parsing', () => {
  const parse = (argv: string[]) => {
    const parsed = normalizeCommandPositionals(ACTION_COMMAND_SPECS, parseArgs(argv))
    validateCommandAndFlags(ACTION_COMMAND_SPECS, parsed)
    return parsed
  }

  it('takes the action name as one positional argument', () => {
    const parsed = parse(['action', 'run', '--restart', 'Claim tunnel', '--wait'])
    expect(parsed.commandPath).toEqual(['action', 'run'])
    expect(parsed.flags.get('action')).toBe('Claim tunnel')
    expect(parsed.flags.get('restart')).toBe(true)
    expect(parsed.flags.get('wait')).toBe(true)
  })

  it('rejects flags the command does not take', () => {
    expect(() => parse(['action', 'list', '--script', 'rm -rf /'])).toThrow()
  })

  it('checks --location and --timeout-ms', () => {
    expect(parseActionLocation('mirror')).toBe('mirror')
    expect(() => parseActionLocation('moon')).toThrow('--location must be local, cloud or mirror')
    expect(parseActionWaitMs(new Map())).toBeNull()
    expect(parseActionWaitMs(new Map([['wait', true]]))).toBe(120_000)
    expect(
      parseActionWaitMs(
        new Map<string, string | boolean>([
          ['wait', true],
          ['timeout-ms', '5000']
        ])
      )
    ).toBe(5000)
    expect(() => parseActionWaitMs(new Map([['timeout-ms', '5000']]))).toThrow(
      '--timeout-ms needs --wait'
    )
    expect(() =>
      parseActionWaitMs(
        new Map<string, string | boolean>([
          ['wait', true],
          ['timeout-ms', '900000']
        ])
      )
    ).toThrow('at most 600000')
  })
})

describe('orca action output', () => {
  it('previews the first meaningful script lines', () => {
    expect(scriptPreview('#!/bin/bash\n\n# comment\nset -e\nngrok http 3000\nmore\n')).toEqual([
      'set -e',
      'ngrok http 3000',
      '… (1 more lines; --json has the full script)'
    ])
    expect(scriptPreview('x'.repeat(150))[0]).toHaveLength(100)
  })

  it('lists name, id, where it runs and the script start', () => {
    const text = formatActionList({
      worktreeId: 'w',
      location: 'local',
      runMode: 'concurrent',
      sharedError: null,
      actions: [
        {
          id: 'shared:0:claim-tunnel',
          name: 'Claim tunnel',
          script: 'ngrok http 3000',
          shared: true,
          targets: ['local'],
          runsIn: ['local']
        },
        {
          id: 'p1',
          name: 'Deploy',
          script: 'make deploy',
          shared: false,
          targets: ['cloud'],
          runsIn: []
        }
      ]
    })
    expect(text).toBe(
      [
        'Workspace location: local',
        '',
        'Claim tunnel  id=shared:0:claim-tunnel  runs=local',
        '    ngrok http 3000',
        '',
        'Deploy  id=p1  runs=not here',
        '    make deploy',
        '',
        `Run one with: ${FORK_CLI_COMMAND_NAME} action run "<name>"`
      ].join('\n')
    )
  })

  it('prints the Run terminal handle and the waited output', () => {
    const base = {
      action: { id: 'a', name: 'Claim tunnel' },
      location: 'local' as const,
      worktreeId: 'w',
      terminal: 'term_1',
      alreadyRunning: false
    }
    expect(formatActionRun(base)).toBe(
      `Started Claim tunnel in the Run tab (local).\nterminal=term_1\nRead output: ${FORK_CLI_COMMAND_NAME} terminal read --terminal term_1`
    )
    expect(
      formatActionRun({
        ...base,
        wait: { finished: true, timedOut: false, exitCode: 0, tail: ['ready'] }
      })
    ).toContain('The script finished with exit code 0.\n--- output (last lines) ---\nready')
    expect(formatActionRun({ ...base, alreadyRunning: true, terminal: null })).toContain(
      'already running (pass --restart'
    )
  })
})
