import * as agentStart from '../startup/structured-agent-session-agent-start'
import * as conversation from '../delivery/structured-agent-session-host-delivery'
import { StructuredAgentSessionEventRecovery } from '../termination/structured-agent-session-event-recovery'
import type { StructuredAgentSessionAttachContext } from '../acquisition/structured-agent-session-attach-context'
import type { StructuredAgentSessionClientDelivery } from '../publication/subscribers/structured-agent-session-client-delivery'
import type { createStructuredAgentSessionPublicationWiring } from './structured-agent-session-publication-wiring'
import type { StructuredAgentSessionHostRuntimeState } from './structured-agent-session-host-runtime-state'
import type { StructuredAgentSessionTaskQueue } from './structured-agent-session-task-queue'
import type * as HostTypes from './structured-agent-session-host-types'

export function createStructuredAgentSessionHostDeliveryWiring(input: {
  deps: HostTypes.StructuredAgentSessionHostDeps
  sessions: ReturnType<typeof createStructuredAgentSessionPublicationWiring>
  runtimeState: StructuredAgentSessionHostRuntimeState
  clientDelivery: StructuredAgentSessionClientDelivery
  tasks: StructuredAgentSessionTaskQueue
  restartRequests: Set<string>
  serialize: <T>(sessionId: string, task: () => Promise<T>) => Promise<T>
  now: () => number
  attachContext: () => StructuredAgentSessionAttachContext
  lifetime: () => HostTypes.StructuredAgentSessionConversationLifetime
}) {
  const { deps, sessions, runtimeState, clientDelivery, tasks, serialize, lifetime } = input
  const conversationDelivery = conversation.createStructuredAgentSessionConversationDelivery({
    deps,
    acquireAborts: runtimeState.acquireAborts,
    sessions,
    serialize: (sessionId, task) => serialize(sessionId, task),
    // Quit drains tracked starts before eviction so their children are stopped.
    trackStart: (start) => tasks.trackAttach(start),
    startProviderChild: (sessionId, startedFor) =>
      agentStart.claimStructuredAgentSessionAgent(input.attachContext(), sessionId, startedFor),
    deliveryOrder: runtimeState.deliveryOrder,
    startFlights: runtimeState.startFlights,
    readiness: (id, child) => runtimeState.startupAttempts.readiness(id, child),
    // Retire at rest; the next start refreshes login and permission mode.
    stopOutgrownAgent: (id) => lifetime().stopAgent(id, { cause: 'evict', resting: true }),
    restartRequests: input.restartRequests,
    stopPermissionTransitionChild: (id) => lifetime().stopAgent(id, { cause: 'evict' }),
    clientDelivery
  })
  const eventRecovery = new StructuredAgentSessionEventRecovery({
    deps,
    store: deps.store,
    sessions,
    flushLifecycle: (sessionId) => runtimeState.lifecycleBarrier(sessionId),
    publishStatus: clientDelivery.publishStatusAndSettlement,
    generationEnded: clientDelivery.publishGenerationEnded,
    serialize: (sessionId, task) => tasks.trackAttach(serialize(sessionId, task)),
    now: input.now,
    runtimeState,
    wakeDelivery: (sessionId) => conversationDelivery.loop.wake(sessionId),
    failStartingChild: (...args) => lifetime().failStartingChild(...args),
    trackOpen: (open) => tasks.trackAttach(open)
  })
  return { conversationDelivery, eventRecovery }
}
