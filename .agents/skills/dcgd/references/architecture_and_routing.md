# Architecture, Dual-Process Routing & LiveOps Guardrail Reference

## 1. Dual-Process Cloud Run Container Architecture (`Dockerfile` & `entrypoint.sh`)

When deployed to Cloud Run (`gaming-demo-app`), a single container runs **two coordinated processes**:

1. **Internal Python Flask Service (`src/gamingdatademo/website-live/app.py`)**:
   - Launched first by `entrypoint.sh` on `127.0.0.1:${PYTHON_PORT:-5000}` via `gunicorn`:
     ```bash
     gunicorn --bind "127.0.0.1:${PYTHON_PORT}" --workers 1 --threads 8 --worker-class gthread --timeout 300 app:app &
     ```
   - `entrypoint.sh` executes a 30-attempt TCP socket readiness loop (`0.5s` interval) against `127.0.0.1:5000` before starting Node.js, and exits immediately if Gunicorn crashes.
   - **Why Gunicorn `gthread` is Mandatory**: Running `python3 app.py` directly triggers Werkzeug `debug=True` child process forking and single-threaded socket deadlocks in headless Cloud Run containers.
2. **Public Express Web Gateway & React 19 UI (`src/remix-gaming-app/server.ts`)**:
   - Compiled to `dist/server.cjs` + static client bundle via Vite (`npm run build` in `node:22-slim` builder stage).
   - Listens on `0.0.0.0:${PORT:-8080}` and serves both the React 19 Player 360 cockpit and all `/api/*` gateway routes.
   - **Reverse Proxy & WebSocket Upgrade to Flask (`127.0.0.1:5000`)**:
     - HTTP routes proxied to `127.0.0.1:5000`: `/agent-comparison/*`, `/api/gamingdatademo/*`, `/graph_visualization.html`, `/executive.html`, `/difficulty.html`, `/toxicity.html`, `/api/table-info`, `/api/term-info`, `/api/difficulty-stats`, `/api/simulate/*`, `/api/marketing/*`, `/api/executive/*`.
     - WebSocket upgrade proxied via TCP `net` socket to `127.0.0.1:5000`: `/api/ws` (powers real-time step-by-step query streaming and point-cloud animations in the 3-Tier Agent Comparison workspace).

---

## 2. Frontend UI Modules to Backend Endpoints & GCP Services

All main UI views live under `src/remix-gaming-app/src/components/sections/`:

| UI Component | Primary Express / Flask Routes | Target GCP Services & Tables | Key Capabilities |
| :--- | :--- | :--- | :--- |
| `Overview.tsx` | `GET /api/analytics/financial`<br>`GET /api/analytics/regional`<br>`GET /api/catalog/search` | BigQuery Gold (`gold_studio_financial_performance`, `gold_regional_kpis`, `gold_player_360`) & `player_dna` | Dynamic publisher branding (`PUBLISHER_NAME`), Gross Spend vs Net Realized Cash vs 30% Storefront Fees banner, AWS S3 / Snowflake / Cloud Spanner federation cards |
| `LiveOpsGuardrail.tsx` | `POST /api/telemetry/stream`<br>`GET /api/guardrail/events` (SSE) | Cloud Pub/Sub (`gaming-live-telemetry`) $\rightarrow$ BQ Direct Sub $\rightarrow$ BQML `ML.PREDICT` $\rightarrow$ Dataplex Aspect Check | Split-screen game client simulator + LiveOps telemetry observatory with <300ms autonomous retention pop-up |
| `GamingAssistant.tsx` | `POST /api/chat` | Vertex AI Agent Engine (`reasoningEngines` / `google-adk`) + Dataplex MCP + BigQuery Gold | Natural language executive Q&A returning grounded answers, SQL previews, confidence scores, and lineage links |
| `KnowledgeCatalog.tsx` | `GET /api/catalog/search`<br>`POST /api/catalog/rules/discover` | Dataplex Knowledge Catalog REST APIs (`dataplex.googleapis.com`) | Cross-cloud catalog browser, business glossaries, aspect tags, and plain-text **Automatic Rule Discovery Sandbox** |
| `Operations.tsx` | `GET /api/difficulty-stats`<br>`POST /api/simulate/difficulty-spike` | BigQuery Silver (`silver_client_sre_metrics`) + Gold (`gold_level_difficulty_funnel`) + Flask `:5000` | CCU, regional capacity, client SRE latency/crash telemetry, and live level difficulty spike simulation |
| `CampaignEngine.tsx` | `POST /api/marketing/simulate-cluster`<br>Firestore SDK | Cloud Firestore (`campaigns` / `offers`) + BigQuery Gold (`gold_marketing_roas_cohorts`) + Flask `:5000` | Cohort sizing, campaign CRUD state in Firestore, and multi-agent marketing ROAS recovery simulation |
| `ITObservatory.tsx` & `GCPHealth.tsx` | `GET /api/observatory/audit-logs`<br>`GET /api/system/gcp-health`<br>`POST /api/simulate/toxicity-incident` | BigQuery Audit Logs + 6-Service Health Probe + Flask `:5000` | Real-time 6-service probe (ADC Auth, BigQuery, Pub/Sub, BQML, Dataplex, Vertex AI Agent) & trust/safety toxicity simulator |
| `AgenticWorkflows.tsx` | Vertex AI Agent & Dataplex routes | Vertex AI Agent Engine + Dataplex Policy Checks | Multi-agent decision trace visualizers for Player Retention Promo, Cheat/Anomaly Detection, and Matchmaking |
| `/agent-comparison` | Proxied to Flask `:5000` + `/api/ws` | Vertex AI / Gemini + Dataplex Knowledge Catalog | Side-by-side comparison of Basic Agent (5 tables), Scaled Agent (150+ tables), and KC-Guided Agent |

