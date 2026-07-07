# Unified Gaming Data, AI Governance & Executive Operations Platform
## Master Integration Plan

This document outlines the end-to-end integration strategy to combine three core repositories into a unified, enterprise-grade Gaming Data & AI Operations Platform:

1. **Target Backend Architecture & Data Generator Pattern** ([retail-data-and-ai-demo](retail-data-and-ai-demo/overview.md))
2. **OmniArcade Governance & KC-Guided Agent Engine** ([gamingdatademo](gamingdatademo/overview.md))
3. **Player 360 Executive Operations Dashboard** ([remix-gaming-app](remix-gaming-app/overview.md))

---

## 🏗️ Target Unified System Architecture

```mermaid
graph TD
    subgraph Layer 1: Infrastructure, Streaming & Synthetic Data Generation (retail-data-and-ai-demo pattern)
        TF[Terraform IaC: main.tf] -->|industry_target = 'games'| TF_GAMES[infrastructure/terraform/games/]
        TF_GAMES --> BQ_SYNTH[BigQuery: omniarcade_raw / omniarcade_synthetic]
        TF_PLATFORM[infrastructure/terraform/artifact-registry.tf] --> AR[Artifact Registry: data-cloud-ai-demos]
        VERTEX_GEN[Vertex AI LLM] -->|AI.GENERATE (Quota-Safe Batching)| BQ_SYNTH
        PROC[SQL Routines: populate_player_tables.sql.tftpl] -->|Power-Law IAP Spend| BQ_SYNTH
        
        STREAM_CLIENT[Game Client Telemetry] -->|/api/telemetry/stream| PUBSUB[Cloud Pub/Sub: omniarcade-live-telemetry]
        PUBSUB -->|Direct BQ Subscription: games-pubsub.tf| BQ_SYNTH
        BQML[BQML Model: omniarcade_raw.player_churn_model] -->|ML.PREDICT In-Warehouse Inference| BQ_SYNTH
        BQ_SYNTH --> AWS_SIM[Simulated AWS / Snowflake Telemetry]
    end

    subgraph Layer 2: Medallion Transformation & Governance Engine
        BQ_SYNTH -->|Dataform Pipeline| BRONZE[Bronze Datasets: omniarcade_bronze]
        BRONZE -->|Cleanse & Mask PII| SILVER[Silver Datasets: omniarcade_silver]
        SILVER -->|Aggregations & Joins| GOLD[Gold Datasets: omniarcade_gold]
        
        DATAPLEX[Dataplex Knowledge Catalog] -->|Aspects, Lineage, Glossary| GOLD
        DATAPLEX -->|Lineage| SILVER
    end

    subgraph Layer 3: AI Agent & MCP Context Layer
        GOLD --> MCP[Model Context Protocol Tools]
        DATAPLEX --> MCP
        MCP --> ADK[Vertex AI Agent Engine / google-adk: KC-Guided Agent]
    end

    subgraph Layer 4: Executive Operations & Presentation UI
        EXPRESS[Express Backend Server server.ts] -->|ADC OAuth / /api/chat Proxy| ADK
        EXPRESS -->|Pub/Sub SDK / BQML Client / Firebase Sync| GOLD
        
        REACT[React 19 / Vite / Tailwind App] -->|UI Dashboard| EXPRESS
        REACT --> PANEL_OVERVIEW[Overview & Operational KPIs]
        REACT --> PANEL_CATALOG[Knowledge Catalog Browser]
        REACT --> PANEL_ASSISTANT[PineCore Floating AI Assistant with UX Stepper]
        REACT --> PANEL_GUARDRAIL[LiveOps Churn Guardrail Split-Screen View]
    end
```

---

## 📱 User Guide: Running Applications Locally vs. Cloud Run

This section provides instructions for running both the **Remix Gaming App** and the **Gaming Data Demo (`gamingdatademo`)**, whether developing locally on a laptop or deploying to Cloud Run. Both applications connect live to the GCP backend infrastructure (Pub/Sub, BigQuery ML, Dataplex, Vertex AI Agent Engine).

### 1. Running `remix-gaming-app` Locally
Running locally is ideal for rapid development and testing of the Executive Operations UI.
* **Authentication**: Uses local **Application Default Credentials (ADC)** via `gcloud auth application-default login`.
* **Prerequisites**:
  ```bash
  gcloud auth application-default login
  export GCP_PROJECT_ID="your-gcp-project-id"
  export GCP_REGION="us-central1"
  ```
