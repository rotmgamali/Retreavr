-- =============================================================================
-- Retrevr Insurance Platform — Comprehensive Seed Data
-- Replaces supabase/migrations/002_seed_data.sql with full demo data:
--   • 3 organizations (different performance stories)
--   • 13 users (varied roles including superadmin)
--   • 6 voice agents with real insurance prompts
--   • 75 leads across the pipeline
--   • 210 calls with transcripts, summaries, and sentiment
--   • 27 campaigns (9 per org) with results
--   • 9 knowledge documents
--
-- All passwords: "demo123!"
-- SHA-256 hash:  a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767
-- (login route uses SHA-256 via Node crypto, not bcrypt)
--
-- Run against Supabase:
--   psql $DATABASE_URL -f frontend/src/lib/seed.sql
-- =============================================================================

BEGIN;

-- Clear existing seed data (safe order respecting FK constraints)
DELETE FROM audit_logs;
DELETE FROM api_keys;
DELETE FROM integrations;
DELETE FROM notification_rules;
DELETE FROM notifications;
DELETE FROM ab_test_results;
DELETE FROM ab_test_variants;
DELETE FROM ab_tests;
DELETE FROM document_embeddings;
DELETE FROM agent_knowledge_bases;
DELETE FROM knowledge_documents;
DELETE FROM campaign_results;
DELETE FROM campaign_leads;
DELETE FROM campaigns;
DELETE FROM call_sentiments;
DELETE FROM call_summaries;
DELETE FROM call_transcripts;
DELETE FROM call_recordings;
DELETE FROM calls;
DELETE FROM lead_qualifications;
DELETE FROM lead_interactions;
DELETE FROM leads;
DELETE FROM agent_configs;
DELETE FROM voice_agents;
DELETE FROM refresh_tokens;
DELETE FROM users;
DELETE FROM organizations;

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================
-- a01... = Apex Insurance Group     (enterprise, high performer)
-- a02... = Pacific Shield Insurance (professional, growing)
-- a03... = Heartland Coverage Co    (starter, niche/stable)

INSERT INTO organizations (id, name, slug, subscription_tier, settings) VALUES
  ('a0100000-0000-0000-0000-000000000001',
   'Apex Insurance Group',
   'apex-insurance',
   'enterprise',
   '{"timezone":"America/New_York","branding":{"primary_color":"#3b82f6"},"lines":["auto","home","life","commercial"],"story":"high_performer"}'
  ),
  ('a0200000-0000-0000-0000-000000000002',
   'Pacific Shield Insurance',
   'pacific-shield',
   'professional',
   '{"timezone":"America/Los_Angeles","branding":{"primary_color":"#10b981"},"lines":["auto","renters","health"],"story":"growing"}'
  ),
  ('a0300000-0000-0000-0000-000000000003',
   'Heartland Coverage Co',
   'heartland-coverage',
   'starter',
   '{"timezone":"America/Chicago","branding":{"primary_color":"#f59e0b"},"lines":["home","commercial","umbrella"],"story":"stable_niche"}'
  );

-- =============================================================================
-- USERS
-- Password hash is bcrypt of "demo123!"
-- =============================================================================

INSERT INTO users (id, organization_id, email, hashed_password, first_name, last_name, role) VALUES
  -- Platform superadmin (Apex org)
  ('b0100000-0000-0000-0000-000000000001','a0100000-0000-0000-0000-000000000001',
   'superadmin@retrevr.demo','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','Super','Admin','superadmin'),
  -- Apex team
  ('b0100000-0000-0000-0000-000000000002','a0100000-0000-0000-0000-000000000001',
   'sarah.chen@apexinsurance.com','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','Sarah','Chen','admin'),
  ('b0100000-0000-0000-0000-000000000003','a0100000-0000-0000-0000-000000000001',
   'marcus.johnson@apexinsurance.com','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','Marcus','Johnson','manager'),
  ('b0100000-0000-0000-0000-000000000004','a0100000-0000-0000-0000-000000000001',
   'emily.rodriguez@apexinsurance.com','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','Emily','Rodriguez','agent'),
  ('b0100000-0000-0000-0000-000000000005','a0100000-0000-0000-0000-000000000001',
   'jason.kim@apexinsurance.com','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','Jason','Kim','viewer'),
  -- Pacific Shield team
  ('b0200000-0000-0000-0000-000000000001','a0200000-0000-0000-0000-000000000002',
   'david.park@pacificshield.com','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','David','Park','admin'),
  ('b0200000-0000-0000-0000-000000000002','a0200000-0000-0000-0000-000000000002',
   'lisa.wang@pacificshield.com','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','Lisa','Wang','agent'),
  ('b0200000-0000-0000-0000-000000000003','a0200000-0000-0000-0000-000000000002',
   'carlos.mendez@pacificshield.com','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','Carlos','Mendez','agent'),
  -- Heartland team
  ('b0300000-0000-0000-0000-000000000001','a0300000-0000-0000-0000-000000000003',
   'mike.thompson@heartlandcoverage.com','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','Mike','Thompson','admin'),
  ('b0300000-0000-0000-0000-000000000002','a0300000-0000-0000-0000-000000000003',
   'nancy.whitfield@heartlandcoverage.com','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','Nancy','Whitfield','agent'),
  ('b0300000-0000-0000-0000-000000000003','a0300000-0000-0000-0000-000000000003',
   'bob.harris@heartlandcoverage.com','a4b68926dcbb3bb050605983391192bd2a2f3da552788e2d15f3c81816e53767','Bob','Harris','viewer');

-- =============================================================================
-- VOICE AGENTS
-- =============================================================================

INSERT INTO voice_agents (id, organization_id, name, persona, system_prompt, voice, status, vad_config) VALUES
  -- Apex: 3 agents
  ('c0100000-0000-0000-0000-000000000001','a0100000-0000-0000-0000-000000000001',
   'Alexis',
   'Warm, professional multi-line insurance advisor for Apex Insurance Group.',
   'You are Alexis, a senior advisor at Apex Insurance Group. You help customers with auto, home, and life insurance. Be warm but efficient. Always confirm name and policy number before discussing account details. Highlight multi-policy bundle discounts. Ask about life changes (new car, new baby, home purchase) that might affect coverage needs.',
   'nova','active',
   '{"mode":"server_vad","threshold":0.55,"prefix_padding_ms":300,"silence_duration_ms":800}'
  ),
  ('c0100000-0000-0000-0000-000000000002','a0100000-0000-0000-0000-000000000001',
   'Victor',
   'Direct commercial insurance specialist, focuses on business clients.',
   'You are Victor, a commercial lines specialist at Apex Insurance Group. You handle GL, commercial auto, workers comp, and BOP. Ask about business type, annual revenue, number of employees, and current coverage gaps early in the call. Be efficient — business owners value their time.',
   'onyx','active',
   '{"mode":"server_vad","threshold":0.5,"prefix_padding_ms":250,"silence_duration_ms":700}'
  ),
  ('c0100000-0000-0000-0000-000000000003','a0100000-0000-0000-0000-000000000001',
   'Serenity',
   'Empathetic claims intake specialist.',
   'You are Serenity, a claims intake specialist at Apex. Be calm and compassionate — customers calling to file claims are often stressed. Collect: date/time of incident, location, description of what happened, involved parties, police report number if applicable, and photos/documentation status. Provide claim number at end of call.',
   'shimmer','draft',
   '{"mode":"server_vad","threshold":0.6,"prefix_padding_ms":350,"silence_duration_ms":900}'
  ),
  -- Pacific Shield: 2 agents
  ('c0200000-0000-0000-0000-000000000001','a0200000-0000-0000-0000-000000000002',
   'Kai',
   'Bilingual (English/Spanish) auto and renters insurance advisor for West Coast markets.',
   'You are Kai, a bilingual insurance advisor at Pacific Shield Insurance serving the West Coast. Switch to Spanish if the customer prefers it. Focus on auto, renters, and health insurance. Be approachable and transparent about pricing. Many customers are young adults getting insurance for the first time — be educational without being condescending.',
   'echo','active',
   '{"mode":"server_vad","threshold":0.6,"prefix_padding_ms":300,"silence_duration_ms":800}'
  ),
  ('c0200000-0000-0000-0000-000000000002','a0200000-0000-0000-0000-000000000002',
   'Jordan',
   'Health insurance enrollment specialist.',
   'You are Jordan, a health insurance enrollment specialist at Pacific Shield. Help customers navigate health plan options, explain deductibles vs premiums tradeoffs, and assist with HDHP/HSA enrollment. Be patient — insurance terminology confuses many people. Use simple analogies.',
   'alloy','active',
   '{"mode":"server_vad","threshold":0.5,"prefix_padding_ms":300,"silence_duration_ms":850}'
  ),
  -- Heartland: 1 agent
  ('c0300000-0000-0000-0000-000000000001','a0300000-0000-0000-0000-000000000003',
   'Jake',
   'Friendly farm, ranch, and rural property insurance specialist.',
   'You are Jake, a farm and ranch insurance specialist at Heartland Coverage Co. You specialize in agricultural policies, crop insurance, rural property, and commercial umbrella for small businesses. Be friendly and down-to-earth. Ask about acreage, livestock, equipment value, and outbuildings. Understand seasonal business patterns.',
   'fable','active',
   '{"mode":"server_vad","threshold":0.5,"prefix_padding_ms":400,"silence_duration_ms":900}'
  );

