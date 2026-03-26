/**
 * Insurance tool definitions and execution for the OpenAI Realtime API.
 */

import { query } from "@/lib/db";

export interface InsuranceTool {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

export const INSURANCE_TOOL_DEFINITIONS: InsuranceTool[] = [
  {
    type: "function",
    name: "lookup_lead",
    description: "Look up a lead or customer record by phone number or name.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Phone number to look up" },
        name: { type: "string", description: "Customer full name" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_quote",
    description: "Generate an insurance quote estimate for the customer.",
    parameters: {
      type: "object",
      properties: {
        insurance_type: {
          type: "string",
          description: "Type of insurance",
          enum: ["auto", "home", "life", "health", "commercial"],
        },
        coverage_amount: { type: "number", description: "Requested coverage amount in dollars" },
        zip_code: { type: "string", description: "Customer zip code for rating" },
      },
      required: ["insurance_type"],
    },
  },
  {
    type: "function",
    name: "schedule_callback",
    description: "Schedule a callback or follow-up appointment.",
    parameters: {
      type: "object",
      properties: {
        preferred_time: { type: "string", description: "Preferred callback time" },
        reason: { type: "string", description: "Reason for the callback" },
      },
      required: ["preferred_time"],
    },
  },
  {
    type: "function",
    name: "update_lead_status",
    description: "Update the lead stage in the CRM pipeline.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "New lead status",
          enum: ["contacted", "qualified", "quoted", "bound", "lost"],
        },
        notes: { type: "string", description: "Notes about the status change" },
      },
      required: ["status"],
    },
  },
];

export async function executeInsuranceTool(
  toolName: string,
  argumentsJson: string,
  orgId: string
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argumentsJson) as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: "Invalid tool arguments" });
  }

  switch (toolName) {
    case "lookup_lead": {
      const phone = args.phone as string | undefined;
      const name = args.name as string | undefined;
      if (!phone && !name) return JSON.stringify({ error: "phone or name required" });

      const rows = await query<{
        id: string;
        first_name: string;
        last_name: string;
        phone: string;
        insurance_type: string;
        status: string;
      }>(
        `SELECT id, first_name, last_name, phone, insurance_type, status
         FROM leads
         WHERE organization_id = $1
           AND (phone ILIKE $2 OR (first_name || ' ' || last_name) ILIKE $3)
         LIMIT 3`,
        [orgId, phone ? `%${phone}%` : "%", name ? `%${name}%` : "%"]
      );

      return JSON.stringify({
        found: rows.length > 0,
        leads: rows.map((r) => ({
          id: r.id,
          name: `${r.first_name} ${r.last_name}`,
          phone: r.phone,
          insurance_type: r.insurance_type,
          status: r.status,
        })),
      });
    }

    case "get_quote": {
      const insuranceType = args.insurance_type as string;
      const baseRates: Record<string, number> = {
        auto: 1200, home: 1800, life: 600, health: 4800, commercial: 6000,
      };
      const base = baseRates[insuranceType] ?? 1500;
      return JSON.stringify({
        insurance_type: insuranceType,
        estimated_annual_premium: base,
        estimated_monthly_premium: Math.round(base / 12),
        disclaimer: "Estimate only. Final rates depend on underwriting.",
      });
    }

    case "schedule_callback":
      return JSON.stringify({
        scheduled: true,
        preferred_time: args.preferred_time,
        confirmation: `Callback noted for ${args.preferred_time}.`,
      });

    case "update_lead_status":
      return JSON.stringify({
        updated: true,
        status: args.status,
        message: `Lead status noted as ${args.status}.`,
      });

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
