import React from 'react'
import MermaidBlock from '@/components/editor/MermaidBlock'
import { useMermaidDiagramExpand } from '@/components/editor/use-mermaid-diagram-expand'
import { useDocumentDarkTheme } from '@/hooks/use-document-dark-theme'
import { cn } from '@/lib/utils'
import { Copy } from 'lucide-react'
import { translate } from '@/i18n/i18n'

/** "Copy Mermaid source", shown on hover beside the diagram's Expand. */
function CopyMermaidSource({ content }: { content: string }): React.JSX.Element {
  const label = translate(
    'auto.components.sidebar.CommentMermaidBlock.copySource',
    'Copy Mermaid source'
  )
  return (
    <button
      type="button"
      data-orca-export-hide="true"
      aria-label={label}
      title={label}
      onClick={() => void window.api.ui.writeClipboardText(content)}
      className="absolute top-0 right-7 flex size-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none can-hover:opacity-0 can-hover:group-hover/mermaid-source:opacity-100 can-hover:focus-visible:opacity-100"
    >
      <Copy className="size-3.5" />
    </button>
  )
}

// Resolve live document theme here; comment markdown components have no theme access.
export default function CommentMermaidBlock({
  content,
  className,
  pendingContent,
  renderEnabled = true
}: {
  content: string
  className?: string
  pendingContent?: React.ReactNode
  renderEnabled?: boolean
}): React.JSX.Element {
  const isDark = useDocumentDarkTheme()
  const expand = useMermaidDiagramExpand()

  if (pendingContent === undefined) {
    return (
      <div className={cn('group/mermaid-source relative', className)}>
        <MermaidBlock content={content} isDark={isDark} onExpand={expand} />
        <CopyMermaidSource content={content} />
      </div>
    )
  }

  return (
    <MermaidBlock
      content={content}
      isDark={isDark}
      className={className}
      pendingContent={pendingContent}
      renderEnabled={renderEnabled}
      onExpand={expand}
    />
  )
}
