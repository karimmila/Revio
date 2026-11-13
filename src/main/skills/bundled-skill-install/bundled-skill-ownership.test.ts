import { lstat, readFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import renames from '../../../shared/bundled-skill-renames.json'
import { BUNDLED_SKILL_SOURCES } from './bundled-skill-sources'
import { isUpstreamOrcaSkillName, ownedBundledSkillSources } from './install-guards'
import {
  makeSkillHome,
  previewAndInstall,
  removeSkillHomes,
  serviceInput
} from './skill-home.test-support'
import { claudeSkillPath, sharedSkillPath } from './upstream-orca-skills.test-support'

afterEach(removeSkillHomes)

const LEDGER = join(import.meta.dirname, '../../../../resources/skills/released-digests.json')

const FORMER_NAMES: Readonly<Record<string, readonly string[]>> = renames

const frontmatterName = (text: string) => /^---\nname: (\S+)\n/u.exec(text)?.[1]

describe('bundled skills this fork ships', () => {
  it('every source has a revio-* name, matching frontmatter, and no upstream alias', () => {
    expect(BUNDLED_SKILL_SOURCES.length).toBeGreaterThan(0)
    for (const source of BUNDLED_SKILL_SOURCES) {
      expect(source.name).toMatch(/^revio-/u)
      expect(frontmatterName(source.text)).toBe(source.name)
      expect(source.aliases ?? []).toEqual([])
    }
    expect(ownedBundledSkillSources(BUNDLED_SKILL_SOURCES)).toEqual(BUNDLED_SKILL_SOURCES)
    expect(Object.entries(FORMER_NAMES).flat(2).filter(isUpstreamOrcaSkillName)).toEqual([])
  })

  it('claims no digest that upstream Orca released under its own names', async () => {
    const ledger: { skills: Record<string, string[]> } = JSON.parse(await readFile(LEDGER, 'utf8'))
    const upstream = new Set(
      Object.entries(ledger.skills)
        .filter(([name]) => !name.startsWith('revio-'))
        .flatMap(([, digests]) => digests)
    )
    for (const source of BUNDLED_SKILL_SOURCES) {
      expect(source.releasedDigests).toEqual(ledger.skills[source.name])
      expect(source.releasedDigests.filter((digest) => upstream.has(digest))).toEqual([])
    }
  })

  it('a packaged install writes each skill under its revio-* name', async () => {
    const home = await makeSkillHome()
    const input = {
      ...serviceInput(home, { agents: ['claude'] }),
      sources: BUNDLED_SKILL_SOURCES,
      developmentBuild: false
    }

    await previewAndInstall(input)

    for (const source of BUNDLED_SKILL_SOURCES) {
      const shared = sharedSkillPath(home, source.name)
      expect(await readFile(join(shared, 'SKILL.md'), 'utf8')).toBe(source.text)
      expect((await lstat(claudeSkillPath(home, source.name))).isSymbolicLink()).toBe(true)
      expect(await realpath(claudeSkillPath(home, source.name))).toBe(await realpath(shared))
    }
  })
})
