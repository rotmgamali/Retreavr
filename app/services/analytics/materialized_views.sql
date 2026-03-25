-- =============================================================================
-- Retrevr Insurance Platform — Analytics Materialized Views
--
-- Run once to create; refresh periodically (cron or pg_cron) to keep fresh.
-- Each view has a unique index for fast incremental refresh (CONCURRENTLY).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Daily call + conversion rollup
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_call_rollup AS
SELECT
    DATE(c.started_at)                                              AS day,
    c.organization_id,
    COUNT(c.id)                                                     AS total_calls,
    COUNT(c.id) FILTER (WHERE c.status = 'completed')              AS connected_calls,
    COALESCE(AVG(c.duration_seconds)
        FILTER (WHERE c.status = 'completed'), 0)                  AS avg_duration_seconds,
    COUNT(DISTINCT lq.lead_id)
        FILTER (WHERE lq.is_qualified = TRUE)                      AS qualified_leads,
    COUNT(DISTINCT l.id)
        FILTER (WHERE l.status = 'converted')                      AS converted_leads,
    COALESCE(
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted')::float
        / NULLIF(COUNT(c.id), 0), 0
    )                                                               AS conversion_rate,
    COALESCE(SUM(cc.openai_cost_usd + cc.twilio_cost_usd), 0)     AS total_cost_usd,
    COUNT(DISTINCT c.campaign_id)                                   AS unique_campaigns
FROM calls c
LEFT JOIN leads l                ON l.id = c.lead_id
LEFT JOIN lead_qualifications lq ON lq.lead_id = c.lead_id
LEFT JOIN call_costs cc          ON cc.call_id = c.id
GROUP BY DATE(c.started_at), c.organization_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_call_rollup
    ON mv_daily_call_rollup (day, organization_id);


-- ---------------------------------------------------------------------------
-- 2. Weekly call + conversion rollup
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_call_rollup AS
SELECT
    DATE_TRUNC('week', c.started_at)::date                         AS week_start,
    (DATE_TRUNC('week', c.started_at) + INTERVAL '6 days')::date  AS week_end,
    c.organization_id,
    COUNT(c.id)                                                     AS total_calls,
    COUNT(c.id) FILTER (WHERE c.status = 'completed')              AS connected_calls,
    COALESCE(AVG(c.duration_seconds)
        FILTER (WHERE c.status = 'completed'), 0)                  AS avg_duration_seconds,
    COUNT(DISTINCT lq.lead_id)
        FILTER (WHERE lq.is_qualified = TRUE)                      AS qualified_leads,
    COUNT(DISTINCT l.id)
        FILTER (WHERE l.status = 'converted')                      AS converted_leads,
    COALESCE(
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted')::float
        / NULLIF(COUNT(c.id), 0), 0
    )                                                               AS conversion_rate,
    COALESCE(SUM(cc.openai_cost_usd + cc.twilio_cost_usd), 0)     AS total_cost_usd
FROM calls c
LEFT JOIN leads l                ON l.id = c.lead_id
LEFT JOIN lead_qualifications lq ON lq.lead_id = c.lead_id
LEFT JOIN call_costs cc          ON cc.call_id = c.id
GROUP BY DATE_TRUNC('week', c.started_at), c.organization_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_weekly_call_rollup
    ON mv_weekly_call_rollup (week_start, organization_id);


-- ---------------------------------------------------------------------------
-- 3. Monthly call + conversion rollup
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_call_rollup AS
SELECT
    EXTRACT(YEAR  FROM c.started_at)::int                          AS yr,
    EXTRACT(MONTH FROM c.started_at)::int                          AS mo,
    c.organization_id,
    COUNT(c.id)                                                     AS total_calls,
    COUNT(c.id) FILTER (WHERE c.status = 'completed')              AS connected_calls,
    COALESCE(AVG(c.duration_seconds)
        FILTER (WHERE c.status = 'completed'), 0)                  AS avg_duration_seconds,
    COUNT(DISTINCT lq.lead_id)
        FILTER (WHERE lq.is_qualified = TRUE)                      AS qualified_leads,
    COUNT(DISTINCT l.id)
        FILTER (WHERE l.status = 'converted')                      AS converted_leads,
    COALESCE(
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted')::float
        / NULLIF(COUNT(c.id), 0), 0
    )                                                               AS conversion_rate,
    COALESCE(SUM(cc.openai_cost_usd + cc.twilio_cost_usd), 0)     AS total_cost_usd
FROM calls c
LEFT JOIN leads l                ON l.id = c.lead_id
LEFT JOIN lead_qualifications lq ON lq.lead_id = c.lead_id
LEFT JOIN call_costs cc          ON cc.call_id = c.id
GROUP BY yr, mo, c.organization_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_call_rollup
    ON mv_monthly_call_rollup (yr, mo, organization_id);


