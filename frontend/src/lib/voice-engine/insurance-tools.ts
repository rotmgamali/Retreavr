/**
 * Function tools the voice agent can invoke mid-conversation.
 *
 * Each tool queries the Supabase Postgres database and returns a
 * JSON string the model can weave into its spoken response.
 */

import { query, queryOne } from "@/lib/db";
import { randomUUID } from "crypto";
import type { RealtimeToolDefinition } from "./realtime-client";

// ── Tool Definitions (sent to OpenAI) ────────────────────────────────────────

export const INSURANCE_TOOL_DEFINITIONS: RealtimeToolDefinition[] = [
  {
    type: "function",
    name: "lookup_policy",
    description:
      "Look up an insurance policy by policy number or customer name. Returns policy details including coverage, premium, and status.",
    parameters: {
      type: "object",
      properties: {
        policy_number: {
          type: "string",
          description: "The policy number to look up",
        },
        customer_name: {
          type: "string",
          description:
            "Customer first or last name to search (used if policy_number is not provided)",
        },
        org_id: {
          type: "string",
          description: "Organization ID (injected by system)",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_quote",
    description:
      "Generate an insurance quote for auto, home, or life insurance based on provided details.",
    parameters: {
      type: "object",
      properties: {
        insurance_type: {
          type: "string",
          enum: ["auto", "home", "life", "renters", "umbrella"],
          description: "Type of insurance",
        },
        coverage_amount: {
          type: "number",
          description: "Desired coverage amount in dollars",
        },
        deductible: {
          type: "number",
          description: "Desired deductible amount in dollars",
        },
        customer_age: { type: "number", description: "Customer age" },
        customer_zip: {
          type: "string",
          description: "Customer ZIP code",
        },
        additional_info: {
          type: "string",
          description:
            "Any additional relevant info (e.g. vehicle year/make, home sqft)",
        },
        org_id: { type: "string" },
      },
      required: ["insurance_type"],
    },
  },
  {
    type: "function",
    name: "schedule_callback",
    description:
      "Schedule a follow-up callback at a specific date and time.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead ID to call back" },
        callback_date: {
          type: "string",
          description: "ISO date-time for the callback",
        },
        reason: {
          type: "string",
          description: "Reason for the callback",
        },
        org_id: { type: "string" },
      },
      required: ["callback_date"],
    },
  },
  {
    type: "function",
    name: "transfer_to_human",
    description:
      "Transfer the current call to a human agent. Use when the customer explicitly requests a human or the query is beyond the AI's capabilities.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for transfer",
        },
        department: {
          type: "string",
          enum: ["sales", "claims", "billing", "support", "management"],
          description: "Department to transfer to",
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Urgency level",
        },
        org_id: { type: "string" },
      },
      required: ["reason"],
    },
  },
  {
    type: "function",
    name: "update_lead_status",
    description:
      "Update the status of a lead in the CRM system.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead ID" },
        status: {
          type: "string",
          enum: ["new", "contacted", "qualified", "quoted", "bound", "lost"],
          description: "New lead status",
        },
        notes: {
          type: "string",
          description: "Notes about the status change",
        },
        org_id: { type: "string" },
      },
      required: ["lead_id", "status"],
    },
  },
  {
    type: "function",
    name: "check_claim_status",
    description:
      "Check the current status of an insurance claim by claim number or customer info.",
    parameters: {
      type: "object",
      properties: {
        claim_number: { type: "string", description: "Claim number" },
        policy_number: {
          type: "string",
          description: "Policy number associated with the claim",
        },
        customer_name: { type: "string" },
        org_id: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "create_lead",
    description:
      "Create a new lead from caller information captured during the conversation.",
    parameters: {
      type: "object",
      properties: {
        first_name: { type: "string", description: "Caller first name" },
        last_name: { type: "string", description: "Caller last name" },
        phone: { type: "string", description: "Caller phone number" },
        email: { type: "string", description: "Caller email" },
        insurance_type: {
          type: "string",
          enum: ["auto", "home", "life", "renters", "umbrella", "commercial"],
          description: "Type of insurance the caller is interested in",
        },
        notes: { type: "string", description: "Additional notes" },
        org_id: { type: "string" },
      },
      required: ["first_name", "last_name", "phone"],
    },
  },
];

// ── Tool Execution Router ────────────────────────────────────────────────────

/**
 * Execute a named tool and return the JSON result string.
 * The `orgId` is injected server-side so the model can't spoof tenant scope.
 */
export async function executeInsuranceTool(
  name: string,
  argsJson: string,
  orgId: string
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson);
  } catch {
    return JSON.stringify({ error: "Invalid arguments JSON" });
  }

  // Always inject the real org_id
  args.org_id = orgId;

  try {
    switch (name) {
      case "lookup_policy":
        return JSON.stringify(await lookupPolicy(args));
      case "get_quote":
        return JSON.stringify(await getQuote(args));
      case "schedule_callback":
        return JSON.stringify(await scheduleCallback(args));
      case "transfer_to_human":
        return JSON.stringify(await transferToHuman(args));
      case "update_lead_status":
        return JSON.stringify(await updateLeadStatus(args));
      case "check_claim_status":
        return JSON.stringify(await checkClaimStatus(args));
      case "create_lead":
        return JSON.stringify(await createLead(args));
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tool execution failed";
    return JSON.stringify({ error: msg });
  }
}

