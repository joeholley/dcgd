# Frontend-to-Backend Integration Mapping
## Remix Gaming App UI & GCP Backend Architecture

This document defines the architectural mapping between the frontend modules in **Remix Gaming App** ([remix-gaming-app](remix-gaming-app/overview.md)) and the GCP backend infrastructure provisioned via **retail-data-and-ai-demo** and **gamingdatademo**.

---

## 🔀 Cloud Run Routing & Dual Application Navigation

When deployed to Cloud Run, **both applications run concurrently in a single container** managed via `entrypoint.sh`:
- **`remix-gaming-app` (Express + React 19 UI)**: Listens on `0.0.0.0:$PORT` (default `8080`).
- **`gamingdatademo` (Python Flask App)**: Listens internally on `127.0.0.1:5000`.

### Full `gamingdatademo` Feature Preservations & Proxy Endpoints:
The Express Server Gateway (`server.ts`) proxies all `/agent-comparison/*` and `/api/gamingdatademo/*` endpoints internally to `http://127.0.0.1:5000`, preserving **100% of `gamingdatademo`'s original features**:

1. **3-Tier Agent Comparison Workspace**:
   - **Route**: `https://<cloud-run-domain>/agent-comparison`
   - **Features**: Interactive comparison between Basic Agent (5 tables), Scaled Agent (150+ tables), and KC-Guided Agent (Dataplex Knowledge Catalog) with live WebSocket step-by-step query execution streaming and point-cloud animations.
2. **Dataplex Knowledge Catalog Inspection APIs**:
   - **Routes**: `/api/table-info`, `/api/term-info`
   - **Features**: Returns BigQuery column aspects, data quality scores, business glossary definitions (*Whale Spend*), and cross-table data lineage graphs.
3. **Operational & LiveOps Incident Simulation Engines**:
   - **ROAS Drop Simulator**: `/api/simulate/roas-drop` (Simulates marketing ROI drops).
   - **Player Cohort Cluster Simulator**: `/api/marketing/cohort-telemetry`, `/api/marketing/simulate-cluster`.
   - **Game Difficulty Spike Simulator**: `/api/difficulty-stats`, `/api/simulate/difficulty-spike` (Simulates level failure rate spikes).
   - **Executive Diagnostics Simulator**: `/api/executive/portfolio-metrics`, `/api/executive/simulate-diagnostics`.
   - **Trust & Safety Toxicity Simulator**: `/api/simulate/toxicity-incident`.

---

## 🏗️ System Architecture & Connection Diagram

```mermaid
graph LR
    subgraph Frontend UI (remix-gaming-app / Cloud Run Port 8080)
        UI_AI[PineCore AI Assistant: HospitalAdmin.tsx]
        UI_CATALOG[Knowledge Catalog: KnowledgeCatalog.tsx]
        UI_OVERVIEW[Overview Dashboard: Overview.tsx]
        UI_OPS[Operations & Latency: Operations.tsx]
        UI_CAMPAIGN[Campaign Engine: CampaignEngine.tsx]
        UI_GUARDRAIL[LiveOps Guardrail: LiveOpsGuardrail.tsx]
        UI_OBS[IT Observatory: ITObservatory.tsx]
        UI_AGENT_COMP[Header Nav: Agent Comparison Tab]
    end

    subgraph Express Gateway (server.ts)
        EXPRESS[Express Server Gateway]
    end

    subgraph Internal Python Flask App (gamingdatademo / 127.0.0.1:5000)
        FLASK[Flask Agent Comparison & Simulation Engines]
    end

    subgraph GCP Backend Infrastructure (retail-data-and-ai-demo / gamingdatademo)
        PUBSUB[Cloud Pub/Sub Topic: omniarcade-live-telemetry]
        BQML[BigQuery ML: ML.PREDICT player_churn_model]
        ADK[Vertex AI Agent Engine: google-adk]
        DATAPLEX[Dataplex Knowledge Catalog]
        RAW[BigQuery Raw: omniarcade_raw]
        GOLD[BigQuery Gold: omniarcade_gold]
        SILVER[BigQuery Silver: omniarcade_silver]
        OPERATIONAL_DB[Operational DB: Spanner / AlloyDB / Firestore]
    end

    UI_AGENT_COMP -->|/agent-comparison| EXPRESS
    EXPRESS -->|Internal Reverse Proxy| FLASK

    UI_GUARDRAIL -->|/api/telemetry/stream| EXPRESS
    EXPRESS -->|Pub/Sub SDK (snake_case JSON)| PUBSUB
    PUBSUB -->|Direct BQ Subscription| RAW
    EXPRESS -->|ML.PREDICT Query| BQML
    EXPRESS -->|State Update| OPERATIONAL_DB
    OPERATIONAL_DB -->|SSE Push| UI_GUARDRAIL

    UI_AI -->|/api/chat| EXPRESS
    EXPRESS -->|ADC OAuth| ADK
    ADK -->|MCP APIs| DATAPLEX
    ADK -->|SQL Query| GOLD

    UI_CATALOG -->|/api/catalog| EXPRESS
    EXPRESS -->|REST APIs| DATAPLEX

    UI_OVERVIEW -->|BigQuery Client| GOLD
    UI_OPS -->|BigQuery Client| SILVER
    UI_CAMPAIGN -->|Operational Sync| OPERATIONAL_DB
    UI_CAMPAIGN -->|Cohort Read| GOLD
    UI_OBS -->|Audit Logs| GOLD
```

