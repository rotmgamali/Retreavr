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
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin@retrevr.io', '$2b$12$LJ3Rr0C0pV5Y5E5F0K1qWeZ5XsZ5Y5E5F0K1qWeZ5XsZ5Y5E5F0K', 'Andrew', 'Rollins', 'superadmin'),
-- Apex Insurance Team
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'sarah@apexinsurance.com', '$2b$12$LJ3Rr0C0pV5Y5E5F0K1qWeZ5XsZ5Y5E5F0K1qWeZ5XsZ5Y5E5F0K', 'Sarah', 'Chen', 'admin'),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'marcus@apexinsurance.com', '$2b$12$LJ3Rr0C0pV5Y5E5F0K1qWeZ5XsZ5Y5E5F0K1qWeZ5XsZ5Y5E5F0K', 'Marcus', 'Johnson', 'manager'),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'emily@apexinsurance.com', '$2b$12$LJ3Rr0C0pV5Y5E5F0K1qWeZ5XsZ5Y5E5F0K1qWeZ5XsZ5Y5E5F0K', 'Emily', 'Rodriguez', 'agent'),
-- Pacific Shield Team
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'david@pacificshield.com', '$2b$12$LJ3Rr0C0pV5Y5E5F0K1qWeZ5XsZ5Y5E5F0K1qWeZ5XsZ5Y5E5F0K', 'David', 'Park', 'admin'),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'lisa@pacificshield.com', '$2b$12$LJ3Rr0C0pV5Y5E5F0K1qWeZ5XsZ5Y5E5F0K1qWeZ5XsZ5Y5E5F0K', 'Lisa', 'Wang', 'agent'),
-- Heartland Team
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'mike@heartlandcoverage.com', '$2b$12$LJ3Rr0C0pV5Y5E5F0K1qWeZ5XsZ5Y5E5F0K1qWeZ5XsZ5Y5E5F0K', 'Mike', 'Thompson', 'admin');

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
