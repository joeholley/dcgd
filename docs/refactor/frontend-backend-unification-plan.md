# Refactoring Plan: Frontend Unification, Comprehensive GCP Diagnostics & Simulator Architecture

## Executive Summary & Objectives

This document defines the architectural refactoring plan for unifying the **Remix Gaming App** (`src/remix-gaming-app`) and **OmniArcade Gaming Knowledge Catalog Demo** (`src/gamingdatademo`), while introducing a multi-service **Diagnostics Dashboard** (`/diagnostics`), defining explicit scope boundaries for live vs. mock services, and establishing a **Live Game & Telemetry Simulator** microservice.

### Primary Objectives:
1. **Multi-Service Diagnostics Page (`/diagnostics`)**:
   - Provide a real-time, single-pane-of-glass dashboard at `/diagnostics` (and integrated in sidebar navigation).
   - Display live vs. mock status for every frontend page/section and every GCP backend service down to specific sub-features.
   - Differentiate at a glance between live GCP connections (ADC Auth, BigQuery, Pub/Sub, BQML, Dataplex, Vertex AI Agent Engine) and in-memory/synthetic fallback mocks.
2. **Frontend Navigation & Shell Unification**:
   - Embed all `gamingdatademo` Flask views (`/agent-comparison`, `/executive.html`, `/difficulty.html`, `/toxicity.html`, `/graph_visualization.html`, `/marketing_swarm_visualizer.html`) directly into the `remix-gaming-app` React/Vite layout.
   - Maintain the Python Flask service on port 5000 (proxied via `server.ts`) while providing a single, seamless navigation shell with unified header, localization controls (Region/Language), and state.
3. **Scope Boundaries & Out-of-Scope Service Flags**:
   - Clearly delineate which backend services are in-scope for live GCP integration versus out-of-scope (mock-only).
   - Explicitly flag AWS / Multi-cloud (Snowflake, BigQuery Omni), Google Ads API, Firebase/Firestore, and Looker as **Mock-Only (Out of Scope for Live GCP Deployment)**.
4. **Live Telemetry & Game Simulator Architecture**:
   - Differentiate between historical analytical data (BigQuery Gold tables) and live operational data (AlloyDB CCU/DAU, Pub/Sub session ticks).
   - Design a containerized, Cloud Run-deployable **Live Game & Telemetry Simulator** that writes real-time gameplay ticks to Cloud Pub/Sub and AlloyDB, controllable directly via web UI toggles.

---

## 🚫 Scope Boundaries & Out-of-Scope Backend Services (Mock Only)

To maintain a focused deployment scope while preserving full narrative impact in the frontend UI, specific multi-cloud, third-party, and auxiliary services are designated as **Out of Scope for Live GCP Infrastructure Provisioning** and will be powered exclusively by robust, in-memory or simulated dev mocks:

| Service / Technology | UI Reference & Narrative Role | Scope Designation | Implementation Strategy |
| :--- | :--- | :--- | :--- |
| **AWS S3 & Snowflake** | Cold log archive & player economic LTV tables in `Overview.tsx` & `ITObservatory.tsx`. | **MOCK ONLY (Out of Scope)** | UI text, diagrams, and asset cards retain S3/Snowflake labels, but data queries return pre-computed static JSON or in-memory arrays. |
| **BigQuery Omni** | Cross-cloud SQL federation over AWS/Snowflake tables in `Overview.tsx`. | **MOCK ONLY (Out of Scope)** | Query execution is simulated in Express (`server.ts`) without creating BigQuery Omni connections or external AWS S3/Snowflake tables. |
| **Google Ads API & DV360** | Automated ad network campaign delivery & RTB bid adjustment in `CampaignEngine.tsx`. | **MOCK ONLY (Out of Scope)** | OAuth authorization and campaign deployment are handled via client-side `setTimeout()` state toggles and local React state. |
| **Firebase / Firestore** | Campaign document store & report catalog in `CampaignEngine.tsx` & `KnowledgeCatalog.tsx`. | **MOCK ONLY (Out of Scope)** | Replaced with an in-memory Node.js JS `Map` or local JSON file store in Express (`server.ts`), eliminating live Firebase/Firestore dependencies. |
| **Looker / Looker Embedded** | Executive C-suite BI dashboards in `executive.html`. | **MOCK ONLY (Out of Scope)** | Embedded iframe points to self-contained SVG/HTML5 canvas charts rendered directly by Flask/React rather than a live Looker instance. |

