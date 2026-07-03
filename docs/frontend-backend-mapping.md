# Frontend-to-Backend Integration Mapping
## Remix Gaming App UI & GCP Backend Architecture

This document defines the architectural mapping between the frontend modules in **Remix Gaming App** ([remix-gaming-app](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md)) and the GCP backend infrastructure provisioned via **retail-data-and-ai-demo-dev** and **gamingdatademo**.

---

## 🏗️ System Architecture & Connection Diagram

```mermaid
graph LR
    subgraph Frontend UI (remix-gaming-app)
        UI_AI[PineCore AI Assistant: HospitalAdmin.tsx]
        UI_CATALOG[Knowledge Catalog: KnowledgeCatalog.tsx]
        UI_OVERVIEW[Overview Dashboard: Overview.tsx]
        UI_OPS[Operations & Latency: Operations.tsx]
        UI_CAMPAIGN[Campaign Engine: CampaignEngine.tsx]
        UI_GUARDRAIL[LiveOps Guardrail: LiveOpsGuardrail.tsx]
        UI_OBS[IT Observatory: ITObservatory.tsx]
    end

    subgraph Express Gateway (server.ts)
        EXPRESS[Express Server Gateway]
    end

    subgraph GCP Backend Infrastructure (retail-data-and-ai-demo-dev / gamingdatademo)
        PUBSUB[Cloud Pub/Sub Topic: omniarcade-live-telemetry]
        BQML[BigQuery ML: ML.PREDICT player_churn_model]
        ADK[Vertex AI Agent Engine: google-adk]
        DATAPLEX[Dataplex Knowledge Catalog]
        RAW[BigQuery Raw: omniarcade_raw]
        GOLD[BigQuery Gold: omniarcade_gold]
        SILVER[BigQuery Silver: omniarcade_silver]
        FIREBASE[Firebase / Firestore]
    end

    UI_GUARDRAIL -->|/api/telemetry/stream| EXPRESS
    EXPRESS -->|Pub/Sub SDK (snake_case JSON)| PUBSUB
    PUBSUB -->|Direct BQ Subscription| RAW
    EXPRESS -->|ML.PREDICT Query| BQML

    UI_AI -->|/api/chat| EXPRESS
    EXPRESS -->|ADC OAuth| ADK
    ADK -->|MCP APIs| DATAPLEX
    ADK -->|SQL Query| GOLD

    UI_CATALOG -->|/api/catalog| EXPRESS
    EXPRESS -->|REST APIs| DATAPLEX

    UI_OVERVIEW -->|BigQuery Client| GOLD
    UI_OPS -->|BigQuery Client| SILVER
    UI_CAMPAIGN -->|Firestore SDK| FIREBASE
    UI_CAMPAIGN -->|Cohort Read| GOLD
    UI_OBS -->|Audit Logs| GOLD
```

---

## 🧱 Detailed UI Module to Backend Mapping

### 1. 🎮 LiveOps Churn Guardrail Split-Screen View ([LiveOpsGuardrail.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/churn-guardrail-plan.md))
* **Frontend Component**: Interactive game client simulator (Left Panel) & LiveOps Telemetry / Guardrail Observatory (Right Panel).
* **Express Routes**: `/api/telemetry/stream` & `/api/guardrail/events` (SSE / WebSocket).
* **Target GCP Service**: **Cloud Pub/Sub (`omniarcade-live-telemetry`)** $\rightarrow$ **BigQuery Direct Subscription (`omniarcade_raw.live_session_events`)** $\rightarrow$ **BQML (`ML.PREDICT`)** $\rightarrow$ **Vertex AI Agent Engine**.
* **Data & Action Exchanged**:
  - Emits `snake_case` JSON session events (`boss_fail`, `quit_intent`) to `/api/telemetry/stream`.
  - Express server publishes messages to Pub/Sub, streaming into BigQuery `live_session_events` in ~100ms.
  - BigQuery BQML `ML.PREDICT(MODEL player_churn_model)` evaluates churn probability score (> 85%), triggering pre-cached KC Agent policy checks to push a $0.99 offer pop-up back to the game client (<300ms) before unmounting.

---

### 2. 💬 PineCore Floating AI Assistant ([HospitalAdmin.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L55))
* **Frontend Component**: Floating chatbot drawer widget.
* **Express Route**: `/api/chat` in `server.ts`.
* **Target GCP Service**: **Vertex AI Agent Engine (`google-adk`)** with Model Context Protocol (MCP) tools.
* **Data & Action Exchanged**:
  - Accepts natural language questions from executives (e.g. *"Show total spend for Whale players in Japan"*).
  - Agent queries **Dataplex Knowledge Catalog** for schema aspect definitions and executes SQL against **BigQuery Gold tables** (`omniarcade_gold.gold_player_360`).
  - Returns structured AI answers, SQL query previews, table confidence scores, and dataset lineage links.

---

### 3. 📚 Knowledge Catalog Explorer ([KnowledgeCatalog.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L53))
* **Frontend Component**: Dataset search and metadata catalog browser.
* **Express Route**: `/api/catalog` search proxy endpoints.
* **Target GCP Service**: **Dataplex Knowledge Catalog REST APIs** (`dataplex.googleapis.com`).
* **Data & Action Exchanged**:
  - Searches cross-cloud datasets (BigQuery, Snowflake, AlloyDB, AWS S3).
  - Fetches Dataplex catalog entries, business glossary terms (e.g. *Whale Spend*, *MAU*), data quality scores, and data lineage graphs across `omniarcade_raw`, `omniarcade_silver`, and `omniarcade_gold` datasets.

