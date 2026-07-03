# Real-Time Autonomous Churn Guardrail & Dynamic Incentive Engine
## End-to-End Implementation & Backend Integration Plan

This document details the plan to extend the **Remix Gaming App** ([remix-gaming-app](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md)) and integrate it with the GCP backend architecture ([retail-data-and-ai-demo-dev](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/retail-data-and-ai-demo-dev/overview.md) + [gamingdatademo](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/gamingdatademo/overview.md)) to fulfill the **Real-Time Autonomous Guardrail Narrative** ([docs/narrative.md](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/narrative.md)).

---

## 🎯 Value Proposition & Customer Demonstration Goals

The goal of this feature is to demonstrate three primary Google Cloud data & AI pillars:
1. **AI-Native Real-Time Streaming Ingestion**: Using **Cloud Pub/Sub Direct BigQuery Subscription** to ingest high-volume game telemetry (`boss_fail`, `quit_intent`) straight into BigQuery without overnight batch delays.
2. **In-Warehouse Machine Learning (BigQuery ML)**: Running predictive churn inference via **BQML (`ML.PREDICT`)** directly inside BigQuery over incoming session logs joined with player feature tables, eliminating data movement to external servers.
3. **Universal Context & Policy Enforcement**: Using **Dataplex Knowledge Catalog** via MCP to verify player tier semantics (*Whale/Dolphin*), compliance policies, and certified SKU pricing rules before executing an automated intervention.

---

## 🏗️ End-to-End Real-Time Churn Guardrail Architecture

```mermaid
graph TD
    subgraph Step 1: Perceive (Live Telemetry via Pub/Sub Direct BigQuery Subscription)
        GAME_CLIENT[Simulated Mobile RPG Client: GameClientSimulation.tsx] -->|Player Fails Boss & Clicks 'Quit'| EXPRESS[Express Backend /api/telemetry/stream]
        EXPRESS -->|Publish JSON Payload (snake_case + ISO-8601)| PUBSUB[Cloud Pub/Sub Topic: omniarcade-live-telemetry]
        PUBSUB -->|Direct BQ Subscription: games-pubsub.tf| BQ_RAW[omniarcade_raw.live_session_events]
    end

    subgraph Step 2: Reason (BigQuery ML In-Engine Prediction)
        BQ_RAW --> BQ_ML[BQML Model: omniarcade_raw.player_churn_model]
        GOLD[omniarcade_gold.gold_player_360 (or omniarcade_raw.gcp_players fallback)] --> BQ_ML
        EXPRESS -->|Targeted ML.PREDICT Query| BQ_ML
        BQ_ML -->|Churn Propensity Spikes > 85%| AGENT_TRIGGER[Trigger Autonomous Guardrail Agent]
    end

    subgraph Step 3: Context Check (Dataplex Universal Context Engine with Pre-Caching)
        AGENT_TRIGGER --> MCP[Model Context Protocol Tools]
        MCP --> DATAPLEX[Dataplex Knowledge Catalog]
        DATAPLEX -->|Aspect Check: 08_create_churn_guardrail_aspects.py| POLICY_OK[Policy & Semantics Certified (<300ms)]
    end

    subgraph Step 4: Act (Analytical-Operational Fusion & Conversion Loop)
        POLICY_OK --> OPERATIONAL_DB[Operational DB: AlloyDB / Firestore session_state]
        OPERATIONAL_DB -->|WebSocket Push / Server-Sent Events| GAME_CLIENT
        GAME_CLIENT -->|Render In-Game Pop-up: '$0.99 Frost Giant Shield Bundle'| PLAYER_BUY[Player Purchases Discounted Bundle]
        PLAYER_BUY -->|Revenue +$0.99 / Churn Averted| BQ_GOLD_UPDATE[Update LiveOps KPIs: Overview.tsx & CampaignEngine.tsx]
    end
```

---

## 📚 Dataplex Knowledge Catalog Required Metadata Specification