-- Agent configs
INSERT INTO agent_configs (voice_agent_id, key, value) VALUES
  ('c0100000-0000-0000-0000-000000000001','insurance_lines','{"lines":["auto","home","life"],"max_duration_sec":900}'),
  ('c0100000-0000-0000-0000-000000000002','insurance_lines','{"lines":["commercial"],"max_duration_sec":1200}'),
  ('c0200000-0000-0000-0000-000000000001','insurance_lines','{"lines":["auto","renters"],"max_duration_sec":600}'),
  ('c0200000-0000-0000-0000-000000000002','insurance_lines','{"lines":["health"],"max_duration_sec":900}'),
  ('c0300000-0000-0000-0000-000000000001','insurance_lines','{"lines":["home","commercial","umbrella"],"max_duration_sec":1200}');

-- =============================================================================
-- KNOWLEDGE DOCUMENTS
-- =============================================================================

INSERT INTO knowledge_documents (id, organization_id, title, file_path, file_type, status) VALUES
  ('e0100000-0000-0000-0000-000000000001','a0100000-0000-0000-0000-000000000001',
   'Auto Insurance Policy Guide','docs/apex/auto-policy-guide.md','text/markdown','ready'),
  ('e0100000-0000-0000-0000-000000000002','a0100000-0000-0000-0000-000000000001',
   'Homeowners Coverage Explained','docs/apex/homeowners-guide.md','text/markdown','ready'),
  ('e0100000-0000-0000-0000-000000000003','a0100000-0000-0000-0000-000000000001',
   'Claims Filing FAQ','docs/apex/claims-faq.md','text/markdown','ready'),
  ('e0200000-0000-0000-0000-000000000001','a0200000-0000-0000-0000-000000000002',
   'Auto Insurance Basics for New Drivers','docs/pacific/auto-basics.md','text/markdown','ready'),
  ('e0200000-0000-0000-0000-000000000002','a0200000-0000-0000-0000-000000000002',
   'HDHP + HSA Explainer','docs/pacific/hdhp-hsa.md','text/markdown','ready'),
  ('e0200000-0000-0000-0000-000000000003','a0200000-0000-0000-0000-000000000002',
   'Renters Insurance Checklist','docs/pacific/renters-checklist.md','text/markdown','ready'),
  ('e0300000-0000-0000-0000-000000000001','a0300000-0000-0000-0000-000000000003',
   'Farm & Ranch Coverage Overview','docs/heartland/farm-ranch.md','text/markdown','ready'),
  ('e0300000-0000-0000-0000-000000000002','a0300000-0000-0000-0000-000000000003',
   'Commercial Umbrella Policy Guide','docs/heartland/umbrella.md','text/markdown','ready'),
  ('e0300000-0000-0000-0000-000000000003','a0300000-0000-0000-0000-000000000003',
   'Crop Insurance Programs 2024','docs/heartland/crop-insurance.md','text/markdown','ready');

-- Link knowledge docs to voice agents
INSERT INTO agent_knowledge_bases (voice_agent_id, knowledge_document_id) VALUES
  ('c0100000-0000-0000-0000-000000000001','e0100000-0000-0000-0000-000000000001'),
  ('c0100000-0000-0000-0000-000000000001','e0100000-0000-0000-0000-000000000002'),
  ('c0100000-0000-0000-0000-000000000001','e0100000-0000-0000-0000-000000000003'),
  ('c0100000-0000-0000-0000-000000000002','e0100000-0000-0000-0000-000000000003'),
  ('c0200000-0000-0000-0000-000000000001','e0200000-0000-0000-0000-000000000001'),
  ('c0200000-0000-0000-0000-000000000001','e0200000-0000-0000-0000-000000000003'),
  ('c0200000-0000-0000-0000-000000000002','e0200000-0000-0000-0000-000000000002'),
  ('c0300000-0000-0000-0000-000000000001','e0300000-0000-0000-0000-000000000001'),
  ('c0300000-0000-0000-0000-000000000001','e0300000-0000-0000-0000-000000000002'),
  ('c0300000-0000-0000-0000-000000000001','e0300000-0000-0000-0000-000000000003');

-- =============================================================================
-- LEADS (75 total)
-- Apex: 35 leads — high performer, more bound/quoted
-- Pacific: 25 leads — growing, more new/contacted
-- Heartland: 15 leads — stable niche
-- =============================================================================

