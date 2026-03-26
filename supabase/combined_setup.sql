-- Drop existing tables if they exist
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS integrations CASCADE;
DROP TABLE IF EXISTS notification_rules CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS ab_test_results CASCADE;
DROP TABLE IF EXISTS ab_test_variants CASCADE;
DROP TABLE IF EXISTS ab_tests CASCADE;
DROP TABLE IF EXISTS campaign_results CASCADE;
DROP TABLE IF EXISTS campaign_leads CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS call_sentiments CASCADE;
DROP TABLE IF EXISTS call_summaries CASCADE;
DROP TABLE IF EXISTS call_transcripts CASCADE;
DROP TABLE IF EXISTS call_recordings CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS lead_qualifications CASCADE;
DROP TABLE IF EXISTS lead_interactions CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS document_embeddings CASCADE;
DROP TABLE IF EXISTS agent_knowledge_bases CASCADE;
DROP TABLE IF EXISTS knowledge_documents CASCADE;
DROP TABLE IF EXISTS agent_configs CASCADE;
DROP TABLE IF EXISTS voice_agents CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
-- Retrevr Insurance Pipeline - Initial Schema Migration
-- Run against Supabase PostgreSQL

-- Enable UUID extension (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable pgvector for RAG embeddings
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- 1. Organizations (tenants)
-- ============================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'starter',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ============================================================
-- 2. Users
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'agent',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- 3. Refresh Tokens
-- ============================================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- ============================================================
-- 4. Voice Agents
-- ============================================================
CREATE TABLE voice_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    persona TEXT,
    system_prompt TEXT,
    voice VARCHAR(50) NOT NULL DEFAULT 'alloy',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    vad_config JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_voice_agents_organization_id ON voice_agents(organization_id);

-- ============================================================
-- 5. Agent Configs
-- ============================================================
CREATE TABLE agent_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voice_agent_id UUID NOT NULL REFERENCES voice_agents(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agent_configs_voice_agent_id ON agent_configs(voice_agent_id);

-- ============================================================
-- 6. Knowledge Documents
-- ============================================================
CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_type VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_knowledge_documents_organization_id ON knowledge_documents(organization_id);

-- ============================================================
-- 7. Agent Knowledge Bases (join table)
-- ============================================================
CREATE TABLE agent_knowledge_bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voice_agent_id UUID NOT NULL REFERENCES voice_agents(id) ON DELETE CASCADE,
    knowledge_document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agent_kb_voice_agent_id ON agent_knowledge_bases(voice_agent_id);

-- ============================================================
-- 8. Document Embeddings (with pgvector)
-- ============================================================
CREATE TABLE document_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_document_embeddings_document_id ON document_embeddings(document_id);

-- ============================================================
-- 9. Leads
-- ============================================================
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    insurance_type VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    propensity_score FLOAT,
    metadata JSONB,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_leads_organization_id ON leads(organization_id);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);

-- ============================================================
-- 10. Lead Interactions
-- ============================================================
CREATE TABLE lead_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lead_interactions_lead_id ON lead_interactions(lead_id);

-- ============================================================
-- 11. Lead Qualifications
-- ============================================================
CREATE TABLE lead_qualifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    score FLOAT,
    criteria JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lead_qualifications_lead_id ON lead_qualifications(lead_id);

-- ============================================================
-- 12. Calls
-- ============================================================
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES voice_agents(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
    status VARCHAR(50) NOT NULL DEFAULT 'initiated',
    duration INTEGER,
    phone_from VARCHAR(50),
    phone_to VARCHAR(50),
    twilio_sid VARCHAR(100) UNIQUE,
    sentiment_score FLOAT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_calls_organization_id ON calls(organization_id);
CREATE INDEX idx_calls_agent_id ON calls(agent_id);
CREATE INDEX idx_calls_lead_id ON calls(lead_id);
CREATE INDEX idx_calls_twilio_sid ON calls(twilio_sid);

-- ============================================================
-- 13. Call Recordings
-- ============================================================
CREATE TABLE call_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
    recording_url VARCHAR(500),
    duration INTEGER,
    file_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. Call Transcripts
-- ============================================================
CREATE TABLE call_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
    transcript TEXT,
    language VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. Call Summaries
-- ============================================================
CREATE TABLE call_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
    summary TEXT,
    key_points JSONB,
    next_actions JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. Call Sentiments
-- ============================================================
CREATE TABLE call_sentiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
    overall_score FLOAT,
    customer_sentiment VARCHAR(50),
    agent_sentiment VARCHAR(50),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 17. Campaigns
-- ============================================================
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'outbound_call',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    config JSONB,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_campaigns_organization_id ON campaigns(organization_id);

-- ============================================================
-- 18. Campaign Leads (join)
-- ============================================================
CREATE TABLE campaign_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_lead_id ON campaign_leads(lead_id);

-- ============================================================
-- 19. Campaign Results
-- ============================================================
CREATE TABLE campaign_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    metrics JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_campaign_results_campaign_id ON campaign_results(campaign_id);

-- ============================================================
-- 20. AB Tests
-- ============================================================
CREATE TABLE ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ab_tests_organization_id ON ab_tests(organization_id);

-- ============================================================
-- 21. AB Test Variants
-- ============================================================
CREATE TABLE ab_test_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ab_test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    config JSONB,
    traffic_weight FLOAT NOT NULL DEFAULT 0.5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ab_test_variants_ab_test_id ON ab_test_variants(ab_test_id);

-- ============================================================
-- 22. AB Test Results
-- ============================================================
CREATE TABLE ab_test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ab_test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES ab_test_variants(id) ON DELETE SET NULL,
    metrics JSONB,
    sample_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ab_test_results_ab_test_id ON ab_test_results(ab_test_id);

-- ============================================================
-- 23. Notifications
-- ============================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- 24. Notification Rules
-- ============================================================
CREATE TABLE notification_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(100) NOT NULL,
    conditions JSONB,
    actions JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notification_rules_organization_id ON notification_rules(organization_id);

-- ============================================================
-- 25. Integrations
-- ============================================================
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    config JSONB,
    credentials JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_integrations_organization_id ON integrations(organization_id);

-- ============================================================
-- 26. API Keys
-- ============================================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_api_keys_organization_id ON api_keys(organization_id);

-- ============================================================
-- 27. Audit Logs
-- ============================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables with updated_at column
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
        AND table_name NOT IN ('refresh_tokens')
    LOOP
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t);
    END LOOP;
END;
$$;

-- ============================================================
-- Row Level Security (RLS) for multi-tenancy
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so our FastAPI backend using service_role key has full access.
-- These policies are for direct Supabase client access if needed later.
-- Retrevr Insurance Pipeline - Seed Data
-- Demo-ready data for 3 tenant organizations

-- ============================================================
-- Organizations (3 insurance agencies)
-- ============================================================
INSERT INTO organizations (id, name, slug, subscription_tier, settings) VALUES
('a0000000-0000-0000-0000-000000000001', 'Apex Insurance Group', 'apex-insurance', 'enterprise', '{"timezone": "America/New_York", "branding": {"primary_color": "#3b82f6"}}'),
('a0000000-0000-0000-0000-000000000002', 'Pacific Shield Insurance', 'pacific-shield', 'professional', '{"timezone": "America/Los_Angeles", "branding": {"primary_color": "#10b981"}}'),
('a0000000-0000-0000-0000-000000000003', 'Heartland Coverage Co', 'heartland-coverage', 'starter', '{"timezone": "America/Chicago", "branding": {"primary_color": "#f59e0b"}}');

-- ============================================================
-- Users (superadmin + users per org)
-- Password for all users: "demo123!" (bcrypt hash)
-- ============================================================
INSERT INTO users (id, organization_id, email, hashed_password, first_name, last_name, role) VALUES
-- Superadmin (Apex org but has superadmin role)
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin@retrevr.io', '$2b$12$z6R1N7MvBZERXTn6P.sTZuj0/7Cl242kt7HgWWsbbWYZ/AlbSvmqq', 'Andrew', 'Rollins', 'superadmin'),
-- Apex Insurance Team
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'sarah@apexinsurance.com', '$2b$12$z6R1N7MvBZERXTn6P.sTZuj0/7Cl242kt7HgWWsbbWYZ/AlbSvmqq', 'Sarah', 'Chen', 'admin'),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'marcus@apexinsurance.com', '$2b$12$z6R1N7MvBZERXTn6P.sTZuj0/7Cl242kt7HgWWsbbWYZ/AlbSvmqq', 'Marcus', 'Johnson', 'manager'),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'emily@apexinsurance.com', '$2b$12$z6R1N7MvBZERXTn6P.sTZuj0/7Cl242kt7HgWWsbbWYZ/AlbSvmqq', 'Emily', 'Rodriguez', 'agent'),
-- Pacific Shield Team
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'david@pacificshield.com', '$2b$12$z6R1N7MvBZERXTn6P.sTZuj0/7Cl242kt7HgWWsbbWYZ/AlbSvmqq', 'David', 'Park', 'admin'),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'lisa@pacificshield.com', '$2b$12$z6R1N7MvBZERXTn6P.sTZuj0/7Cl242kt7HgWWsbbWYZ/AlbSvmqq', 'Lisa', 'Wang', 'agent'),
-- Heartland Team
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'mike@heartlandcoverage.com', '$2b$12$z6R1N7MvBZERXTn6P.sTZuj0/7Cl242kt7HgWWsbbWYZ/AlbSvmqq', 'Mike', 'Thompson', 'admin');

