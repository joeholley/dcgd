# Implementation Plan: GCP Backend Provisioning & Frontend-to-Backend Integration

## Executive Summary & Objectives

This document defines the comprehensive implementation plan for provisioning the Google Cloud Platform (GCP) backend infrastructure and connecting it to the unified frontend application (`src/remix-gaming-app` and `src/gamingdatademo`).

The backend architecture is strictly modeled on the infrastructure patterns established in **Retail Data and AI Demo** (`src/retail-data-and-ai-demo`), utilizing Terraform HCL, zero-code Cloud Pub/Sub to BigQuery streaming, BigQuery ML (BQML), BigQuery Remote Models (Gemini `AI.GENERATE`), Dataplex Knowledge Catalog aspect types & glossaries, and Vertex AI Agent Engine (ADK) swarms.

### Primary Objectives:
1. **Terraform Infrastructure Provisioning**:
   - Extend existing Terraform modules in `src/retail-data-and-ai-demo/infrastructure/terraform/games/` to provision all Medallion datasets (`gaming_raw`, `gaming_silver`, `gaming_gold`, `gaming_synthetic`), streaming Pub/Sub topics, BigQuery tables, BQML models, and Dataplex catalog resources.
2. **Data Hydration & BQML Model Training**:
   - Execute synthetic data stored procedures (`generate_players`, `generate_iap`, `populate_player_tables`, `train_churn_model`) to hydrate BigQuery tables and train the BQML logistic regression churn model.
3. **Vertex AI Agent Engine & Dataplex Deployment**:
   - Deploy ADK multi-agent swarms (`agent_kc`, `marketing_agent_swarm`) to Vertex AI Reasoning Engine.
   - Register Dataplex aspect types (`liveops_campaign_policy_aspect`) and business glossaries (`gaming-studios-glossary-us`).
4. **Express & Flask API Gateway Wiring**:
   - Wire live GCP SDK clients in Express (`server.ts`) and Flask (`app.py`) to replace dev mock fallbacks with real GCP API calls (BigQuery, Pub/Sub, Dataplex, Vertex AI).
5. **Diagnostics & Data Mode Verification**:
   - Validate that `/diagnostics` and `<DataModeBadge>` components cleanly transition from `MOCK (Dev)` to `LIVE (GCP)` once GCP services are active.

---

## 🏗️ Architecture & Data Flow Topology

```
+---------------------------------------------------------------------------------------------------+
| UNIFIED FRONTEND SHELL (Remix React + Embedded Flask)                                            |
| Overview | Operations | Executive | Guardrail | Campaigns | Difficulty | Swarm | Agents | Diagnostics |
+---------------------------------------------------------------------------------------------------+
                                   │                                  │
                  REST / SSE / WS  │                                  │ Pub/Sub SDK (Direct)
                                   ▼                                  ▼
+--------------------------------------------------+ +----------------------------------------------+
| EXPRESS GATEWAY (server.ts / :3000)             | | CLOUD PUB/SUB TOPIC                        |
| & FLASK REVERSE PROXY (app.py / :5000)          | | `gaming-live-telemetry`                 |
+--------------------------------------------------+ +----------------------------------------------+
  │            │                    │                                │
  │ BigQuery   │ Dataplex REST      │ Vertex AI                      │ Zero-Code Direct
  │ SDK (Node) │ API (Aspects/Dict) │ ReasoningEngine (ADK)          │ Subscription
  ▼            ▼                    ▼                                ▼
+---------------------------------------------------------------------------------------------------+
| GOOGLE CLOUD PLATFORM (GCP BACKEND INFRASTRUCTURE)                                                |
|                                                                                                   |
| -- BIGQUERY LAKEHOUSE (US Multi-Region) --                                                       |
| * gaming_raw.live_session_events  (Partitioned by Day, Clustered by player_id, event_type)     |
| * gaming_raw.gcp_players & iap_transactions                                                   |
| * gaming_gold.gold_player_360 (Feature Store: LTV, spend tier, churn risk)                   |
| * gaming_gold.gold_regional_kpis, gold_campaign_analytics, gold_level_difficulty_funnel       |
| * gaming_silver.server_latency                                                                |
|                                                                                                   |
| -- BIGQUERY ML & REMOTE MODELS --                                                                 |
| * gaming_raw.gaming_player_churn_model (Logistic Regression) + calculate_churn_risk procedure        |
| * gemini_flash_remote_model (Vertex AI AI.GENERATE connection)                                    |
|                                                                                                   |
| -- DATAPLEX KNOWLEDGE CATALOG --                                                                  |
| * Glossary: gaming-studios-glossary-us (Whale Spend, ARPU, CCU, Toxicity Exposure)            |
| * Aspect Types: liveops_campaign_policy_aspect, gaming-certified-reward-sku-aspect                        |
| * Policy Tags: gaming_data_classification (PII, Financial) & Row Access Policies                         |
|                                                                                                   |
| -- VERTEX AI AGENT ENGINE (ADK) --                                                                |
| * ReasoningEngine: omniarcade-guardrail-agent & marketing-recovery-swarm                          |
+---------------------------------------------------------------------------------------------------+
```