INSERT INTO leads (id, organization_id, first_name, last_name, email, phone, insurance_type, status, propensity_score, metadata, created_at) VALUES
-- ── Apex leads (d01xx) ──────────────────────────────────────────────────────
('d0100000-0000-0000-0000-000000000001','a0100000-0000-0000-0000-000000000001','James','Wilson','james.wilson@email.com','+15550101','auto','bound',0.95,'{"source":"referral","zip":"10001"}',NOW()-INTERVAL'85 days'),
('d0100000-0000-0000-0000-000000000002','a0100000-0000-0000-0000-000000000001','Maria','Garcia','maria.garcia@gmail.com','+15550102','home','bound',0.92,'{"source":"website","zip":"10002"}',NOW()-INTERVAL'80 days'),
('d0100000-0000-0000-0000-000000000003','a0100000-0000-0000-0000-000000000001','Robert','Taylor','robert.taylor@yahoo.com','+15550103','life','quoted',0.78,'{"source":"cold_call","zip":"10003"}',NOW()-INTERVAL'75 days'),
('d0100000-0000-0000-0000-000000000004','a0100000-0000-0000-0000-000000000001','Jennifer','Martinez','jennifer.m@outlook.com','+15550104','auto','bound',0.90,'{"source":"referral","zip":"10004"}',NOW()-INTERVAL'72 days'),
('d0100000-0000-0000-0000-000000000005','a0100000-0000-0000-0000-000000000001','Michael','Brown','michael.brown@icloud.com','+15550105','home','quoted',0.82,'{"source":"website","zip":"10005"}',NOW()-INTERVAL'68 days'),
('d0100000-0000-0000-0000-000000000006','a0100000-0000-0000-0000-000000000001','Patricia','Davis','patricia.d@email.com','+15550106','life','bound',0.88,'{"source":"referral","zip":"10006"}',NOW()-INTERVAL'65 days'),
('d0100000-0000-0000-0000-000000000007','a0100000-0000-0000-0000-000000000001','Linda','Anderson','linda.anderson@gmail.com','+15550107','auto','qualified',0.72,'{"source":"web_form","zip":"10007"}',NOW()-INTERVAL'60 days'),
('d0100000-0000-0000-0000-000000000008','a0100000-0000-0000-0000-000000000001','William','Thomas','wthomas@outlook.com','+15550108','commercial','quoted',0.80,'{"source":"referral","zip":"10008"}',NOW()-INTERVAL'58 days'),
('d0100000-0000-0000-0000-000000000009','a0100000-0000-0000-0000-000000000001','Barbara','Jackson','bjackson@yahoo.com','+15550109','home','bound',0.94,'{"source":"referral","zip":"10009"}',NOW()-INTERVAL'55 days'),
('d0100000-0000-0000-0000-000000000010','a0100000-0000-0000-0000-000000000001','Charles','White','cwhite@gmail.com','+15550110','auto','contacted',0.55,'{"source":"social","zip":"10010"}',NOW()-INTERVAL'52 days'),
('d0100000-0000-0000-0000-000000000011','a0100000-0000-0000-0000-000000000001','Susan','Harris','sharris@email.com','+15550111','life','qualified',0.68,'{"source":"web_form","zip":"10011"}',NOW()-INTERVAL'50 days'),
('d0100000-0000-0000-0000-000000000012','a0100000-0000-0000-0000-000000000001','Joseph','Lewis','jlewis@icloud.com','+15550112','auto','bound',0.91,'{"source":"referral","zip":"10012"}',NOW()-INTERVAL'48 days'),
('d0100000-0000-0000-0000-000000000013','a0100000-0000-0000-0000-000000000001','Karen','Robinson','krobinson@outlook.com','+15550113','home','quoted',0.76,'{"source":"website","zip":"10013"}',NOW()-INTERVAL'45 days'),
('d0100000-0000-0000-0000-000000000014','a0100000-0000-0000-0000-000000000001','Donald','Walker','dwalker@gmail.com','+15550114','commercial','qualified',0.70,'{"source":"cold_call","zip":"10014"}',NOW()-INTERVAL'42 days'),
('d0100000-0000-0000-0000-000000000015','a0100000-0000-0000-0000-000000000001','Nancy','Hall','nhall@yahoo.com','+15550115','life','contacted',0.48,'{"source":"social","zip":"10015"}',NOW()-INTERVAL'40 days'),
('d0100000-0000-0000-0000-000000000016','a0100000-0000-0000-0000-000000000001','Mark','Young','myoung@email.com','+15550116','auto','new',0.35,'{"source":"website","zip":"10016"}',NOW()-INTERVAL'38 days'),
('d0100000-0000-0000-0000-000000000017','a0100000-0000-0000-0000-000000000001','Betty','Allen','ballen@gmail.com','+15550117','home','bound',0.89,'{"source":"referral","zip":"10017"}',NOW()-INTERVAL'35 days'),
('d0100000-0000-0000-0000-000000000018','a0100000-0000-0000-0000-000000000001','George','King','gking@icloud.com','+15550118','auto','quoted',0.74,'{"source":"website","zip":"10018"}',NOW()-INTERVAL'32 days'),
('d0100000-0000-0000-0000-000000000019','a0100000-0000-0000-0000-000000000001','Ruth','Wright','rwright@outlook.com','+15550119','life','qualified',0.65,'{"source":"web_form","zip":"10019"}',NOW()-INTERVAL'30 days'),
('d0100000-0000-0000-0000-000000000020','a0100000-0000-0000-0000-000000000001','Steven','Scott','sscott@yahoo.com','+15550120','commercial','bound',0.87,'{"source":"referral","zip":"10020"}',NOW()-INTERVAL'28 days'),
('d0100000-0000-0000-0000-000000000021','a0100000-0000-0000-0000-000000000001','Dorothy','Green','dgreen@gmail.com','+15550121','auto','contacted',0.52,'{"source":"cold_call","zip":"10021"}',NOW()-INTERVAL'25 days'),
('d0100000-0000-0000-0000-000000000022','a0100000-0000-0000-0000-000000000001','Paul','Adams','padams@email.com','+15550122','home','lost',0.25,'{"source":"website","zip":"10022"}',NOW()-INTERVAL'22 days'),
('d0100000-0000-0000-0000-000000000023','a0100000-0000-0000-0000-000000000001','Sharon','Baker','sbaker@outlook.com','+15550123','auto','new',0.40,'{"source":"social","zip":"10023"}',NOW()-INTERVAL'20 days'),
('d0100000-0000-0000-0000-000000000024','a0100000-0000-0000-0000-000000000001','Andrew','Nelson','anelson@icloud.com','+15550124','life','bound',0.93,'{"source":"referral","zip":"10024"}',NOW()-INTERVAL'18 days'),
('d0100000-0000-0000-0000-000000000025','a0100000-0000-0000-0000-000000000001','Cynthia','Carter','ccarter@gmail.com','+15550125','auto','qualified',0.69,'{"source":"website","zip":"10025"}',NOW()-INTERVAL'15 days'),
('d0100000-0000-0000-0000-000000000026','a0100000-0000-0000-0000-000000000001','Kenneth','Mitchell','kmitchell@yahoo.com','+15550126','home','quoted',0.77,'{"source":"web_form","zip":"10026"}',NOW()-INTERVAL'12 days'),
('d0100000-0000-0000-0000-000000000027','a0100000-0000-0000-0000-000000000001','Angela','Roberts','aroberts@email.com','+15550127','commercial','contacted',0.58,'{"source":"referral","zip":"10027"}',NOW()-INTERVAL'10 days'),
('d0100000-0000-0000-0000-000000000028','a0100000-0000-0000-0000-000000000001','Joshua','Turner','jturner@gmail.com','+15550128','auto','new',0.32,'{"source":"social","zip":"10028"}',NOW()-INTERVAL'8 days'),
('d0100000-0000-0000-0000-000000000029','a0100000-0000-0000-0000-000000000001','Melissa','Phillips','mphillips@outlook.com','+15550129','life','quoted',0.81,'{"source":"referral","zip":"10029"}',NOW()-INTERVAL'6 days'),
('d0100000-0000-0000-0000-000000000030','a0100000-0000-0000-0000-000000000001','Raymond','Campbell','rcampbell@icloud.com','+15550130','home','bound',0.96,'{"source":"referral","zip":"10030"}',NOW()-INTERVAL'4 days'),
('d0100000-0000-0000-0000-000000000031','a0100000-0000-0000-0000-000000000001','Laura','Evans','levans@gmail.com','+15550131','auto','contacted',0.50,'{"source":"cold_call","zip":"10031"}',NOW()-INTERVAL'3 days'),
('d0100000-0000-0000-0000-000000000032','a0100000-0000-0000-0000-000000000001','Eric','Collins','ecollins@yahoo.com','+15550132','commercial','qualified',0.73,'{"source":"website","zip":"10032"}',NOW()-INTERVAL'2 days'),
('d0100000-0000-0000-0000-000000000033','a0100000-0000-0000-0000-000000000001','Donna','Stewart','dstewart@email.com','+15550133','auto','new',0.28,'{"source":"social","zip":"10033"}',NOW()-INTERVAL'1 day'),
('d0100000-0000-0000-0000-000000000034','a0100000-0000-0000-0000-000000000001','Jack','Sanchez','jsanchez@outlook.com','+15550134','home','lost',0.22,'{"source":"website","zip":"10034"}',NOW()-INTERVAL'14 days'),
('d0100000-0000-0000-0000-000000000035','a0100000-0000-0000-0000-000000000001','Carol','Morris','cmorris@gmail.com','+15550135','life','new',0.38,'{"source":"web_form","zip":"10035"}',NOW()-INTERVAL'5 days'),
-- ── Pacific Shield leads (d02xx) ────────────────────────────────────────────
('d0200000-0000-0000-0000-000000000001','a0200000-0000-0000-0000-000000000002','David','Lee','david.lee@gmail.com','+15550201','auto','new',0.40,'{"source":"social","zip":"90210"}',NOW()-INTERVAL'40 days'),
('d0200000-0000-0000-0000-000000000002','a0200000-0000-0000-0000-000000000002','Jennifer','Patel','jen.patel@yahoo.com','+15550202','renters','contacted',0.55,'{"source":"website","zip":"90211"}',NOW()-INTERVAL'35 days'),
('d0200000-0000-0000-0000-000000000003','a0200000-0000-0000-0000-000000000002','Miguel','Flores','mflores@email.com','+15550203','auto','qualified',0.68,'{"source":"referral","zip":"90212"}',NOW()-INTERVAL'30 days'),
('d0200000-0000-0000-0000-000000000004','a0200000-0000-0000-0000-000000000002','Ashley','Nguyen','anguyen@outlook.com','+15550204','health','new',0.35,'{"source":"web_form","zip":"90213"}',NOW()-INTERVAL'28 days'),
('d0200000-0000-0000-0000-000000000005','a0200000-0000-0000-0000-000000000002','Kevin','Ramirez','kramirez@icloud.com','+15550205','auto','contacted',0.52,'{"source":"cold_call","zip":"90214"}',NOW()-INTERVAL'25 days'),
('d0200000-0000-0000-0000-000000000006','a0200000-0000-0000-0000-000000000002','Amanda','Torres','atorres@gmail.com','+15550206','renters','bound',0.85,'{"source":"referral","zip":"90215"}',NOW()-INTERVAL'22 days'),
('d0200000-0000-0000-0000-000000000007','a0200000-0000-0000-0000-000000000002','Brian','Rivera','brivera@yahoo.com','+15550207','auto','qualified',0.70,'{"source":"website","zip":"90216"}',NOW()-INTERVAL'20 days'),
('d0200000-0000-0000-0000-000000000008','a0200000-0000-0000-0000-000000000002','Stephanie','Murphy','smurphy@email.com','+15550208','health','contacted',0.48,'{"source":"social","zip":"90217"}',NOW()-INTERVAL'18 days'),
('d0200000-0000-0000-0000-000000000009','a0200000-0000-0000-0000-000000000002','Timothy','Cook','tcook@outlook.com','+15550209','auto','new',0.30,'{"source":"web_form","zip":"90218"}',NOW()-INTERVAL'15 days'),
('d0200000-0000-0000-0000-000000000010','a0200000-0000-0000-0000-000000000002','Nicole','Rogers','nrogers@gmail.com','+15550210','renters','quoted',0.74,'{"source":"referral","zip":"90219"}',NOW()-INTERVAL'12 days'),
('d0200000-0000-0000-0000-000000000011','a0200000-0000-0000-0000-000000000002','Anthony','Reed','areed@icloud.com','+15550211','auto','contacted',0.57,'{"source":"cold_call","zip":"90220"}',NOW()-INTERVAL'10 days'),
('d0200000-0000-0000-0000-000000000012','a0200000-0000-0000-0000-000000000002','Rebecca','Bell','rbell@yahoo.com','+15550212','health','new',0.42,'{"source":"website","zip":"90221"}',NOW()-INTERVAL'8 days'),
('d0200000-0000-0000-0000-000000000013','a0200000-0000-0000-0000-000000000002','Ryan','Howard','rhoward@email.com','+15550213','auto','qualified',0.66,'{"source":"referral","zip":"90222"}',NOW()-INTERVAL'6 days'),
('d0200000-0000-0000-0000-000000000014','a0200000-0000-0000-0000-000000000002','Samantha','Ward','sward@outlook.com','+15550214','renters','new',0.38,'{"source":"social","zip":"90223"}',NOW()-INTERVAL'4 days'),
('d0200000-0000-0000-0000-000000000015','a0200000-0000-0000-0000-000000000002','Gregory','Cox','gcox@gmail.com','+15550215','auto','bound',0.88,'{"source":"referral","zip":"90224"}',NOW()-INTERVAL'3 days'),
('d0200000-0000-0000-0000-000000000016','a0200000-0000-0000-0000-000000000002','Kimberly','Hughes','khughes@icloud.com','+15550216','health','contacted',0.53,'{"source":"web_form","zip":"90225"}',NOW()-INTERVAL'2 days'),
('d0200000-0000-0000-0000-000000000017','a0200000-0000-0000-0000-000000000002','Patrick','Price','pprice@yahoo.com','+15550217','auto','new',0.29,'{"source":"social","zip":"90226"}',NOW()-INTERVAL'1 day'),
('d0200000-0000-0000-0000-000000000018','a0200000-0000-0000-0000-000000000002','Christine','Myers','cmyers@email.com','+15550218','renters','lost',0.20,'{"source":"website","zip":"90227"}',NOW()-INTERVAL'45 days'),
('d0200000-0000-0000-0000-000000000019','a0200000-0000-0000-0000-000000000002','Jonathan','Long','jlong@outlook.com','+15550219','auto','qualified',0.71,'{"source":"referral","zip":"90228"}',NOW()-INTERVAL'20 days'),
('d0200000-0000-0000-0000-000000000020','a0200000-0000-0000-0000-000000000002','Pamela','Ross','pross@gmail.com','+15550220','health','new',0.36,'{"source":"web_form","zip":"90229"}',NOW()-INTERVAL'7 days'),
('d0200000-0000-0000-0000-000000000021','a0200000-0000-0000-0000-000000000002','Scott','Foster','sfoster@yahoo.com','+15550221','auto','contacted',0.61,'{"source":"cold_call","zip":"90230"}',NOW()-INTERVAL'11 days'),
('d0200000-0000-0000-0000-000000000022','a0200000-0000-0000-0000-000000000002','Emma','Jimenez','ejimenez@icloud.com','+15550222','renters','qualified',0.67,'{"source":"website","zip":"90231"}',NOW()-INTERVAL'9 days'),
('d0200000-0000-0000-0000-000000000023','a0200000-0000-0000-0000-000000000002','Brandon','Powell','bpowell@email.com','+15550223','auto','new',0.33,'{"source":"social","zip":"90232"}',NOW()-INTERVAL'3 days'),
('d0200000-0000-0000-0000-000000000024','a0200000-0000-0000-0000-000000000002','Melissa','Jenkins','mjenkins@outlook.com','+15550224','health','contacted',0.50,'{"source":"web_form","zip":"90233"}',NOW()-INTERVAL'5 days'),
('d0200000-0000-0000-0000-000000000025','a0200000-0000-0000-0000-000000000002','Jeffrey','Perry','jperry@gmail.com','+15550225','auto','quoted',0.75,'{"source":"referral","zip":"90234"}',NOW()-INTERVAL'16 days'),
-- ── Heartland leads (d03xx) ─────────────────────────────────────────────────
('d0300000-0000-0000-0000-000000000001','a0300000-0000-0000-0000-000000000003','Thomas','Russell','trussell@email.com','+15550301','home','bound',0.90,'{"source":"referral","zip":"60601"}',NOW()-INTERVAL'70 days'),
('d0300000-0000-0000-0000-000000000002','a0300000-0000-0000-0000-000000000003','Sandra','Sullivan','ssullivan@gmail.com','+15550302','commercial','quoted',0.78,'{"source":"website","zip":"60602"}',NOW()-INTERVAL'55 days'),
('d0300000-0000-0000-0000-000000000003','a0300000-0000-0000-0000-000000000003','Henry','Bell','hbell@yahoo.com','+15550303','home','qualified',0.65,'{"source":"cold_call","zip":"60603"}',NOW()-INTERVAL'40 days'),
('d0300000-0000-0000-0000-000000000004','a0300000-0000-0000-0000-000000000003','Margaret','Coleman','mcoleman@outlook.com','+15550304','umbrella','contacted',0.55,'{"source":"web_form","zip":"60604"}',NOW()-INTERVAL'30 days'),
('d0300000-0000-0000-0000-000000000005','a0300000-0000-0000-0000-000000000003','Arthur','Butler','abutler@icloud.com','+15550305','commercial','bound',0.88,'{"source":"referral","zip":"60605"}',NOW()-INTERVAL'22 days'),
('d0300000-0000-0000-0000-000000000006','a0300000-0000-0000-0000-000000000003','Diane','Henderson','dhenderson@gmail.com','+15550306','home','new',0.40,'{"source":"social","zip":"60606"}',NOW()-INTERVAL'15 days'),
('d0300000-0000-0000-0000-000000000007','a0300000-0000-0000-0000-000000000003','Walter','Barnes','wbarnes@yahoo.com','+15550307','commercial','qualified',0.72,'{"source":"website","zip":"60607"}',NOW()-INTERVAL'10 days'),
('d0300000-0000-0000-0000-000000000008','a0300000-0000-0000-0000-000000000003','Brenda','Patterson','bpatterson@email.com','+15550308','umbrella','quoted',0.80,'{"source":"referral","zip":"60608"}',NOW()-INTERVAL'6 days'),
('d0300000-0000-0000-0000-000000000009','a0300000-0000-0000-0000-000000000003','Harold','Cooper','hcooper@outlook.com','+15550309','home','contacted',0.48,'{"source":"cold_call","zip":"60609"}',NOW()-INTERVAL'4 days'),
('d0300000-0000-0000-0000-000000000010','a0300000-0000-0000-0000-000000000003','Virginia','Richardson','vrichardson@gmail.com','+15550310','commercial','new',0.32,'{"source":"web_form","zip":"60610"}',NOW()-INTERVAL'2 days'),
('d0300000-0000-0000-0000-000000000011','a0300000-0000-0000-0000-000000000003','Eugene','Watson','ewatson@icloud.com','+15550311','home','bound',0.92,'{"source":"referral","zip":"60611"}',NOW()-INTERVAL'35 days'),
('d0300000-0000-0000-0000-000000000012','a0300000-0000-0000-0000-000000000003','Florence','Brooks','fbrooks@yahoo.com','+15550312','umbrella','lost',0.18,'{"source":"website","zip":"60612"}',NOW()-INTERVAL'50 days'),
('d0300000-0000-0000-0000-000000000013','a0300000-0000-0000-0000-000000000003','Roy','Chavez','rchavez@email.com','+15550313','commercial','qualified',0.69,'{"source":"cold_call","zip":"60613"}',NOW()-INTERVAL'18 days'),
('d0300000-0000-0000-0000-000000000014','a0300000-0000-0000-0000-000000000003','Evelyn','Wood','ewood@outlook.com','+15550314','home','quoted',0.76,'{"source":"referral","zip":"60614"}',NOW()-INTERVAL'8 days'),
('d0300000-0000-0000-0000-000000000015','a0300000-0000-0000-0000-000000000003','Carl','James','cjames@gmail.com','+15550315','commercial','new',0.37,'{"source":"social","zip":"60615"}',NOW()-INTERVAL'1 day');