-- ============================================================
-- Voice Agents
-- ============================================================
INSERT INTO voice_agents (id, organization_id, name, persona, system_prompt, voice, status, vad_config) VALUES
-- Apex Insurance Agents
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sarah AI', 'Friendly and professional insurance advisor specializing in auto and home policies. Warm tone, empathetic listener.', 'You are Sarah, a senior insurance advisor at Apex Insurance Group. You help customers find the right coverage for their needs. Always be warm, professional, and thorough. Ask about their current coverage, life changes, and budget. Use {{LeadName}} and {{PolicyType}} for personalization. Never make promises about exact pricing without running a quote.', 'nova', 'active', '{"sensitivity": 0.6, "endpointing_ms": 800, "interruption_threshold": 0.7}'),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Mike AI', 'Direct, knowledgeable commercial insurance specialist. Gets to the point quickly while remaining personable.', 'You are Mike, a commercial insurance specialist at Apex Insurance Group. You focus on business policies including general liability, workers comp, and commercial auto. Be direct and efficient. Ask about business type, number of employees, annual revenue, and current coverage gaps.', 'onyx', 'active', '{"sensitivity": 0.5, "endpointing_ms": 600, "interruption_threshold": 0.8}'),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Alex AI', 'Life insurance specialist with a calm, reassuring demeanor. Expert at handling sensitive conversations about coverage needs.', 'You are Alex, a life insurance advisor at Apex Insurance Group. You handle term life, whole life, and universal life policies. Be empathetic and patient. These conversations involve sensitive topics. Help customers calculate their coverage needs based on income, dependents, and debts.', 'alloy', 'active', '{"sensitivity": 0.7, "endpointing_ms": 1000, "interruption_threshold": 0.6}'),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Lisa AI', 'Claims intake specialist. Efficient, compassionate, detail-oriented. Guides customers through the claims process.', 'You are Lisa, a claims intake specialist at Apex Insurance Group. Your job is to collect all necessary information for insurance claims. Be compassionate but thorough. Get the date of incident, description, involved parties, police report number if applicable, and photos if possible.', 'shimmer', 'draft', '{"sensitivity": 0.5, "endpointing_ms": 700, "interruption_threshold": 0.7}'),
-- Pacific Shield Agent
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Kai AI', 'Bilingual (English/Spanish) insurance advisor for West Coast markets.', 'You are Kai, a bilingual insurance advisor at Pacific Shield Insurance. You serve the West Coast market and can switch between English and Spanish. Focus on auto, renters, and earthquake coverage. Be approachable and helpful.', 'echo', 'active', '{"sensitivity": 0.6, "endpointing_ms": 800, "interruption_threshold": 0.7}'),
-- Heartland Agent
('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'Jake AI', 'Midwestern friendly farm and ranch insurance specialist.', 'You are Jake, a farm and ranch insurance specialist at Heartland Coverage Co. You specialize in agricultural policies, crop insurance, and rural property coverage. Be friendly and down-to-earth. Understand the unique needs of farming operations.', 'fable', 'active', '{"sensitivity": 0.5, "endpointing_ms": 900, "interruption_threshold": 0.6}');

-- ============================================================
-- Leads (30 leads across organizations)
-- ============================================================
INSERT INTO leads (id, organization_id, first_name, last_name, email, phone, insurance_type, status, propensity_score, metadata) VALUES
-- Apex Insurance Leads
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'James', 'Wilson', 'james.wilson@email.com', '+1-555-0101', 'auto', 'qualified', 0.87, '{"source": "website", "zip": "10001", "age": 34, "vehicles": 2}'),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Maria', 'Garcia', 'maria.garcia@email.com', '+1-555-0102', 'home', 'quoted', 0.92, '{"source": "referral", "zip": "10002", "home_value": 450000, "year_built": 2005}'),
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Robert', 'Taylor', 'robert.taylor@email.com', '+1-555-0103', 'life', 'contacted', 0.65, '{"source": "cold_call", "zip": "10003", "age": 45, "dependents": 3}'),
('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Jennifer', 'Martinez', 'jennifer.m@email.com', '+1-555-0104', 'auto', 'new', 0.73, '{"source": "google_ads", "zip": "10004", "age": 28, "vehicles": 1}'),
('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'William', 'Anderson', 'w.anderson@email.com', '+1-555-0105', 'commercial', 'qualified', 0.81, '{"source": "linkedin", "zip": "10005", "business_type": "restaurant", "employees": 25}'),
('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Patricia', 'Thomas', 'p.thomas@email.com', '+1-555-0106', 'health', 'bound', 0.95, '{"source": "referral", "zip": "10006", "age": 52, "family_size": 4}'),
('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'David', 'Jackson', 'david.j@email.com', '+1-555-0107', 'renters', 'contacted', 0.45, '{"source": "website", "zip": "10007", "age": 23}'),
('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Linda', 'White', 'linda.w@email.com', '+1-555-0108', 'umbrella', 'quoted', 0.88, '{"source": "existing_client", "zip": "10008", "net_worth": 1200000}'),
('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'Michael', 'Harris', 'michael.h@email.com', '+1-555-0109', 'auto', 'lost', 0.34, '{"source": "cold_call", "zip": "10009", "reason_lost": "price_too_high"}'),
('d0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'Susan', 'Clark', 'susan.c@email.com', '+1-555-0110', 'home', 'new', 0.71, '{"source": "facebook_ads", "zip": "10010", "home_value": 320000}'),
('d0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'Christopher', 'Lewis', 'chris.l@email.com', '+1-555-0111', 'life', 'qualified', 0.79, '{"source": "website", "zip": "10011", "age": 38, "tobacco": false}'),
('d0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'Karen', 'Robinson', 'karen.r@email.com', '+1-555-0112', 'auto', 'contacted', 0.62, '{"source": "google_ads", "zip": "10012", "age": 31, "driving_record": "clean"}'),
-- Pacific Shield Leads
('d0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000002', 'Carlos', 'Hernandez', 'carlos.h@email.com', '+1-555-0201', 'auto', 'qualified', 0.83, '{"source": "website", "zip": "90001", "age": 29, "language": "spanish"}'),
('d0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000002', 'Amy', 'Lee', 'amy.lee@email.com', '+1-555-0202', 'renters', 'new', 0.56, '{"source": "instagram_ads", "zip": "94102", "age": 26}'),
('d0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000002', 'Kevin', 'Nguyen', 'kevin.n@email.com', '+1-555-0203', 'home', 'quoted', 0.90, '{"source": "referral", "zip": "98101", "home_value": 680000, "earthquake_zone": true}'),
('d0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000002', 'Jessica', 'Kim', 'jessica.k@email.com', '+1-555-0204', 'auto', 'bound', 0.96, '{"source": "website", "zip": "92101", "age": 33, "vehicles": 1}'),
('d0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000002', 'Daniel', 'Patel', 'daniel.p@email.com', '+1-555-0205', 'commercial', 'contacted', 0.72, '{"source": "linkedin", "zip": "94103", "business_type": "tech_startup", "employees": 12}'),
('d0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000002', 'Rachel', 'Wong', 'rachel.w@email.com', '+1-555-0206', 'life', 'new', 0.58, '{"source": "google_ads", "zip": "90210", "age": 41}'),
-- Heartland Coverage Leads
('d0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000003', 'Bobby', 'Miller', 'bobby.m@email.com', '+1-555-0301', 'commercial', 'qualified', 0.85, '{"source": "referral", "zip": "66002", "business_type": "farm", "acreage": 500}'),
('d0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000003', 'Tammy', 'Davis', 'tammy.d@email.com', '+1-555-0302', 'home', 'contacted', 0.67, '{"source": "local_event", "zip": "68001", "home_value": 185000}'),
('d0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000003', 'Earl', 'Brown', 'earl.b@email.com', '+1-555-0303', 'auto', 'new', 0.49, '{"source": "radio_ad", "zip": "73301", "age": 55, "vehicles": 3}'),
('d0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000003', 'Donna', 'Wilson', 'donna.w@email.com', '+1-555-0304', 'life', 'quoted', 0.78, '{"source": "website", "zip": "50301", "age": 47, "dependents": 2}');

-- ============================================================
-- Calls (40 realistic call records)
-- ============================================================
INSERT INTO calls (id, organization_id, agent_id, lead_id, direction, status, duration, phone_from, phone_to, sentiment_score, created_at) VALUES
-- Apex calls
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'outbound', 'completed', 342, '+1-800-555-0001', '+1-555-0101', 0.82, NOW() - INTERVAL '2 hours'),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'inbound', 'completed', 487, '+1-555-0102', '+1-800-555-0001', 0.91, NOW() - INTERVAL '3 hours'),
('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 'outbound', 'completed', 612, '+1-800-555-0001', '+1-555-0105', 0.75, NOW() - INTERVAL '4 hours'),
('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'outbound', 'completed', 523, '+1-800-555-0001', '+1-555-0103', 0.68, NOW() - INTERVAL '5 hours'),
('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'outbound', 'no-answer', NULL, '+1-800-555-0001', '+1-555-0104', NULL, NOW() - INTERVAL '6 hours'),
('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'inbound', 'completed', 278, '+1-555-0106', '+1-800-555-0001', 0.94, NOW() - INTERVAL '1 day'),
('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000007', 'outbound', 'completed', 195, '+1-800-555-0001', '+1-555-0107', 0.55, NOW() - INTERVAL '1 day 2 hours'),
('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000008', 'outbound', 'completed', 445, '+1-800-555-0001', '+1-555-0108', 0.86, NOW() - INTERVAL '1 day 4 hours'),
('e0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'outbound', 'completed', 156, '+1-800-555-0001', '+1-555-0109', 0.32, NOW() - INTERVAL '2 days'),
('e0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000010', 'outbound', 'failed', NULL, '+1-800-555-0001', '+1-555-0110', NULL, NOW() - INTERVAL '2 days 1 hour'),
('e0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000011', 'outbound', 'completed', 389, '+1-800-555-0001', '+1-555-0111', 0.78, NOW() - INTERVAL '2 days 3 hours'),
('e0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000012', 'inbound', 'completed', 267, '+1-555-0112', '+1-800-555-0001', 0.71, NOW() - INTERVAL '3 days'),
('e0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'outbound', 'completed', 298, '+1-800-555-0001', '+1-555-0101', 0.89, NOW() - INTERVAL '3 days 2 hours'),
('e0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'inbound', 'completed', 412, '+1-555-0103', '+1-800-555-0001', 0.74, NOW() - INTERVAL '4 days'),
('e0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 'outbound', 'completed', 534, '+1-800-555-0001', '+1-555-0105', 0.83, NOW() - INTERVAL '4 days 3 hours'),
-- In-progress call (live)
('e0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'inbound', 'in-progress', NULL, '+1-555-0102', '+1-800-555-0001', NULL, NOW() - INTERVAL '3 minutes'),
-- Pacific Shield calls
('e0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000013', 'outbound', 'completed', 378, '+1-800-555-0002', '+1-555-0201', 0.85, NOW() - INTERVAL '1 hour'),
('e0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000015', 'inbound', 'completed', 502, '+1-555-0203', '+1-800-555-0002', 0.91, NOW() - INTERVAL '5 hours'),
('e0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000016', 'outbound', 'completed', 245, '+1-800-555-0002', '+1-555-0204', 0.93, NOW() - INTERVAL '1 day'),
('e0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000014', 'outbound', 'no-answer', NULL, '+1-800-555-0002', '+1-555-0202', NULL, NOW() - INTERVAL '2 days'),
-- Heartland calls
('e0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000019', 'outbound', 'completed', 623, '+1-800-555-0003', '+1-555-0301', 0.88, NOW() - INTERVAL '3 hours'),
('e0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000020', 'inbound', 'completed', 312, '+1-555-0302', '+1-800-555-0003', 0.72, NOW() - INTERVAL '1 day'),
('e0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000022', 'outbound', 'completed', 467, '+1-800-555-0003', '+1-555-0304', 0.81, NOW() - INTERVAL '2 days');

-- ============================================================
-- Call Transcripts
-- ============================================================
INSERT INTO call_transcripts (call_id, transcript, language) VALUES
('e0000000-0000-0000-0000-000000000001', E'[00:00] Agent: Hi James, this is Sarah from Apex Insurance Group. How are you doing today?\n[00:05] Customer: Hey Sarah, doing well thanks. I got your message about reviewing my auto policy.\n[00:12] Agent: Great! Yes, I noticed your current policy is up for renewal next month. I wanted to make sure you have the best coverage at the best rate. Have there been any changes - new vehicle, change in commute?\n[00:25] Customer: Actually yes, I bought a new Honda CR-V last month and my daughter just got her license.\n[00:33] Agent: Congratulations on both! Adding a new vehicle and a young driver will affect your premium, but we have some great multi-vehicle discounts. Let me pull up some options for you.\n[00:45] Customer: That sounds great. What kind of savings are we looking at?\n[00:50] Agent: With our multi-vehicle bundle and good student discount if your daughter qualifies, we could save you around 15-20% compared to separate policies. Let me run the exact numbers.', 'en'),
('e0000000-0000-0000-0000-000000000002', E'[00:00] Customer: Hi, I''m calling about getting a quote for homeowners insurance. We just closed on a house.\n[00:08] Agent: Congratulations on the new home, Maria! I''d love to help. Can you tell me about the property?\n[00:15] Customer: It''s a 3-bedroom colonial in Westchester, built in 2005, about 2,200 square feet.\n[00:22] Agent: Beautiful area. And what''s the estimated replacement value or purchase price?\n[00:28] Customer: We bought it for $450,000.\n[00:32] Agent: Perfect. Do you have any special features - pool, detached garage, home office?\n[00:38] Customer: Yes, there''s a detached two-car garage and I work from home.\n[00:44] Agent: Great, we can include home office coverage. Based on what you''ve told me, I''m seeing a very competitive rate. Let me put together a comprehensive quote with liability, dwelling, and personal property coverage.', 'en'),
('e0000000-0000-0000-0000-000000000003', E'[00:00] Agent: Good afternoon, William. Mike from Apex Insurance here. I wanted to follow up on our conversation about your restaurant''s insurance needs.\n[00:10] Customer: Hey Mike, glad you called. I''ve been thinking about what you said about our liability gaps.\n[00:18] Agent: Good to hear you''ve been considering it. With 25 employees and the alcohol service, you really need a comprehensive BOP - Business Owner''s Policy - that includes liquor liability.\n[00:30] Customer: What kind of coverage limits should I be looking at?\n[00:35] Agent: For a restaurant your size, I''d recommend at least $2M in general liability, $1M per occurrence, plus $500K in liquor liability. Workers'' comp is required by state law with your headcount.\n[00:50] Customer: And what about food contamination coverage?\n[00:54] Agent: Excellent question. We include food spoilage and contamination as part of our restaurant package. It covers inventory loss from equipment failure or contamination events.', 'en'),
('e0000000-0000-0000-0000-000000000017', E'[00:00] Agent: Hola Carlos, soy Kai de Pacific Shield Insurance. ¿Cómo estás?\n[00:05] Customer: Bien, gracias Kai. Can we do this in English? My English is fine.\n[00:10] Agent: Of course! So I see you''re looking for auto insurance. Can you tell me about your vehicle?\n[00:16] Customer: Yeah, I have a 2023 Toyota Camry. Clean driving record, no accidents.\n[00:22] Agent: That''s great, clean records get our best rates. How many miles do you drive annually?\n[00:28] Customer: About 12,000 miles a year, mostly commuting to work in downtown LA.\n[00:34] Agent: Perfect. With your clean record and the Camry''s safety ratings, I can get you a very competitive rate. Do you want comprehensive and collision, or just liability?\n[00:42] Customer: Full coverage please. The car is still being financed.', 'en');

-- ============================================================
-- Call Summaries
-- ============================================================
INSERT INTO call_summaries (call_id, summary, key_points, next_actions) VALUES
('e0000000-0000-0000-0000-000000000001', 'Discussed auto policy renewal with James Wilson. Customer has a new Honda CR-V and a teenage daughter who recently got her license. Quoted multi-vehicle bundle with potential 15-20% savings.', '["New vehicle: 2023 Honda CR-V", "Daughter recently licensed - young driver", "Current policy renewing next month", "Multi-vehicle discount opportunity"]', '["Send formal quote with multi-vehicle bundle", "Request daughter driving record", "Follow up in 3 days", "Check good student discount eligibility"]'),
('e0000000-0000-0000-0000-000000000002', 'Maria Garcia called for homeowners insurance quote on newly purchased $450K colonial in Westchester. Property is 3BR, 2,200 sqft, built 2005, with detached garage and home office.', '["New home purchase: $450,000", "3BR colonial, 2,200 sqft, built 2005", "Detached 2-car garage", "Home office - needs business equipment rider"]', '["Generate formal HO-3 quote", "Include home office endorsement", "Bundle opportunity with auto", "Send quote within 24 hours"]'),
('e0000000-0000-0000-0000-000000000003', 'Follow-up call with William Anderson about commercial insurance for his restaurant. Discussed BOP, liquor liability, workers comp, and food contamination coverage for 25-employee establishment.', '["25 employees, serves alcohol", "Needs BOP with liquor liability", "Recommended: $2M GL, $1M per occurrence, $500K liquor", "Food contamination coverage included"]', '["Prepare comprehensive BOP proposal", "Get exact revenue figures for premium calc", "Schedule in-person risk assessment", "Send proposal by Friday"]');

-- ============================================================
-- Call Sentiments
-- ============================================================
INSERT INTO call_sentiments (call_id, overall_score, customer_sentiment, agent_sentiment, details) VALUES
('e0000000-0000-0000-0000-000000000001', 0.82, 'positive', 'confident', '{"timeline": [{"time": 0, "score": 0.7}, {"time": 60, "score": 0.75}, {"time": 120, "score": 0.8}, {"time": 180, "score": 0.85}, {"time": 240, "score": 0.88}, {"time": 300, "score": 0.82}]}'),
('e0000000-0000-0000-0000-000000000002', 0.91, 'very_positive', 'enthusiastic', '{"timeline": [{"time": 0, "score": 0.85}, {"time": 60, "score": 0.88}, {"time": 120, "score": 0.9}, {"time": 180, "score": 0.92}, {"time": 240, "score": 0.93}, {"time": 300, "score": 0.91}]}'),
('e0000000-0000-0000-0000-000000000003', 0.75, 'interested', 'professional', '{"timeline": [{"time": 0, "score": 0.65}, {"time": 120, "score": 0.7}, {"time": 240, "score": 0.75}, {"time": 360, "score": 0.78}, {"time": 480, "score": 0.8}, {"time": 600, "score": 0.75}]}'),
('e0000000-0000-0000-0000-000000000009', 0.32, 'frustrated', 'empathetic', '{"timeline": [{"time": 0, "score": 0.5}, {"time": 30, "score": 0.4}, {"time": 60, "score": 0.35}, {"time": 90, "score": 0.28}, {"time": 120, "score": 0.25}, {"time": 150, "score": 0.32}]}');

-- ============================================================
-- Campaigns
-- ============================================================
INSERT INTO campaigns (id, organization_id, name, type, status, config) VALUES
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Q1 Auto Insurance Blitz', 'outbound_call', 'active', '{"target_audience": "auto leads aged 25-45", "daily_limit": 50, "calling_hours": {"start": "09:00", "end": "17:00"}, "script_variant": "consultative"}'),
('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Home Insurance Renewal Push', 'outbound_call', 'active', '{"target_audience": "existing home policy renewals", "daily_limit": 30, "calling_hours": {"start": "10:00", "end": "18:00"}, "script_variant": "retention"}'),
('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Life Insurance Awareness', 'multi_channel', 'draft', '{"channels": ["call", "email", "sms"], "target_audience": "leads with dependents aged 30-55", "daily_limit": 25}'),
('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Claims Follow-up', 'outbound_call', 'completed', '{"target_audience": "recent claimants", "daily_limit": 20, "satisfaction_survey": true}'),
('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'West Coast Auto Spring', 'outbound_call', 'active', '{"target_audience": "CA, OR, WA auto leads", "daily_limit": 40, "bilingual": true}');

-- ============================================================
-- Campaign Leads
-- ============================================================
INSERT INTO campaign_leads (campaign_id, lead_id, status) VALUES
('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'completed'),
('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'pending'),
('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'completed'),
('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000012', 'in_progress'),
('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'completed'),
('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000010', 'pending'),
('f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000013', 'completed'),
('f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000016', 'completed');

-- ============================================================
-- Campaign Results
-- ============================================================
INSERT INTO campaign_results (campaign_id, metrics) VALUES
('f0000000-0000-0000-0000-000000000001', '{"total_calls": 156, "connected": 98, "qualified": 34, "quotes_sent": 22, "conversion_rate": 0.224, "avg_call_duration": 285, "total_talk_time_hours": 7.8}'),
('f0000000-0000-0000-0000-000000000002', '{"total_calls": 89, "connected": 67, "renewed": 52, "retention_rate": 0.776, "avg_call_duration": 198, "total_talk_time_hours": 3.7}'),
('f0000000-0000-0000-0000-000000000004', '{"total_calls": 45, "connected": 38, "satisfied": 31, "nps_score": 72, "avg_call_duration": 145, "total_talk_time_hours": 1.5}'),
('f0000000-0000-0000-0000-000000000005', '{"total_calls": 120, "connected": 76, "qualified": 28, "quotes_sent": 18, "conversion_rate": 0.237, "avg_call_duration": 312}');

-- ============================================================
-- Lead Interactions
-- ============================================================
INSERT INTO lead_interactions (lead_id, interaction_type, notes, metadata) VALUES
('d0000000-0000-0000-0000-000000000001', 'call', 'Initial outbound call - discussed auto policy renewal and new vehicle', '{"call_id": "e0000000-0000-0000-0000-000000000001", "outcome": "quote_requested"}'),
('d0000000-0000-0000-0000-000000000001', 'call', 'Follow-up call - provided multi-vehicle quote details', '{"call_id": "e0000000-0000-0000-0000-000000000013", "outcome": "considering"}'),
('d0000000-0000-0000-0000-000000000002', 'call', 'Inbound call - new homeowner seeking quote', '{"call_id": "e0000000-0000-0000-0000-000000000002", "outcome": "quote_sent"}'),
('d0000000-0000-0000-0000-000000000005', 'call', 'Commercial insurance assessment for restaurant', '{"call_id": "e0000000-0000-0000-0000-000000000003", "outcome": "proposal_pending"}'),
('d0000000-0000-0000-0000-000000000005', 'email', 'Sent BOP proposal with coverage breakdown', '{"template": "commercial_proposal", "opened": true}'),
('d0000000-0000-0000-0000-000000000006', 'call', 'Policy binding call - confirmed health coverage', '{"call_id": "e0000000-0000-0000-0000-000000000006", "outcome": "bound"}'),
('d0000000-0000-0000-0000-000000000013', 'call', 'Auto insurance quote call - bilingual service', '{"call_id": "e0000000-0000-0000-0000-000000000017", "outcome": "quote_sent"}');

-- ============================================================
-- Integrations
-- ============================================================
INSERT INTO integrations (organization_id, name, provider, config, is_active) VALUES
('a0000000-0000-0000-0000-000000000001', 'Twilio Voice', 'twilio', '{"phone_number": "+1-800-555-0001", "region": "us1"}', true),
('a0000000-0000-0000-0000-000000000001', 'Salesforce CRM', 'salesforce', '{"instance_url": "https://apex-insurance.my.salesforce.com", "sync_leads": true, "sync_calls": true}', true),
('a0000000-0000-0000-0000-000000000001', 'OpenAI', 'openai', '{"model": "gpt-4o-realtime-preview", "embeddings_model": "text-embedding-3-small"}', true),
('a0000000-0000-0000-0000-000000000001', 'Stripe Billing', 'stripe', '{"plan": "enterprise_monthly"}', true),
('a0000000-0000-0000-0000-000000000002', 'Twilio Voice', 'twilio', '{"phone_number": "+1-800-555-0002", "region": "us1"}', true),
('a0000000-0000-0000-0000-000000000002', 'HubSpot CRM', 'hubspot', '{"portal_id": "12345678", "sync_leads": true}', true),
('a0000000-0000-0000-0000-000000000003', 'Twilio Voice', 'twilio', '{"phone_number": "+1-800-555-0003", "region": "us1"}', true);

-- ============================================================
-- Notifications
-- ============================================================
INSERT INTO notifications (organization_id, user_id, type, title, body, is_read) VALUES
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'call_completed', 'Call completed with James Wilson', 'Sarah AI completed a 5:42 call with James Wilson. Sentiment: Positive (0.82)', false),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'lead_qualified', 'Lead qualified: William Anderson', 'William Anderson (Commercial) has been qualified with a propensity score of 0.81', false),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'campaign_milestone', 'Q1 Auto Blitz: 100 calls reached', 'The Q1 Auto Insurance Blitz campaign has completed 100 calls with a 22.4% conversion rate.', true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'call_alert', 'Live call in progress', 'Sarah AI is currently on a call with Maria Garcia (Home Insurance)', false),
('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000005', 'lead_bound', 'Policy bound: Jessica Kim', 'Jessica Kim (Auto) policy has been bound. Premium: $1,284/yr', false);

-- ============================================================
-- Audit Logs
-- ============================================================
INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details) VALUES
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'create', 'voice_agent', 'c0000000-0000-0000-0000-000000000001', '{"agent_name": "Sarah AI"}'),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'update', 'voice_agent', 'c0000000-0000-0000-0000-000000000001', '{"field": "status", "old": "draft", "new": "active"}'),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'create', 'campaign', 'f0000000-0000-0000-0000-000000000001', '{"campaign_name": "Q1 Auto Insurance Blitz"}'),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'login', 'user', 'b0000000-0000-0000-0000-000000000002', '{"ip": "192.168.1.100"}');
-- ============================================================
-- 003_rls_policies.sql
-- Comprehensive Row Level Security for multi-tenant isolation
-- ============================================================
-- JWT claims expected: { sub: user_id, org_id: uuid, role: string }
-- Roles: superadmin, admin, manager, agent, viewer
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Helper functions to extract JWT claims
-- ============================================================
-- These read from Supabase's request.jwt.claims GUC, set
-- automatically when using supabase-js or PostgREST.
-- Placed in public schema since auth schema is managed by Supabase.

CREATE OR REPLACE FUNCTION public.rls_org_id() RETURNS UUID AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'org_id',
    NULL
  )::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.rls_role() RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.rls_user_id() RETURNS UUID AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    NULL
  )::uuid;
$$ LANGUAGE sql STABLE;

-- Convenience: check if caller is superadmin
CREATE OR REPLACE FUNCTION public.rls_is_superadmin() RETURNS BOOLEAN AS $$
  SELECT public.rls_role() = 'superadmin';
$$ LANGUAGE sql STABLE;

-- Convenience: check minimum role level (ordered hierarchy)
CREATE OR REPLACE FUNCTION public.rls_has_role_gte(min_role TEXT) RETURNS BOOLEAN AS $$
  SELECT CASE min_role
    WHEN 'viewer'     THEN public.rls_role() IN ('viewer','agent','manager','admin','superadmin')
    WHEN 'agent'      THEN public.rls_role() IN ('agent','manager','admin','superadmin')
    WHEN 'manager'    THEN public.rls_role() IN ('manager','admin','superadmin')
    WHEN 'admin'      THEN public.rls_role() IN ('admin','superadmin')
    WHEN 'superadmin' THEN public.rls_role() = 'superadmin'
    ELSE FALSE
  END;
$$ LANGUAGE sql STABLE;


-- ============================================================
-- 2. Enable RLS on ALL tables (idempotent)
-- ============================================================
-- Tables already enabled in 001 are harmless to re-enable.

ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_qualifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls                ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_summaries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sentiments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys             ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 3. Drop any existing policies (idempotent re-runs)
-- ============================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END;
$$;


-- ============================================================
-- 4. DIRECT ORG TABLES — tables with organization_id column
-- ============================================================
-- Pattern: org_id match OR superadmin for SELECT
--          org_id match + role check for INSERT/UPDATE/DELETE

-- -------------------------------------------------------
-- ORGANIZATIONS
-- -------------------------------------------------------
-- SELECT: see own org, superadmin sees all
CREATE POLICY organizations_select ON organizations FOR SELECT USING (
    public.rls_is_superadmin() OR id = public.rls_org_id()
);
-- INSERT: admin+ (creating sub-orgs) or superadmin
CREATE POLICY organizations_insert ON organizations FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND id = public.rls_org_id())
);
-- UPDATE: admin+ own org or superadmin
CREATE POLICY organizations_update ON organizations FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND id = public.rls_org_id())
);
-- DELETE: superadmin only
CREATE POLICY organizations_delete ON organizations FOR DELETE USING (
    public.rls_is_superadmin()
);

-- -------------------------------------------------------
-- USERS
-- -------------------------------------------------------
CREATE POLICY users_select ON users FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND organization_id = public.rls_org_id())
);
CREATE POLICY users_update ON users FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND organization_id = public.rls_org_id())
);
CREATE POLICY users_delete ON users FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND organization_id = public.rls_org_id())
);

