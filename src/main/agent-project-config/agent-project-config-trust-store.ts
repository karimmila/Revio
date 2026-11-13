import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { AgentProjectConfigDecision } from '../../shared/agent-project-config-trust'
import { writeSecureFile } from '../../shared/secure-file'

const FILE_NAME = 'agent-project-config-trust.json'
const MAX_PROJECTS = 2000

const FileSchema = z.object({
  projects: z.record(
    z.string(),
    z.object({
      hash: z.string().regex(/^[0-9a-f]{64}$/),
      decision: z.enum(['trust', 'user-only']),
      decidedAt: z.number()
    })
  )
})
type TrustFile = z.infer<typeof FileSchema>

function read(userDataPath: string): TrustFile {
  const path = join(userDataPath, FILE_NAME)
  if (!existsSync(path)) {
    return { projects: {} }
  }
  try {
    const parsed = FileSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')))
    return parsed.success ? parsed.data : { projects: {} }
  } catch {
    return { projects: {} }
  }
}

/** The decision for this project, only while its settings still have the content it was made for. */
export function readAgentProjectConfigDecision(
  userDataPath: string,
  projectKey: string,
  hash: string
): AgentProjectConfigDecision | null {
  const entry = read(userDataPath).projects[projectKey]
  return entry?.hash === hash ? entry.decision : null
}

export function writeAgentProjectConfigDecision(
  userDataPath: string,
  projectKey: string,
  hash: string,
  decision: AgentProjectConfigDecision,
  now: number
): void {
  const projects = {
    ...read(userDataPath).projects,
    [projectKey]: { hash, decision, decidedAt: now }
  }
  const newest = Object.entries(projects)
    .toSorted(([, a], [, b]) => b.decidedAt - a.decidedAt)
    .slice(0, MAX_PROJECTS)
  writeSecureFile(
    join(userDataPath, FILE_NAME),
    `${JSON.stringify({ projects: Object.fromEntries(newest) }, null, 2)}\n`
  )
}

/** What was last decided for this project, whatever content it was decided for; null when nothing. */
export function readStoredAgentProjectConfigDecision(
  userDataPath: string,
  projectKey: string
): { decision: AgentProjectConfigDecision; hash: string } | null {
  const entry = read(userDataPath).projects[projectKey]
  return entry ? { decision: entry.decision, hash: entry.hash } : null
}

/** Forgets the decision, so the next chat in the project asks again. */
export function forgetAgentProjectConfigDecision(userDataPath: string, projectKey: string): void {
  const { [projectKey]: _forgotten, ...projects } = read(userDataPath).projects
  writeSecureFile(join(userDataPath, FILE_NAME), `${JSON.stringify({ projects }, null, 2)}\n`)
}
