import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BUNDLED_SKILL_SOURCES, type BundledSkillSource } from './bundled-skill-sources'
import {
  autoUpdateInstalledBundledSkills,
  installBundledSkills,
  previewBundledSkillInstall
} from './service'
import {
  makeSkillHome,
  removeSkillHomes,
  serviceInput,
  writeCopy,
  type SkillHome
} from './skill-home.test-support'
import {
  OLDEST_ORCA_ORCHESTRATION,
  UPSTREAM_ORCA_FIXTURES,
  byteSnapshot,
  installUpstreamOrcaCopies,
  readUpstreamFixture,
  sharedSkillPath
} from './upstream-orca-skills.test-support'

afterEach(removeSkillHomes)

const digest = (text: string) => createHash('sha256').update(text).digest('hex')
const REVIO_NAMES = BUNDLED_SKILL_SOURCES.map((source) => source.name)

function packaged(home: SkillHome, options: { installedOnly?: boolean } = {}) {
  return {
    ...serviceInput(home, { agents: ['claude'], ...options }),
    sources: BUNDLED_SKILL_SOURCES,
    developmentBuild: false
  }
}

describe("upstream Orca's skills on the same machine", () => {
  it('plan, install and auto-update leave every Orca copy byte-for-byte untouched', async () => {
    const home = await makeSkillHome()
    const orcaPaths = await installUpstreamOrcaCopies(home)
    const before = await byteSnapshot(orcaPaths)

    const plan = await previewBundledSkillInstall(packaged(home))
    const touched = plan.skills.flatMap((entry) => entry.ops.map((op) => basename(op.path)))
    expect(touched.every((name) => name.startsWith('revio-'))).toBe(true)
    await installBundledSkills(packaged(home), plan.planDigest)
    await autoUpdateInstalledBundledSkills({
      ...packaged(home),
      names: REVIO_NAMES
    })

    expect(await byteSnapshot(orcaPaths)).toEqual(before)
  })

  it('does not count an Orca copy as an installed Revio skill, so updates add nothing', async () => {
    const home = await makeSkillHome()
    const orcaPaths = await installUpstreamOrcaCopies(home)
    await writeCopy(
      sharedSkillPath(home, 'orchestration'),
      await readUpstreamFixture(OLDEST_ORCA_ORCHESTRATION)
    )
    const before = await byteSnapshot(orcaPaths)

    const plan = await previewBundledSkillInstall(packaged(home, { installedOnly: true }))
    const result = await autoUpdateInstalledBundledSkills({ ...packaged(home), names: REVIO_NAMES })

    expect(plan.skills).toEqual([])
    expect(result.skills).toEqual([])
    expect(await byteSnapshot(orcaPaths)).toEqual(before)
  })

  it('refuses a hand-built source that claims an Orca name and its released digest', async () => {
    const home = await makeSkillHome()
    const orcaPaths = await installUpstreamOrcaCopies(home)
    const before = await byteSnapshot(orcaPaths)
    const orcaText = await readUpstreamFixture(UPSTREAM_ORCA_FIXTURES['orca-cli'])
    const claimsOrca: BundledSkillSource = {
      name: 'orca-cli',
      text: '---\nname: orca-cli\n---\nnot ours\n',
      releasedDigests: [digest(orcaText)]
    }
    const aliasesOrca: BundledSkillSource = {
      name: 'revio-cli',
      aliases: ['orca-cli', 'orchestration'],
      text: '---\nname: revio-cli\n---\nours\n',
      releasedDigests: [digest(orcaText)]
    }
    const input = { ...packaged(home), sources: [claimsOrca, aliasesOrca] }

    // The guard drops the source, so the name is unknown and nothing runs.
    const refused = await autoUpdateInstalledBundledSkills({ ...input, names: ['orca-cli'] })
    expect(refused.skills.flatMap((skill) => skill.ops)).toEqual([])
    const plan = await previewBundledSkillInstall(input)
    await installBundledSkills(input, plan.planDigest)

    expect(plan.skills.map((entry) => entry.name)).toEqual(['revio-cli'])
    expect(await byteSnapshot(orcaPaths)).toEqual(before)
  })

  it('auto-update still replaces a hash-verified older Revio copy beside the Orca ones', async () => {
    const home = await makeSkillHome()
    const orcaPaths = await installUpstreamOrcaCopies(home)
    const before = await byteSnapshot(orcaPaths)
    const current = BUNDLED_SKILL_SOURCES.find((source) => source.name === 'revio-cli')
    if (!current) {
      throw new Error('revio-cli is not bundled')
    }
    const older = current.text.replace('# Revio CLI', '# Revio CLI (older release)')
    const source: BundledSkillSource = {
      ...current,
      releasedDigests: [digest(older), ...current.releasedDigests]
    }
    await writeCopy(sharedSkillPath(home, 'revio-cli'), older)

    const result = await autoUpdateInstalledBundledSkills({
      ...packaged(home),
      sources: [source],
      names: ['revio-cli']
    })

    expect(result.skills[0]?.ops.map((op) => [basename(op.path), op.kind, op.status])).toEqual([
      ['revio-cli', 'update', 'done']
    ])
    expect(await readFile(join(sharedSkillPath(home, 'revio-cli'), 'SKILL.md'), 'utf8')).toBe(
      current.text
    )
    expect(await byteSnapshot(orcaPaths)).toEqual(before)
  })
})