-- -------------------------------------------------------
-- VOICE AGENTS
-- -------------------------------------------------------
CREATE POLICY voice_agents_select ON voice_agents FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY voice_agents_insert ON voice_agents FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('agent') AND organization_id = public.rls_org_id())
);
CREATE POLICY voice_agents_update ON voice_agents FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);
CREATE POLICY voice_agents_delete ON voice_agents FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);

-- -------------------------------------------------------
-- LEADS
-- -------------------------------------------------------
CREATE POLICY leads_select ON leads FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('agent') AND organization_id = public.rls_org_id())
);
CREATE POLICY leads_update ON leads FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('agent') AND organization_id = public.rls_org_id())
);
CREATE POLICY leads_delete ON leads FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);

-- -------------------------------------------------------
-- CALLS
-- -------------------------------------------------------
CREATE POLICY calls_select ON calls FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY calls_insert ON calls FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('agent') AND organization_id = public.rls_org_id())
);
CREATE POLICY calls_update ON calls FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('agent') AND organization_id = public.rls_org_id())
);
CREATE POLICY calls_delete ON calls FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);

-- -------------------------------------------------------
-- CAMPAIGNS
-- -------------------------------------------------------
CREATE POLICY campaigns_select ON campaigns FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY campaigns_insert ON campaigns FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);
CREATE POLICY campaigns_update ON campaigns FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);
CREATE POLICY campaigns_delete ON campaigns FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);