To ensure the ADK Proactive Agent can query and validate intervention parameters, the Dataplex Knowledge Catalog setup in `gamingdatademo/scripts/` is extended with dedicated terms and aspect types (`08_create_churn_guardrail_aspects.py`):

### 1. Business Glossary Terms (`01_create_glossary.py` Extension)
- **`Whale Spend`**: Definition = *"Player lifetime monetization exceeding $500.00 USD"*. Linked to `omniarcade_gold.gold_player_360.total_iap_spend`.
- **`Real-Time Churn Propensity`**: Definition = *"Predictive probability score (0.0 to 1.0) derived from BQML inference over active session friction events."*
- **`Autonomous Intervention Boundary`**: Definition = *"Execution rules governing dynamic offer pop-ups during session exit intent."*

### 2. Custom Aspect Types (`08_create_churn_guardrail_aspects.py`)
Attached to `omniarcade_gold.gold_player_360` and `omniarcade_gold.gold_campaign_analytics`:

#### A. `liveops_campaign_policy_aspect` (Campaign Policy Metadata)
```python
{
    "aspect_type_id": "liveops_campaign_policy_aspect",
    "fields": {
        "max_discount_pct_whale": 80,       # Maximum discount allowed for Whale tier (80%)
        "max_discount_pct_dolphin": 50,     # Maximum discount allowed for Dolphin tier (50%)
        "max_discount_pct_f2p": 25,         # Maximum discount allowed for F2P tier (25%)
        "policy_status": "APPROVED_PRODUCTION",
        "compliance_certified": True
    }
}
```

#### B. `certified_reward_sku_aspect` (Reward SKU Metadata)
```python
{
    "aspect_type_id": "certified_reward_sku_aspect",
    "fields": {
        "sku_id": "frost_giant_shield_pack",
        "item_name": "50% Shield Boost & 100 Health Elixirs",
        "base_price_usd": 4.99,
        "min_discount_price_usd": 0.99,
        "certification_status": "ACTIVE_PRODUCTION"
    }
}
```

---

## 🤖 Proactive Agent & ADK Framework Specification

The architecture deploys two distinct agent roles built with the **Google Agent Development Kit (`google-adk`)** and hosted on **Vertex AI Agent Engine**:

### 1. Dual Agent Architecture

| Dimension | Proactive Guardrail Agent (`agents/agent_kc`) | Reactive Executive Assistant (`PineCore`) |
| :--- | :--- | :--- |
| **Framework** | `google-adk` Python SDK on Vertex AI Agent Engine. | `google-adk` Python SDK on Vertex AI Agent Engine. |
| **Trigger Mode** | **Event-Driven**: Auto-invoked by Express when BQML churn score > 85%. | **Prompt-Driven**: Executed when user types in `HospitalAdmin.tsx`. |
| **MCP Tools** | `get_glossary_term`, `verify_aspect_compliance`, `verify_intervention_policy`. | `search_knowledge_catalog`, `execute_bigquery_sql`, `get_dataset_lineage`. |
| **Primary Task** | Autonomous policy verification & pop-up offer payload generation. | Interactive executive natural language analytics reporting. |

### 2. ADK Model Context Protocol (MCP) Tools Specification
The Proactive Guardrail Agent is equipped with 3 custom MCP tools connecting to Dataplex:

1. **`get_glossary_term(term_name)`**:
   - Queries Dataplex Knowledge Catalog REST APIs (`dataplex.googleapis.com`) to retrieve business semantics (e.g. verifying `Whale Spend` definition = LTV > $500).
2. **`verify_aspect_compliance(sku_id, discount_percentage)`**:
   - Reads `liveops_campaign_policy_aspect` and `certified_reward_sku_aspect` tags on Gold tables to ensure max discount for `Whale` tier is $\le 80\%$ and reward SKU `frost_giant_shield_pack` is certified.
3. **`verify_intervention_policy(player_id, payer_tier, proposed_discount)`**:
   - Validates automated campaign boundaries and outputs an approved decision payload.

### 3. ADK Decision Output JSON Schema
When policy checks pass, the ADK agent returns a structured JSON payload to `server.ts`:

```json
{
  "decision": "APPROVED",
  "player_id": "player_101",
  "payer_tier": "Whale",
  "churn_score": 0.87,
  "offer_payload": {
    "title": "Frost Giant Boss Defeat Pack",
    "description": "That Frost Giant is tough! Grab a temporary 50% Shield Boost and 100 Health Elixirs for just $0.99 now.",
    "discount_price": 0.99,
    "original_price": 4.99,
    "sku": "frost_giant_shield_pack"
  },
  "dataplex_audit_id": "audit_881923"
}
```

---

## 🤖 BigQuery ML (BQML) Churn Engine Design

Instead of static conditional SQL rules (`IF deaths > 3 THEN 0.85`), the architecture uses **BigQuery ML** to train a Logistic Regression model during demo setup and run real-time inference over streaming session logs.

### 1. BQML Model Training Routine (`train-churn-model.sql.tftpl`)
Located in `infrastructure/terraform/games/games-bigquery-routines/`:

```sql
-- Trains BQML Logistic Regression Model on historical player feature tables
CREATE OR REPLACE MODEL `omniarcade_raw.player_churn_model`
OPTIONS(
  MODEL_TYPE = 'LOGISTIC_REG',
  INPUT_LABEL_COLS = ['is_churned'],
  AUTO_CLASS_WEIGHTS = TRUE
) AS
SELECT 
  consecutive_deaths,
  session_duration_seconds,
  payer_tier,
  total_iap_spend,
  days_since_last_login,
  favorite_category,
  is_churned
FROM `omniarcade_gold.gold_player_360`
WHERE is_churned IS NOT NULL;
```

### 2. In-Engine Real-Time Inference (`ML.PREDICT`)
When `/api/telemetry/stream` receives a game client event, `server.ts` executes `ML.PREDICT` with robust fallback `LEFT JOIN` logic:

```sql
SELECT 
  t.player_id,
  p.prob AS real_time_churn_score
FROM ML.PREDICT(
  MODEL `omniarcade_raw.player_churn_model`,
  (
    SELECT 
      s.consecutive_deaths,
      s.session_duration_seconds,
      COALESCE(gold.payer_tier, raw.payer_tier, 'Whale') AS payer_tier,
      COALESCE(gold.total_iap_spend, raw.total_iap_spend, 500.0) AS total_iap_spend,
      COALESCE(gold.days_since_last_login, 1) AS days_since_last_login,
      COALESCE(gold.favorite_category, 'Skins') AS favorite_category
    FROM `omniarcade_raw.live_session_events` s
    LEFT JOIN `omniarcade_gold.gold_player_360` gold ON s.player_id = gold.player_id
    LEFT JOIN `omniarcade_raw.gcp_players` raw ON s.player_id = raw.player_id
    WHERE s.player_id = @target_player_id
    ORDER BY s.timestamp DESC
    LIMIT 1
  )
),
UNNEST(predicted_is_churned_probs) p
WHERE p.label = 1;
```

---

## 📡 Google Cloud Pub/Sub $\rightarrow$ BigQuery Streaming Pattern

Following the **`retail-data-and-ai-demo-dev`** Infrastructure-as-Code pattern, Pub/Sub ingestion is provisioned as part of the `games/` Terraform extension in `infrastructure/terraform/games/games-pubsub.tf`.

```hcl
# Pub/Sub Topic for Live Game Telemetry
resource "google_pubsub_topic" "live_telemetry" {
  name    = "omniarcade-live-telemetry"
  project = var.gcp_project_id
}

# Direct BigQuery Subscription (Zero-Code Streaming Ingestion)
resource "google_pubsub_subscription" "live_telemetry_bq_sub" {
  name    = "omniarcade-live-telemetry-bq-sub"
  topic   = google_pubsub_topic.live_telemetry.name
  project = var.gcp_project_id

  bigquery_config {
    table               = "${var.gcp_project_id}:${google_bigquery_dataset.omniarcade_raw.dataset_id}.${google_bigquery_table.live_session_events.table_id}"
    use_topic_schema    = true
    write_metadata      = true
    drop_unknown_fields = true
  }
}
```

