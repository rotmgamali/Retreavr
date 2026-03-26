-- MASTER SEED FOR DEMO
-- SETTING UP ORGANIZATION
INSERT INTO organizations (id, name, slug, subscription_tier, is_active)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Apex Insurance Group', 'apex-insurance', 'enterprise', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- SETTING UP ADMIN USER
-- Re-defining the users table if needed to fix schema
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
        ALTER TABLE public.users RENAME COLUMN password_hash TO hashed_password;
    END IF;
END $$;

INSERT INTO users (id, organization_id, email, hashed_password, first_name, last_name, role, is_active)
VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin@retrevr.io', '$2b$12$LQv3c1yqBWVHxkdZMRbi.u78.lsh102mXv.XWlk8F4Xy.rLk22u/m', 'Andrew', 'Rollins', 'superadmin', true)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- SETTING UP VOICE AGENTS
INSERT INTO voice_agents (id, organization_id, name, persona, system_prompt, voice, status)
VALUES 
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sarah (Support)', 'Sarah is a helpful insurance support agent.', 'Hello, this is Sarah from Apex Insurance. How can I help you today?', 'shimmer', 'active'),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Marcus (Outbound)', 'Marcus is a direct and friendly outbound sales agent.', 'Hi, I am Marcus from Apex. I am calling about your recent quote request.', 'onyx', 'active')
ON CONFLICT (id) DO NOTHING;

-- SETTING UP LEADS
INSERT INTO leads (id, organization_id, email, phone, first_name, last_name, status, insurance_type, propensity_score, is_deleted)
VALUES 
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'john@example.com', '+15551234567', 'John', 'Doe', 'bound', 'auto', 0.95, false),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'jane@example.com', '+15559876543', 'Jane', 'Smith', 'qualified', 'home', 0.8, false),
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'bob@example.com', '+15550001111', 'Bob', 'Johnson', 'quoted', 'life', 0.7, false)
ON CONFLICT (id) DO NOTHING;

-- SETTING UP CALLS (Historical)
INSERT INTO calls (id, organization_id, lead_id, agent_id, direction, status, duration, sentiment_score, is_deleted, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'inbound',
    'completed',
    FLOOR(RANDOM() * 300 + 60),
    (RANDOM() * 0.4 + 0.6),
    false,
    NOW() - (i || ' hours')::INTERVAL,
    NOW() - (i || ' hours')::INTERVAL
FROM generate_series(1, 50) i;