-- -------------------------------------------------------
-- KNOWLEDGE DOCUMENTS
-- -------------------------------------------------------
CREATE POLICY knowledge_documents_select ON knowledge_documents FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY knowledge_documents_insert ON knowledge_documents FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('agent') AND organization_id = public.rls_org_id())
);
CREATE POLICY knowledge_documents_update ON knowledge_documents FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);
CREATE POLICY knowledge_documents_delete ON knowledge_documents FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);

-- -------------------------------------------------------
-- AB TESTS
-- -------------------------------------------------------
CREATE POLICY ab_tests_select ON ab_tests FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY ab_tests_insert ON ab_tests FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);
CREATE POLICY ab_tests_update ON ab_tests FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);
CREATE POLICY ab_tests_delete ON ab_tests FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);

-- -------------------------------------------------------
-- NOTIFICATIONS
-- -------------------------------------------------------
CREATE POLICY notifications_select ON notifications FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('agent') AND organization_id = public.rls_org_id())
);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('agent') AND organization_id = public.rls_org_id())
);
CREATE POLICY notifications_delete ON notifications FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);

-- -------------------------------------------------------
-- NOTIFICATION RULES
-- -------------------------------------------------------
CREATE POLICY notification_rules_select ON notification_rules FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY notification_rules_insert ON notification_rules FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);
CREATE POLICY notification_rules_update ON notification_rules FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('manager') AND organization_id = public.rls_org_id())
);
CREATE POLICY notification_rules_delete ON notification_rules FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND organization_id = public.rls_org_id())
);