-- =============================================================================
-- CALLS (210 total)
-- Using a generate_series approach for bulk insertion
-- Apex: ~90 calls  |  Pacific: ~75 calls  |  Heartland: ~45 calls
-- =============================================================================

-- ── Apex calls: completed inbound (auto quotes, home renewals, life inquiries) ──
INSERT INTO calls (id, organization_id, agent_id, lead_id, direction, status, duration, phone_from, phone_to, twilio_sid, sentiment_score, created_at)
SELECT
  ('f0100000-0000-0000-00' || LPAD(gs::text, 2, '0') || '-000000000001')::uuid,
  'a0100000-0000-0000-0000-000000000001',
  'c0100000-0000-0000-0000-000000000001',
  CASE WHEN gs <= 35
    THEN ('d0100000-0000-0000-0000-0000000000' || LPAD(gs::text, 2, '0'))::uuid
    ELSE NULL
  END,
  'inbound',
  'completed',
  180 + (gs * 7 % 540),
  '+1555' || LPAD((1000 + gs)::text, 7, '0'),
  '+18005551000',
  'CA' || MD5(gs::text || 'apex_in'),
  0.55 + (gs % 45) * 0.01,
  NOW() - INTERVAL'1 day' * (90 - gs)
FROM generate_series(1, 45) gs;

