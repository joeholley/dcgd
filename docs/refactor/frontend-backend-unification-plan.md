# Refactoring Plan: Frontend Unification & Comprehensive GCP Diagnostics

## Executive Summary & Objectives

This document defines the architectural refactoring plan for unifying the **Remix Gaming App** (`src/remix-gaming-app`) and **OmniArcade Gaming Knowledge Catalog Demo** (`src/gamingdatademo`), while introducing a multi-service **Diagnostics Dashboard** (`/diagnostics`) and consolidating overlapping frontend demonstration surfaces.

### Primary Objectives:
1. **Multi-Service Diagnostics Page (`/diagnostics`)**:
   - Provide a real-time, single-pane-of-glass dashboard at `/diagnostics` (and integrated in sidebar navigation).
   - Display live vs. mock status for every frontend page/section and every GCP backend service down to specific sub-features.
   - Differentiate at a glance between live GCP connections (ADC Auth, BigQuery, Pub/Sub, BQML, Dataplex, Vertex AI Agent Engine) and in-memory/synthetic fallback mocks.
2. **Frontend Navigation & Shell Unification**:
   - Embed all `gamingdatademo` Flask views (`/agent-comparison`, `/executive.html`, `/difficulty.html`, `/toxicity.html`, `/graph_visualization.html`, `/marketing_swarm_visualizer.html`) directly into the `remix-gaming-app` React/Vite layout.
   - Maintain the Python Flask service on port 5000 (proxied via `server.ts`) while providing a single, seamless navigation shell with unified header, localization controls (Region/Language), and state.
3. **Demo Consolidation & Cross-Section Interactions**:
   - Identify and eliminate feature redundancies across both applications (e.g. duplicate toxicity simulators, ROAS recovery plans, and difficulty stats).
   - Establish interactive cross-section workflows (e.g. LiveOps churn trigger in Guardrail driving Campaign Engine & Marketing Swarm; Knowledge Catalog rule discovery pushing live BQ row access policies to Guardrail; Operations difficulty bottleneck auto-opening Difficulty Balancer).

---

## 🏗️ Architecture & Component Hierarchy

### Unified Navigation Shell Layout
```
+---------------------------------------------------------------------------------------------------+
| [J] Jingle Games Player 360 | Region: [Japan v] Language: [EN|JA] | Admin Console [User (v)]      |
+-----------------------------+---------------------------------------------------------------------+
| SIDEBAR                     | MAIN CONTENT AREA                                                   |
|                             |                                                                     |
| -- EXECUTIVE & ANALYTICS -- | [Overview] | [Game Performance] | [Executive Portfolio (Flask)]     |
| * Gaming Overview (React)   |                                                                     |
| * Game Performance (React)  |                                                                     |
| * Executive Portfolio (Flask)|                                                                     |
|                             |                                                                     |
| -- LIVEOPS & AUTOMATION --  |                                                                     |
| * LiveOps Guardrail (React) |                                                                     |
| * Campaign Engine (React)   |                                                                     |
| * Difficulty Balancer (Flask)|                                                                    |
| * Marketing Swarm (Flask)   |                                                                     |
|                             |                                                                     |
| -- AGENT & AI WORKSPACE --  |                                                                     |
| * Gameplay Agents (React)   |                                                                     |
| * Agent Comparison (Flask)  |                                                                     |
| * Telemetry Catalog (React) |                                                                     |
|                             |                                                                     |
| -- OBSERVABILITY & DIAG --  |                                                                     |
| * API Observatory (React)   |                                                                     |
| * Trust & Safety (Flask)    |                                                                     |
| * GCP System Health (React) |                                                                     |
| * System Diagnostics (React)| <-- /diagnostics (NEW)                                             |
+-----------------------------+---------------------------------------------------------------------+
| Persistent AI Chat Drawer (PineCore AI / Vertex AI Agent Engine)                                  |
+---------------------------------------------------------------------------------------------------+
```

---

## 🗄️ Backend Infrastructure Evaluation: Reusable vs. Net-New Creation