-- -------------------------------------------------------
-- AUDIT LOGS (append-only for non-superadmin)
-- -------------------------------------------------------
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('agent') AND organization_id = public.rls_org_id())
);
-- No UPDATE policy: audit logs are immutable
-- DELETE: superadmin only (regulatory retention)
CREATE POLICY audit_logs_delete ON audit_logs FOR DELETE USING (
    public.rls_is_superadmin()
);

-- -------------------------------------------------------
-- INTEGRATIONS
-- -------------------------------------------------------
CREATE POLICY integrations_select ON integrations FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY integrations_insert ON integrations FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND organization_id = public.rls_org_id())
);
CREATE POLICY integrations_update ON integrations FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND organization_id = public.rls_org_id())
);
CREATE POLICY integrations_delete ON integrations FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND organization_id = public.rls_org_id())
);

-- -------------------------------------------------------
-- API KEYS
-- -------------------------------------------------------
CREATE POLICY api_keys_select ON api_keys FOR SELECT USING (
    public.rls_is_superadmin() OR organization_id = public.rls_org_id()
);
CREATE POLICY api_keys_insert ON api_keys FOR INSERT WITH CHECK (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND organization_id = public.rls_org_id())
);
CREATE POLICY api_keys_update ON api_keys FOR UPDATE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND organization_id = public.rls_org_id())
);
CREATE POLICY api_keys_delete ON api_keys FOR DELETE USING (
    public.rls_is_superadmin() OR (public.rls_has_role_gte('admin') AND organization_id = public.rls_org_id())
);


