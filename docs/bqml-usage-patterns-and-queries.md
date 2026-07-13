# BigQuery ML (BQML) Model Usage Patterns & Query Guide

## Executive Overview

BigQuery ML (`ML.PREDICT`) supports flexible inference patterns across both single-player point evaluation and full-universe cohort analytics. 

This guide details the standard usage patterns for **`omniarcade_raw.player_churn_model`** (Logistic Regression) and **`omniarcade_gold.predictive_ltv_model`** (Boosted Tree Regressor), including SQL examples for cohort filtering, multi-model join analytics, and real-time inference.

---

## BQML Inference Patterns

### Pattern 1: Batch Cohort Filtering (e.g., "Find All Players About to Churn")

To evaluate an entire dataset and extract all players exceeding a churn probability threshold (e.g., $\ge 70\%$), pass the full gold feature table (`TABLE omniarcade_gold.gold_player_360`) to `ML.PREDICT`:

```sql
SELECT
  player_id,
  payer_tier,
  consecutive_deaths,
  session_duration_seconds,
  days_since_last_login,
  ROUND(p.prob, 2) AS churn_probability
FROM ML.PREDICT(
  MODEL `omniarcade_raw.player_churn_model`,
  TABLE `omniarcade_gold.gold_player_360`
), UNNEST(predicted_is_churned_probs) p
WHERE p.label = 1 AND p.prob >= 0.70
ORDER BY churn_probability DESC;
```

---

### Pattern 2: Multi-Model Join Analytics (High LTV Spenders At Risk)

By combining inferences from both `player_churn_model` and `predictive_ltv_model` in a single query, LiveOps and Marketing teams can isolate high-value players (predicted high future LTV) who are showing critical churn probability:

```sql
WITH churn_scores AS (
  SELECT 
    player_id, 
    p.prob AS churn_risk
  FROM ML.PREDICT(
    MODEL `omniarcade_raw.player_churn_model`,
    TABLE `omniarcade_gold.gold_player_360`
  ), UNNEST(predicted_is_churned_probs) p
  WHERE p.label = 1
),
ltv_predictions AS (
  SELECT 
    player_id, 
    predicted_total_iap_spend AS predicted_future_ltv
  FROM ML.PREDICT(
    MODEL `omniarcade_gold.predictive_ltv_model`,
    TABLE `omniarcade_gold.gold_player_360`
  )
)
SELECT
  c.player_id,
  g.payer_tier,
  ROUND(c.churn_risk, 2) AS churn_risk_score,
  ROUND(l.predicted_future_ltv, 2) AS predicted_future_ltv
FROM churn_scores c
JOIN ltv_predictions l ON c.player_id = l.player_id
JOIN `omniarcade_gold.gold_player_360` g ON c.player_id = g.player_id
WHERE c.churn_risk >= 0.70
  AND l.predicted_future_ltv >= 100.00
ORDER BY predicted_future_ltv DESC;
```

---

### Pattern 3: Single-Player Point Inference (Real-time LiveOps & Telemetry Streams)

Used by backend API gateways ([`src/remix-gaming-app/server.ts`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/server.ts)) and stored procedures ([`calculate-churn-risk.sql.tftpl`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/retail-data-and-ai-demo/infrastructure/terraform/games/games-bigquery-routines/calculate-churn-risk.sql.tftpl)) during active game sessions to perform immediate sub-second evaluation for a specific player:

```sql
SELECT * FROM ML.PREDICT(
  MODEL `omniarcade_raw.player_churn_model`,
  (
    SELECT
      'PLAY-00000042' AS player_id,
      4 AS consecutive_deaths,
      1200 AS session_duration_seconds,
      'Whale' AS payer_tier,
      750.0 AS total_iap_spend,
      2 AS days_since_last_login,
      'RPG' AS favorite_category
  )
);
```

---

### Pattern 4: Scheduled In-Warehouse Materialization & Analytical Views

Rather than re-executing `ML.PREDICT` on every dashboard query, Dataform or scheduled BQ jobs can periodically execute batch predictions and hydrate columns (`churn_risk_score`, `predicted_ltv_dollars`) directly on `omniarcade_gold.gold_player_360` or materialize dedicated views:

```sql
CREATE OR REPLACE VIEW `omniarcade_gold.vw_at_risk_whales` AS
SELECT
  g.player_id,
  g.payer_tier,
  g.total_iap_spend AS historical_ltv,
  ROUND(p.prob, 2) AS churn_risk_score,
  ROUND(l.predicted_total_iap_spend, 2) AS predicted_ltv
FROM `omniarcade_gold.gold_player_360` g
CROSS JOIN UNNEST(
  ML.PREDICT(
    MODEL `omniarcade_raw.player_churn_model`,
    (SELECT * FROM `omniarcade_gold.gold_player_360` WHERE player_id = g.player_id)
  )
), UNNEST(predicted_is_churned_probs) p
CROSS JOIN UNNEST(
  ML.PREDICT(
    MODEL `omniarcade_gold.predictive_ltv_model`,
    (SELECT * FROM `omniarcade_gold.gold_player_360` WHERE player_id = g.player_id)
  )
) l
WHERE p.label = 1 AND p.prob >= 0.70 AND g.payer_tier = 'Whale';
```
