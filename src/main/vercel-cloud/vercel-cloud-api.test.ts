import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureSandboxProject, LEGACY_SANDBOX_PROJECT, SANDBOX_PROJECT } from './vercel-cloud-api'
import { FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'

type Call = { method: string; path: string; body: unknown }

/** Fakes the Vercel projects API over the given existing project names. */
function stubVercel(existing: string[]): Call[] {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { method: string; body?: string }) => {
      const path = url.replace('https://api.vercel.com', '')
      const body = init.body ? JSON.parse(init.body) : undefined
      calls.push({ method: init.method, path, body })
      const name = /^\/v9\/projects\/([^?]+)/.exec(path)?.[1]
      if (init.method === 'GET' && name && !existing.includes(decodeURIComponent(name))) {
        return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 })
      }
      return new Response(JSON.stringify({}), { status: 200 })
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ensureSandboxProject', () => {
  it("creates the fork's project for a new connection", async () => {
    const calls = stubVercel([])

    await expect(ensureSandboxProject('t', 'team_1')).resolves.toBe(SANDBOX_PROJECT)
    expect(SANDBOX_PROJECT).toBe(`${FORK_CLI_COMMAND_NAME}-sandboxes`)
    expect(calls.at(-1)).toMatchObject({ method: 'POST', body: { name: SANDBOX_PROJECT } })
  })

  it('keeps a connection on its existing upstream-named project', async () => {
    const calls = stubVercel([LEGACY_SANDBOX_PROJECT])

    await expect(ensureSandboxProject('t', 'team_1', LEGACY_SANDBOX_PROJECT)).resolves.toBe(
      LEGACY_SANDBOX_PROJECT
    )
    expect(calls.map((call) => call.method)).toEqual(['GET'])
  })

  it("falls back to the fork's project when the saved one is gone", async () => {
    const calls = stubVercel([SANDBOX_PROJECT])

    await expect(ensureSandboxProject('t', 'team_1', LEGACY_SANDBOX_PROJECT)).resolves.toBe(
      SANDBOX_PROJECT
    )
    expect(calls.some((call) => call.method === 'POST')).toBe(false)
  })
})