A thorough line-by-line audit of `src/retail-data-and-ai-demo/infrastructure/terraform/games/` (`games-apis.tf`, `games-bigquery.tf`, `games-pubsub.tf`, `games-bigquery-procedure.tf`, `games-iam.tf`) was performed to evaluate existing vs. required backend resources.

### 1. 🟢 Reusable Backend Infrastructure (Provisioned by `retail-data-and-ai-demo`)
The following core streaming and BQML churn pipeline resources are **already provisioned in Terraform** and will be used directly:

* **Cloud Pub/Sub Streaming Pipeline**:
  - `google_pubsub_topic.live_telemetry` (`omniarcade-live-telemetry`): Ingests real-time `snake_case` JSON telemetry events.
  - `google_pubsub_subscription.live_telemetry_bq_sub` (`omniarcade-live-telemetry-bq-sub`): Zero-code BigQuery direct subscription.
* **BigQuery Datasets & Telemetry Tables**:
  - `google_bigquery_dataset.omniarcade_raw`, `omniarcade_synthetic`, `omniarcade_gold`.
  - `google_bigquery_table.live_session_events` (`omniarcade_raw.live_session_events` - partitioned by day, clustered by `player_id`, `event_type`).
  - `google_bigquery_table.gcp_players` & `iap_transactions`.
  - `google_bigquery_table.gold_player_360` (`omniarcade_gold.gold_player_360` - feature store for LTV, spend tier, churn risk score).
* **BigQuery ML (BQML) Churn Prediction**:
  - Model: `omniarcade_raw.player_churn_model` (Logistic Regression).
  - Stored Procedures: `train_churn_model` and `calculate_churn_risk` (executes `ML.PREDICT`).
* **Synthetic Data Procedures**: `generate_players`, `populate_player_tables`, and `generate_iap`.
* **Enabled APIs**: `bigquery`, `dataplex`, `pubsub`, `aiplatform`, `datalineage`, `cloudbuild`, `run`.

---

### 2. 🟡 Net-New Infrastructure Required in GCP / Terraform
The following resources are **confirmed absent** from `src/retail-data-and-ai-demo/infrastructure/terraform/games/` and must be created:

#### A. Additional Gold Analytical Tables (BigQuery)
* `omniarcade_gold.gold_regional_kpis`: Aggregates DAU, MAU, ARPU, total revenue, active sessions, and ping latency by region/country.
* `omniarcade_gold.gold_campaign_analytics`: Tracks campaign impressions, conversions, churn prevention rate, and incremental revenue.
* `omniarcade_silver.server_latency` / `gold_server_performance`: Tracks CCU, server region capacity utilization, and frame rate latency.
* `omniarcade_gold.gold_level_difficulty_funnel`: Tracks level starts, completions, failures, resets, and completion rates for difficulty re-balancing.

#### B. Dataplex Knowledge Catalog Infrastructure
* `google_dataplex_aspect_type.liveops_campaign_policy_aspect`: Enforces max promotional discount boundaries (`player_tier`, `max_discount_pct`, `target_sku`, `guardrail_boundary_status`).
* `google_dataplex_aspect_type.certified_reward_sku_aspect`: Validates certified in-game reward SKUs.
* `google_dataplex_glossary.omniarcade_glossary`: Glossary `omniarcade-studios-glossary-us` with terms like *Whale Spend*, *Idle Churn*, *KYP*, *ARPU*, *CCU*, *Toxicity Exposure*.

#### C. Vertex AI Reasoning Engine Deployment (Agent Engine)
* Reasoning Engine deployment script/module (`omniarcade-guardrail-agent` / `COUNCIL_AGENT_ID`) packaged with:
  - Dataplex MCP Tool (schema aspect resolution).
  - BigQuery SQL Execution Tool (Gold table querying).
  - Dataplex Policy Verification Tool.

#### D. Operational Database (Spanner / Firestore)
* `google_firestore_database` (or Spanner instance): Manages active campaign CRUD state and precached offer audit trails (currently handled via Firestore in-memory fallback in dev).

---

### 3. 🔵 Application Server Logic vs. GCP Infrastructure Breakdown