---

## 🧱 Detailed UI Module to Backend Mapping

### 1. 🎮 LiveOps Churn Guardrail Split-Screen View ([LiveOpsGuardrail.tsx](churn-guardrail-plan.md))
* **Frontend Component**: Interactive game client simulator (Left Panel) & LiveOps Telemetry / Guardrail Observatory (Right Panel).
* **Express Routes**: `/api/telemetry/stream` & `/api/guardrail/events` (SSE / WebSocket).
* **Target GCP Service**: **Cloud Pub/Sub (`omniarcade-live-telemetry`)** $\rightarrow$ **BigQuery Direct Subscription (`omniarcade_raw.live_session_events`)** $\rightarrow$ **BQML (`ML.PREDICT`)** $\rightarrow$ **Cloud Spanner / Firestore**.
* **Data & Action Exchanged**:
  - Emits `snake_case` JSON session events (`boss_fail`, `quit_intent`) to `/api/telemetry/stream`.
  - Express server publishes messages to Pub/Sub, streaming into BigQuery `live_session_events` in ~100ms.
  - BigQuery BQML `ML.PREDICT(MODEL player_churn_model)` evaluates churn probability score (> 85%), triggering pre-cached KC Agent policy checks.
  - Express updates operational state in Cloud Spanner / Firestore and pushes SSE payload to rendering pop-up offer:
    > *"That Frost Giant is tough! Grab a temporary 50% Shield Boost and 100 Health Elixirs for just $0.99 (normally $4.99) to defeat him now."*

---

### 2. 💬 PineCore Floating AI Assistant ([HospitalAdmin.tsx](remix-gaming-app/overview.md#L55))
* **Frontend Component**: Floating chatbot drawer widget.
* **Express Route**: `/api/chat` in `server.ts`.
* **Target GCP Service**: **Vertex AI Agent Engine (`google-adk`)** with Model Context Protocol (MCP) tools.
* **Data & Action Exchanged**:
  - Accepts natural language questions from executives (e.g. *"Show total spend for Whale players in Japan"*).
  - Agent queries **Dataplex Knowledge Catalog** for schema aspect definitions and executes SQL against **BigQuery Gold tables** (`omniarcade_gold.gold_player_360`).
  - Returns structured AI answers, SQL query previews, table confidence scores, and dataset lineage links.

---

### 3. 📚 Knowledge Catalog Explorer & Automatic Discovery ([KnowledgeCatalog.tsx](remix-gaming-app/overview.md#L53))
* **Frontend Component**: Dataset search, metadata catalog browser, and **Automatic Rule Discovery Sandbox**.
* **Express Route**: `/api/catalog` search & discovery proxy endpoints.
* **Target GCP Service**: **Dataplex Knowledge Catalog REST APIs** (`dataplex.googleapis.com`).
* **Data & Action Exchanged**:
  - **Catalog Search**: Searches cross-cloud datasets (BigQuery, Snowflake, AlloyDB, AWS S3) for glossaries (*Whale Spend*), custom aspect tags (`liveops_campaign_policy_aspect`), and data lineage.
  - **Automatic Rule Discovery Sandbox**: Allows non-SQL executives (Alex, VP of Marketing) to paste plain-text campaign execution criteria into the UI, automatically discovering business logic and rendering backend BigQuery rules tables without typing SQL.

---

### 4. 📊 Executive Overview Dashboard ([Overview.tsx](remix-gaming-app/overview.md#L49))
* **Frontend Component**: Top-level executive KPI dashboard.
* **Target GCP Service**: **BigQuery Gold Analytical Tables** (`omniarcade_gold.gold_player_360`, `omniarcade_gold.gold_regional_kpis`).
* **Data & Action Exchanged**:
  - Renders top-level executive metrics: Total Regional Revenue, Monthly Active Users (MAU), and Player Payer Tiers (*Whale, Dolphin, Minnow, F2P*).
  - Displays cross-cloud data lineage cards populated directly by BigQuery Gold tables generated during synthetic data population routines.

---

### 5. ⚡ Game Operations & Telemetry ([Operations.tsx](remix-gaming-app/overview.md#L50))
* **Frontend Component**: Operations telemetry & server capacity dashboard.
* **Target GCP Service**: **BigQuery Silver/Gold Telemetry Tables** (`omniarcade_silver.server_latency`, `omniarcade_gold.gold_regional_kpis`) + `gamingdatademo` `/api/difficulty-stats`.
* **Data & Action Exchanged**:
  - Renders interactive Recharts time-series performance graphs.
  - Monitors Concurrent Active Users (CCU), server region capacity utilization, frame rate latency, and unit economics.
  - Connects to `/api/simulate/difficulty-spike` to simulate live level failure rate spikes.

---