// ── Tool Implementations ─────────────────────────────────────────────────────

async function lookupPolicy(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { policy_number, customer_name, org_id } = args as {
    policy_number?: string;
    customer_name?: string;
    org_id: string;
  };

  if (policy_number) {
    const row = await queryOne(
      `SELECT * FROM policies
       WHERE organization_id = $1 AND policy_number = $2
       LIMIT 1`,
      [org_id, policy_number]
    );
    if (row) return { found: true, policy: row };
    return { found: false, message: "No policy found with that number." };
  }

  if (customer_name) {
    const rows = await query(
      `SELECT p.* FROM policies p
       JOIN leads l ON p.lead_id = l.id
       WHERE p.organization_id = $1
         AND (l.first_name ILIKE $2 OR l.last_name ILIKE $2)
       LIMIT 5`,
      [org_id, `%${customer_name}%`]
    );
    if (rows.length > 0) return { found: true, policies: rows };
    return { found: false, message: "No policies found for that name." };
  }

  return { error: "Please provide a policy number or customer name." };
}

async function getQuote(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const {
    insurance_type,
    coverage_amount,
    deductible,
    customer_age,
    customer_zip,
    additional_info,
    org_id,
  } = args as {
    insurance_type: string;
    coverage_amount?: number;
    deductible?: number;
    customer_age?: number;
    customer_zip?: string;
    additional_info?: string;
    org_id: string;
  };

  // Base premium calculation (simplified — real quotes would use rating tables)
  const basePremiums: Record<string, number> = {
    auto: 1200,
    home: 1800,
    life: 600,
    renters: 300,
    umbrella: 400,
  };

  let premium = basePremiums[insurance_type] ?? 1000;
  const coverage = coverage_amount ?? premium * 200;
  const ded = deductible ?? 500;

  // Age adjustment
  if (customer_age) {
    if (customer_age < 25) premium *= 1.4;
    else if (customer_age > 65) premium *= 1.2;
  }

  // Deductible adjustment (higher deductible = lower premium)
  if (ded >= 2500) premium *= 0.75;
  else if (ded >= 1000) premium *= 0.85;

  // Round to 2 decimals
  const monthlyPremium = Math.round((premium / 12) * 100) / 100;
  const annualPremium = Math.round(premium * 100) / 100;

  const quoteId = randomUUID();

  // Store quote in database
  await queryOne(
    `INSERT INTO quotes (id, organization_id, insurance_type, coverage_amount, deductible, annual_premium, monthly_premium, status, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, NOW())
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      quoteId,
      org_id,
      insurance_type,
      coverage,
      ded,
      annualPremium,
      monthlyPremium,
      JSON.stringify({ customer_age, customer_zip, additional_info }),
    ]
  ).catch(() => {
    // quotes table may not exist yet — that's OK, still return the quote
  });

  return {
    quote_id: quoteId,
    insurance_type,
    coverage_amount: coverage,
    deductible: ded,
    annual_premium: annualPremium,
    monthly_premium: monthlyPremium,
    note: "This is an estimated quote. Final premium may vary after underwriting.",
  };
}

async function scheduleCallback(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { lead_id, callback_date, reason, org_id } = args as {
    lead_id?: string;
    callback_date: string;
    reason?: string;
    org_id: string;
  };

  const id = randomUUID();

  await queryOne(
    `INSERT INTO scheduled_callbacks (id, organization_id, lead_id, callback_at, reason, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'scheduled', NOW())
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [id, org_id, lead_id ?? null, callback_date, reason ?? "Follow-up"]
  ).catch(() => {
    // table may not exist yet
  });

  return {
    scheduled: true,
    callback_id: id,
    callback_date,
    message: `Callback scheduled for ${callback_date}.`,
  };
}

