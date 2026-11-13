import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { FORK_IDENTITY } from '../../shared/fork-identity'
import {
  githubAppOverrideProblem,
  normalizeGithubAppOverride,
  resolveGithubAppConfig,
  type GithubAppConfig,
  type GithubAppOverride
} from '../../shared/cloud/github-app-config'
import { writeSecureFile } from '../../shared/secure-file'
import { cloudDataRoot } from './cloud-repo-store'

// Not a secret (a client id is public), but main owns it so a renderer bug cannot point the
// sign-in at another host behind the person's back.
const OverrideSchema = z.object({
  clientId: z.string().max(64).optional(),
  slug: z.string().max(64).optional(),
  host: z.string().max(253).optional()
})

function overrideFile(): string {
  return join(cloudDataRoot(), 'github-app-config.json')
}

export function readGithubAppOverride(): GithubAppOverride {
  try {
    if (!existsSync(overrideFile())) {
      return {}
    }
    const parsed = OverrideSchema.safeParse(JSON.parse(readFileSync(overrideFile(), 'utf8')))
    return parsed.success ? normalizeGithubAppOverride(parsed.data) : {}
  } catch {
    return {}
  }
}

/** Saves the override (blank fields fall back to the fork's app); throws the reason when invalid. */
export function writeGithubAppOverride(input: unknown): GithubAppOverride {
  const parsed = OverrideSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error('That GitHub App setting is not valid.')
  }
  const override = normalizeGithubAppOverride(parsed.data)
  const problem = githubAppOverrideProblem(override)
  if (problem) {
    throw new Error(problem)
  }
  if (Object.keys(override).length === 0) {
    rmSync(overrideFile(), { force: true })
    return override
  }
  mkdirSync(cloudDataRoot(), { recursive: true, mode: 0o700 })
  writeSecureFile(overrideFile(), JSON.stringify(override))
  return override
}

export function currentGithubAppConfig(): GithubAppConfig {
  return resolveGithubAppConfig(FORK_IDENTITY.githubApp, readGithubAppOverride())
}