---

## 🛠️ Mitigations & Edge Case Risk Protections

### 1. Robust Fallback SQL Logic for Dataform Compilation Timing
- **Edge Case**: If telemetry events arrive before Dataform completes compilation of `omniarcade_gold.gold_player_360`, standard inner joins will crash.
- **Fix**: `ML.PREDICT` query uses a `LEFT JOIN` with `COALESCE` falling back to raw staging profiles in `omniarcade_raw.gcp_players`.

### 2. Immediate BQML Event-Driven Score Evaluation (`server.ts`)
- **Edge Case**: Streaming events land in BigQuery via Pub/Sub, but score predictions require explicit execution.
- **Fix**: When `/api/telemetry/stream` receives a payload, `server.ts` executes `ML.PREDICT` for `player_id` and streams the resulting probability score to the UI via Server-Sent Events (SSE).

### 3. Asynchronous Pre-Caching for <300ms Intervention Pop-ups
- **Edge Case**: Multi-step Vertex AI Agent Engine $\rightarrow$ Dataplex MCP tool calls take 3–8 seconds, missing the player's app exit window.
- **Fix**: As the player's churn score crosses **50%**, `server.ts` asynchronously triggers the Dataplex policy verification check (`08_create_churn_guardrail_aspects.py`). When score spikes past **85%**, the pre-validated `$0.99 Frost Giant Shield Bundle` pops up instantly (<300ms).

### 4. Strict Pub/Sub JSON Schema Formatting
- **Edge Case**: Field mismatches (camelCase vs. snake_case) cause Pub/Sub Direct BigQuery Subscription failures.
- **Fix**: `server.ts` formats payloads strictly as `snake_case` with ISO-8601 formatted timestamps (`"timestamp": "2026-07-03T09:12:00Z"`).

---

## 🔍 Gap Analysis: Current Remix Demo vs. Extended Target Narrative

| Narrative Element | Current Remix Demo Capability | Extended Backend Integration Plan |
| :--- | :--- | :--- |
| **1. Perceive (Continuous Monitoring)** | `Operations.tsx` displays static Recharts time-series graphs of active user counts and server metrics. | Create **`GameClientSimulation.tsx`** (Left Screen): Interactive RPG boss fight simulator emitting live telemetry to `/api/telemetry/stream` $\rightarrow$ **Pub/Sub Topic** $\rightarrow$ Direct Subscription to BigQuery `omniarcade_raw.live_session_events`. |
| **2. Reason (In-Engine Inference)** | Static/hardcoded churn numbers in `Overview.tsx`. | Deploy **BQML Churn Model (`omniarcade_raw.player_churn_model`)** executing `ML.PREDICT` in BigQuery over streaming session features. |
| **3. Context Check (Universal Context)** | `KnowledgeCatalog.tsx` displays static dataset search cards. | Integrate **Vertex AI KC-Guided Agent (`google-adk`)** via MCP to query Dataplex glossaries & `liveops_campaign_policy_aspect` tags (`08_create_churn_guardrail_aspects.py`). |
| **4. Act (Analytical-Operational Fusion)** | `CampaignEngine.tsx` creates manual marketing campaign cards in Firestore. | Implement a **Real-Time Operational Bridge** (`server.ts` + SSE Hub): Pushes pre-validated offer payload to `GameClientSimulation.tsx` in <300ms before unmount. |
| **Conversion Loop** | Manual button clicks. | Clicking "Buy $0.99 Offer" streams a purchase event back through Pub/Sub to BigQuery, decrementing churn risk and updating `Overview.tsx` KPI counters live. |

---

## ⚡ Detailed Step-by-Step Extension Plan

### Phase 1: Real-Time Telemetry & BQML Churn Reasoning Engine (`gamingdatademo` + `retail-data-and-ai-demo-dev`)
1. **Define `omniarcade_raw.live_session_events` Table**:
   - Schema: `session_id`, `player_id`, `event_type` (`boss_fail`, `quit_intent`), `consecutive_deaths`, `timestamp`.