-- ---------------------------------------------------------------------------
-- 4. Per-agent performance summary
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_agent_performance AS
SELECT
    va.id                                                           AS agent_id,
    va.name                                                         AS agent_name,
    va.organization_id,
    DATE(c.started_at)                                             AS day,
    COUNT(c.id)                                                     AS total_calls,
    COUNT(c.id) FILTER (WHERE c.status = 'completed')              AS connected_calls,
    COALESCE(AVG(c.duration_seconds)
        FILTER (WHERE c.status = 'completed'), 0)                  AS avg_duration_seconds,
    COALESCE(
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted')::float
        / NULLIF(COUNT(c.id), 0), 0
    )                                                               AS conversion_rate,
    COALESCE(
        COUNT(DISTINCT lq.lead_id) FILTER (WHERE lq.is_qualified = TRUE)::float
        / NULLIF(COUNT(c.id), 0), 0
    )                                                               AS qualification_rate,
    COALESCE(AVG(lq.lead_score), 0)                                AS avg_lead_score,
    AVG(cs.overall_sentiment_score)                                AS sentiment_score,
    COALESCE(SUM(cc.openai_cost_usd + cc.twilio_cost_usd), 0)     AS total_cost_usd
FROM voice_agents va
JOIN calls c                 ON c.voice_agent_id = va.id
LEFT JOIN leads l            ON l.id = c.lead_id
LEFT JOIN lead_qualifications lq ON lq.lead_id = c.lead_id
    AND lq.call_id = c.id
LEFT JOIN call_sentiments cs ON cs.call_id = c.id
LEFT JOIN call_costs cc      ON cc.call_id = c.id
GROUP BY va.id, va.name, va.organization_id, DATE(c.started_at)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_agent_performance
    ON mv_agent_performance (agent_id, day);


-- ---------------------------------------------------------------------------
-- 5. Conversion funnel snapshot (full history)
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_conversion_funnel AS
SELECT
    DATE(c.started_at)                                             AS day,
    c.organization_id,
    c.campaign_id,
    COUNT(c.id)                                                     AS initiated,
    COUNT(c.id) FILTER (WHERE c.status = 'completed')              AS connected,
    COUNT(DISTINCT lq.lead_id)
        FILTER (WHERE lq.is_qualified = TRUE)                      AS qualified,
    COUNT(DISTINCT lq.lead_id)
        FILTER (WHERE lq.quote_generated = TRUE)                   AS quoted,
    COUNT(DISTINCT l.id)
        FILTER (WHERE l.status = 'converted')                      AS converted
FROM calls c
LEFT JOIN leads l                ON l.id = c.lead_id
LEFT JOIN lead_qualifications lq ON lq.lead_id = c.lead_id
GROUP BY DATE(c.started_at), c.organization_id, c.campaign_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_conversion_funnel
    ON mv_conversion_funnel (day, organization_id, campaign_id);


-- ---------------------------------------------------------------------------
-- 6. A/B test result summary
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ab_test_results AS
SELECT
    abt.id                                                          AS test_id,
    abt.name                                                        AS test_name,
    abt.status,
    abt.organization_id,
    abv.id                                                          AS variant_id,
    abv.name                                                        AS variant_name,
    COUNT(abtr.id)                                                  AS total_trials,
    COUNT(abtr.id) FILTER (WHERE abtr.converted = TRUE)            AS conversions,
    COALESCE(
        COUNT(abtr.id) FILTER (WHERE abtr.converted = TRUE)::float
        / NULLIF(COUNT(abtr.id), 0), 0
    )                                                               AS conversion_rate,
    COALESCE(AVG(abtr.call_duration_seconds), 0)                   AS avg_call_duration,
    COALESCE(
        COUNT(abtr.id) FILTER (WHERE abtr.qualified = TRUE)::float
        / NULLIF(COUNT(abtr.id), 0), 0
    )                                                               AS qualification_rate
FROM ab_tests abt
JOIN ab_test_variants abv  ON abv.test_id = abt.id
LEFT JOIN ab_test_results abtr ON abtr.variant_id = abv.id
GROUP BY abt.id, abt.name, abt.status, abt.organization_id,
         abv.id, abv.name
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ab_test_results
    ON mv_ab_test_results (test_id, variant_id);


-- ---------------------------------------------------------------------------
-- 7. Daily API cost summary
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_cost AS
SELECT
    DATE(c.started_at)                                             AS day,
    c.organization_id,
    COALESCE(SUM(cc.openai_tokens_input),  0)                      AS openai_tokens_input,
    COALESCE(SUM(cc.openai_tokens_output), 0)                      AS openai_tokens_output,
    COALESCE(SUM(cc.openai_cost_usd), 0)                           AS openai_cost_usd,
    COALESCE(SUM(cc.twilio_minutes),  0)                           AS twilio_minutes,
    COALESCE(SUM(cc.twilio_cost_usd), 0)                           AS twilio_cost_usd,
    COALESCE(SUM(cc.openai_cost_usd + cc.twilio_cost_usd), 0)     AS total_cost_usd,
    COUNT(DISTINCT c.id)                                            AS calls_count
FROM calls c
JOIN call_costs cc ON cc.call_id = c.id
GROUP BY DATE(c.started_at), c.organization_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_cost
    ON mv_daily_cost (day, organization_id);


-- =============================================================================
-- Refresh commands (run via pg_cron or application scheduler)
--
-- Every hour (for near-real-time dashboards):
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_call_rollup;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_conversion_funnel;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_agent_performance;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_cost;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ab_test_results;
--
-- Every night (for weekly/monthly aggregates, which change less frequently):
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_call_rollup;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_call_rollup;
-- =============================================================================