-- Apex calls: outbound renewal/follow-up
INSERT INTO calls (id, organization_id, agent_id, lead_id, direction, status, duration, phone_from, phone_to, twilio_sid, sentiment_score, created_at)
SELECT
  ('f0100000-0000-0000-00' || LPAD(gs::text, 2, '0') || '-000000000002')::uuid,
  'a0100000-0000-0000-0000-000000000001',
  'c0100000-0000-0000-0000-000000000002',
  CASE WHEN gs <= 20
    THEN ('d0100000-0000-0000-0000-0000000000' || LPAD(gs::text, 2, '0'))::uuid
    ELSE NULL
  END,
  'outbound',
  CASE WHEN gs % 5 = 0 THEN 'no-answer'
       WHEN gs % 7 = 0 THEN 'busy'
       ELSE 'completed' END,
  CASE WHEN gs % 5 = 0 THEN 10 WHEN gs % 7 = 0 THEN 8 ELSE 120 + (gs * 11 % 480) END,
  '+18005551001',
  '+1555' || LPAD((2000 + gs)::text, 7, '0'),
  'CA' || MD5(gs::text || 'apex_out'),
  CASE WHEN gs % 5 = 0 OR gs % 7 = 0 THEN NULL ELSE 0.45 + (gs % 50) * 0.01 END,
  NOW() - INTERVAL'1 day' * (88 - gs * 2)
FROM generate_series(1, 45) gs;

-- ── Pacific Shield calls ──────────────────────────────────────────────────
INSERT INTO calls (id, organization_id, agent_id, lead_id, direction, status, duration, phone_from, phone_to, twilio_sid, sentiment_score, created_at)
SELECT
  ('f0200000-0000-0000-00' || LPAD(gs::text, 2, '0') || '-000000000001')::uuid,
  'a0200000-0000-0000-0000-000000000002',
  'c0200000-0000-0000-0000-000000000001',
  CASE WHEN gs <= 25
    THEN ('d0200000-0000-0000-0000-0000000000' || LPAD(gs::text, 2, '0'))::uuid
    ELSE NULL
  END,
  CASE WHEN gs % 3 = 0 THEN 'outbound' ELSE 'inbound' END,
  CASE WHEN gs % 6 = 0 THEN 'no-answer' ELSE 'completed' END,
  CASE WHEN gs % 6 = 0 THEN 12 ELSE 150 + (gs * 9 % 450) END,
  CASE WHEN gs % 3 = 0 THEN '+18005552000' ELSE '+1555' || LPAD((3000 + gs)::text, 7, '0') END,
  CASE WHEN gs % 3 = 0 THEN '+1555' || LPAD((3000 + gs)::text, 7, '0') ELSE '+18005552000' END,
  'CA' || MD5(gs::text || 'pacific'),
  CASE WHEN gs % 6 = 0 THEN NULL ELSE 0.50 + (gs % 48) * 0.01 END,
  NOW() - INTERVAL'1 day' * (85 - gs * 2)
FROM generate_series(1, 37) gs;

-- Pacific Shield health calls (agent Jordan)
INSERT INTO calls (id, organization_id, agent_id, lead_id, direction, status, duration, phone_from, phone_to, twilio_sid, sentiment_score, created_at)
SELECT
  ('f0200000-0000-0000-00' || LPAD(gs::text, 2, '0') || '-000000000002')::uuid,
  'a0200000-0000-0000-0000-000000000002',
  'c0200000-0000-0000-0000-000000000002',
  CASE WHEN gs <= 10
    THEN ('d0200000-0000-0000-0000-0000000000' || LPAD((gs + 3)::text, 2, '0'))::uuid
    ELSE NULL
  END,
  'inbound',
  CASE WHEN gs % 8 = 0 THEN 'failed' ELSE 'completed' END,
  CASE WHEN gs % 8 = 0 THEN 5 ELSE 300 + (gs * 15 % 420) END,
  '+1555' || LPAD((4000 + gs)::text, 7, '0'),
  '+18005552001',
  'CA' || MD5(gs::text || 'pacific_health'),
  CASE WHEN gs % 8 = 0 THEN NULL ELSE 0.60 + (gs % 38) * 0.01 END,
  NOW() - INTERVAL'1 day' * (60 - gs * 3)
FROM generate_series(1, 20) gs;

-- ── Heartland calls ───────────────────────────────────────────────────────
INSERT INTO calls (id, organization_id, agent_id, lead_id, direction, status, duration, phone_from, phone_to, twilio_sid, sentiment_score, created_at)
SELECT
  ('f0300000-0000-0000-00' || LPAD(gs::text, 2, '0') || '-000000000001')::uuid,
  'a0300000-0000-0000-0000-000000000003',
  'c0300000-0000-0000-0000-000000000001',
  CASE WHEN gs <= 15
    THEN ('d0300000-0000-0000-0000-0000000000' || LPAD(gs::text, 2, '0'))::uuid
    ELSE NULL
  END,
  CASE WHEN gs % 4 = 0 THEN 'outbound' ELSE 'inbound' END,
  CASE WHEN gs % 9 = 0 THEN 'no-answer' WHEN gs % 11 = 0 THEN 'busy' ELSE 'completed' END,
  CASE WHEN gs % 9 = 0 OR gs % 11 = 0 THEN 8 ELSE 240 + (gs * 17 % 600) END,
  CASE WHEN gs % 4 = 0 THEN '+18005553000' ELSE '+1555' || LPAD((5000 + gs)::text, 7, '0') END,
  CASE WHEN gs % 4 = 0 THEN '+1555' || LPAD((5000 + gs)::text, 7, '0') ELSE '+18005553000' END,
  'CA' || MD5(gs::text || 'heartland'),
  CASE WHEN gs % 9 = 0 OR gs % 11 = 0 THEN NULL ELSE 0.52 + (gs % 42) * 0.01 END,
  NOW() - INTERVAL'1 day' * (80 - gs * 2)
FROM generate_series(1, 45) gs;

-- =============================================================================
-- CALL TRANSCRIPTS (for completed calls with good sentiment)
-- =============================================================================

-- Transcript for first 15 Apex inbound calls
INSERT INTO call_transcripts (call_id, transcript, language, created_at)
SELECT
  c.id,
  CASE gs % 5
    WHEN 0 THEN 'Agent: Thank you for calling Apex Insurance Group, my name is Alexis. How can I help you today?
Customer: Hi Alexis, I''m calling about an auto insurance quote. My policy renews next month.
Agent: Of course! I''d be happy to help. Can I get your name and zip code to get started?
Customer: Sure, it''s ' || first_name || ' ' || last_name || ', and I''m in zip ' || substr(metadata::text, position('"zip":"' in metadata::text) + 7, 5) || '.
Agent: Perfect. And what vehicle are you looking to insure?
Customer: 2022 Honda Civic.
Agent: Great choice. Any accidents or violations in the past three years?
Customer: No, clean record.
Agent: Excellent. For a 2022 Civic with comprehensive coverage, I can offer $138 per month or $1,560 annually.
Customer: That sounds competitive. Can you email me the quote?
Agent: Absolutely. Is there anything else I can help you with today?
Customer: No, that covers it. Thank you Alexis.
Agent: My pleasure. Have a wonderful day!'
    WHEN 1 THEN 'Agent: Apex Insurance, this is Alexis speaking.
Customer: Hi, I need to update my home insurance. I just finished a kitchen renovation.
Agent: Congratulations on the renovation! Yes, that can affect your coverage. May I have your policy number?
Customer: It''s APX-' || (100000 + gs * 7) || '.
Agent: I have your account pulled up. The renovation — what was the total cost?
Customer: About $45,000. Added a new island, appliances, custom cabinets.
Agent: That''s a significant improvement. We should increase your dwelling coverage to reflect the added value. I''d recommend adding about $50,000 in coverage, which would increase your premium by roughly $18 per month.
Customer: That seems reasonable. Let''s do it.
Agent: I''ll process that update now. You''ll receive confirmation by email within 2 hours.
Customer: Perfect, thank you.'
    WHEN 2 THEN 'Agent: Thank you for holding, this is Alexis at Apex Insurance.