---

## 🗄️ Phase-by-Phase Implementation Breakdown

### Phase 1: Terraform Infrastructure Provisioning & API Enablement

#### 1. API Enablement (`infrastructure/terraform/games/games-apis.tf`)
Ensure the following GCP APIs are enabled:
```hcl
resource "google_project_service" "games_apis" {
  for_each = toset([
    "bigquery.googleapis.com",
    "pubsub.googleapis.com",
    "dataplex.googleapis.com",
    "aiplatform.googleapis.com",
    "datalineage.googleapis.com",
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}
```

#### 2. BigQuery Datasets & Analytical Tables (`infrastructure/terraform/games/games-bigquery.tf`)
Provision Medallion datasets and tables:
- **Datasets**: `gaming_raw`, `gaming_silver`, `gaming_gold`, `gaming_synthetic`.
- **Raw Tables**:
  - `gcp_players`: Player profiles, registration dates, spend tier (`Whale`, `Dolphin`, `Minnow`).
  - `live_session_events`: Partitioned by `DATE(timestamp)`, clustered by `player_id, event_type`.
  - `iap_transactions`: Transaction ID, player ID, SKU, price, timestamp.
- **Silver & Gold Analytical Tables**:
  - `gold_player_360`: Feature store (LTV, total sessions, consecutive deaths, churn risk).
  - `gold_regional_kpis`: DAU, MAU, ARPU, total revenue, average ping by country.
  - `gold_campaign_analytics`: Campaign impressions, conversions, churn prevention rate, incremental ROI.
  - `silver_server_latency`: Server region capacity, CCU, ping latency, frame rate drops.
  - `gold_level_difficulty_funnel`: Level starts, completions, failures, resets, move limit adjustments.

#### 3. Cloud Pub/Sub Topic & Direct BigQuery Subscription (`infrastructure/terraform/games/games-pubsub.tf`)
- Topic: `gaming-live-telemetry`.
- Subscription: `gaming-live-telemetry-bq-sub` with `bigquery_config` writing directly into `gaming_raw.live_session_events` without Dataflow or custom code.

#### 4. Dataplex Knowledge Catalog Infrastructure (`infrastructure/terraform/games/games-dataplex.tf`)
- **Aspect Types**:
  - `google_dataplex_aspect_type.liveops_campaign_policy_aspect`: Discount caps, target SKUs, guardrail status.
- **Business Glossary**:
  - `google_dataplex_glossary.omniarcade_glossary`: `gaming-studios-glossary-us` with terms *Whale Spend*, *Idle Churn*, *ARPU*, *CCU*, *Toxicity Exposure*.

---

### Phase 2: Data Hydration & BQML Model Training

#### 1. Execute Data Generation Stored Procedures (`games-bigquery-procedure.tf`)
Run the following SQL stored procedures to populate BigQuery with baseline data:
1. `CALL gaming_synthetic.generate_players(5000)`: Generates 5,000 player profiles across global regions (AMER, APAC, EMEA).
2. `CALL gaming_synthetic.generate_iap()`: Generates historic in-app purchase transactions.
3. `CALL gaming_synthetic.populate_player_tables()`: Aggregates raw logs into `gold_player_360` and `gold_regional_kpis`.

#### 2. Train BQML Churn Prediction Model
Execute `CALL gaming_raw.train_churn_model()` to train a BQML logistic regression model:
```sql
CREATE OR REPLACE MODEL `gaming_raw.gaming_player_churn_model`
OPTIONS(
  MODEL_TYPE='LOGISTIC_REG',
  INPUT_LABEL_COLS=['is_churned']
) AS
SELECT
  consecutive_deaths,
  session_duration_seconds,
  event_type,
  is_churned
FROM `gaming_raw.live_session_events`;
```

#### 3. Verify `calculate_churn_risk` Stored Procedure
Verify that calling `CALL gaming_raw.calculate_churn_risk(player_id, score, risk_level)` executes `ML.PREDICT` on `gaming_raw.gaming_player_churn_model` and returns predicted churn probability within <100ms.

---

### Phase 3: Vertex AI Agent Engine & ADK Multi-Agent Deployment