2. **Implement BQML Training & Inference Routines**:
   - Location: `infrastructure/terraform/games/games-bigquery-routines/`.
   - Files: `train-churn-model.sql.tftpl` and `calculate-churn-risk.sql.tftpl` (`ML.PREDICT`).

---

### Phase 2: Dataplex Universal Context Check & Aspects Setup (Vertex AI Agent Engine + MCP + ADK)
1. **Create Churn Guardrail Aspects Script (`gamingdatademo/scripts/08_create_churn_guardrail_aspects.py`)**:
   - Registers `liveops_campaign_policy_aspect` and `certified_reward_sku_aspect` in Dataplex Knowledge Catalog.
2. **Extend ADK KC-Guided Agent Tools (`agents/agent_kc`)**:
   - Equip agent with `verify_intervention_policy`, `get_glossary_term`, and `verify_aspect_compliance` tools.
   - Pre-cache policy approval when churn score crosses 50%.

---

### Phase 3: Express Backend Real-Time Gateway (`server.ts`)
1. **Streaming Telemetry Endpoint (`/api/telemetry/stream`)**:
   - Receives events from `GameClientSimulation.tsx`.
   - Publishes strict `snake_case` ISO-8601 JSON payload to `omniarcade-live-telemetry`.
   - Executes immediate `ML.PREDICT` query for `player_id` and pushes result via Server-Sent Events (SSE).

---

### Phase 4: Remix Frontend Split-Screen UI Modernization (`remix-gaming-app`)
1. **New Split-Screen View (`src/components/sections/LiveOpsGuardrail.tsx`)**:
   - **Left Panel (Interactive Game Client Simulation)**: Simulated mobile RPG boss fight interface ("Fail Encounter", "Quit Mission"). Instant dynamic pop-up overlay (<300ms): *"50% Shield Boost & 100 Elixirs for $0.99"*.
   - **Right Panel (Real-Time LiveOps Telemetry & Guardrail Observatory)**: Live JSON event stream, dynamic BQML radial churn propensity gauge (25% $\rightarrow$ 50% $\rightarrow$ **87%**), Dataplex policy audit card, and closed-loop revenue counters (+1 Churn Averted, +$0.99 Incremental Revenue).

---

## 📊 Verification Runbook & Customer Demo Script

| Demonstration Step | User Interface Action | Backend System Execution | Customer Value Highlight |
| :--- | :--- | :--- | :--- |
| **1. Session Failures** | Click "Fail Encounter" 3 times on simulated mobile game client (Left Screen). | `GameClientSimulation.tsx` posts `snake_case` JSON to `/api/telemetry/stream` $\rightarrow$ **Pub/Sub Topic** $\rightarrow$ Direct Subscription writes to `omniarcade_raw.live_session_events`. | Real-time live session telemetry ingestion without overnight batch delay. |
| **2. Quit Intent & BQML ML Spike** | Click "Quit Mission". | Express runs BQML `ML.PREDICT(MODEL player_churn_model)`. Churn risk gauge spikes to **87%**. | In-engine native Machine Learning predictive inference in BigQuery. |
| **3. Knowledge Catalog Verification** | Right Screen displays "Dataplex Policy Check: Pre-Cached Tier Verification". | Vertex AI Agent (`google-adk`) pre-validates Dataplex `Whale` tier rules & aspect tags (`08_create_churn_guardrail_aspects.py`) when score crossed 50%. | Universal Context Engine guaranteeing governance & policy compliance. |
| **4. In-Game Intervention** | Game client pops up (<300ms): *"50% Shield Boost for $0.99"*. | Backend state update in Firestore pushes SSE payload to game client before unmount. | Analytical-Operational Fusion shifting from observation to instant execution. |
| **5. Offer Conversion** | Click "Accept & Purchase ($0.99)". | In-app purchase event published to Pub/Sub; BigQuery Gold KPI counters update live (`Overview.tsx` revenue +$0.99, Churn Averted +1). | Closed-loop revenue optimization turning churn risk into micro-transaction. |