Customer: Hi, I''m calling because I just had a baby and I think I need to update my life insurance.
Agent: Congratulations! That''s such wonderful news. Yes, a new family member is definitely a reason to revisit coverage. What policy do you currently have?
Customer: I have a term policy, $250,000 coverage.
Agent: For a new parent, many financial advisors recommend at least 10-12 times your income. What''s your rough annual income if you don''t mind?
Customer: Around $75,000.
Agent: So ideally you''d want $750,000 to $900,000 in coverage. Increasing your current policy or adding a second term policy would be straightforward. What''s your current age?
Customer: 31.
Agent: Non-smoker I assume?
Customer: Yes.
Agent: Great. An additional $500,000 20-year term would run about $22 per month. Would you like to start an application?
Customer: Yes, let''s do that.'
    WHEN 3 THEN 'Agent: Apex Insurance, how can I help you?
Customer: I got a renewal notice and the price went up $40 a month. That seems like a lot.
Agent: I understand your concern. Let me pull up your policy. May I have your name?
Customer: ' || first_name || ' ' || last_name || '.
Agent: Thank you. I can see your policy. The increase is due to a combination of rising replacement costs in your area and your policy coming off an introductory rate. Let me see what discounts I can apply. Do you have any other policies with us?
Customer: No, just the auto.
Agent: Adding homeowners insurance would give you a 10% multi-policy discount. We also have a telematics program where safe driving earns up to 25% back. That could more than offset the increase.
Customer: The telematics thing, does it track everything?
Agent: Just basic driving metrics — speed, braking, time of day. Nothing invasive. Many customers find it saves them $200-400 a year.
Customer: Okay, I''m willing to try it.
Agent: I''ll enroll you now and send you the app download link.'
    ELSE 'Agent: Good morning, Apex Insurance Group. My name is Alexis.
Customer: Hi, I''m interested in commercial insurance for my landscaping business.
Agent: I''d be happy to help. Can you tell me a bit about your business? Number of employees, annual revenue, and vehicles?
Customer: 6 employees, about $600,000 revenue, and 3 trucks.
Agent: Any claims in the past 3 years?
Customer: One small claim, a client''s fence got nicked. Under $2,000.
Agent: Minor claim, below threshold. For your size, general liability and commercial auto combined typically runs $3,800 to $5,200 annually. We can also quote workers comp separately.
Customer: Let''s get the full package. What do you need from me?
Agent: I''ll need your FEIN, loss runs from your current carrier, and a list of vehicle VINs. I can email you a checklist.
Customer: Perfect, please do.'
  END,
  'en-US',
  c.created_at + INTERVAL'5 minutes'
FROM generate_series(1, 15) gs
JOIN leads l ON l.id = ('d0100000-0000-0000-0000-0000000000' || LPAD(gs::text, 2, '0'))::uuid
JOIN calls c ON c.id = ('f0100000-0000-0000-00' || LPAD(gs::text, 2, '0') || '-000000000001')::uuid;

-- Transcripts for first 10 Pacific Shield inbound completed calls
INSERT INTO call_transcripts (call_id, transcript, language, created_at)
SELECT
  c.id,
  CASE gs % 3
    WHEN 0 THEN 'Agent: Pacific Shield Insurance, this is Kai. How can I help you today?
Customer: Hi, I just moved to LA and need to get auto insurance. This is my first time.
Agent: Welcome to California! Getting auto insurance is mandatory here so you''re doing the right thing. May I ask your age and driving history?
Customer: I''m 24, got my license two years ago, no accidents.
Agent: Good start. California requires minimum liability, but I''d recommend full coverage especially as a newer driver. What car do you have?
Customer: A 2021 Toyota Corolla.
Agent: Nice reliable car. Full coverage on a 2021 Corolla with your profile would be around $145-165 per month. Liability-only would be $89-95.
Customer: What''s the difference?
Agent: Liability covers damage you cause to others. Full coverage also covers damage to your own car from accidents, theft, weather, etc. On a newer car, full coverage is usually worth it.
Customer: I''ll go with full coverage.
Agent: Smart choice. Let me get your information and we can start the application.'
    WHEN 1 THEN 'Agent: Pacific Shield, Kai speaking.
Customer: Hi, I''m a student renting an apartment and my landlord just told me I need renters insurance.
Agent: Yes, many landlords require it now. The good news is renters insurance is very affordable — typically $12-20 a month for good coverage.
Customer: What does it cover?
Agent: Three main things: your personal property if it''s stolen or damaged, personal liability if someone gets hurt in your apartment, and additional living expenses if you have to move out temporarily after a covered event.
Customer: My laptop alone is worth $1,500. Would that be covered?
Agent: Yes, electronics are covered. You''d choose a coverage limit for your belongings — most renters choose $20,000-$30,000 which is more than enough. With a $500 deductible that runs about $14 a month.
Customer: That''s less than I expected. Let''s sign up.
Agent: Excellent. I just need your address and I can have a policy ready in minutes.'
    ELSE 'Agent: Pacific Shield Insurance, Jordan speaking.
Customer: Hi, I need to enroll in health insurance through my new job and I''m confused about the options.
Agent: No worries, I''ll walk you through it. What plans are available to you?
Customer: There''s a PPO and an HDHP with an HSA. My employer contributes $500 to the HSA.
Agent: Great employer contribution! Are you generally healthy? How often do you see doctors?
Customer: Pretty healthy. Maybe twice a year, plus an annual physical.
Agent: For someone healthy with infrequent visits, the HDHP with HSA is typically the better financial choice. You pay less per month, and with your employer''s $500 HSA contribution plus your own contributions, you can cover most out-of-pocket costs tax-free.
Customer: So the HSA money rolls over if I don''t use it?
Agent: Yes, it rolls over forever — it''s not use-it-or-lose-it like an FSA. Many people treat it as an investment account for future medical expenses.
Customer: That''s really helpful. I''ll go with the HDHP.
Agent: Great choice for your situation. Let me help you complete the enrollment form.'
  END,
  'en-US',
  c.created_at + INTERVAL'4 minutes'
FROM generate_series(1, 10) gs
JOIN calls c ON c.status = 'completed'
  AND c.organization_id = 'a0200000-0000-0000-0000-000000000002'
  AND c.id = ('f0200000-0000-0000-00' || LPAD(gs::text, 2, '0') || '-000000000001')::uuid;

-- =============================================================================
-- CALL SUMMARIES (for calls with transcripts)
-- =============================================================================

INSERT INTO call_summaries (call_id, summary, key_points, next_actions, created_at)
SELECT
  c.id,
  CASE gs % 5
    WHEN 0 THEN 'Customer called for auto insurance quote on 2022 Honda Civic. Agent offered $138/month comprehensive coverage. Customer requested emailed quote. Clean driving record, strong conversion candidate.'
    WHEN 1 THEN 'Customer updating home insurance after $45K kitchen renovation. Agent increased dwelling coverage by $50K, adding $18/month to premium. Customer agreed immediately. Policy updated.'
    WHEN 2 THEN 'New parent seeking additional life insurance. Currently at $250K, recommended increasing to $750-900K based on $75K income. Customer interested in additional $500K 20-year term at $22/month. Application started.'
    WHEN 3 THEN 'Customer concerned about $40/month renewal increase. Agent explained rate factors and offered telematics program as offset. Customer enrolled in telematics. Multi-policy bundle opportunity identified.'
    ELSE 'Commercial insurance inquiry for landscaping business ($600K revenue, 6 employees, 3 trucks). Quoted $3,800-5,200 GL + commercial auto package. One prior claim below threshold. Agent sent documentation checklist.'
  END,
  CASE gs % 5
    WHEN 0 THEN '["Clean driving record - no accidents or violations","2022 Honda Civic - lower risk vehicle","Customer comparison shopping - price sensitive","Competitive at $138/month vs current carrier"]'::jsonb
    WHEN 1 THEN '["$45K kitchen renovation increases replacement value","Customer proactive about updating coverage","Agreed to $18/month increase without hesitation","Immediate policy update processed"]'::jsonb
    WHEN 2 THEN '["Currently underinsured at $250K with new dependent","31-year-old non-smoker - excellent rate profile","Recommended $750K-$900K based on income","High purchase intent - application started"]'::jsonb
    WHEN 3 THEN '["Rate increase due to market conditions + end of intro rate","Telematics enrollment completed","Multi-policy opportunity: no home insurance yet","Customer open to bundle discussion"]'::jsonb
    ELSE '["Landscaping business, 6 employees, $600K revenue","3 commercial trucks need coverage","1 minor prior claim - below pricing threshold","Package quote $3,800-5,200 annually"]'::jsonb
  END,
  CASE gs % 5
    WHEN 0 THEN '["Send quote email within 1 hour","Follow up in 48 hours if no response","Ask about home insurance bundle on follow-up"]'::jsonb
    WHEN 1 THEN '["Send policy update confirmation","Schedule 6-month review to assess any additional renovation","Ask about auto coverage bundle"]'::jsonb
    WHEN 2 THEN '["Complete life insurance application","Schedule paramedic exam","Follow up on application status in 5 business days"]'::jsonb
    WHEN 3 THEN '["Send telematics app download link","Check driving score at 30-day mark","Present home insurance bundle at renewal"]'::jsonb
    ELSE '["Email documentation checklist (FEIN, loss runs, VIN list)","Call back in 3 business days","Prepare full commercial package quote"]'::jsonb
  END,
  c.created_at + INTERVAL'7 minutes'