---

## 3. Real-Time Autonomous LiveOps Churn Guardrail (<300ms SLA)

The split-screen LiveOps Guardrail (`LiveOpsGuardrail.tsx` + `server.ts`) implements a 5-stage low-latency loop:

1. **Telemetry Emission (`snake_case` Contract)**:
   - The in-game simulator posts gameplay frustration events (`boss_fail`, `consecutive_deaths`, `session_duration_seconds`) to `POST /api/telemetry/stream`.
2. **Zero-ETL Streaming Ingestion**:
   - `server.ts` publishes the payload via `@google-cloud/pubsub` to topic `gaming-live-telemetry`, which streams directly into BigQuery via a Pub/Sub Direct-to-BigQuery subscription (~100ms).
3. **In-Warehouse BQML Churn Scoring**:
   - `server.ts` executes `ML.PREDICT(MODEL gaming_raw.gaming_player_churn_model, ...)` and streams the updated churn risk probability to the UI over Server-Sent Events (`GET /api/guardrail/events`).
4. **Proactive Dataplex Aspect Pre-Caching (Churn Risk $\ge 0.50$)**:
   - When predicted churn probability crosses **50%**, `server.ts` asynchronously queries Dataplex Knowledge Catalog to verify governance policies (`liveops_campaign_policy_aspect` and `certified_reward_sku_aspect`) and pre-caches the approved promotional offer in memory.
5. **Sub-300ms Autonomous Intervention (Churn Risk $\ge 0.85$)**:
   - When predicted churn probability reaches **85%**, `server.ts` immediately pushes the pre-cached certified offer (`$0.99 Frost Giant Shield Pack — 50% Shield Boost + 100 Health Elixirs`) over SSE so the in-game modal renders in **<300ms**.

---

## 4. Master Orchestrator Runbook (`deploy-demo.sh` Steps 0–8)

While production deployments **must** be executed via `gcloud builds submit --config=cloudbuild.yaml`, `deploy-demo.sh` defines the full 8-step provisioning lifecycle across the sub-repositories:

| Step | Name | What It Executes |
| :---: | :--- | :--- |
| **Step 0** | Pre-Flight & Discovery Gate | Verifies active GCP project, IAM bindings, and upstream dataset parameters. If no game dataset is specified (and `--enable-legacy-data-gen` is false), queries `INFORMATION_SCHEMA.TABLES`, prints deployment commands, and exits. |
| **Step 1** | Core Terraform Infrastructure | Runs `terraform apply` in `src/retail-data-and-ai-demo/infrastructure/terraform` with `industry_target="games"` (`games-apis.tf`, `games-iam.tf`, `games-pubsub.tf`, `games-bigquery.tf`, `games-dataplex.tf`, `games-firestore.tf`). |
| **Step 2** | Dataplex Config Generation | Generates `src/gamingdatademo/scripts/config.json` with `project_id`, `project_number`, `region`, and `multi_region`. |
| **Step 3** | Dataform Medallion Pipeline | Executes `src/gamingdatademo/dataform` SQLX transformations (`Bronze -> Silver -> Gold`). |
| **Step 4** | Dataplex Glossaries & Aspects | Runs `01_create_glossary.py`, `08_create_churn_guardrail_aspects.py`, and `07_create_lineage.py`. |
| **Step 5** | BQML Churn Model Training | Trains/updates the in-warehouse BigQuery ML churn prediction model (`gaming_player_churn_model`). |
| **Step 6** | Vertex AI ADK Agent Deployment | Deploys the Knowledge-Catalog-guided agent (`kc` by default, or all 5 agents `basic`, `scaled`, `kc`, `council`, `council_seq` when `--all-agents` is passed). |
| **Step 7** | Container Compilation | Builds and caches `gaming-app:builder` and `gaming-app:latest` in Artifact Registry (`${_LOCATION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}`). |
| **Step 8** | Public Cloud Run Deployment | Deploys `gaming-demo-app` with `--service-account="gaming-runner-sa@${PROJECT_ID}.iam.gserviceaccount.com"`, `--allow-unauthenticated`, `--port=8080`, `--cpu=2`, `--memory=4Gi`, and `PYTHON_PORT=5000`. |