| Feature / Refactoring Plan Item | Reusable `retail-data-and-ai-demo` Infra | Net-New GCP Infra Required (Terraform) | Net-New Application Code Required |
| :--- | :--- | :--- | :--- |
| **`/diagnostics` Page & API** | Reuses ADC Auth, BigQuery, Pub/Sub, BQML, Dataplex, Vertex AI. | None (runs probes against existing APIs). | **Node.js**: 8-service probe handler in `server.ts` & React `<Diagnostics />` UI. |
| **LiveOps Churn Guardrail** | **Pub/Sub Topic**: `omniarcade-live-telemetry`<br>**BQ Table**: `live_session_events`<br>**BQML**: `player_churn_model` | **Dataplex Aspect**: `liveops_campaign_policy_aspect` | **Node.js**: SSE hub (`/api/guardrail/events`) & in-memory pre-caching (`setPrecachedOffer`). |
| **AI Assistant (`/api/chat`)** | ADC Auth & BigQuery Gold tables. | **Vertex AI**: Deployed `ReasoningEngine` instance. | **Node.js**: ADC fetch handler with static fallback reply in `server.ts`. |
| **Rule Discovery Sandbox** | BigQuery dataset (`omniarcade_gold`). | **IAM**: BQ Row Access Policy creation permissions. | **Node.js**: `/api/catalog/rules/discover` plain-text to SQL/Aspect compiler. |
| **Executive Overview** | **BQ Table**: `gold_player_360`. | **BQ Tables**: `gold_regional_kpis`. | **React**: `Overview.tsx` UI rendering. |
| **Operations & Difficulty** | None. | **BQ Tables**: `server_latency`, `gold_level_difficulty_funnel`. | **Node.js**: Reverse proxy to Flask `/api/difficulty-stats` & `/api/simulate/difficulty-spike`. |
| **Campaign Engine** | None. | **BQ Table**: `gold_campaign_analytics`<br>**Firestore**: `campaigns` collection. | **React**: `CampaignEngine.tsx` & Firestore client service (`firebase.ts`). |
| **Frontend Shell Unification** | None. | None. | **React/Node.js**: `FlaskSection.tsx` iframe wrapper, updated `Layout.tsx` & `App.tsx` nav items. |

---

## 🛠️ Detailed Component & Endpoint Specifications

### Phase 1: Comprehensive Multi-Service Diagnostics (`/diagnostics`)

#### 1. Backend Endpoint: `GET /api/system/diagnostics` (Express `server.ts`)
The Express gateway will execute a detailed diagnostic probe across all 9 frontend sections and 6 GCP backend services, returning a structured JSON payload:

