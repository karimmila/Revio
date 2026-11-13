export type LinearTeamSummaryInput = {
  id: string
  name: string
  key: string
  url?: string
  workspaceId?: string
  workspaceName?: string
}

export type LinearTeamSummary = {
  id: string
  name: string
  key: string
  url?: string
  workspace?: { id: string; name: string }
}

export function toLinearTeamSummary(team: LinearTeamSummaryInput): LinearTeamSummary {
  return {
    id: team.id,
    name: team.name,
    key: team.key,
    ...(team.url ? { url: team.url } : {}),
    ...(team.workspaceId
      ? { workspace: { id: team.workspaceId, name: team.workspaceName ?? team.workspaceId } }
      : {})
  }
}
