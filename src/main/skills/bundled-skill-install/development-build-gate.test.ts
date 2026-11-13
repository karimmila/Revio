import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getAppEnvironment,
  hasAppEnvironment,
  setAppEnvironment
} from '../../../shared/app-environment'
import { BUNDLED_SKILL_SOURCES } from './bundled-skill-sources'
import { isDevelopmentBuild } from './install-guards'
import {
  autoUpdateInstalledBundledSkills,
  installBundledSkills,
  previewBundledSkillInstall,
  type BundledSkillServiceInput
} from './service'
import { makeSkillHome, removeSkillHomes, serviceInput } from './skill-home.test-support'
import { homeTree, installUpstreamOrcaCopies } from './upstream-orca-skills.test-support'

const previousEnvironment = hasAppEnvironment() ? getAppEnvironment() : null

function useAppEnvironment(isPackaged: boolean): void {
  setAppEnvironment({
    getPath: () => '/unused',
    getAppPath: () => '/unused',
    getVersion: () => 'test',
    isPackaged: () => isPackaged,
    onWillQuit: () => undefined,
    exit: () => undefined,
    getAppMetrics: () => []
  })
}

afterEach(async () => {
  if (previousEnvironment) {
    setAppEnvironment(previousEnvironment)
  }
  await removeSkillHomes()
})

async function runEveryPath(input: BundledSkillServiceInput) {
  const plan = await previewBundledSkillInstall(input)
  const installed = await installBundledSkills(input, plan.planDigest)
  const updated = await autoUpdateInstalledBundledSkills({
    ...input,
    names: BUNDLED_SKILL_SOURCES.map((source) => source.name)
  })
  return { plan, installed, updated }
}

describe('development builds and user-level skill folders', () => {
  it.each([
    ['global', undefined],
    ['workspace', 'project']
  ] as const)('a %s install, update and auto-update write nothing', async (_scope, workspace) => {
    const home = await makeSkillHome()
    await installUpstreamOrcaCopies(home)
    const before = await homeTree(home.root)
    const input = {
      ...serviceInput(home, {
        agents: ['claude', 'cursor'],
        ...(workspace ? { workspaceDirectory: join(home.home, workspace) } : {})
      }),
      sources: BUNDLED_SKILL_SOURCES,
      developmentBuild: true
    }

    const { plan, installed, updated } = await runEveryPath(input)

    expect(plan.skills).toEqual([])
    expect(installed.skills).toEqual([])
    expect(updated.skills).toEqual([])
    expect(await homeTree(home.root)).toEqual(before)
  })

  it('reads the build from the app environment when the caller does not say', async () => {
    const home = await makeSkillHome()
    const before = await homeTree(home.root)
    useAppEnvironment(false)

    const { plan } = await runEveryPath({
      ...serviceInput(home),
      sources: BUNDLED_SKILL_SOURCES,
      developmentBuild: undefined
    })

    expect(plan.skills).toEqual([])
    expect(await homeTree(home.root)).toEqual(before)
  })

  it('tells a packaged app, a dev app and the dev CLI apart', () => {
    useAppEnvironment(true)
    expect(isDevelopmentBuild({ ORCA_DEV_CLI_INVOCATION: '1' })).toBe(false)
    useAppEnvironment(false)
    expect(isDevelopmentBuild({})).toBe(true)
    expect(isDevelopmentBuild({ ORCA_DEV_CLI_INVOCATION: '1' }, null)).toBe(true)
    expect(isDevelopmentBuild({}, null)).toBe(false)
  })

  it('treats a daemon that reports itself packaged but runs with the dev env as a dev build', () => {
    useAppEnvironment(true)
    expect(isDevelopmentBuild({ NODE_ENV: 'development' })).toBe(true)
    expect(isDevelopmentBuild({ NODE_ENV: 'production' })).toBe(false)
  })
})
