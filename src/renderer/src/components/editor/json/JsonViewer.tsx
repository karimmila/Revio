import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { jsonSummary, parseJsonPreview } from './json-preview-parse'

function entriesOf(value: unknown): [string, unknown][] {
  if (Array.isArray(value)) {
    return value.map((item, index): [string, unknown] => [String(index), item])
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value)
  }
  return []
}

function Scalar({ value }: { value: unknown }): React.JSX.Element {
  const tone =
    typeof value === 'string'
      ? 'json-string'
      : typeof value === 'number'
        ? 'json-number'
        : typeof value === 'boolean'
          ? 'json-boolean'
          : 'json-null'
  return <span data-json-tone={tone}>{JSON.stringify(value)}</span>
}

function JsonNode({
  name,
  value,
  depth
}: {
  name: string | null
  value: unknown
  depth: number
}): React.JSX.Element {
  const children = entriesOf(value)
  const branch = value !== null && typeof value === 'object'
  const [open, setOpen] = React.useState(depth < 2)
  const label = name === null ? null : <span data-json-key="">{name}: </span>
  if (!branch) {
    return (
      <div data-json-row="" style={{ paddingLeft: depth * 14 + 16 }}>
        {label}
        <Scalar value={value} />
      </div>
    )
  }
  return (
    <>
      <button
        type="button"
        data-json-row=""
        style={{ paddingLeft: depth * 14 }}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={cn('size-3 shrink-0 transition-transform', open && 'rotate-90')} />
        {label}
        <span className="text-muted-foreground">{jsonSummary(value)}</span>
      </button>
      {open
        ? children.map(([key, child]) => (
            <JsonNode key={key} name={key} value={child} depth={depth + 1} />
          ))
        : null}
    </>
  )
}

/** The JSON / JSONL preview: a collapsible tree, one record per line for JSONL. */
export function JsonViewer({
  content,
  jsonl
}: {
  content: string
  jsonl: boolean
}): React.JSX.Element {
  const preview = React.useMemo(() => parseJsonPreview(content, jsonl), [content, jsonl])
  return (
    <div data-json-viewer="" className="h-full overflow-y-auto scrollbar-sleek">
      {preview.kind === 'error' ? (
        <div className="p-3 text-xs text-destructive">
          {translate('auto.components.editor.jsonViewer.invalid', 'Invalid JSON: {{value0}}', {
            value0: preview.message
          })}
        </div>
      ) : preview.kind === 'value' ? (
        <JsonNode name={null} value={preview.value} depth={0} />
      ) : (
        preview.records.map((record) =>
          record.error !== undefined ? (
            <div key={record.line} data-json-row="" className="text-destructive">
              {translate(
                'auto.components.editor.jsonViewer.invalidLine',
                'Line {{value0}}: {{value1}}',
                {
                  value0: record.line,
                  value1: record.error
                }
              )}
            </div>
          ) : (
            <JsonNode key={record.line} name={String(record.line)} value={record.value} depth={0} />
          )
        )
      )}
    </div>
  )
}