#### 1. Package ADK Agents (`src/gamingdatademo/agents/`)
- **`agent_kc`** (`src/gamingdatademo/agents/agent_kc/agent.py`): Dataplex Knowledge Catalog-guided agent equipped with:
  - Dataplex `lookupContext` tool.
  - BigQuery SQL execution tool.
  - Policy verification tool.
- **`marketing_agent_swarm`** (`src/gamingdatademo/agents/marketing_agent_swarm/`): Multi-agent swarm (Strategist, Creative, Budget Manager, Risk Evaluator).

#### 2. Deploy to Vertex AI Reasoning Engine
Execute deployment script to deploy ADK agents to Vertex AI Reasoning Engine:
```bash
python3 -m src.gamingdatademo.agents.deploy_reasoning_engine \
  --project_id=$GCP_PROJECT_ID \
  --location=us-central1 \
  --display_name="omniarcade-guardrail-agent"
```
Store the resulting Reasoning Engine resource ID (`AGENT_ENGINE_ID`) in environment variables.

---

### Phase 4: Express Gateway (`server.ts`) & Flask (`app.py`) Integration Wiring

#### 1. Express Gateway GCP SDK Wiring (`server.ts`)
- **BigQuery Client**: Wire `@google-cloud/bigquery` in `/api/system/gcp-health` to execute parallel `SELECT 1` health checks against all 8 BigQuery tables.
- **Pub/Sub Client**: Wire `@google-cloud/pubsub` in `/api/telemetry/stream` to publish telemetry payloads directly to `gaming-live-telemetry`.
- **BQML Integration**: Wire `ML.PREDICT` execution in `/api/telemetry/stream` so boss death events immediately trigger real BQML churn scoring.
- **Dataplex Pre-Caching**: Wire Dataplex REST API token check in `verifyDataplexPolicyAndPrecache()` to validate max discount caps before pushing SSE offer events (`/api/guardrail/events`).

#### 2. Flask API Wiring (`app.py`)
- **Executive Portfolio (`/api/executive/*`)**: Query `gaming_gold.gold_player_360` and `gold_regional_kpis` for portfolio metrics.
- **Difficulty Balancer (`/api/difficulty-stats`)**: Query `gaming_gold.gold_level_difficulty_funnel` for Level 2 failure drop-off stats.
- **Marketing Swarm (`/api/marketing/cohort-telemetry`)**: Query `gaming_gold.gold_campaign_analytics`.
- **WebSocket Agent Trace (`/api/ws`)**: Connect to live Vertex AI Reasoning Engine (`AGENT_ENGINE_ID`).

---

### Phase 5: Verification, QA & Diagnostics Transition

#### 1. Transition Diagnostics Badges
Verify that running `/api/system/diagnostics` returns:
- `overall_status`: `"ALL_LIVE"` (or `"HEALTHY_WITH_FALLBACKS"`).
- All 13 GCP/BQ probes display green `LIVE (GCP)` status pills.
- Latencies: BigQuery <30ms, Pub/Sub <15ms, BQML <50ms, Dataplex <40ms, Vertex AI <60ms.

#### 2. End-to-End LiveOps Guardrail Walkthrough
1. Trigger a boss death event in LiveOps Guardrail or launch the Live Telemetry Simulator (`/api/simulator/start`).
2. Verify Pub/Sub message ID is generated by GCP Pub/Sub.
3. Verify BQML `ML.PREDICT` scores churn probability > 0.85.
4. Verify Dataplex policy aspect certifies the `$0.99 Frost Giant Shield` offer.
5. Verify SSE push delivers the offer pop-up in `<300ms`.

#### 3. Build & Type Validation
- Execute `npx tsc --noEmit` and `npx vite build` to ensure 0 compilation or bundling errors.

---

## 📅 Implementation Roadmap & Action Items

| Step | Task Description | Target Artifact / File | Estimated Time |
| :--- | :--- | :--- | :--- |
| **Step 1** | Run Terraform to provision BigQuery datasets, tables, Pub/Sub, and Dataplex glossaries. | `infrastructure/terraform/games/` | 15 mins |
| **Step 2** | Execute synthetic data generation procedures & train BQML churn model. | BigQuery Stored Procedures | 10 mins |
| **Step 3** | Deploy ADK agents to Vertex AI Reasoning Engine. | `deploy_reasoning_engine.py` | 15 mins |
| **Step 4** | Wire live GCP SDK clients in Express (`server.ts`) & Flask (`app.py`). | `server.ts` & `app.py` | 20 mins |
| **Step 5** | Run end-to-end QA, verify `/diagnostics` badges, and validate production build. | `Diagnostics.tsx` | 10 mins |