* **Launch Steps**:
  ```bash
  cd src/remix-gaming-app
  npm install
  npm run dev
  ```
* **Access URL**: Open **`http://localhost:3000`**. The Express server picks up your local ADC credentials to stream telemetry to Pub/Sub, run BQML predictions, and connect to Vertex AI Agent Engine.

---

### 2. Running `gamingdatademo` Locally
Running `gamingdatademo` locally is fully supported for testing Python automation scripts, Dataform pipelines, and the Flask Agent comparison UI.

* **Authentication**: `google.auth.default()` automatically picks up local Application Default Credentials (ADC).
* **Prerequisites**:
  ```bash
  gcloud auth application-default login
  export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
  export GOOGLE_CLOUD_LOCATION="us-central1"
  ```
* **Running Python Dataplex Catalog Scripts**:
  ```bash
  cd src/gamingdatademo
  pip install -e .
  python3 scripts/01_create_glossary.py
  python3 scripts/04_create_aspects.py
  python3 scripts/07_create_lineage.py
  python3 scripts/08_create_churn_guardrail_aspects.py
  ```
* **Running Dataform Medallion Pipeline Locally**:
  ```bash
  cd src/gamingdatademo/dataform
  dataform run --vars=industry:games
  ```
* **Running the Flask Agent Comparison Web UI**:
  ```bash
  cd src/gamingdatademo
  python3 website-live/app.py
  ```
  * **Access URL**: Open **`http://localhost:5000`** in your browser to test interactive agent comparisons against your live GCP backend.

---

### 3. Deploying & Running on Cloud Run (Containerized)
Running on Cloud Run provides a production-ready, serverless HTTP endpoint that authenticates via a dedicated GCP Service Account (`omniarcade-demo-sa`).

* **Step 1: Build Container Image & Push to Artifact Registry**:
  ```bash
  gcloud builds submit --config=cloudbuild.yaml .
  ```
* **Step 2: Deploy Container Image to Cloud Run**:
  ```bash
  gcloud run deploy omniarcade-gaming-demo \
    --image=us-central1-docker.pkg.dev/$GCP_PROJECT_ID/data-cloud-ai-demos/gaming-app:latest \
    --region=us-central1 \
    --service-account=omniarcade-demo-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars="GCP_PROJECT_ID=$GCP_PROJECT_ID,GCP_REGION=us-central1" \
    --allow-unauthenticated
  ```
* **Access URL**: Cloud Run outputs a secure public HTTPS URL (e.g. `https://omniarcade-gaming-demo-xxxxxx-uc.a.run.app`).

---

## 📂 Backend Provisioning Repository Pattern (`retail-data-and-ai-demo`)

All backend infrastructure and database generation scripts follow the established patterns in **`retail-data-and-ai-demo`**. The new gaming backend provisioning lives alongside the retail scripts in a modular **`games/`** directory under `infrastructure/terraform/`.

