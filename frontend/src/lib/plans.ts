export type PlanTier = "free_trial" | "starter" | "professional" | "enterprise";

export interface PlanLimits {
  agents: number;
  calls_per_month: number;
  users: number;
  knowledge_docs: number;
}

export const PLANS: Record<PlanTier, PlanLimits> = {
  free_trial: {
    agents: 1,
    calls_per_month: 100,
    users: 2,
    knowledge_docs: 5,
  },
  starter: {
    agents: 3,
    calls_per_month: 1000,
    users: 5,
    knowledge_docs: 25,
  },
  professional: {
    agents: 10,
    calls_per_month: 10000,
    users: 20,
    knowledge_docs: 100,
  },
  enterprise: {
    agents: -1,
    calls_per_month: -1,
    users: -1,
    knowledge_docs: -1,
  },
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  free_trial: "Free Trial",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

/** Returns true if the value is unlimited (-1) or within the limit. */
export function withinLimit(current: number, limit: number): boolean {
  return limit === -1 || current < limit;
}

/** Human-readable limit display. */
export function formatLimit(value: number): string {
  if (value === -1) return "Unlimited";
  return value.toLocaleString();
}
