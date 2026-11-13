import type {
  BundledSkillInstallResult,
  BundledSkillPlan
} from '../../../shared/bundled-skill-plan'
import { BUNDLED_SKILL_SOURCES } from './bundled-skill-sources'
import {
  autoUpdateBundledSkills,
  executeBundledSkillPlan,
  type BundledSkillExecuteInput
} from './execute'
import { nativeBundledSkillFilesystem } from './filesystem'
import { isDevelopmentBuild, ownedBundledSkillSources } from './install-guards'
import { buildBundledSkillPlan, bundledSkillDigestOf } from './plan'

export type BundledSkillServiceInput = Omit<BundledSkillExecuteInput, 'filesystem' | 'sources'> &
  Partial<Pick<BundledSkillExecuteInput, 'filesystem' | 'sources'>> & {
    /** Detected from the host when unset; a development build plans and writes nothing. */
    developmentBuild?: boolean
  }

function withDefaults(input: BundledSkillServiceInput): BundledSkillExecuteInput {
  const { developmentBuild: _developmentBuild, ...rest } = input
  return {
    ...rest,
    filesystem: input.filesystem ?? nativeBundledSkillFilesystem,
    sources: ownedBundledSkillSources(input.sources ?? BUNDLED_SKILL_SOURCES)
  }
}

/** Every install path passes here, so a development build never reads or writes skill homes. */
function writesBlocked(input: BundledSkillServiceInput): boolean {
  return input.developmentBuild ?? isDevelopmentBuild()
}

function emptyPlan(input: BundledSkillServiceInput): BundledSkillPlan {
  return {
    scope: input.destination.scope,
    homeDirectory: input.destination.homeDirectory,
    skills: [],
    planDigest: bundledSkillDigestOf([])
  }
}

export async function previewBundledSkillInstall(
  input: BundledSkillServiceInput
): Promise<BundledSkillPlan> {
  if (writesBlocked(input)) {
    return emptyPlan(input)
  }
  return (await buildBundledSkillPlan(withDefaults(input))).plan
}

/** Execute by preview digest, never by client-supplied operations. */
export async function installBundledSkills(
  input: BundledSkillServiceInput,
  planDigest: string
): Promise<BundledSkillInstallResult> {
  if (writesBlocked(input)) {
    return { scope: input.destination.scope, skills: [] }
  }
  return executeBundledSkillPlan(withDefaults(input), planDigest)
}

/** Silent path: updates only hash-verified copies of `names`, planned under the same locks. */
export async function autoUpdateInstalledBundledSkills(
  input: BundledSkillServiceInput & { names: readonly string[] }
): Promise<BundledSkillInstallResult> {
  if (writesBlocked(input)) {
    return { scope: input.destination.scope, skills: [] }
  }
  return autoUpdateBundledSkills({ ...withDefaults(input), names: input.names })
}