---

### 4. 📊 Executive Overview Dashboard ([Overview.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L49))
* **Frontend Component**: Top-level executive KPI dashboard.
* **Target GCP Service**: **BigQuery Gold Analytical Tables** (`omniarcade_gold.gold_player_360`, `omniarcade_gold.gold_regional_kpis`).
* **Data & Action Exchanged**:
  - Renders top-level executive metrics: Total Regional Revenue, Monthly Active Users (MAU), and Player Payer Tiers (*Whale, Dolphin, Minnow, F2P*).
  - Displays cross-cloud data lineage cards populated directly by BigQuery Gold tables generated during synthetic data population routines.

---

### 5. ⚡ Game Operations & Telemetry ([Operations.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L50))
* **Frontend Component**: Operations telemetry & server capacity dashboard.
* **Target GCP Service**: **BigQuery Silver/Gold Telemetry Tables** (`omniarcade_silver.server_latency`, `omniarcade_gold.gold_regional_kpis`).
* **Data & Action Exchanged**:
  - Renders interactive Recharts time-series performance graphs.
  - Monitors Concurrent Active Users (CCU), server region capacity utilization, frame rate latency, and unit economics.

---

### 6. 🎯 Player Marketing Campaign Engine ([CampaignEngine.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L52))
* **Frontend Component**: Targeted marketing campaign builder & budget allocator.
* **Target GCP Service**: **Firebase/Firestore** + **BigQuery Gold Tables** (`omniarcade_gold.gold_campaign_analytics`).
* **Data & Action Exchanged**:
  - Queries BigQuery `gold_player_360` to calculate target player cohort sizes (e.g. inactive Whales in Japan).
  - Stores campaign state in Firestore, which automatically syncs to BigQuery for campaign performance and ROI tracking.

---

### 7. 🛰️ IT Observatory & Monitoring ([ITObservatory.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L54))
* **Frontend Component**: System health and API observatory.
* **Target GCP Service**: **BigQuery Audit Logs** & **GCP Monitoring APIs**.
* **Data & Action Exchanged**:
  - Renders real-time API throughput charts, response time latency distributions, and health checks across GCP and simulated multi-cloud environments.

---

## 📋 Component Connection Summary Matrix

| Frontend Module | UI Component File | Target Backend Service | Primary Data Exchanged |
| :--- | :--- | :--- | :--- |
| **LiveOps Guardrail** | [LiveOpsGuardrail.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/churn-guardrail-plan.md) | Cloud Pub/Sub $\rightarrow$ BQ Direct Sub $\rightarrow$ BQML `ML.PREDICT` | Streaming game telemetry, predictive ML churn probability, dynamic offer pop-ups. |
| **AI Assistant** | [HospitalAdmin.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L55) | Vertex AI Agent Engine + Dataplex MCP | Natural language QA, schema resolution, SQL query results. |
| **Catalog Explorer** | [KnowledgeCatalog.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L53) | Dataplex Knowledge Catalog APIs | Glossaries, custom aspect tags, quality scores, lineage graphs. |
| **Executive Overview** | [Overview.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L49) | BigQuery Gold (`gold_player_360`) | Regional revenue, MAU, player spend tiers (*Whales/Minnows*). |
| **Operations Telemetry** | [Operations.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L50) | BigQuery Silver (`server_latency`) | Real-time concurrent active users (CCU), server region capacity. |
| **Campaign Engine** | [CampaignEngine.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L52) | Firebase/Firestore + BigQuery Gold | Target player cohort sizing, campaign CRUD state, ROI metrics. |
| **IT Observatory** | [ITObservatory.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/remix-gaming-app/overview.md#L54) | BigQuery Audit Logs | API throughput, latency distribution, system health checks. |

---

## 🛠️ Implementation Action Items for Frontend Integration

1. **Express Server Gateway (`server.ts`)**:
   - Add `@google-cloud/pubsub` SDK to publish live telemetry events to topic `omniarcade-live-telemetry`. Enforce strict `snake_case` keys and ISO-8601 timestamps.
   - Execute an immediate targeted BQML `ML.PREDICT` query upon receiving stream events to push live ML churn probability scores via Server-Sent Events (SSE).
   - Add `/api/catalog` proxy endpoints to connect `KnowledgeCatalog.tsx` to Dataplex REST APIs.
   - Update `/api/chat` route to authenticate via Application Default Credentials (ADC) to Vertex AI Agent Engine.

2. **BigQuery Client Adapter**:
   - Create a lightweight API client service (`src/services/bigquery.ts`) in the Remix app to execute parameterized queries against `omniarcade_gold` feature tables for `Overview.tsx` and `Operations.tsx`.

3. **PineCore AI UI Stepper & Pre-Caching**:
   - Update `HospitalAdmin.tsx` state to parse and display multi-step progress events from the KC Agent stream.
   - Asynchronously pre-cache Dataplex policy checks in `server.ts` when BQML churn score crosses 50% for <300ms pop-up execution.