FROM generate_series(1, 15) gs
JOIN calls c ON c.id = ('f0100000-0000-0000-00' || LPAD(gs::text, 2, '0') || '-000000000001')::uuid;

-- Pacific Shield summaries
INSERT INTO call_summaries (call_id, summary, key_points, next_actions, created_at)
SELECT
  c.id,
  CASE gs % 3
    WHEN 0 THEN 'First-time insurance buyer, age 24, moved to LA. Chose full coverage on 2021 Toyota Corolla at $145-165/month over liability-only. Application started.'
    WHEN 1 THEN 'Student renter enrolling for required renters insurance. Chose $20K coverage, $500 deductible at $14/month. Policy issued immediately.'
    ELSE 'New employee choosing between PPO and HDHP+HSA plans. Agent recommended HDHP given healthy profile and $500 employer HSA contribution. HDHP enrollment completed.'
  END,
  CASE gs % 3
    WHEN 0 THEN '["First-time CA auto insurance buyer","24-year-old, 2-year license, no accidents","2021 Toyota Corolla - good value vehicle","Chose full coverage - good decision for newer car"]'::jsonb
    WHEN 1 THEN '["Landlord required renters insurance","Student budget-conscious","$1,500 laptop is primary asset concern","$14/month is very affordable for coverage level"]'::jsonb
    ELSE '["New employee, first time on employer health plan","PPO vs HDHP comparison done","$500 employer HSA contribution is significant","Healthy, low utilizer - HDHP is optimal"]'::jsonb
  END,
  CASE gs % 3
    WHEN 0 THEN '["Complete application","Run MVR report","Bind policy and send proof of insurance"]'::jsonb
    WHEN 1 THEN '["Issue policy documents","Email proof of insurance for landlord","Set renewal reminder at 11 months"]'::jsonb
    ELSE '["Complete open enrollment form","Confirm HSA account setup","Send HSA contribution guide"]'::jsonb
  END,
  c.created_at + INTERVAL'6 minutes'
FROM generate_series(1, 10) gs
JOIN calls c ON c.status = 'completed'
  AND c.organization_id = 'a0200000-0000-0000-0000-000000000002'
  AND c.id = ('f0200000-0000-0000-00' || LPAD(gs::text, 2, '0') || '-000000000001')::uuid;

-- =============================================================================
-- CALL SENTIMENTS (for all completed calls)
-- =============================================================================

INSERT INTO call_sentiments (call_id, overall_score, customer_sentiment, agent_sentiment, details, created_at)
SELECT
  id,
  sentiment_score,
  CASE
    WHEN sentiment_score >= 0.75 THEN 'positive'
    WHEN sentiment_score >= 0.45 THEN 'neutral'
    ELSE 'negative'
  END,
  'positive',
  jsonb_build_object(
    'tone', CASE WHEN sentiment_score >= 0.75 THEN 'positive' WHEN sentiment_score >= 0.45 THEN 'neutral' ELSE 'negative' END,
    'frustration_detected', sentiment_score < 0.40,
    'purchase_intent', sentiment_score > 0.75,
    'escalation_risk', sentiment_score < 0.35
  ),
  created_at + INTERVAL'8 minutes'
FROM calls
WHERE status = 'completed' AND sentiment_score IS NOT NULL;

-- =============================================================================
-- CAMPAIGNS (27 total: 9 per org)
-- =============================================================================

INSERT INTO campaigns (id, organization_id, name, type, status, config, created_at) VALUES
-- Apex campaigns (cam01xx)
('cam01000-0000-0000-0000-000000000001','a0100000-0000-0000-0000-000000000001','Spring Auto Renewal Blitz','outbound_call','completed','{"target_insurance_type":"auto","daily_call_limit":80,"calling_hours":{"start":"09:00","end":"20:00"}}',NOW()-INTERVAL'75 days'),
('cam01000-0000-0000-0000-000000000002','a0100000-0000-0000-0000-000000000001','Q1 Life Insurance Awareness','multi_channel','completed','{"target_insurance_type":"life","daily_call_limit":50,"channels":["call","email"]}',NOW()-INTERVAL'60 days'),
('cam01000-0000-0000-0000-000000000003','a0100000-0000-0000-0000-000000000001','Bundle & Save - Auto + Home','outbound_call','completed','{"target_insurance_type":"auto","daily_call_limit":60,"bundle_focus":true}',NOW()-INTERVAL'45 days'),
('cam01000-0000-0000-0000-000000000004','a0100000-0000-0000-0000-000000000001','New Business Push Q2','outbound_call','active','{"target_insurance_type":"auto","daily_call_limit":100,"calling_hours":{"start":"09:00","end":"21:00"}}',NOW()-INTERVAL'20 days'),
('cam01000-0000-0000-0000-000000000005','a0100000-0000-0000-0000-000000000001','Commercial Lines Expansion','multi_channel','active','{"target_insurance_type":"commercial","daily_call_limit":30,"channels":["call","email"]}',NOW()-INTERVAL'15 days'),
('cam01000-0000-0000-0000-000000000006','a0100000-0000-0000-0000-000000000001','Lapsed Policy Win-Back','outbound_call','paused','{"target_insurance_type":"auto","daily_call_limit":40,"lapsed_days_min":30}',NOW()-INTERVAL'10 days'),
('cam01000-0000-0000-0000-000000000007','a0100000-0000-0000-0000-000000000001','Teen Driver Add-On Campaign','outbound_call','draft','{"target_insurance_type":"auto","daily_call_limit":50}',NOW()-INTERVAL'5 days'),
('cam01000-0000-0000-0000-000000000008','a0100000-0000-0000-0000-000000000001','Summer Home Review','multi_channel','draft','{"target_insurance_type":"home","daily_call_limit":45}',NOW()-INTERVAL'3 days'),
('cam01000-0000-0000-0000-000000000009','a0100000-0000-0000-0000-000000000001','Life - Estate Planning Package','outbound_call','draft','{"target_insurance_type":"life","daily_call_limit":25}',NOW()-INTERVAL'1 day'),
-- Pacific Shield campaigns (cam02xx)
('cam02000-0000-0000-0000-000000000001','a0200000-0000-0000-0000-000000000002','New Driver Auto Acquisition','outbound_call','completed','{"target_insurance_type":"auto","daily_call_limit":60,"age_range":[18,26]}',NOW()-INTERVAL'65 days'),
('cam02000-0000-0000-0000-000000000002','a0200000-0000-0000-0000-000000000002','Student Renters Insurance Drive','multi_channel','completed','{"target_insurance_type":"renters","daily_call_limit":40,"channels":["call","email","sms"]}',NOW()-INTERVAL'50 days'),
('cam02000-0000-0000-0000-000000000003','a0200000-0000-0000-0000-000000000002','Open Enrollment Health Push','outbound_call','active','{"target_insurance_type":"health","daily_call_limit":55,"season":"open_enrollment"}',NOW()-INTERVAL'18 days'),
('cam02000-0000-0000-0000-000000000004','a0200000-0000-0000-0000-000000000002','Spanish Market Outreach','multi_channel','active','{"target_insurance_type":"auto","daily_call_limit":35,"language":"es","channels":["call","sms"]}',NOW()-INTERVAL'12 days'),
('cam02000-0000-0000-0000-000000000005','a0200000-0000-0000-0000-000000000002','Renters to Homeowners Pipeline','outbound_call','active','{"target_insurance_type":"renters","daily_call_limit":20,"upsell_target":"home"}',NOW()-INTERVAL'8 days'),
('cam02000-0000-0000-0000-000000000006','a0200000-0000-0000-0000-000000000002','Q2 Auto Renewals','outbound_call','paused','{"target_insurance_type":"auto","daily_call_limit":70}',NOW()-INTERVAL'6 days'),
('cam02000-0000-0000-0000-000000000007','a0200000-0000-0000-0000-000000000002','HDHP + HSA Education Series','multi_channel','draft','{"target_insurance_type":"health","daily_call_limit":25,"channels":["email","call"]}',NOW()-INTERVAL'4 days'),
('cam02000-0000-0000-0000-000000000008','a0200000-0000-0000-0000-000000000002','Dental Vision Add-On','sms','draft','{"target_insurance_type":"health","daily_sms_limit":200}',NOW()-INTERVAL'2 days'),
('cam02000-0000-0000-0000-000000000009','a0200000-0000-0000-0000-000000000002','Summer Telematics Enrollment','outbound_call','draft','{"target_insurance_type":"auto","daily_call_limit":45,"program":"telematics"}',NOW()-INTERVAL'1 day'),
-- Heartland campaigns (cam03xx)
('cam03000-0000-0000-0000-000000000001','a0300000-0000-0000-0000-000000000003','Spring Farm Policy Review','outbound_call','completed','{"target_insurance_type":"commercial","daily_call_limit":25,"segment":"agricultural"}',NOW()-INTERVAL'70 days'),
('cam03000-0000-0000-0000-000000000002','a0300000-0000-0000-0000-000000000003','Commercial Umbrella Upsell','outbound_call','completed','{"target_insurance_type":"umbrella","daily_call_limit":20}',NOW()-INTERVAL'55 days'),
('cam03000-0000-0000-0000-000000000003','a0300000-0000-0000-0000-000000000003','Rural Homeowner Outreach','multi_channel','active','{"target_insurance_type":"home","daily_call_limit":30,"channels":["call","email"]}',NOW()-INTERVAL'22 days'),
('cam03000-0000-0000-0000-000000000004','a0300000-0000-0000-0000-000000000003','Small Business BOP Push','outbound_call','active','{"target_insurance_type":"commercial","daily_call_limit":15}',NOW()-INTERVAL'14 days'),
('cam03000-0000-0000-0000-000000000005','a0300000-0000-0000-0000-000000000003','Crop Insurance Q3 Enrollment','outbound_call','active','{"target_insurance_type":"commercial","daily_call_limit":20,"season":"pre_harvest"}',NOW()-INTERVAL'7 days'),
('cam03000-0000-0000-0000-000000000006','a0300000-0000-0000-0000-000000000003','Renewal Follow-Up Batch','outbound_call','paused','{"target_insurance_type":"home","daily_call_limit":25}',NOW()-INTERVAL'5 days'),
('cam03000-0000-0000-0000-000000000007','a0300000-0000-0000-0000-000000000003','Equipment Floater Campaign','outbound_call','draft','{"target_insurance_type":"commercial","daily_call_limit":15}',NOW()-INTERVAL'3 days'),
('cam03000-0000-0000-0000-000000000008','a0300000-0000-0000-0000-000000000003','New Farm Owners','multi_channel','draft','{"target_insurance_type":"commercial","daily_call_limit":10,"channels":["call","email"]}',NOW()-INTERVAL'2 days'),
('cam03000-0000-0000-0000-000000000009','a0300000-0000-0000-0000-000000000003','Winter Prep Property Review','outbound_call','draft','{"target_insurance_type":"home","daily_call_limit":20}',NOW()-INTERVAL'1 day');