### 6. 🎯 Player Marketing Campaign Engine ([CampaignEngine.tsx](remix-gaming-app/overview.md#L52))
* **Frontend Component**: Targeted marketing campaign builder & budget allocator.
* **Target GCP Service**: **Cloud Spanner / Firebase / Firestore** + **BigQuery Gold Tables** (`omniarcade_gold.gold_campaign_analytics`) + `gamingdatademo` `/api/marketing/*`.
* **Data & Action Exchanged**:
  - Queries BigQuery `gold_player_360` to calculate target player cohort sizes (e.g. inactive Whales in Japan).
  - Stores campaign state in Spanner/Firestore, which automatically syncs to BigQuery for campaign performance and ROI tracking.
  - Invokes `/api/marketing/simulate-cluster` to dynamically test marketing cohort budget reallocations.

---

### 7. 🛰️ IT Observatory & Monitoring ([ITObservatory.tsx](remix-gaming-app/overview.md#L54))
* **Frontend Component**: System health and API observatory.
* **Target GCP Service**: **BigQuery Audit Logs** & **GCP Monitoring APIs** + `gamingdatademo` `/api/simulate/toxicity-incident`.
* **Data & Action Exchanged**:
  - Renders real-time API throughput charts, response time latency distributions, and health checks across GCP and simulated multi-cloud environments.
  - Executes community trust & safety toxicity incident simulations.

---

## 📋 Component Connection Summary Matrix

| Frontend Module | UI Component File | Target Backend Service | Primary Data Exchanged |
| :--- | :--- | :--- | :--- |
| **LiveOps Guardrail** | [LiveOpsGuardrail.tsx](churn-guardrail-plan.md) | Cloud Pub/Sub $\rightarrow$ BQ Direct Sub $\rightarrow$ BQML `ML.PREDICT` $\rightarrow$ Spanner/Firestore | Streaming game telemetry, predictive ML churn probability, dynamic offer pop-ups ($0.99 Shield Pack). |
| **Agent Comparison Workspace** | Header Tab / `/agent-comparison` | `gamingdatademo` Flask Service (`127.0.0.1:5000`) | Side-by-side Basic, Scaled, and KC Agent query step streaming and point-cloud animations. |
| **AI Assistant** | [HospitalAdmin.tsx](remix-gaming-app/overview.md#L55) | Vertex AI Agent Engine + Dataplex MCP | Natural language QA, schema resolution, SQL query results. |
| **Catalog Explorer & Auto-Discovery** | [KnowledgeCatalog.tsx](remix-gaming-app/overview.md#L53) | Dataplex Knowledge Catalog APIs | Glossaries, aspect tags, quality scores, lineage, and Automatic Rule Discovery Sandbox. |
| **Executive Overview** | [Overview.tsx](remix-gaming-app/overview.md#L49) | BigQuery Gold (`gold_player_360`) | Regional revenue, MAU, player spend tiers (*Whales/Minnows*). |
| **Operations Telemetry** | [Operations.tsx](remix-gaming-app/overview.md#L50) | BigQuery Silver (`server_latency`) + `/api/simulate/difficulty-spike` | Real-time concurrent active users (CCU), server region capacity, difficulty spike simulation. |
| **Campaign Engine** | [CampaignEngine.tsx](remix-gaming-app/overview.md#L52) | Cloud Spanner / Firestore + `/api/marketing/simulate-cluster` | Target player cohort sizing, campaign CRUD state, marketing cluster simulation. |
| **IT Observatory** | [ITObservatory.tsx](remix-gaming-app/overview.md#L54) | BigQuery Audit Logs + `/api/simulate/toxicity-incident` | API throughput, latency distribution, system health checks, toxicity incident simulation. |

---

## 🛠️ Implementation Action Items for Frontend Integration

1. **Express Server Gateway (`server.ts`)**:
   - Add `@google-cloud/pubsub` SDK to publish live telemetry events to topic `omniarcade-live-telemetry`. Enforce strict `snake_case` keys and ISO-8601 timestamps.
   - Execute an immediate targeted BQML `ML.PREDICT` query upon receiving stream events to push live ML churn probability scores via Server-Sent Events (SSE).
   - Add `/api/catalog` proxy endpoints to connect `KnowledgeCatalog.tsx` to Dataplex REST APIs and handle plain-text Automatic Rule Discovery.
   - Setup internal reverse proxy for `/agent-comparison` and `/api/gamingdatademo/*` routing to `http://127.0.0.1:5000` (Python Flask app).
   - Update `/api/chat` route to authenticate via Application Default Credentials (ADC) to Vertex AI Agent Engine.

2. **BigQuery Client Adapter**:
   - Create a lightweight API client service (`src/services/bigquery.ts`) in the Remix app to execute parameterized queries against `omniarcade_gold` feature tables for `Overview.tsx` and `Operations.tsx`.

3. **PineCore AI UI Stepper & Pre-Caching**:
   - Update `HospitalAdmin.tsx` state to parse and display multi-step progress events from the KC Agent stream.
   - Asynchronously pre-cache Dataplex policy checks in `server.ts` when BQML churn score crosses 50% for <300ms pop-up execution.
