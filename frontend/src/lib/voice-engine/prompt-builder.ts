/**
 * System prompt builder for insurance voice agents.
 */

import { queryOne } from "@/lib/db";

export type CallType =
  | "outbound_sales"
  | "outbound_followup"
  | "inbound_support"
  | "inbound_claims";

export interface BuildSystemPromptParams {
  agentName: string;
  agentPersona: string;
  agentSystemPrompt?: string;
  callType: CallType;
  orgId: string;
  orgName?: string;
  leadId?: string | null;
}

export async function buildSystemPrompt(params: BuildSystemPromptParams): Promise<string> {
  const { agentName, agentPersona, agentSystemPrompt, callType, orgName, leadId, orgId } = params;

  let leadContext = "";
  if (leadId) {
    const lead = await queryOne<{
      first_name: string;
      last_name: string;
      phone: string;
      insurance_type: string;
      status: string;
    }>(
      `SELECT first_name, last_name, phone, insurance_type, status
       FROM leads WHERE id = $1 AND organization_id = $2`,
      [leadId, orgId]
    );
    if (lead) {
      leadContext = `\n\nLEAD CONTEXT:\nName: ${lead.first_name} ${lead.last_name}\nInsurance: ${lead.insurance_type}\nStatus: ${lead.status}`;
    }
  }

  const callGoal =
    callType === "outbound_sales"
      ? "Your goal is to introduce insurance options, qualify the lead, and schedule a follow-up or close a policy."
      : callType === "outbound_followup"
      ? "Your goal is to follow up on a previous conversation, answer questions, and move the lead to the next stage."
      : callType === "inbound_support"
      ? "Your goal is to help the caller with their insurance question, claim, or policy inquiry."
      : "Your goal is to assist the caller with their claim and provide next steps.";

  const base = agentSystemPrompt ?? agentPersona;

  return `You are ${agentName}, an AI voice agent for ${orgName ?? "our insurance agency"}.

${base}

${callGoal}

GUIDELINES:
- Be professional, empathetic, and concise.
- Keep responses under 3 sentences for natural conversation flow.
- Do not read URLs or long numbers aloud.
- Verify customer identity before discussing account details.${leadContext}`;
}