-- ============================================================
-- 5. CHILD TABLES — joined to parent for org_id check
-- ============================================================

-- -------------------------------------------------------
-- REFRESH TOKENS (child of users)
-- -------------------------------------------------------
CREATE POLICY refresh_tokens_select ON refresh_tokens FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = refresh_tokens.user_id
          AND u.organization_id = public.rls_org_id()
    )
);
CREATE POLICY refresh_tokens_insert ON refresh_tokens FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = refresh_tokens.user_id
          AND u.organization_id = public.rls_org_id()
    )
);
CREATE POLICY refresh_tokens_update ON refresh_tokens FOR UPDATE USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = refresh_tokens.user_id
          AND u.organization_id = public.rls_org_id()
    )
);
CREATE POLICY refresh_tokens_delete ON refresh_tokens FOR DELETE USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = refresh_tokens.user_id
          AND u.organization_id = public.rls_org_id()
    )
);

-- -------------------------------------------------------
-- AGENT CONFIGS (child of voice_agents)
-- -------------------------------------------------------
CREATE POLICY agent_configs_select ON agent_configs FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM voice_agents va
        WHERE va.id = agent_configs.voice_agent_id
          AND va.organization_id = public.rls_org_id()
    )
);
CREATE POLICY agent_configs_insert ON agent_configs FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM voice_agents va
        WHERE va.id = agent_configs.voice_agent_id
          AND va.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY agent_configs_update ON agent_configs FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM voice_agents va
        WHERE va.id = agent_configs.voice_agent_id
          AND va.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY agent_configs_delete ON agent_configs FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM voice_agents va
        WHERE va.id = agent_configs.voice_agent_id
          AND va.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- AGENT KNOWLEDGE BASES (child of voice_agents)