---

## 🎮 Live Telemetry & Game Simulator Architecture

### 1. Distinction: Live Operational Data vs. Historical Analytical Data

The platform relies on two distinct categories of data:
- **Historical / Analytical Data (BigQuery)**: Pre-aggregated Gold Medallion tables (`gold_player_360`, `gold_regional_kpis`, `gold_campaign_analytics`, `gold_level_difficulty_funnel`) containing static/batch historical records used for trend analysis and initial ML model training.
- **Live Operational Data (Cloud Pub/Sub & AlloyDB)**: High-frequency, sub-second telemetry streams and real-time operational state (active CCU counters, live match lobby concurrency, ping latencies, in-game boss deaths, chat moderation flags).

Without live games actively being played by thousands of concurrent human players, the live operational data views (`Operations.tsx`, `LiveOpsGuardrail.tsx`, `toxicity.html`) would remain static or empty. Therefore, a containerized **Live Game & Telemetry Simulator** is required to generate realistic, dynamic live data.

---

### 2. Simulator Specification & Capabilities

The simulator microservice simulates realistic gameplay activity across multiple global title servers (`Cosmic Raider`, `Shadow Realm`, `Match-3 Quest`):

#### A. Simulated Event Types & Lifecycles
1. **Player Session Lifecycle**: `session_start`, `heartbeat` (every 15s), `match_start`, `match_end`, `session_end`.
2. **Gameplay & LiveOps Ticks**: `level_attempt`, `level_fail` (tracking consecutive deaths on Level 2), `boss_encounter`, `boss_death`.
3. **Monetization & Churn Events**: `iap_view`, `iap_attempt` (tracking failed or abandoned purchases), `churn_risk_flag`.
4. **Trust & Safety Stream**: In-game player chat messages tagged with synthetic toxicity scores and GIRA incident flags.

#### B. Dynamic Player Concurrency (DAU/CCU) Curve
- Generates a smooth, sinusoidal 24-hour player concurrency curve (ranging from 1,200 to 18,500 CCU) with regional peaks (APAC, EMEA, AMER).

#### C. LiveOps Anomaly Injection Engine
The simulator supports on-demand anomaly injection triggered by web UI controls:
- **Level 2 Bottleneck Spike**: Increases Level 2 failure rate from 15% to 82%, generating telemetry that triggers the Operations-to-Difficulty Balancer workflow.
- **High-Churn Whale Boss Death**: Simulates consecutive boss deaths for VIP/Whale players (LTV > $500), generating Pub/Sub events that trigger the LiveOps Guardrail <300ms offer pop-up.
- **Toxic Chat Outbreak**: Injects toxic chat messages into the stream, populating the Trust & Safety Observatory.

---

### 3. Data Volume & Target GCP Products Written To

| GCP Target Service | Target Table / Topic | Write Rate (Normal / Anomaly) | Daily Volume | Purpose & Consumer |
| :--- | :--- | :--- | :--- | :--- |
| **Cloud Pub/Sub** | Topic `gaming-live-telemetry` | 10–25 events/sec (Normal)<br>50–100 events/sec (Anomaly Burst) | ~25,000–50,000 events/day | Ingested zero-code via Direct Subscription into BigQuery `gaming_raw.live_session_events`; consumed by SSE hub in `server.ts` for LiveOps Guardrail. |
| **AlloyDB for PostgreSQL** | `live_ccu_counter`, `active_match_lobbies`, `gira_incident_tickets` | 1 SQL UPSERT / 5 seconds | ~17,280 rows/day | Real-time operational state queries for `Operations.tsx` (CCU, ping latency) and `toxicity.html` (GIRA incident tickets). |

---

### 4. Deployment Model & Web Frontend Toggle Control

#### A. Microservice Containerization & Cloud Run Deployment
- **Built as**: Lightweight Python / Go microservice (`src/simulator/`).
- **Deployment Target**: Google Cloud Run (or Cloud Run Job / background worker thread inside the unified container).
- **Environment Variables**:
  - `GCP_PROJECT_ID`: Target GCP project.
  - `PUBSUB_TOPIC_ID`: `gaming-live-telemetry`.
  - `ALLOYDB_DB_URI`: Connection string for AlloyDB instance (optional, falls back to local SQLite/in-memory if offline).
  - `SIMULATION_RATE_HZ`: Target event frequency (default: 10 Hz).