```json
{
  "timestamp": "2026-07-08T08:15:00Z",
  "overall_mode": "HEALTHY_WITH_FALLBACKS",
  "gcp_services": {
    "auth": { "status": "LIVE", "mode": "ADC", "details": "Authenticated for omniarcade-demo", "latency_ms": 12 },
    "bigquery": { "status": "LIVE", "mode": "PROVISIONED", "details": "Dataset omniarcade_gold active", "latency_ms": 28 },
    "pubsub": { "status": "LIVE", "mode": "PROVISIONED", "details": "Topic omniarcade-live-telemetry active", "latency_ms": 14 },
    "bqml": { "status": "MOCK", "mode": "FALLBACK", "details": "Using dynamic heuristic churn scoring", "latency_ms": 5 },
    "dataplex": { "status": "LIVE", "mode": "PROVISIONED", "details": "Dataplex REST API & Aspect Registry online", "latency_ms": 35 },
    "vertex_agent": { "status": "LIVE", "mode": "PROVISIONED", "details": "Reasoning Engine omniarcade-guardrail-agent online", "latency_ms": 42 }
  },
  "sections": [
    {
      "id": "overview",
      "name": "Executive Overview",
      "status": "PARTIAL_MOCK",
      "sub_features": [
        { "name": "Player 360 Metrics (gold_player_360)", "connected": true, "source": "BigQuery Gold Table", "mode": "LIVE" },
        { "name": "Regional KPIs (gold_regional_kpis)", "connected": false, "source": "Synthetic Dev Fallback", "mode": "MOCK" },
        { "name": "Cross-Cloud Data Lineage", "connected": true, "source": "Dataplex Lineage API", "mode": "LIVE" }
      ]
    },
    {
      "id": "guardrail",
      "name": "LiveOps Guardrail",
      "status": "LIVE",
      "sub_features": [
        { "name": "Telemetry Stream Ingestion (/api/telemetry/stream)", "connected": true, "source": "Cloud Pub/Sub Topic", "mode": "LIVE" },
        { "name": "BigQuery Direct Subscription", "connected": true, "source": "omniarcade_raw.live_session_events", "mode": "LIVE" },
        { "name": "BQML Churn Prediction (ML.PREDICT)", "connected": true, "source": "player_churn_model", "mode": "LIVE" },
        { "name": "Dataplex Policy Verification & Pre-Cache", "connected": true, "source": "liveops_campaign_policy_aspect", "mode": "LIVE" },
        { "name": "SSE Offer Push (/api/guardrail/events)", "connected": true, "source": "Express SSE Hub", "mode": "LIVE" }
      ]
    },
    {
      "id": "campaigns",
      "name": "Campaign Engine",
      "status": "PARTIAL_MOCK",
      "sub_features": [
        { "name": "Campaign Analytics (gold_campaign_analytics)", "connected": false, "source": "Dev Fallback Data", "mode": "MOCK" },
        { "name": "Campaign CRUD State", "connected": false, "source": "Firestore In-Memory Mock", "mode": "MOCK" },
        { "name": "Marketing Swarm Anomaly Simulation", "connected": true, "source": "Flask /api/marketing/simulate-cluster", "mode": "LIVE" }
      ]
    },
    {
      "id": "agent-comparison",
      "name": "Agent Comparison Workspace (Flask)",
      "status": "LIVE",
      "sub_features": [
        { "name": "WebSocket Step Streaming (/api/ws)", "connected": true, "source": "Flask-Sock Proxy", "mode": "LIVE" },
        { "name": "KC-Guided Agent Dataplex Tools", "connected": true, "source": "Vertex AI Reasoning Engine + Dataplex", "mode": "LIVE" }
      ]
    }
  ]
}
```

#### 2. Frontend Component: `Diagnostics.tsx` (`src/remix-gaming-app/src/components/sections/Diagnostics.tsx`)
- Renders an interactive matrix grid:
  - **Header Summary Badges**: Overall System Mode (e.g. `ALL LIVE`, `HEALTHY WITH FALLBACKS`, `OFFLINE MOCK`), Total Latency, and Active GCP Project.
  - **GCP Backend Service Grid**: 6 cards showing live probe status for Auth, BigQuery, Pub/Sub, BQML, Dataplex, and Vertex AI Agent.
  - **Per-Section Status Table**: Lists all 9 React sections + 5 Flask views, showing each sub-feature with a clear `LIVE (GCP)` green pill or `MOCK (Dev)` amber pill, along with latency and data source.

---

### Phase 2: Frontend Navigation & Shell Unification

#### 1. Flask View Embedding Strategy (`FlaskSection.tsx`)
Rather than rewriting `gamingdatademo` HTML/JS in React or opening external browser tabs, create a dedicated React wrapper component: `src/remix-gaming-app/src/components/sections/FlaskSection.tsx`:

```tsx
interface FlaskSectionProps {
  title: string;
  path: string;
  description: string;
}

export function FlaskSection({ title, path, description }: FlaskSectionProps) {
  return (
    <div className="h-full flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Integrated Header Bar */}
      <div className="px-6 py-4 bg-slate-800/80 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            {title}
          </h2>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-white/10 text-xs font-mono text-slate-300">
          <span>Route: {path}</span>
        </div>
      </div>

      {/* Embedded IFrame with Proxy Communication */}
      <div className="flex-1 w-full h-full relative">
        <iframe
          src={path}
          className="w-full h-full border-none"
          title={title}
        />
      </div>
    </div>
  );
}
```

#### 2. Updated Navigation Menu (`Layout.tsx` & `App.tsx`)
Add Flask pages as first-class sections in the sidebar navigation:

- **Executive & Analytics**:
  - `Gaming Overview` (React)
  - `Game Performance` (React)
  - `Executive Portfolio` (Flask: `/executive.html`)
  - `Telemetry Catalog` (React: `KnowledgeCatalog.tsx`)