-- -------------------------------------------------------
CREATE POLICY agent_knowledge_bases_select ON agent_knowledge_bases FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM voice_agents va
        WHERE va.id = agent_knowledge_bases.voice_agent_id
          AND va.organization_id = public.rls_org_id()
    )
);
CREATE POLICY agent_knowledge_bases_insert ON agent_knowledge_bases FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM voice_agents va
        WHERE va.id = agent_knowledge_bases.voice_agent_id
          AND va.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY agent_knowledge_bases_update ON agent_knowledge_bases FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM voice_agents va
        WHERE va.id = agent_knowledge_bases.voice_agent_id
          AND va.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY agent_knowledge_bases_delete ON agent_knowledge_bases FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM voice_agents va
        WHERE va.id = agent_knowledge_bases.voice_agent_id
          AND va.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- DOCUMENT EMBEDDINGS (child of knowledge_documents)
-- -------------------------------------------------------
CREATE POLICY document_embeddings_select ON document_embeddings FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM knowledge_documents kd
        WHERE kd.id = document_embeddings.document_id
          AND kd.organization_id = public.rls_org_id()
    )
);
CREATE POLICY document_embeddings_insert ON document_embeddings FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM knowledge_documents kd
        WHERE kd.id = document_embeddings.document_id
          AND kd.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY document_embeddings_update ON document_embeddings FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM knowledge_documents kd
        WHERE kd.id = document_embeddings.document_id
          AND kd.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY document_embeddings_delete ON document_embeddings FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM knowledge_documents kd
        WHERE kd.id = document_embeddings.document_id
          AND kd.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- LEAD INTERACTIONS (child of leads)
