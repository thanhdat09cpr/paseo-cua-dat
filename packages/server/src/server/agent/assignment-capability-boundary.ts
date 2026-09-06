import type { RoleBindingInjectionMethod } from "@getpaseo/protocol/role-binding";

import type {
  AgentPermissionRequest,
  AgentPermissionResponse,
  AgentSessionConfig,
} from "./agent-sdk-types.js";
import type { PersistedRoleBinding } from "./role-binding.js";
import { ROLE_TOOL_CEILINGS } from "../policy/bundled/slp/role-profiles.js";

export const ASSIGNMENT_CAPABILITY_BOUNDARY_ERROR = "assignment_capability_boundary_required";

const NO_WRITE_MODE_BY_INJECTION_METHOD: Partial<Record<RoleBindingInjectionMethod, string>> = {
  "codex-developer-instructions": "read-only",
  // Claude plan mode injects a planning workflow that blocks role coordination.
  // Role-bound Claude and Codex agents use the host-wide unattended overrides
  // below. This table remains the fallback for other no-write transports.
  "claude-system-prompt": "default",
  "cursor-project-rule-capsule": "plan",
  "cursor-always-apply-plugin": "plan",
  "antigravity-custom-agent": "plan",
  "mock-launch-context": "read-only",
};

const ROLE_UNATTENDED_MODE_BY_INJECTION_METHOD: Partial<
  Record<RoleBindingInjectionMethod, string>
> = {
  "codex-developer-instructions": "full-access",
  "claude-system-prompt": "bypassPermissions",
};

export function noWriteModeForInjectionMethod(
  injectionMethod: RoleBindingInjectionMethod,
): string | null {
  return NO_WRITE_MODE_BY_INJECTION_METHOD[injectionMethod] ?? null;
}

function requiresTechnicalNoWrite(roleBinding: PersistedRoleBinding | undefined): boolean {
  return roleBinding?.assignment?.mutationBoundary.mode === "no-write";
}

export function requiredNoWriteMode(roleBinding: PersistedRoleBinding | undefined): string | null {
  if (!roleBinding || !requiresTechnicalNoWrite(roleBinding)) {
    return null;
  }
  const unattendedMode = ROLE_UNATTENDED_MODE_BY_INJECTION_METHOD[roleBinding.injectionMethod];
  if (unattendedMode) {
    return unattendedMode;
  }
  const modeId = noWriteModeForInjectionMethod(roleBinding.injectionMethod);
  if (!modeId) {
    throw new Error(
      `${ASSIGNMENT_CAPABILITY_BOUNDARY_ERROR}: provider injection '${roleBinding.injectionMethod}' has no qualified no-write mode for ${roleBinding.roleId} assignment`,
    );
  }
  return modeId;
}

function requiredRoleMode(roleBinding: PersistedRoleBinding | undefined): string | null {
  if (!roleBinding) return null;
  const unattendedMode = ROLE_UNATTENDED_MODE_BY_INJECTION_METHOD[roleBinding.injectionMethod];
  if (unattendedMode) return unattendedMode;
  return requiredNoWriteMode(roleBinding);
}

export function enforceRoleAssignmentCapability(
  config: AgentSessionConfig,
  roleBinding: PersistedRoleBinding | undefined,
): AgentSessionConfig {
  const modeId = requiredRoleMode(roleBinding);
  if (!modeId) {
    return config;
  }
  const disablesAutoAccept =
    roleBinding?.injectionMethod === "cursor-project-rule-capsule" ||
    roleBinding?.injectionMethod === "cursor-always-apply-plugin";
  return {
    ...config,
    modeId,
    ...(disablesAutoAccept
      ? {
          featureValues: {
            ...config.featureValues,
            auto_accept: false,
          },
        }
      : {}),
  };
}

export function assertRoleAssignmentModeAllowed(
  roleBinding: PersistedRoleBinding | undefined,
  requestedModeId: string,
): void {
  const requiredModeId = requiredRoleMode(roleBinding);
  if (requiredModeId && requestedModeId !== requiredModeId) {
    throw new Error(
      `${ASSIGNMENT_CAPABILITY_BOUNDARY_ERROR}: ${roleBinding?.roleId ?? "role"} assignment is pinned to provider mode '${requiredModeId}'`,
    );
  }
}

export function assertRoleAssignmentPermissionResponseAllowed(
  roleBinding: PersistedRoleBinding | undefined,
  response: AgentPermissionResponse,
  request?: AgentPermissionRequest,
  context: { onlyRuntimePaseoMcp?: boolean } = {},
): void {
  const isExactCursorPaseoToolConsent = (() => {
    if (
      roleBinding?.injectionMethod !== "cursor-project-rule-capsule" &&
      roleBinding?.injectionMethod !== "cursor-always-apply-plugin"
    ) {
      return false;
    }
    if (request?.kind !== "tool") return false;
    const admittedTools =
      roleBinding.roleProfile?.allowedTools ?? ROLE_TOOL_CEILINGS[roleBinding.roleId];
    return admittedTools.some((toolName) => {
      const exactTransportName = `paseo-${toolName}`;
      return request.name === exactTransportName || request.title === exactTransportName;
    });
  })();
  const isRoleScopedOpaqueCursorPaseoConsent =
    (roleBinding?.injectionMethod === "cursor-project-rule-capsule" ||
      roleBinding?.injectionMethod === "cursor-always-apply-plugin") &&
    request?.kind === "tool" &&
    request.metadata?.transportShadow === "cursor-opaque-mcp" &&
    context.onlyRuntimePaseoMcp === true;
  const isQuestionResponse = request?.kind === "question";
  if (
    requiresTechnicalNoWrite(roleBinding) &&
    response.behavior === "allow" &&
    !isQuestionResponse &&
    !isExactCursorPaseoToolConsent &&
    !isRoleScopedOpaqueCursorPaseoConsent
  ) {
    throw new Error(
      `${ASSIGNMENT_CAPABILITY_BOUNDARY_ERROR}: no-write ${roleBinding?.roleId ?? "role"} assignment cannot approve a permission escalation`,
    );
  }
}
