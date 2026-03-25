"""Initial schema — all tables for Retrevr Insurance Platform

Revision ID: 001_initial
Revises:
Create Date: 2026-03-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # --- organizations ---
    op.create_table(
        "organizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("settings", JSON, nullable=True),
        sa.Column("subscription_tier", sa.String(50), nullable=False, server_default="starter"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"])

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="agent"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_organization_id", "users", ["organization_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # --- refresh_tokens ---
    op.create_table(
        "refresh_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("is_revoked", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])

    # --- voice_agents ---
    op.create_table(
        "voice_agents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("persona", sa.Text, nullable=True),
        sa.Column("system_prompt", sa.Text, nullable=True),
        sa.Column("voice", sa.String(50), nullable=False, server_default="alloy"),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("vad_config", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_voice_agents_organization_id", "voice_agents", ["organization_id"])

    # --- agent_configs ---
    op.create_table(
        "agent_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("voice_agent_id", UUID(as_uuid=True), sa.ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("value", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_agent_configs_voice_agent_id", "agent_configs", ["voice_agent_id"])

    # --- knowledge_documents ---
    op.create_table(
        "knowledge_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("file_type", sa.String(50), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_knowledge_documents_organization_id", "knowledge_documents", ["organization_id"])

    # --- agent_knowledge_bases ---
    op.create_table(
        "agent_knowledge_bases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("voice_agent_id", UUID(as_uuid=True), sa.ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("knowledge_document_id", UUID(as_uuid=True), sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_agent_knowledge_bases_voice_agent_id", "agent_knowledge_bases", ["voice_agent_id"])

    # --- document_embeddings ---
    op.create_table(
        "document_embeddings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_text", sa.Text, nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_document_embeddings_document_id", "document_embeddings", ["document_id"])
    # pgvector embedding column
    op.execute("ALTER TABLE document_embeddings ADD COLUMN embedding vector(1536)")

    # --- leads ---
    op.create_table(
        "leads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("insurance_type", sa.String(50), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="new"),
        sa.Column("propensity_score", sa.Float, nullable=True),
        sa.Column("metadata", JSON, nullable=True),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_leads_organization_id", "leads", ["organization_id"])
    op.create_index("ix_leads_email", "leads", ["email"])
    op.create_index("ix_leads_status", "leads", ["status"])

    # --- lead_interactions ---
    op.create_table(
        "lead_interactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("interaction_type", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("metadata", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_lead_interactions_lead_id", "lead_interactions", ["lead_id"])

    # --- lead_qualifications ---
    op.create_table(
        "lead_qualifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float, nullable=True),
        sa.Column("criteria", JSON, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_lead_qualifications_lead_id", "lead_qualifications", ["lead_id"])

    # --- calls ---
    op.create_table(
        "calls",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", UUID(as_uuid=True), sa.ForeignKey("voice_agents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True),
        sa.Column("direction", sa.String(20), nullable=False, server_default="outbound"),
        sa.Column("status", sa.String(50), nullable=False, server_default="initiated"),
        sa.Column("duration", sa.Integer, nullable=True),
        sa.Column("phone_from", sa.String(50), nullable=True),
        sa.Column("phone_to", sa.String(50), nullable=True),
        sa.Column("twilio_sid", sa.String(100), nullable=True, unique=True),
        sa.Column("sentiment_score", sa.Float, nullable=True),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_calls_organization_id", "calls", ["organization_id"])
    op.create_index("ix_calls_agent_id", "calls", ["agent_id"])
    op.create_index("ix_calls_lead_id", "calls", ["lead_id"])
    op.create_index("ix_calls_twilio_sid", "calls", ["twilio_sid"])

    # --- call_recordings ---
    op.create_table(
        "call_recordings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("call_id", UUID(as_uuid=True), sa.ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("recording_url", sa.String(500), nullable=True),
        sa.Column("duration", sa.Integer, nullable=True),
        sa.Column("file_size", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- call_transcripts ---
    op.create_table(
        "call_transcripts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("call_id", UUID(as_uuid=True), sa.ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("transcript", sa.Text, nullable=True),
        sa.Column("language", sa.String(10), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- call_summaries ---
    op.create_table(
        "call_summaries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("call_id", UUID(as_uuid=True), sa.ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("key_points", JSON, nullable=True),
        sa.Column("next_actions", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- call_sentiments ---
    op.create_table(
        "call_sentiments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("call_id", UUID(as_uuid=True), sa.ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("overall_score", sa.Float, nullable=True),
        sa.Column("customer_sentiment", sa.String(50), nullable=True),
        sa.Column("agent_sentiment", sa.String(50), nullable=True),
        sa.Column("details", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- campaigns ---
    op.create_table(
        "campaigns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=False, server_default="outbound_call"),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("config", JSON, nullable=True),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_campaigns_organization_id", "campaigns", ["organization_id"])

    # --- campaign_leads ---
    op.create_table(
        "campaign_leads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_campaign_leads_campaign_id", "campaign_leads", ["campaign_id"])
    op.create_index("ix_campaign_leads_lead_id", "campaign_leads", ["lead_id"])

    # --- campaign_results ---
    op.create_table(
        "campaign_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("metrics", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_campaign_results_campaign_id", "campaign_results", ["campaign_id"])

    # --- ab_tests ---
    op.create_table(
        "ab_tests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ab_tests_organization_id", "ab_tests", ["organization_id"])

    # --- ab_test_variants ---
    op.create_table(
        "ab_test_variants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ab_test_id", UUID(as_uuid=True), sa.ForeignKey("ab_tests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("config", JSON, nullable=True),
        sa.Column("traffic_weight", sa.Float, nullable=False, server_default="0.5"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ab_test_variants_ab_test_id", "ab_test_variants", ["ab_test_id"])

    # --- ab_test_results ---
    op.create_table(
        "ab_test_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ab_test_id", UUID(as_uuid=True), sa.ForeignKey("ab_tests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", UUID(as_uuid=True), sa.ForeignKey("ab_test_variants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("metrics", JSON, nullable=True),
        sa.Column("sample_size", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ab_test_results_ab_test_id", "ab_test_results", ["ab_test_id"])

    # --- notifications ---
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("type", sa.String(100), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("metadata", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_organization_id", "notifications", ["organization_id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    # --- notification_rules ---
    op.create_table(
        "notification_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("trigger_event", sa.String(100), nullable=False),
        sa.Column("conditions", JSON, nullable=True),
        sa.Column("actions", JSON, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notification_rules_organization_id", "notification_rules", ["organization_id"])

    # --- integrations ---
    op.create_table(
        "integrations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("config", JSON, nullable=True),
        sa.Column("credentials", JSON, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_integrations_organization_id", "integrations", ["organization_id"])

    # --- api_keys ---
    op.create_table(
        "api_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("key_prefix", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_api_keys_organization_id", "api_keys", ["organization_id"])

    # --- audit_logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=True),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("details", JSON, nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_organization_id", "audit_logs", ["organization_id"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])


def downgrade() -> None:
    tables = [
        "audit_logs", "api_keys", "integrations", "notification_rules", "notifications",
        "ab_test_results", "ab_test_variants", "ab_tests",
        "campaign_results", "campaign_leads", "campaigns",
        "call_sentiments", "call_summaries", "call_transcripts", "call_recordings", "calls",
        "lead_qualifications", "lead_interactions", "leads",
        "document_embeddings", "agent_knowledge_bases", "knowledge_documents",
        "agent_configs", "voice_agents",
        "refresh_tokens", "users", "organizations",
    ]
    for t in tables:
        op.drop_table(t)
    op.execute("DROP EXTENSION IF EXISTS vector")