-- Campaign leads linkages
INSERT INTO campaign_leads (campaign_id, lead_id, status)
-- Apex campaign 1 links to first 15 leads
SELECT 'cam01000-0000-0000-0000-000000000001', id, 'called' FROM leads WHERE organization_id = 'a0100000-0000-0000-0000-000000000001' LIMIT 15;

INSERT INTO campaign_leads (campaign_id, lead_id, status)
SELECT 'cam01000-0000-0000-0000-000000000004', id,
       CASE WHEN status IN ('bound','quoted') THEN 'converted' WHEN status = 'lost' THEN 'skipped' ELSE 'called' END
FROM leads WHERE organization_id = 'a0100000-0000-0000-0000-000000000001' AND status IN ('new','contacted','qualified');

INSERT INTO campaign_leads (campaign_id, lead_id, status)
SELECT 'cam02000-0000-0000-0000-000000000003', id,
       CASE WHEN status = 'bound' THEN 'converted' ELSE 'called' END
FROM leads WHERE organization_id = 'a0200000-0000-0000-0000-000000000002' AND insurance_type = 'health';

INSERT INTO campaign_leads (campaign_id, lead_id, status)
SELECT 'cam03000-0000-0000-0000-000000000003', id,
       CASE WHEN status = 'bound' THEN 'converted' WHEN status = 'lost' THEN 'skipped' ELSE 'pending' END
FROM leads WHERE organization_id = 'a0300000-0000-0000-0000-000000000003' AND insurance_type = 'home';

-- =============================================================================
-- CAMPAIGN RESULTS (for completed and active campaigns)
-- =============================================================================

INSERT INTO campaign_results (campaign_id, metrics, created_at) VALUES
-- Apex completed campaigns (high performance numbers)
('cam01000-0000-0000-0000-000000000001','{"total_calls":312,"connected_calls":218,"qualified_leads":87,"conversions":42,"conversion_rate":0.134,"avg_call_duration_sec":387,"revenue_generated":168000,"roi":4.2}',NOW()-INTERVAL'40 days'),
('cam01000-0000-0000-0000-000000000002','{"total_calls":185,"connected_calls":129,"qualified_leads":58,"conversions":24,"conversion_rate":0.130,"avg_call_duration_sec":524,"revenue_generated":96000,"roi":3.8}',NOW()-INTERVAL'25 days'),
('cam01000-0000-0000-0000-000000000003','{"total_calls":247,"connected_calls":168,"qualified_leads":72,"conversions":38,"conversion_rate":0.154,"avg_call_duration_sec":412,"revenue_generated":152000,"roi":5.1}',NOW()-INTERVAL'10 days'),
-- Apex active campaigns (partial results)
('cam01000-0000-0000-0000-000000000004','{"total_calls":89,"connected_calls":58,"qualified_leads":21,"conversions":9,"conversion_rate":0.101,"avg_call_duration_sec":365,"revenue_generated":36000}',NOW()-INTERVAL'5 days'),
('cam01000-0000-0000-0000-000000000005','{"total_calls":42,"connected_calls":30,"qualified_leads":14,"conversions":6,"conversion_rate":0.143,"avg_call_duration_sec":598,"revenue_generated":30000}',NOW()-INTERVAL'3 days'),
-- Pacific Shield completed campaigns
('cam02000-0000-0000-0000-000000000001','{"total_calls":228,"connected_calls":142,"qualified_leads":61,"conversions":28,"conversion_rate":0.123,"avg_call_duration_sec":298,"revenue_generated":78400,"roi":3.2}',NOW()-INTERVAL'30 days'),
('cam02000-0000-0000-0000-000000000002','{"total_calls":156,"connected_calls":98,"qualified_leads":44,"conversions":19,"conversion_rate":0.122,"avg_call_duration_sec":245,"revenue_generated":28500,"roi":2.9}',NOW()-INTERVAL'15 days'),
-- Pacific Shield active campaigns (partial)
('cam02000-0000-0000-0000-000000000003','{"total_calls":67,"connected_calls":41,"qualified_leads":18,"conversions":7,"conversion_rate":0.104,"avg_call_duration_sec":445}',NOW()-INTERVAL'4 days'),
('cam02000-0000-0000-0000-000000000004','{"total_calls":35,"connected_calls":23,"qualified_leads":10,"conversions":4,"conversion_rate":0.114}',NOW()-INTERVAL'3 days'),
-- Heartland completed campaigns (smaller, niche numbers)
('cam03000-0000-0000-0000-000000000001','{"total_calls":92,"connected_calls":71,"qualified_leads":32,"conversions":18,"conversion_rate":0.196,"avg_call_duration_sec":612,"revenue_generated":86400,"roi":5.8}',NOW()-INTERVAL'35 days'),
('cam03000-0000-0000-0000-000000000002','{"total_calls":74,"connected_calls":58,"qualified_leads":27,"conversions":14,"conversion_rate":0.189,"avg_call_duration_sec":578,"revenue_generated":98000,"roi":6.1}',NOW()-INTERVAL'20 days'),
-- Heartland active (partial)
('cam03000-0000-0000-0000-000000000003','{"total_calls":38,"connected_calls":30,"qualified_leads":14,"conversions":7,"conversion_rate":0.184}',NOW()-INTERVAL'5 days');

COMMIT;

-- Verify counts
SELECT 'organizations' AS tbl, COUNT(*) FROM organizations
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'voice_agents', COUNT(*) FROM voice_agents
UNION ALL SELECT 'leads', COUNT(*) FROM leads
UNION ALL SELECT 'calls', COUNT(*) FROM calls
UNION ALL SELECT 'call_transcripts', COUNT(*) FROM call_transcripts
UNION ALL SELECT 'call_summaries', COUNT(*) FROM call_summaries
UNION ALL SELECT 'call_sentiments', COUNT(*) FROM call_sentiments
UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL SELECT 'campaign_results', COUNT(*) FROM campaign_results
UNION ALL SELECT 'knowledge_documents', COUNT(*) FROM knowledge_documents
ORDER BY 1;