```
retail-data-and-ai-demo/
├── README.md                                  # Setup & modular industry deployment guide
├── deploy-demo.sh                             # Orchestration script (Terraform -> Dataform -> BQML -> Dataplex -> Cloud Build -> Agent -> UI)
└── infrastructure/
    ├── project-setup/                         # Phase 1: Shared Service API enablement
    │   ├── main.tf
    │   └── service-api.tf                     # BigQuery, Vertex AI, Dataplex, Pub/Sub, Artifact Registry, Discovery Engine
    └── terraform/                             # Phase 2: Core demo infrastructure
        ├── main.tf                            # Provider & industry_target flag ('retail' | 'games' | 'all')
        ├── variables.tf                       # Configurable deployment variables
        ├── artifact-registry.tf               # Platform Artifact Registry (`data-cloud-ai-demos`)
        ├── bigquery.tf                        # Base Retail datasets & tables
        ├── bigquery-procedure.tf             # Base Retail stored procedures
        ├── bigquery-schema/                   # Base Retail JSON schemas
        ├── bigquery-routines/                 # Base Retail SQL routines (.tftpl)
        └── games/                             # 🎮 NEW: Games Industry Extension
            ├── games-bigquery.tf              # `omniarcade_raw` & `omniarcade_synthetic` datasets/tables
            ├── games-pubsub.tf                # Pub/Sub topic & Direct BigQuery Subscription for telemetry
            ├── games-iam.tf                   # Dedicated Service Account & IAM roles (roles/bigquery.jobUser, roles/pubsub.publisher)
            ├── games-bigquery-procedure.tf    # Stored procedure deployments for gaming
            ├── games-bigquery-schema/         # Gaming JSON schemas
            │   ├── players.json               # Player profile schema (player_id, tier, spend)
            │   ├── iap-transactions.json      # In-App Purchase transaction schema
            │   ├── live-session-events.json   # Streaming telemetry event schema (boss_fail, quit_intent)
            │   └── synthetic-player.json      # Base identity synthesis schema
            └── games-bigquery-routines/       # Gaming SQL Terraform templates (.tftpl)
                ├── generate-players.sql.tftpl       # Vertex AI `AI.GENERATE` routines (quota-bounded)
                ├── populate-player-tables.sql.tftpl # Power-law IAP spend distribution (Whale/Dolphin/Minnow)
                ├── train-churn-model.sql.tftpl      # BQML Logistic Regression Model Training (`omniarcade_raw.player_churn_model`)
                ├── calculate-churn-risk.sql.tftpl   # Real-time BQML `ML.PREDICT` churn propensity SQL evaluation
                └── generate-iap.sql.tftpl           # Generates synthetic in-app purchase transactions
```

---

## 🤖 In-Warehouse Machine Learning Engine (BigQuery ML)

The architecture leverages **BigQuery ML (BQML)** to train predictive models directly in the data warehouse:
- **Model Training**: `train-churn-model.sql.tftpl` trains a `LOGISTIC_REG` model on historical `omniarcade_gold.gold_player_360` profiles once Dataform finishes building Gold feature tables.
- **Real-Time Inference**: `calculate-churn-risk.sql.tftpl` executes `ML.PREDICT(MODEL player_churn_model)` joining streaming Pub/Sub events with player features in real time.

---

## 📡 Real-Time Telemetry & Pub/Sub Direct BigQuery Subscription Pattern

Following Cloud Pub/Sub's native **Direct BigQuery Subscription** pattern, high-frequency game events stream straight into BigQuery with zero custom ingestion code:

```hcl
# infrastructure/terraform/games/games-pubsub.tf

# Pub/Sub Topic for Live Game Client Telemetry
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

## 🚀 Deployment Orchestration Runbook (`deploy-demo.sh`)

Because a complete demonstration requires strict chronological ordering across IaC, Dataform pipelines, BQML model training, governance tagging, containerization, and AI agents, the unified platform includes an automated deployment runner `deploy-demo.sh`:

```bash
#!/usr/bin/env bash
set -e

echo "=== Step 0: Pre-Flight Verification, CLI Utility Test & GCP API Bootstrapping ==="
# Verifies gcloud, bq, terraform (detecting Cloud Shell stub), node, npm, python3
# Pre-enables foundational GCP APIs (cloudresourcemanager, serviceusage, iam, artifactregistry, etc.)
./docs/deploy-demo.sh

echo "=== Step 1: Provisioning GCP Infrastructure, Pub/Sub, Artifact Registry & Service APIs (Terraform) ==="
cd src/retail-data-and-ai-demo/infrastructure/terraform
terraform apply -var="industry_target=games" -auto-approve

echo "=== Step 2: Executing Quota-Bounded Synthetic Data Generation ==="
# Runs BigQuery stored procedure in 500-row batches to prevent Vertex AI RPM quota limits
bq query --use_legacy_sql=false "CALL omniarcade_raw.populate_player_tables(batch_size => 500);"

echo "=== Step 3: Running Dataform Medallion Transformation Pipeline ==="
cd ../../dataform
dataform run --vars=industry:games

echo "=== Step 4: Training BigQuery ML Churn Prediction Model (BQML) ==="
# Trained over omniarcade_gold.gold_player_360 feature tables built in Step 3
bq query --use_legacy_sql=false "CALL omniarcade_raw.train_churn_model();"

