/**
 * TypeScript types generated from the Supabase/PostgreSQL schema.
 * Matches supabase/migrations/001_initial_schema.sql
 *
 * Update this file whenever the schema changes (or run `supabase gen types typescript`).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Row types — what comes back from SELECT queries
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: OrganizationInsert;
        Update: Partial<OrganizationInsert>;
      };
      users: {
        Row: UserRow;
        Insert: UserInsert;
        Update: Partial<UserInsert>;
      };
      refresh_tokens: {
        Row: RefreshTokenRow;
        Insert: RefreshTokenInsert;
        Update: Partial<RefreshTokenInsert>;
      };
      voice_agents: {
        Row: VoiceAgentRow;
        Insert: VoiceAgentInsert;
        Update: Partial<VoiceAgentInsert>;
      };
      agent_configs: {
        Row: AgentConfigRow;
        Insert: AgentConfigInsert;
        Update: Partial<AgentConfigInsert>;
      };
      knowledge_documents: {
        Row: KnowledgeDocumentRow;
        Insert: KnowledgeDocumentInsert;
        Update: Partial<KnowledgeDocumentInsert>;
      };
      agent_knowledge_bases: {
        Row: AgentKnowledgeBaseRow;
        Insert: AgentKnowledgeBaseInsert;
        Update: Partial<AgentKnowledgeBaseInsert>;
      };
      document_embeddings: {
        Row: DocumentEmbeddingRow;
        Insert: DocumentEmbeddingInsert;
        Update: Partial<DocumentEmbeddingInsert>;
      };
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: Partial<LeadInsert>;
      };
      lead_interactions: {
        Row: LeadInteractionRow;
        Insert: LeadInteractionInsert;
        Update: Partial<LeadInteractionInsert>;
      };
      lead_qualifications: {
        Row: LeadQualificationRow;
        Insert: LeadQualificationInsert;
        Update: Partial<LeadQualificationInsert>;
      };
      calls: {
        Row: CallRow;
        Insert: CallInsert;
        Update: Partial<CallInsert>;
      };
      call_recordings: {
        Row: CallRecordingRow;
        Insert: CallRecordingInsert;
        Update: Partial<CallRecordingInsert>;
      };
      call_transcripts: {
        Row: CallTranscriptRow;
        Insert: CallTranscriptInsert;
        Update: Partial<CallTranscriptInsert>;
      };
      call_summaries: {
        Row: CallSummaryRow;
        Insert: CallSummaryInsert;
        Update: Partial<CallSummaryInsert>;
      };
      call_sentiments: {
        Row: CallSentimentRow;
        Insert: CallSentimentInsert;
        Update: Partial<CallSentimentInsert>;
      };
      campaigns: {
        Row: CampaignRow;
        Insert: CampaignInsert;
        Update: Partial<CampaignInsert>;
      };
      campaign_leads: {
        Row: CampaignLeadRow;
        Insert: CampaignLeadInsert;
        Update: Partial<CampaignLeadInsert>;
      };
      campaign_results: {
        Row: CampaignResultRow;
        Insert: CampaignResultInsert;
        Update: Partial<CampaignResultInsert>;
      };
      ab_tests: {
        Row: ABTestRow;
        Insert: ABTestInsert;
        Update: Partial<ABTestInsert>;
      };
      ab_test_variants: {
        Row: ABTestVariantRow;
        Insert: ABTestVariantInsert;
        Update: Partial<ABTestVariantInsert>;
      };
      ab_test_results: {
        Row: ABTestResultRow;
        Insert: ABTestResultInsert;
        Update: Partial<ABTestResultInsert>;
      };
      notifications: {
        Row: NotificationRow;
        Insert: NotificationInsert;
        Update: Partial<NotificationInsert>;
      };
      integrations: {
        Row: IntegrationRow;
        Insert: IntegrationInsert;
        Update: Partial<IntegrationInsert>;
      };
      api_keys: {
        Row: ApiKeyRow;
        Insert: ApiKeyInsert;
        Update: Partial<ApiKeyInsert>;
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: AuditLogInsert;
        Update: Partial<AuditLogInsert>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      voice_enum: VoiceEnum;
      agent_status: AgentStatus;
      lead_status: LeadStatus;
      insurance_type: InsuranceType;
      call_direction: CallDirection;
      call_status: CallStatus;
      campaign_type: CampaignType;
      campaign_status: CampaignStatus;
      document_status: DocumentStatus;
    };
  };
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type UserRole =
  | "superadmin"
  | "admin"
  | "manager"
  | "agent"
  | "viewer";

export type VoiceEnum =
  | "alloy"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "shimmer";

export type AgentStatus = "active" | "inactive" | "draft";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "quoted"
  | "bound"
  | "lost";

export type InsuranceType =
  | "auto"
  | "home"
  | "life"
  | "health"
  | "commercial"
  | "renters"
  | "umbrella";

export type CallDirection = "inbound" | "outbound";

export type CallStatus =
  | "initiating"
  | "initiated"
  | "ringing"
  | "in-progress"
  | "completed"
  | "failed"
  | "busy"
  | "no-answer"
  | "canceled";

export type CampaignType =
  | "outbound_call"
  | "email"
  | "sms"
  | "multi_channel";

export type CampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

// ---------------------------------------------------------------------------
// organizations
// ---------------------------------------------------------------------------

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  settings: Json | null;
  subscription_tier: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OrganizationInsert = Omit<
  OrganizationRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  organization_id: string;
  email: string;
  hashed_password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserInsert = Omit<UserRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// refresh_tokens
// ---------------------------------------------------------------------------

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  is_revoked: boolean;
  expires_at: string;
  created_at: string;
}

export type RefreshTokenInsert = Omit<RefreshTokenRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// voice_agents
// ---------------------------------------------------------------------------

export interface VoiceAgentRow {
  id: string;
  organization_id: string;
  name: string;
  persona: string | null;
  system_prompt: string | null;
  voice: VoiceEnum;
  status: AgentStatus;
  vad_config: Json | null;
  created_at: string;
  updated_at: string;
}

export type VoiceAgentInsert = Omit<
  VoiceAgentRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// agent_configs
// ---------------------------------------------------------------------------

export interface AgentConfigRow {
  id: string;
  voice_agent_id: string;
  key: string;
  value: Json | null;
  created_at: string;
  updated_at: string;
}

export type AgentConfigInsert = Omit<
  AgentConfigRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// knowledge_documents
// ---------------------------------------------------------------------------

export interface KnowledgeDocumentRow {
  id: string;
  organization_id: string;
  title: string;
  file_path: string | null;
  file_type: string | null;
  status: DocumentStatus;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export type KnowledgeDocumentInsert = Omit<
  KnowledgeDocumentRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// agent_knowledge_bases
// ---------------------------------------------------------------------------

export interface AgentKnowledgeBaseRow {
  id: string;
  voice_agent_id: string;
  knowledge_document_id: string;
  created_at: string;
  updated_at: string;
}

export type AgentKnowledgeBaseInsert = Omit<
  AgentKnowledgeBaseRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// document_embeddings
// ---------------------------------------------------------------------------

export interface DocumentEmbeddingRow {
  id: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export type DocumentEmbeddingInsert = Omit<
  DocumentEmbeddingRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// leads
// ---------------------------------------------------------------------------

export interface LeadRow {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  insurance_type: InsuranceType | null;
  status: LeadStatus;
  propensity_score: number | null;
  metadata: Json | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export type LeadInsert = Omit<LeadRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// lead_interactions
// ---------------------------------------------------------------------------

export interface LeadInteractionRow {
  id: string;
  lead_id: string;
  interaction_type: string;
  notes: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
}

export type LeadInteractionInsert = Omit<
  LeadInteractionRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// lead_qualifications
// ---------------------------------------------------------------------------

export interface LeadQualificationRow {
  id: string;
  lead_id: string;
  score: number | null;
  criteria: Json | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadQualificationInsert = Omit<
  LeadQualificationRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// calls
// ---------------------------------------------------------------------------

export interface CallRow {
  id: string;
  organization_id: string;
  agent_id: string | null;
  lead_id: string | null;
  direction: CallDirection;
  status: CallStatus;
  duration: number | null;
  phone_from: string | null;
  phone_to: string | null;
  twilio_sid: string | null;
  sentiment_score: number | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export type CallInsert = Omit<CallRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// call_recordings
// ---------------------------------------------------------------------------

export interface CallRecordingRow {
  id: string;
  call_id: string;
  recording_url: string | null;
  duration: number | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
}

export type CallRecordingInsert = Omit<
  CallRecordingRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// call_transcripts
// ---------------------------------------------------------------------------

export interface CallTranscriptRow {
  id: string;
  call_id: string;
  transcript: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export type CallTranscriptInsert = Omit<
  CallTranscriptRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// call_summaries
// ---------------------------------------------------------------------------

export interface CallSummaryRow {
  id: string;
  call_id: string;
  summary: string | null;
  key_points: Json | null;
  next_actions: Json | null;
  created_at: string;
  updated_at: string;
}

export type CallSummaryInsert = Omit<
  CallSummaryRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// call_sentiments
// ---------------------------------------------------------------------------

export interface CallSentimentRow {
  id: string;
  call_id: string;
  overall_score: number | null;
  customer_sentiment: string | null;
  agent_sentiment: string | null;
  details: Json | null;
  created_at: string;
  updated_at: string;
}

export type CallSentimentInsert = Omit<
  CallSentimentRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// campaigns
// ---------------------------------------------------------------------------

export interface CampaignRow {
  id: string;
  organization_id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  config: Json | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export type CampaignInsert = Omit<
  CampaignRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// campaign_leads
// ---------------------------------------------------------------------------

export interface CampaignLeadRow {
  id: string;
  campaign_id: string;
  lead_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type CampaignLeadInsert = Omit<
  CampaignLeadRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// campaign_results
// ---------------------------------------------------------------------------

export interface CampaignResultRow {
  id: string;
  campaign_id: string;
  metrics: Json | null;
  created_at: string;
  updated_at: string;
}

export type CampaignResultInsert = Omit<
  CampaignResultRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// ab_tests / ab_test_variants / ab_test_results
// ---------------------------------------------------------------------------

export interface ABTestRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export type ABTestInsert = Omit<ABTestRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export interface ABTestVariantRow {
  id: string;
  ab_test_id: string;
  name: string;
  config: Json | null;
  traffic_weight: number;
  created_at: string;
  updated_at: string;
}

export type ABTestVariantInsert = Omit<
  ABTestVariantRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export interface ABTestResultRow {
  id: string;
  ab_test_id: string;
  variant_id: string | null;
  metrics: Json | null;
  sample_size: number | null;
  created_at: string;
  updated_at: string;
}

export type ABTestResultInsert = Omit<
  ABTestResultRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

export interface NotificationRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
}

export type NotificationInsert = Omit<
  NotificationRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// integrations
// ---------------------------------------------------------------------------

export interface IntegrationRow {
  id: string;
  organization_id: string;
  name: string;
  provider: string;
  config: Json | null;
  credentials: Json | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type IntegrationInsert = Omit<
  IntegrationRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// api_keys
// ---------------------------------------------------------------------------

export interface ApiKeyRow {
  id: string;
  organization_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ApiKeyInsert = Omit<
  ApiKeyRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// audit_logs
// ---------------------------------------------------------------------------

export interface AuditLogRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Json | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditLogInsert = Omit<
  AuditLogRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
