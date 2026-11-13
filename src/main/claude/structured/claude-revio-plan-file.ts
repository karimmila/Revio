import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PLAN_PREFIX = /^Plan:\s*/i
const PLAN_HEADING = /^#{1,3}\s+(.+)$/m
const SLUG_MAX = 50

/** The plan title: the first #–### heading, else the first non-empty line, without "Plan:". */
export function revioPlanTitle(plan: string): string {
  const firstLine = plan
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  return (
    (plan.match(PLAN_HEADING)?.[1] ?? firstLine ?? '').replace(PLAN_PREFIX, '').trim() || 'Untitled'
  )
}

/** The plan file name: the title as a lowercase dash slug of at most 50 characters. */
export function revioPlanSlug(plan: string): string {
  return (
    revioPlanTitle(plan)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, SLUG_MAX) || 'untitled'
  )
}

type PlanFileSystem = {
  exists: (path: string) => Promise<boolean>
  mkdir: (path: string) => Promise<unknown>
  writeFile: (path: string, data: string) => Promise<void>
}

const nodeFileSystem: PlanFileSystem = {
  exists: (path) =>
    stat(path).then(
      () => true,
      () => false
    ),
  mkdir: (path) => mkdir(path, { recursive: true }),
  writeFile: (path, data) => writeFile(path, data, 'utf8')
}

/**
 * Saves a proposed plan as `<workspace>/.context/plans/<slug>.md` when its agent leaves plan mode;
 * a later plan with the same title replaces the file. The workspace layout keeps
 * `.context` out of Git through `.git/info/exclude`; Orca writes nothing outside the workspace, so
 * a `.context` it creates gets its own ignore-everything `.gitignore` instead. An existing
 * `.context` is left as the repository has it.
 */
export async function saveRevioPlan(
  workspacePath: string,
  plan: string,
  fs: PlanFileSystem = nodeFileSystem
): Promise<string | null> {
  if (!plan.trim()) {
    return null
  }
  const contextDir = join(workspacePath, '.context')
  if (!(await fs.exists(contextDir))) {
    await fs.mkdir(contextDir)
    await fs.writeFile(join(contextDir, '.gitignore'), '*\n')
  }
  const plansDir = join(contextDir, 'plans')
  await fs.mkdir(plansDir)
  const filePath = join(plansDir, `${revioPlanSlug(plan)}.md`)
  await fs.writeFile(filePath, plan)
  return filePath
}