- **LiveOps & Automation**:
  - `LiveOps Guardrail` (React: `LiveOpsGuardrail.tsx`)
  - `Campaign Engine` (React: `CampaignEngine.tsx`)
  - `Difficulty Balancer` (Flask: `/difficulty.html`)
  - `Marketing Swarm` (Flask: `/marketing_swarm_visualizer.html`)

- **Agent & AI Workspace**:
  - `Gameplay Agents` (React: `AgenticWorkflows.tsx`)
  - `Agent Comparison` (Flask: `/agent-comparison`)
  - `Cross-Cloud Lineage Graph` (Flask: `/graph_visualization.html`)

- **Observability & Diagnostics**:
  - `API Observatory` (React: `ITObservatory.tsx`)
  - `Trust & Safety` (Flask: `/toxicity.html`)
  - `GCP System Health` (React: `GCPHealth.tsx`)
  - `System Diagnostics` (React: `Diagnostics.tsx` at `/diagnostics`)

---

### Phase 3: Demonstration Consolidation & Inter-Section Interactions

#### 1. Overlap Elimination & Unified Demo Workflows

| Feature Area | Current Remix Implementation | Current Flask Implementation | Consolidation & Cross-Section Interaction |
| :--- | :--- | :--- | :--- |
| **Player Churn & Recovery** | `LiveOpsGuardrail.tsx` ($0.99 Shield offer) & `CampaignEngine.tsx` | `/api/marketing/simulate-cluster` (Marketing Swarm) & `roas-drop` | **Unified Churn-to-Campaign Pipeline**: When a churn alert triggers in `LiveOpsGuardrail`, a button *"Trigger Marketing Recovery Swarm"* directly opens `CampaignEngine` pre-populated with the target cohort and auto-invokes the Flask Marketing Swarm recovery agent. |
| **Game Difficulty & Level Balancing** | `Operations.tsx` (Recharts stats & CCU) | `/difficulty.html` (Level 2 moves solver simulation) | **Operations-to-Balancer Bridge**: In `Operations.tsx`, clicking on an anomaly in the Level Completion funnel directly navigates to the embedded `Difficulty Balancer` (Flask) and executes the solver playtest simulation. |
| **Trust, Safety & Anti-Cheat** | `AgenticWorkflows.tsx` (Cheat detection trace) | `/toxicity.html` (Toxic chat & GIRA safety assessment) | **Unified Trust & Safety Hub**: Combine toxicity incident simulation and anti-cheat memory modification detection into a single "Trust & Safety Observatory" view. |
| **Dataplex Policy & Governance** | `KnowledgeCatalog.tsx` (Rule Discovery Sandbox) | `/api/table-info` & `/api/term-info` (Dataplex glossary & aspect tags) | **Live Policy Push**: Rules compiled in the Rule Discovery Sandbox immediately update the Dataplex aspect tag registry, affecting policy checks in both `LiveOpsGuardrail` and the KC-Guided Agent in `Agent Comparison`. |

---

## 📅 Implementation Roadmap & Action Items

### Step 1: Create Diagnostics Component & API Endpoint
- Create `src/remix-gaming-app/src/components/sections/Diagnostics.tsx`.
- Add `GET /api/system/diagnostics` route in `server.ts` to query all 9 React sections and 5 Flask views.

### Step 2: Integrate Flask Views into Remix Navigation
- Create `FlaskSection.tsx` iframe wrapper component.
- Update `App.tsx` and `Layout.tsx` nav items to include all Flask views directly in sidebar.

### Step 3: Implement Cross-Section Event Bus & State Sharing
- Add a lightweight event listener / state bus in `App.tsx` (e.g. `onTriggerMarketingRecovery(cohort)`, `onTriggerDifficultySolver(level)`).
- Connect `LiveOpsGuardrail` $\rightarrow$ `CampaignEngine` $\rightarrow$ `Marketing Swarm`.
- Connect `Operations` $\rightarrow$ `Difficulty Balancer`.

### Step 4: Update Documentation
- Update `docs/frontend-backend-mapping.md` and `docs/refactor/frontend-backend-unification-plan.md`.
