import type { Logger } from "pino";

import type { AgentManager, AgentManagerEvent } from "./agent-manager.js";
import type { AgentStorage } from "./agent-storage.js";
import type { CoordinationSignalDependencies } from "./coordination-signals.js";

type EventPolicyAgentManager = Pick<
  AgentManager,
  | "getAgent"
  | "hasInFlightRun"
  | "listAgents"
  | "notifyAgentAttention"
  | "notifyAgentState"
  | "subscribe"
>;

export interface EventPolicyRuntimeDependencies extends Omit<
  CoordinationSignalDependencies,
  "agentManager" | "agentStorage"
> {
  agentManager: EventPolicyAgentManager;
  agentStorage: Pick<AgentStorage, "get" | "upsert" | "list">;
  logger: Logger;
}

export interface AgentEventPolicyProcessor {
  handleEvent(event: AgentManagerEvent, context: AgentEventPolicyDispatchContext): Promise<void>;
  dispose?(): void;
}

export interface AgentEventPolicyDispatchContext {
  stateNamespace: string;
}

export interface ResolvedAgentEventPolicy extends AgentEventPolicyDispatchContext {
  policy: AgentEventPolicy;
}

export interface AgentEventPolicy {
  id: string;
  version: string;
  enabled(environment: NodeJS.ProcessEnv): boolean;
  createProcessor(dependencies: EventPolicyRuntimeDependencies): AgentEventPolicyProcessor;
}

export interface EventPolicyRuntime {
  enabledPolicies: Array<{ id: string; version: string }>;
  stop(): void;
}

/**
 * Generic event-policy host. Policy owns meaning; the kernel owns subscription,
 * per-agent serialization, failure isolation, and teardown.
 */
export function startEventPolicyRuntime(input: {
  dependencies: EventPolicyRuntimeDependencies;
  policies?: readonly AgentEventPolicy[];
  resolvePolicies?: (agentId: string) => readonly ResolvedAgentEventPolicy[];
  advertisedPolicies?: readonly AgentEventPolicy[];
  environment?: NodeJS.ProcessEnv;
}): EventPolicyRuntime {
  const environment = input.environment ?? process.env;
  const advertisedPolicies = input.advertisedPolicies ?? input.policies ?? [];
  const staticPolicies = (input.policies ?? [])
    .filter((policy) => policy.enabled(environment))
    .map((policy) => ({ policy, stateNamespace: "static" }));
  const processors = new Map<
    string,
    { policy: AgentEventPolicy; processor: AgentEventPolicyProcessor }
  >();
  for (const { policy, stateNamespace } of staticPolicies) {
    processors.set(`${stateNamespace}:${policy.id}:${policy.version}`, {
      policy,
      processor: policy.createProcessor(input.dependencies),
    });
  }
  const queues = new Map<string, Promise<void>>();

  const unsubscribe = input.dependencies.agentManager.subscribe(
    (event) => {
      if (event.type !== "agent_stream") return;
      let resolved: readonly ResolvedAgentEventPolicy[];
      try {
        resolved = input.resolvePolicies?.(event.agentId) ?? staticPolicies;
      } catch (error) {
        input.dependencies.logger.warn(
          { err: error, agentId: event.agentId },
          "Agent event policy owner could not be resolved",
        );
        return;
      }
      for (const { policy, stateNamespace } of resolved) {
        if (!policy.enabled(environment)) continue;
        const processorKey = `${stateNamespace}:${policy.id}:${policy.version}`;
        let entry = processors.get(processorKey);
        if (!entry) {
          entry = { policy, processor: policy.createProcessor(input.dependencies) };
          processors.set(processorKey, entry);
        }
        const processor = entry.processor;
        const queueKey = `${processorKey}:${event.agentId}`;
        const previous = queues.get(queueKey) ?? Promise.resolve();
        const current = previous
          .then(() => processor.handleEvent(event, { stateNamespace }))
          .catch((error) => {
            input.dependencies.logger.warn(
              { err: error, agentId: event.agentId, policyId: policy.id },
              "Agent event policy failed to process an event",
            );
          })
          .finally(() => {
            if (queues.get(queueKey) === current) queues.delete(queueKey);
          });
        queues.set(queueKey, current);
      }
    },
    { replayState: false },
  );

  return {
    enabledPolicies: advertisedPolicies
      .filter((policy) => policy.enabled(environment))
      .map((policy) => ({ id: policy.id, version: policy.version })),
    stop() {
      unsubscribe();
      queues.clear();
      for (const { processor } of processors.values()) processor.dispose?.();
    },
  };
}
