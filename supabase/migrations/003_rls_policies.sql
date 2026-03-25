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
