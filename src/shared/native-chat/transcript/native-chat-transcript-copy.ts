import type { AgentJournalRenderItem } from '../../agent-session/journal/agent-session-journal-types'
import { describeToolInput } from '../tools/native-chat-tool-summary'

export type NativeChatTranscriptCopyMode = 'concise' | 'full'

function blockText(item: AgentJournalRenderItem): string {
  return item.body.kind === 'message'
    ? item.body.blocks
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('\n')
        .trim()
    : ''
}

/**
 * "Copy concise transcript" (the person's messages and the agent's replies) and "Copy
 * full transcript" (also its reasoning and every tool call), as Markdown.
 */
export function nativeChatTranscriptCopyText(
  items: readonly AgentJournalRenderItem[],
  mode: NativeChatTranscriptCopyMode
): string {
  const sections: string[] = []
  for (const item of items) {
    const { body } = item
    if (body.kind === 'message') {
      const text = blockText(item)
      const shown =
        body.role === 'user' ||
        body.role === 'assistant' ||
        (mode === 'full' && body.role === 'reasoning')
      if (text && shown) {
        const heading =
          body.role === 'user' ? 'User' : body.role === 'assistant' ? 'Assistant' : 'Reasoning'
        sections.push(`## ${heading}\n\n${text}`)
      }
    } else if (body.kind === 'tool-call' && mode === 'full') {
      const input = describeToolInput(body.input)
      sections.push(`> Tool: ${body.name}${input ? ` · ${input}` : ''}`)
    }
  }
  return sections.join('\n\n')
}
