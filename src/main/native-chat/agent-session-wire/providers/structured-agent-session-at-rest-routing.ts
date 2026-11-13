import type { StructuredAgentSessionAtRestCommands } from '../options/structured-agent-session-at-rest-commands'
import type { StructuredAgentSessionAdapter } from './structured-agent-session-adapter'
import type { StructuredAgentRegistry } from './structured-agent-registry'

type AgentRegistration = StructuredAgentRegistry['registration']

/** Routes at-rest command reads by the record's agent; change listeners span every adapter. */
export function routeStructuredAgentSessionAtRestCommands(
  registration: AgentRegistration,
  adapters: () => StructuredAgentSessionAdapter[]
): StructuredAgentSessionAtRestCommands {
  return {
    read: (record) => registration(record.provider)?.adapter.atRestCommands?.read(record),
    snapshot: (record) =>
      registration(record.provider)?.adapter.atRestCommands?.snapshot?.(record) ?? {
        commandsPending: false
      },
    settled: async (record, budgetMs, independent) => {
      const source = registration(record.provider)?.adapter.atRestCommands
      return source?.settled ? source.settled(record, budgetMs, independent) : source?.read(record)
    },
    onChange: (listener) => {
      const stops = adapters().flatMap((adapter) =>
        adapter.atRestCommands ? [adapter.atRestCommands.onChange(listener)] : []
      )
      return () => stops.forEach((stop) => stop())
    }
  }
}
