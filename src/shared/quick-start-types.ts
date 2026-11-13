export type QuickStartTemplate = 'none' | 'empty' | 'nextjs'

export type QuickStartRequest = {
  repoPath: string
  name: string
  template: QuickStartTemplate
  /** Creates a private GitHub repository with gh and pushes; the dialog confirms it first. */
  publishToGithub: boolean
}

export type QuickStartResult = { ok: true; githubUrl?: string } | { ok: false; error: string }