-- -------------------------------------------------------
CREATE POLICY lead_interactions_select ON lead_interactions FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_interactions.lead_id
          AND l.organization_id = public.rls_org_id()
    )
);
CREATE POLICY lead_interactions_insert ON lead_interactions FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_interactions.lead_id
          AND l.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY lead_interactions_update ON lead_interactions FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_interactions.lead_id
          AND l.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY lead_interactions_delete ON lead_interactions FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_interactions.lead_id
          AND l.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- LEAD QUALIFICATIONS (child of leads)
-- -------------------------------------------------------
CREATE POLICY lead_qualifications_select ON lead_qualifications FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_qualifications.lead_id
          AND l.organization_id = public.rls_org_id()
    )
);
CREATE POLICY lead_qualifications_insert ON lead_qualifications FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_qualifications.lead_id
          AND l.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY lead_qualifications_update ON lead_qualifications FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_qualifications.lead_id
          AND l.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY lead_qualifications_delete ON lead_qualifications FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_qualifications.lead_id
          AND l.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- CALL RECORDINGS (child of calls)
-- -------------------------------------------------------
CREATE POLICY call_recordings_select ON call_recordings FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_recordings.call_id
          AND c.organization_id = public.rls_org_id()
    )
);
CREATE POLICY call_recordings_insert ON call_recordings FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_recordings.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY call_recordings_update ON call_recordings FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_recordings.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY call_recordings_delete ON call_recordings FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_recordings.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- CALL TRANSCRIPTS (child of calls)
-- -------------------------------------------------------
CREATE POLICY call_transcripts_select ON call_transcripts FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_transcripts.call_id
          AND c.organization_id = public.rls_org_id()
    )
);
CREATE POLICY call_transcripts_insert ON call_transcripts FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_transcripts.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY call_transcripts_update ON call_transcripts FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_transcripts.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY call_transcripts_delete ON call_transcripts FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_transcripts.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- CALL SUMMARIES (child of calls)
-- -------------------------------------------------------
CREATE POLICY call_summaries_select ON call_summaries FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_summaries.call_id
          AND c.organization_id = public.rls_org_id()
    )
);
CREATE POLICY call_summaries_insert ON call_summaries FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_summaries.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY call_summaries_update ON call_summaries FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_summaries.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY call_summaries_delete ON call_summaries FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_summaries.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- CALL SENTIMENTS (child of calls)
-- -------------------------------------------------------
CREATE POLICY call_sentiments_select ON call_sentiments FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_sentiments.call_id
          AND c.organization_id = public.rls_org_id()
    )
);
CREATE POLICY call_sentiments_insert ON call_sentiments FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('agent') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_sentiments.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY call_sentiments_update ON call_sentiments FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_sentiments.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY call_sentiments_delete ON call_sentiments FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_sentiments.call_id
          AND c.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- CAMPAIGN LEADS (child of campaigns)
-- -------------------------------------------------------
CREATE POLICY campaign_leads_select ON campaign_leads FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM campaigns cp
        WHERE cp.id = campaign_leads.campaign_id
          AND cp.organization_id = public.rls_org_id()
    )
);
CREATE POLICY campaign_leads_insert ON campaign_leads FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM campaigns cp
        WHERE cp.id = campaign_leads.campaign_id
          AND cp.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY campaign_leads_update ON campaign_leads FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM campaigns cp
        WHERE cp.id = campaign_leads.campaign_id
          AND cp.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY campaign_leads_delete ON campaign_leads FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM campaigns cp
        WHERE cp.id = campaign_leads.campaign_id
          AND cp.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- CAMPAIGN RESULTS (child of campaigns)
-- -------------------------------------------------------
CREATE POLICY campaign_results_select ON campaign_results FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM campaigns cp
        WHERE cp.id = campaign_results.campaign_id
          AND cp.organization_id = public.rls_org_id()
    )
);
CREATE POLICY campaign_results_insert ON campaign_results FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM campaigns cp
        WHERE cp.id = campaign_results.campaign_id
          AND cp.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY campaign_results_update ON campaign_results FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM campaigns cp
        WHERE cp.id = campaign_results.campaign_id
          AND cp.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY campaign_results_delete ON campaign_results FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM campaigns cp
        WHERE cp.id = campaign_results.campaign_id
          AND cp.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- AB TEST VARIANTS (child of ab_tests)
-- -------------------------------------------------------
CREATE POLICY ab_test_variants_select ON ab_test_variants FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM ab_tests t
        WHERE t.id = ab_test_variants.ab_test_id
          AND t.organization_id = public.rls_org_id()
    )
);
CREATE POLICY ab_test_variants_insert ON ab_test_variants FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM ab_tests t
        WHERE t.id = ab_test_variants.ab_test_id
          AND t.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY ab_test_variants_update ON ab_test_variants FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM ab_tests t
        WHERE t.id = ab_test_variants.ab_test_id
          AND t.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY ab_test_variants_delete ON ab_test_variants FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM ab_tests t
        WHERE t.id = ab_test_variants.ab_test_id
          AND t.organization_id = public.rls_org_id()
    ))
);

-- -------------------------------------------------------
-- AB TEST RESULTS (child of ab_tests)
-- -------------------------------------------------------
CREATE POLICY ab_test_results_select ON ab_test_results FOR SELECT USING (
    public.rls_is_superadmin()
    OR EXISTS (
        SELECT 1 FROM ab_tests t
        WHERE t.id = ab_test_results.ab_test_id
          AND t.organization_id = public.rls_org_id()
    )
);
CREATE POLICY ab_test_results_insert ON ab_test_results FOR INSERT WITH CHECK (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM ab_tests t
        WHERE t.id = ab_test_results.ab_test_id
          AND t.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY ab_test_results_update ON ab_test_results FOR UPDATE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM ab_tests t
        WHERE t.id = ab_test_results.ab_test_id
          AND t.organization_id = public.rls_org_id()
    ))
);
CREATE POLICY ab_test_results_delete ON ab_test_results FOR DELETE USING (
    public.rls_is_superadmin()
    OR (public.rls_has_role_gte('manager') AND EXISTS (
        SELECT 1 FROM ab_tests t
        WHERE t.id = ab_test_results.ab_test_id
          AND t.organization_id = public.rls_org_id()
    ))
);


-- ============================================================
-- 6. Grant execute on helper functions to Supabase roles
-- ============================================================
GRANT EXECUTE ON FUNCTION public.rls_org_id()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_role()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_user_id()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_is_superadmin()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_has_role_gte(TEXT)   TO authenticated;

GRANT EXECUTE ON FUNCTION public.rls_org_id()            TO anon;
GRANT EXECUTE ON FUNCTION public.rls_role()               TO anon;
GRANT EXECUTE ON FUNCTION public.rls_user_id()            TO anon;
GRANT EXECUTE ON FUNCTION public.rls_is_superadmin()      TO anon;
GRANT EXECUTE ON FUNCTION public.rls_has_role_gte(TEXT)   TO anon;


COMMIT;