#### B. Express Gateway Control REST Endpoints (`server.ts`)
The simulator exposes control endpoints proxied through the Express gateway:
- `POST /api/simulator/start`: Launches live simulation loop.
- `POST /api/simulator/stop`: Pauses simulation loop.
- `GET /api/simulator/status`: Returns current status (RUNNING/PAUSED), event rate, total events published, active CCU, and active anomalies.
- `POST /api/simulator/inject-anomaly`: Body: `{ "anomaly_type": "level_2_bottleneck" | "whale_churn_risk" | "toxic_chat" }`.

#### C. Web Frontend Toggle UI
- **Control Bar Component**: Integrated in the header of `Layout.tsx` and as a prominent control panel in `Diagnostics.tsx`.
- **UI Elements**:
  - **Live Game Telemetry Simulator [ON/OFF]** toggle switch with green active pulse badge.
  - **Live CCU Gauge**: Real-time counter showing current simulated CCU (e.g. `14,280 CCU`).
  - **Inject Anomaly Dropdown**: Allows demo presenters to manually trigger Level 2 bottleneck or High-Churn Boss Death anomalies during live customer presentations.

---

## 🏗️ Architecture & Component Hierarchy

### Unified Navigation Shell Layout
```
+---------------------------------------------------------------------------------------------------+
| [J] Jingle Games Player 360 | Region: [Japan v] | Simulator: [● LIVE (14,280 CCU) [ON/OFF]]      |
+-----------------------------+---------------------------------------------------------------------+
| SIDEBAR                     | MAIN CONTENT AREA                                                   |
|                             |                                                                     |
| -- EXECUTIVE & ANALYTICS -- | [Overview] | [Game Performance] | [Executive Portfolio (Flask)]     |
| * Gaming Overview (React)   |                                                                     |
| * Game Performance (React)  |                                                                     |
| * Executive Portfolio (Flask)|                                                                    |
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
  - `google_pubsub_topic.live_telemetry` (`gaming-live-telemetry`): Ingests real-time `snake_case` JSON telemetry events.
  - `google_pubsub_subscription.live_telemetry_bq_sub` (`gaming-live-telemetry-bq-sub`): Zero-code BigQuery direct subscription.
* **BigQuery Datasets & Telemetry Tables**:
  - `google_bigquery_dataset.gaming_raw`, `gaming_synthetic`, `gaming_gold`.
  - `google_bigquery_table.live_session_events` (`gaming_raw.live_session_events` - partitioned by day, clustered by `player_id`, `event_type`).
  - `google_bigquery_table.gcp_players` & `iap_transactions`.
  - `google_bigquery_table.gold_player_360` (`gaming_gold.gold_player_360` - feature store for LTV, spend tier, churn risk score).
* **BigQuery ML (BQML) Churn Prediction**:
  - Model: `gaming_raw.gaming_player_churn_model` (Logistic Regression).
  - Stored Procedures: `train_churn_model` and `calculate_churn_risk` (executes `ML.PREDICT`).
* **Synthetic Data Procedures**: `generate_players`, `populate_player_tables`, and `generate_iap`.
* **Enabled APIs**: `bigquery`, `dataplex`, `pubsub`, `aiplatform`, `datalineage`, `cloudbuild`, `run`.

---

### 2. 🟡 Net-New Infrastructure Required in GCP / Terraform

#### A. Additional Gold Analytical Tables (BigQuery)
* `gaming_gold.gold_regional_kpis`: Aggregates DAU, MAU, ARPU, total revenue, active sessions, and ping latency by region/country.
* `gaming_gold.gold_campaign_analytics`: Tracks campaign impressions, conversions, churn prevention rate, and incremental revenue.
* `gaming_silver.server_latency` / `gold_server_performance`: Tracks CCU, server region capacity utilization, and frame rate latency.
* `gaming_gold.gold_level_difficulty_funnel`: Tracks level starts, completions, failures, resets, and completion rates for difficulty re-balancing.

#### B. Dataplex Knowledge Catalog Infrastructure
* `google_dataplex_aspect_type.liveops_campaign_policy_aspect`: Enforces max promotional discount boundaries (`player_tier`, `max_discount_pct`, `target_sku`, `guardrail_boundary_status`).
* `google_dataplex_aspect_type.gaming-certified-reward-sku-aspect`: Validates certified in-game reward SKUs.
* `google_dataplex_glossary.omniarcade_glossary`: Glossary `gaming-studios-glossary-us` with terms like *Whale Spend*, *Idle Churn*, *KYP*, *ARPU*, *CCU*, *Toxicity Exposure*.

#### C. Vertex AI Reasoning Engine Deployment (Agent Engine)
* Reasoning Engine deployment script/module (`omniarcade-guardrail-agent` / `COUNCIL_AGENT_ID`) packaged with Dataplex MCP Tool & BQ SQL Tool.

#### D. Live Telemetry Simulator Service (Cloud Run)
* `google_cloud_run_v2_service.telemetry_simulator`: Containerized simulator publishing to `gaming-live-telemetry` Pub/Sub topic and AlloyDB instance.

---

### 3. 🔵 Application Server Logic vs. GCP Infrastructure Breakdown

| Feature / Refactoring Plan Item | Reusable `retail-data-and-ai-demo` Infra | Net-New GCP Infra Required (Terraform) | Net-New Application Code Required |
| :--- | :--- | :--- | :--- |
| **`/diagnostics` Page & API** | Reuses ADC Auth, BigQuery, Pub/Sub, BQML, Dataplex, Vertex AI. | None (runs probes against existing APIs). | **Node.js**: Probe handler in `server.ts` & React `<Diagnostics />` UI. |
| **LiveOps Churn Guardrail** | **Pub/Sub Topic**: `gaming-live-telemetry`<br>**BQ Table**: `live_session_events`<br>**BQML**: `gaming_player_churn_model` | **Dataplex Aspect**: `liveops_campaign_policy_aspect` | **Node.js**: SSE hub (`/api/guardrail/events`) & in-memory pre-caching. |
| **Live Game Simulator** | **Pub/Sub Topic**: `gaming-live-telemetry` | **Cloud Run Service**: `telemetry_simulator`<br>**AlloyDB**: `live_ccu_counter` | **Python/Go**: Simulator loop & anomaly engine in `src/simulator/`; Express control routes in `server.ts`. |
| **Executive Overview** | **BQ Table**: `gold_player_360`. | **BQ Tables**: `gold_regional_kpis`. | **React**: `Overview.tsx` UI rendering w/ mock S3/Snowflake indicators. |
| **Operations & Difficulty** | None. | **BQ Tables**: `server_latency`, `gold_level_difficulty_funnel`. | **Node.js**: Reverse proxy to Flask `/api/difficulty-stats` & `/api/simulate/difficulty-spike`. |
| **Campaign Engine** | None. | **BQ Table**: `gold_campaign_analytics` | **React**: `CampaignEngine.tsx` w/ Express in-memory campaign CRUD (replacing Firestore). |
| **Frontend Shell Unification** | None. | None. | **React/Node.js**: `FlaskSection.tsx` iframe wrapper, updated `Layout.tsx` & `App.tsx` nav items. |

---

## 🛠️ Detailed Component & Endpoint Specifications

### Phase 1: Comprehensive Multi-Service Diagnostics (`/diagnostics`)

#### 1. Backend Endpoint: `GET /api/system/diagnostics` (Express `server.ts`)
The Express gateway executes a detailed diagnostic probe across all 15 frontend sections, 13 GCP/BQ probes, and the Live Game Simulator:

```json
{
  "timestamp": "2026-07-08T10:15:00Z",
  "overall_mode": "HEALTHY_WITH_FALLBACKS",
  "gcp_services": {
    "auth": { "status": "LIVE", "mode": "ADC", "details": "Authenticated for gaming-demo", "latency_ms": 12 },
    "bigquery": { "status": "LIVE", "mode": "PROVISIONED", "details": "Dataset gaming_gold active", "latency_ms": 28 },
    "pubsub": { "status": "LIVE", "mode": "PROVISIONED", "details": "Topic gaming-live-telemetry active", "latency_ms": 14 },
    "bqml": { "status": "MOCK", "mode": "FALLBACK", "details": "Using dynamic heuristic churn scoring", "latency_ms": 5 },
    "dataplex": { "status": "LIVE", "mode": "PROVISIONED", "details": "Dataplex REST API & Aspect Registry online", "latency_ms": 35 },
    "vertex_agent": { "status": "LIVE", "mode": "PROVISIONED", "details": "Reasoning Engine omniarcade-guardrail-agent online", "latency_ms": 42 }
  },
  "simulator": {
    "status": "RUNNING",
    "mode": "CLOUD_RUN",
    "event_rate_hz": 15,
    "current_ccu": 14280,
    "active_anomaly": null
  },
  "sections": [
    {
      "id": "overview",
      "name": "Executive Overview",
      "status": "PARTIAL_MOCK",
      "sub_features": [
        { "name": "Player 360 Metrics (gold_player_360)", "connected": true, "source": "BigQuery Gold Table", "mode": "LIVE" },
        { "name": "AWS S3 / Snowflake Federation", "connected": false, "source": "Mock-Only (Out of Scope)", "mode": "MOCK" }
      ]
    }
  ]
}
```

---

### Phase 2: Frontend Navigation & Shell Unification

#### 1. Flask View Embedding Strategy (`FlaskSection.tsx`)
Create React wrapper component `src/remix-gaming-app/src/components/sections/FlaskSection.tsx` to iframe-wrap `gamingdatademo` Flask views (`/agent-comparison`, `/executive.html`, `/difficulty.html`, `/toxicity.html`, `/graph_visualization.html`, `/marketing_swarm_visualizer.html`) with standardized container heights (`100vh`) and no dead whitespace.

#### 2. Updated Navigation Menu (`Layout.tsx` & `App.tsx`)
Add Flask pages as first-class sections in the sidebar navigation organized across the 4 executive groups.

---

### Phase 3: Demonstration Consolidation & Inter-Section Interactions

#### 1. Overlap Elimination & Unified Demo Workflows

| Feature Area | Current Remix Implementation | Current Flask Implementation | Consolidation & Cross-Section Interaction |
| :--- | :--- | :--- | :--- |
| **Player Churn & Recovery** | `LiveOpsGuardrail.tsx` ($0.99 Shield offer) & `CampaignEngine.tsx` | `/api/marketing/simulate-cluster` (Marketing Swarm) | **Unified Churn-to-Campaign Pipeline**: Churn alert in `LiveOpsGuardrail` provides a *"Trigger Marketing Recovery Swarm"* button that directly opens `CampaignEngine` pre-populated with target cohort and auto-invokes Flask Marketing Swarm recovery agent. |
| **Game Difficulty & Level Balancing** | `Operations.tsx` (Recharts stats & CCU) | `/difficulty.html` (Level 2 moves solver) | **Operations-to-Balancer Bridge**: Clicking an anomaly on Level Completion funnel in `Operations.tsx` navigates directly to embedded `Difficulty Balancer` (Flask) and executes solver playtest simulation. |
| **Trust, Safety & Anti-Cheat** | `AgenticWorkflows.tsx` (Cheat detection trace) | `/toxicity.html` (Toxic chat & GIRA safety assessment) | **Unified Trust & Safety Hub**: Combine toxicity incident simulation and anti-cheat memory modification detection into a single "Trust & Safety Observatory" view. |
| **Dataplex Policy & Governance** | `KnowledgeCatalog.tsx` (Rule Discovery Sandbox) | `/api/table-info` & `/api/term-info` (Dataplex glossary & aspect tags) | **Live Policy Push**: Rules compiled in Rule Discovery Sandbox immediately update Dataplex aspect tag registry, affecting policy checks in both `LiveOpsGuardrail` and KC-Guided Agent in `Agent Comparison`. |

---

## 📅 Implementation Roadmap & Action Items

### Step 1: Update Plan & Diagnostics API
- Update `docs/refactor/frontend-backend-unification-plan.md` with scope boundaries, mock-only flags, and simulator specification.
- Add simulator status probe in `/api/system/diagnostics`.

### Step 2: Implement Live Game Simulator Microservice
- Create `src/simulator/` (Python/Go) publishing to `gaming-live-telemetry` Pub/Sub topic and AlloyDB.
- Add REST control endpoints (`/api/simulator/start`, `/api/simulator/stop`, `/api/simulator/inject-anomaly`) in Express gateway (`server.ts`).

### Step 3: Add Frontend Simulator Control Switch & Anomaly Controls
- Add **Live Telemetry Simulator [ON/OFF]** toggle switch and Anomaly Injection dropdown in `Layout.tsx` header and `Diagnostics.tsx`.

### Step 4: Validate End-to-End Build
- Run `npx tsc --noEmit` and `npx vite build` to ensure 0 errors.
