import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { isTuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent-config'

/** `agent:modelId` from the Review model setting; anything else means the defaults. */
export function parseRevioReviewModel(
  value: string | undefined
): { agent: TuiAgent; model: string } | null {
  const split = value ? value.indexOf(':') : -1
  const agent = value?.slice(0, split)
  if (!value || split <= 0 || split === value.length - 1 || !isTuiAgent(agent)) {
    return null
  }
  return { agent, model: value.slice(split + 1) }
}