echo "=== Step 5: Enriching Dataplex Knowledge Catalog, Glossaries & Aspects ==="
cd ../scripts
python3 01_create_glossary.py
python3 04_create_aspects.py
python3 07_create_lineage.py
python3 08_create_churn_guardrail_aspects.py

echo "=== Step 6: Submitting Cloud Build Job (Build & Store Image in Artifact Registry) ==="
# Builds unified container image & pushes to Artifact Registry repository data-cloud-ai-demos
cd ../..
gcloud builds submit --config=cloudbuild.yaml .

echo "=== Step 7: Deploying KC-Guided Agent to Vertex AI Agent Engine ==="
cd src/gamingdatademo/agents
./deploy_agents.sh

echo "=== Step 8: Launching Player 360 Executive Operations Web Platform ==="
cd ../../remix-gaming-app
npm install && npm run dev
```

---

## 🔒 Security & IAM Authentication Architecture

The Express backend (`server.ts`) is refactored from a static API Key model (`GEMINI_API_KEY`) to **Google Cloud Application Default Credentials (ADC)** / `@google-cloud/aiplatform` SDK.

### Dual IAM Authentication Credentials Resolution:
1. **Local Developer Authentication**: Resolves credentials via local `gcloud auth application-default login`.
2. **Cloud Run Container Authentication**: Resolves OAuth 2.0 access tokens via Compute Engine Metadata Server attached to `omniarcade-demo-sa@$PROJECT_ID.iam.gserviceaccount.com`.

### Required IAM Service Account Permissions:
- **Pub/Sub Telemetry Publisher**: `roles/pubsub.publisher` (Publishes telemetry streams to `omniarcade-live-telemetry`)
- **Vertex AI Agent Engine**: `roles/aiplatform.user` (Invokes KC-Guided Agent)
- **Dataplex Knowledge Catalog**: `roles/dataplex.viewer` (Reads glossaries, custom aspects & lineage)
- **BigQuery Data Access**: `roles/bigquery.dataViewer` & `roles/bigquery.jobUser` (Queries Gold analytics datasets & executes BQML `ML.PREDICT`)
- **Artifact Registry Writer**: `roles/artifactregistry.writer` (Cloud Build image submission)

---

## 🛠️ Mitigations for Friction & Edge Case Risks

### 1. Unified Containerization via Cloud Build & Artifact Registry
- **Risk**: Separate frontend and backend containers create deployment friction on Cloud Run.
- **Fix**: Created a unified multi-stage `Dockerfile` and `entrypoint.sh` managed via `cloudbuild.yaml`, pushing to platform Artifact Registry `data-cloud-ai-demos` without auto-deploying.

### 2. In-Warehouse Machine Learning via BQML
- **Risk**: External ML inference servers add deployment friction and latency.
- **Fix**: Used BQML (`ML.PREDICT`), executing churn prediction directly inside BigQuery over streaming session features without exporting data outside GCP.

### 3. Zero-Code Streaming Telemetry via Pub/Sub Direct Subscription
- **Risk**: Traditional Dataflow pipeline code adds unnecessary complexity for demo provisioning.
- **Fix**: Used Pub/Sub Direct BigQuery Subscription (`games-pubsub.tf`), allowing `@google-cloud/pubsub` events to stream into `omniarcade_raw.live_session_events` in ~100ms. Enforced strict `snake_case` and ISO-8601 formatting in `server.ts`.

### 4. Dataform Compilation Timing Fallback SQL JOINs
- **Risk**: Fresh deployments running churn risk SQL queries before `omniarcade_gold.gold_player_360` completes will crash with table missing errors.
- **Fix**: Added `LEFT JOIN` with fallback `COALESCE` to raw staging table `omniarcade_raw.gcp_players` inside `calculate-churn-risk.sql.tftpl`.

### 5. Graceful Degradation & Full Offline Fallback Modes
- **Risk**: Backend GCP service outages (e.g. Pub/Sub stream lag, Vertex AI Agent Engine quotas, missing Dataplex tags) or completely offline demo presentation causes UI crashes.
- **Fix**: Designed comprehensive multi-tier fallback mechanisms across both applications:
  - **Pub/Sub Unavailable**: `server.ts` catches error and runs local score evaluation without unmounting UI.
  - **BQML / BigQuery Unavailable**: `server.ts` falls back to deterministic rule scoring (`IF deaths > 2 THEN 0.87`).
  - **Vertex AI Agent Engine Unavailable**: `HospitalAdmin.tsx` displays inline banner with pre-cached schema previews. `gamingdatademo` Flask app streams pre-recorded trajectory logs (`demo_trajectories.json`).
  - **Dataplex Catalog Unavailable**: `KnowledgeCatalog.tsx` falls back to local schema JSON definitions (`mock_catalog.json`).
  - **Full Offline Mode**: Both web applications run 100% offline, serving mock executive metrics, pre-recorded agent trajectories, and simulated RPG game client pop-ups. Zero unhandled crashes.

---

## 🧩 Component Mapping & Role Allocation

| Component Layer | Source Project | Key Responsibilities | Technology Stack |
| :--- | :--- | :--- | :--- |
| **Infra, Streaming & Data Generation** | [retail-data-and-ai-demo](retail-data-and-ai-demo/overview.md) | Standardized IaC pattern. Provisions GCP APIs, Pub/Sub direct streaming subscription (`games-pubsub.tf`), Artifact Registry (`artifact-registry.tf`), BigQuery datasets (`games/`), and synthetic player profiles. | Terraform, Cloud Pub/Sub, Artifact Registry, BigQuery AI (`AI.GENERATE`), BQML (`ML.PREDICT`), Vertex AI |
| **Governance & Medallion Pipeline** | [gamingdatademo](gamingdatademo/overview.md) | Orchestrates Bronze $\rightarrow$ Silver $\rightarrow$ Gold transformations via Dataform based on `games/` raw datasets. Configures Dataplex Knowledge Catalog, business glossaries, quality scans, aspect tags (`08_create_churn_guardrail_aspects.py`), and data lineage. | BigQuery, Dataform, GCP Dataplex Knowledge Catalog, Python |
| **KC-Guided Agent Engine** | [gamingdatademo](gamingdatademo/overview.md) | Exposes Dataplex metadata via MCP APIs. Powers a Vertex AI Agent Engine agent that dynamically searches table schemas and glossary terms to answer complex cross-system questions. | `google-adk`, Vertex AI Agent Engine, Gemini 2.5/3.0, MCP APIs |
| **Executive Operations UI** | [remix-gaming-app](remix-gaming-app/overview.md) | Renders executive KPI cards, region/language switching, server latency graphs, Knowledge Catalog explorer, PineCore AI Chatbot, and LiveOps Churn Guardrail split-screen view. | React 19, Vite, Tailwind CSS v4, Express, Firebase |

---

## 📊 Expected Deliverables & Verification Metrics

| Phase | Milestone / Deliverable | Success Criteria / Verification Method |
| :--- | :--- | :--- |
| **Phase 1** | Modular `games/` Terraform extension (BigQuery + Pub/Sub + BQML + Artifact Registry) inside `retail-data-and-ai-demo`. | `terraform apply -var="industry_target=games"` provisions `omniarcade_raw` dataset, `omniarcade-live-telemetry` Pub/Sub topic, direct BQ subscription, and `data-cloud-ai-demos` Artifact Registry repository. |
| **Phase 2** | Dataform Medallion pipeline & Dataplex Knowledge Catalog tags. | Dataform assertions pass; Dataplex UI displays glossary terms, data quality aspects (`08_create_churn_guardrail_aspects.py`), and lineage graphs for Gold tables. |
| **Phase 3** | Cloud Build image build & submission to Artifact Registry (`cloudbuild.yaml`). | `gcloud builds submit` succeeds, creating image `data-cloud-ai-demos/gaming-app:latest` in Artifact Registry. |
| **Phase 4** | KC-Guided Agent deployed on Vertex AI Agent Engine & Express backend integrated with BQML `ML.PREDICT`. | Express `/api/telemetry/stream` successfully publishes events to Pub/Sub, streaming into BigQuery `live_session_events` in ~100ms with event-driven BQML prediction. |
| **Phase 5** | Unified React Executive Dashboard (`remix-gaming-app`) with LiveOps Churn Guardrail Split-Screen. | Live UI streams game client telemetry via Pub/Sub, triggers in-engine BQML churn prediction (87%), checks Dataplex policy, and renders dynamic $0.99 offer pop-up in <300ms. |