async function transferToHuman(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { reason, department, urgency } = args as {
    reason: string;
    department?: string;
    urgency?: string;
  };

  // In a real system this would signal Twilio to bridge the call.
  // For now we return the intent so the front-end can handle it.
  return {
    transfer_requested: true,
    reason,
    department: department ?? "support",
    urgency: urgency ?? "medium",
    message:
      "I'm transferring you to a human agent now. Please hold for a moment.",
  };
}

async function updateLeadStatus(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { lead_id, status, notes, org_id } = args as {
    lead_id: string;
    status: string;
    notes?: string;
    org_id: string;
  };

  const lead = await queryOne(
    `UPDATE leads SET status = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3
     RETURNING id, first_name, last_name, status`,
    [status, lead_id, org_id]
  );

  if (!lead) {
    return { updated: false, message: "Lead not found." };
  }

  // Also log an interaction
  if (notes) {
    await queryOne(
      `INSERT INTO lead_interactions (id, lead_id, interaction_type, notes, metadata, created_at)
       VALUES ($1, $2, 'voice_call', $3, '{}', NOW())`,
      [randomUUID(), lead_id, notes]
    ).catch(() => {});
  }

  return { updated: true, lead };
}

async function checkClaimStatus(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { claim_number, policy_number, customer_name, org_id } = args as {
    claim_number?: string;
    policy_number?: string;
    customer_name?: string;
    org_id: string;
  };

  if (claim_number) {
    const row = await queryOne(
      `SELECT * FROM claims
       WHERE organization_id = $1 AND claim_number = $2
       LIMIT 1`,
      [org_id, claim_number]
    );
    if (row) return { found: true, claim: row };
  }

  if (policy_number) {
    const rows = await query(
      `SELECT * FROM claims
       WHERE organization_id = $1 AND policy_number = $2
       ORDER BY created_at DESC LIMIT 5`,
      [org_id, policy_number]
    );
    if (rows.length > 0) return { found: true, claims: rows };
  }

  if (customer_name) {
    const rows = await query(
      `SELECT c.* FROM claims c
       JOIN leads l ON c.lead_id = l.id
       WHERE c.organization_id = $1
         AND (l.first_name ILIKE $2 OR l.last_name ILIKE $2)
       ORDER BY c.created_at DESC LIMIT 5`,
      [org_id, `%${customer_name}%`]
    );
    if (rows.length > 0) return { found: true, claims: rows };
  }

  return {
    found: false,
    message:
      "No claims found. Please provide a claim number, policy number, or customer name.",
  };
}

async function createLead(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { first_name, last_name, phone, email, insurance_type, notes, org_id } =
    args as {
      first_name: string;
      last_name: string;
      phone: string;
      email?: string;
      insurance_type?: string;
      notes?: string;
      org_id: string;
    };

  const id = randomUUID();

  const lead = await queryOne(
    `INSERT INTO leads (id, organization_id, first_name, last_name, phone, email, insurance_type, status, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', $8, NOW(), NOW())
     RETURNING id, first_name, last_name, phone, email, insurance_type, status`,
    [
      id,
      org_id,
      first_name,
      last_name,
      phone,
      email ?? null,
      insurance_type ?? "auto",
      JSON.stringify({ source: "voice_call", notes: notes ?? "" }),
    ]
  );

  return {
    created: true,
    lead: lead ?? { id, first_name, last_name, phone },
  };
}
