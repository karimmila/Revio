import type { DirEntry } from '../../../../shared/filesystem-entry-types'

export const PAST_PLAN_OFFERS = 3

/** The workspace layout keeps a workspace's plans in `.context/plans/<slug>.md`. */
export function workspacePlansDir(workspacePath: string): string {
  return `${workspacePath.replace(/[\\/]+$/, '')}/.context/plans`
}

export function planFileNames(entries: readonly DirEntry[]): string[] {
  return entries
    .filter((entry) => !entry.isDirectory && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
}

/** `fix-login-loop.md` → `Fix login loop`. */
export function planTitle(fileName: string): string {
  const words = fileName.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : fileName
}

export type PastPlan = { title: string; filePath: string; mtime: number }

export function newestPlans(plans: readonly PastPlan[], limit = PAST_PLAN_OFFERS): PastPlan[] {
  return [...plans].sort((a, b) => b.mtime - a.mtime).slice(0, limit)
}

/** What attaching a plan puts in the prompt: its title and file, for the agent to read. */
export function pastPlanAttachmentText(plan: Pick<PastPlan, 'title' | 'filePath'>): string {
  return `Plan "${plan.title}" — file: ${plan.filePath} `
}

/** This workspace's newest plans; none when the folder is missing or unreadable. */
export async function readWorkspacePlans(workspacePath: string): Promise<PastPlan[]> {
  const dir = workspacePlansDir(workspacePath)
  // Most workspaces have no plans folder; reading a missing one logs an IPC handler error.
  if (!(await window.api.fs.pathExists({ filePath: dir }).catch(() => false))) {
    return []
  }
  const entries = await window.api.fs.readDir({ dirPath: dir }).catch(() => [])
  const plans = await Promise.all(
    planFileNames(entries).map(async (name) => {
      const filePath = `${dir}/${name}`
      const stat = await window.api.fs.stat({ filePath }).catch(() => null)
      return stat ? { title: planTitle(name), filePath, mtime: stat.mtime } : null
    })
  )
  return newestPlans(plans.filter((plan): plan is PastPlan => plan !== null))
}
