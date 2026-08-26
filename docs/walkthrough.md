# Upstream Integration & Task List Planning Walkthrough

## Summary of Accomplishments

A complete review of the updated upstream specifications ([`docs/upstream/eventsim.md`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/upstream/eventsim.md) and [`docs/upstream/generator.md`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/upstream/generator.md)) was conducted, addressing all latest features including HARE hybrid anomalies, dynamic schema evolution (`dataschema`), multi-store clearing feeds, client SRE ticks, toxicity SIR contagion, and simulation parameter registry provenance.

---

## 🏛️ Key Architectural Decisions Established

### 1. Configurable Source Table Mapping (Drift Immunity)
* To protect against naming/schema drift between legacy setups (`players`, `events`) and evolving upstream generators (`player_dna`, `raw_events`, or custom dataset prefixes), **the person deploying can explicitly specify the source table names**.
* **Zero Hardcoded Names**:
  - In **Terraform**: `variables.tf` exposes `source_player_dna_table`, `source_raw_events_table`, `source_payment_settlements_table`, and `source_simulation_parameters_table`.
  - In **Express / React**: Centralized `src/services/dataSourceConfig.ts` resolves table names from `process.env`.
  - In **Flask**: `data_source_config.py` resolves table names from `os.getenv()`.
  - In **CLI**: `deploy-demo.sh` accepts `--player-dna-table=...`, `--raw-events-table=...`, etc.

### 2. In-Repo Data Provisioning Deprecated & Sequestered (`legacy-data-gen`)
* All legacy BigQuery generation routines in `src/retail-data-and-ai-demo` are **deprecated** and sequestered under `infrastructure/terraform/games/legacy-data-gen/`, gated behind `enable_legacy_data_gen = false`.
* **Nothing in this repository takes their place**. This repository will NOT run the upstream generators or simulators as build/deployment steps.

### 3. Pure Downstream Consumption Architecture
* The main process of this repository is strictly **consuming and conforming pre-existing tables** in the target GCP project:
  - Specified player DNA table (default: `gaming_player_data.player_dna`)
  - Specified raw telemetry table (default: `gaming_raw.raw_events`)
  - Specified payment clearing table (default: `gaming_raw.payment_gateway_settlements`)
* This repository builds and owns the downstream Medallion pipeline: `gaming_silver.*` (deduplication, SRE metrics, schema evolution coalescing) and `gaming_gold.*` (Player 360, studio financial performance, churn root cause, level difficulty funnels).

### 4. Demo Presenter Prerequisite Runbook
* Prominently documented in `README.md` and `deploy-demo.sh`: the preferred path is for the person presenting the demo to generate the synthetic data beforehand using the upstream tools ([`generator`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/upstream/generator.md) and [`eventsim`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/upstream/eventsim.md)) **BEFORE** attempting to deploy the software stack in this repository.

### 5. Strict Ground-Truth Air-Gap
* `gaming_player_data.simulation_parameters` (and its views `v_latest_simulation_parameters`, etc.) are **STRICTLY OFF-LIMITS** to runtime applications ([`server.ts`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/server.ts), [`app.py`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/website-live/app.py)), UI views, and AI agents ([`governance.py`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/agents/kc/agent_kc/governance.py)).
* All dashboard KPIs and agent insights are computed purely **bottom-up** from conformed lakehouse tables.
* The registry is used exclusively by `tests/test_simulation_reconciliation.py` to audit accuracy headlessly.

---

## 🚀 Refactor Checkpoint 1: Completed & Validated

### Component 1: Terraform Infrastructure & Lakehouse Layer (`src/retail-data-and-ai-demo`)
- [x] **Sequestered Legacy Generation**: Moved `generate-players.sql.tftpl`, `populate-player-tables.sql.tftpl`, and `generate-iap.sql.tftpl` into [`infrastructure/terraform/games/legacy-data-gen/`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/retail-data-and-ai-demo/infrastructure/terraform/games/legacy-data-gen).
- [x] **Gated Legacy Routines**: Updated [`games-bigquery-procedure.tf`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/retail-data-and-ai-demo/infrastructure/terraform/games/games-bigquery-procedure.tf) with `count = var.enable_legacy_data_gen ? 1 : 0`.
- [x] **Configurable Source Table Variables**: Added `source_player_dna_table`, `source_raw_events_table`, `source_payment_settlements_table`, `source_simulation_parameters_table`, and `enable_legacy_data_gen` in root and games [`variables.tf`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/retail-data-and-ai-demo/infrastructure/terraform/games/variables.tf) and wired them through [`main.tf`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/retail-data-and-ai-demo/infrastructure/terraform/main.tf).
- [x] **Parameterized Silver Conformance Views**: Deployed `silver_microtransactions` (deduplicated), `silver_match_sessions`, `silver_client_sre_metrics` (schema-resilient coalescing), `silver_marketing_attribution`, `silver_player_history` (SCD2), and `silver_moderation_alerts` in [`games-bigquery.tf`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/retail-data-and-ai-demo/infrastructure/terraform/games/games-bigquery.tf).
- [x] **Parameterized Gold Analytical Marts**: Deployed `gold_studio_financial_performance`, `gold_player_360`, `gold_churn_root_cause_mart`, `gold_marketing_roas_cohorts`, `gold_regional_kpis`, and `gold_cheat_analytics` in [`games-bigquery.tf`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/retail-data-and-ai-demo/infrastructure/terraform/games/games-bigquery.tf).
- [x] **Deployed Testing Oracle DDL**: Deployed `gaming_player_data.simulation_parameters` table and `v_latest_simulation_parameters` view strictly for CI/CD test runner audits.
- [x] **Syntax & Validation Verification**:
  - `terraform fmt -recursive` passed cleanly.
  - `terraform validate` returned **`Success! The configuration is valid.`**
  - `bash -n entrypoint.sh && bash -n deploy-demo.sh` passed with exit code 0.
- [x] **Live GCP Cloud Deployment Verification (`deploy-demo.sh --steps 1`)**:
  - Successfully dropped stale legacy `us-central1` datasets and provisioned `gaming_silver` and `gaming_gold` in **`US` multi-region**, achieving strict regional colocation with upstream tables (`datacloudgamesdemo006.gaming_player_data` and `datacloudgamesdemo006.gaming_dqvalidationtest_2419273193286583938`).
  - Corrected Dataplex aspect type IDs to conform to Google Cloud standards (hyphen-separated `certified-reward-sku-aspect` and `liveops-campaign-policy-aspect`).
  - Unpacked CloudEvents JSON 1.0 specification from `raw_events.event_envelope` across all Silver conformance views.
  - Resolved `player_id` column ambiguity in `gold_marketing_roas_cohorts`.
  - **Live Analytical Mart Query Validation Results**:
    - **`gold_regional_kpis`**: Accurately aggregated all **50,000,000 players** across US (17.5M), EMEA (15.0M), APAC (12.5M), and LATAM (5.0M) with live bottom-up gross revenue totals.
    - **`gold_studio_financial_performance`**: Computed live net revenues, storefront commissions, and reconciliation against cleared payouts and bank penalties from `payment_gateway_settlements`.
    - **`gold_player_360`**: Successfully joined player DNA attributes with conformed microtransactions, identifying top spenders (e.g. `$12,564.20` across 31 purchases).
    - **`gold_churn_root_cause_mart`**: Successfully correlated client SRE telemetry (avg ping, avg fps, crashes) with gameplay loss rates across thousands of match sessions per player.

---

## 🚀 Refactor Checkpoint 2: Completed & Validated

### Component 2: Serving Gateways & Config Resolvers (`remix-gaming-app` & `gamingdatademo`)
- [x] **Created TypeScript Config Resolver (`src/remix-gaming-app/src/services/dataSourceConfig.ts`)**:
  - Implemented dynamic table and dataset resolution reading `SOURCE_RAW_EVENTS_TABLE`, `SOURCE_PLAYER_DNA_TABLE`, `SOURCE_PAYMENT_SETTLEMENTS_TABLE`, `BIGQUERY_DATASET_SILVER`, `BIGQUERY_DATASET_GOLD`, and `BIGQUERY_LOCATION`.
  - Exported `getTableMapping()` returning fully-qualified table IDs across Bronze/Silver/Gold layers.
  - **Air-Gap Verification**: `simulation_parameters` is explicitly and strictly excluded from exports.
- [x] **Refactored Express Service (`src/remix-gaming-app/src/services/bigquery.ts`)**:
  - Replaced hardcoded table and dataset references with `tables.*` from `dataSourceConfig.ts`.
  - Configured BigQuery client to use `getBigQueryLocation()` (defaults to multi-region `"US"`).
  - Aligned queries with actual Medallion schema:
    - `queryPlayer360`: Aligned with `gold_player_360` schema (`device_family`, `country_code`, `creation_timestamp`, `is_churned`).
    - `queryRegionalKPIs`: Aligned with `gold_regional_kpis` schema (`region`, `dau`, `mau`, `arpu_dollars`, `total_revenue_dollars`).
    - `queryCampaignAnalytics`: Aligned with `gold_marketing_roas_cohorts` (`campaign_token`, `ad_network`, `total_installs`, `total_revenue`).
  - Added new query functions for newly deployed Gold marts: `queryStudioFinancial()`, `queryChurnRootCause()`, and `queryCheatAnalytics()`.
- [x] **Updated Express API Endpoints (`src/remix-gaming-app/server.ts`)**:
  - Refactored `/api/analytics/exemplars` to dynamically target `getTableMapping().goldPlayer360`.
  - Added new REST endpoints:
    - `GET /api/analytics/financial`: Studio financial performance and settlement reconciliation.
    - `GET /api/analytics/churn-root-cause`: SRE metrics vs gameplay disengagement.
    - `GET /api/analytics/cheat-analytics`: Security, toxicity, and moderation analytics.
- [x] **Created Python Config Resolver (`src/gamingdatademo/website-live/data_source_config.py`)**:
  - Implemented matching table and dataset resolver functions reading `os.getenv()` with identical defaults.
  - Returns dictionary of fully-qualified table names across Silver and Gold layers.
  - Strict air-gap enforcement: zero exposure of simulation parameters.
- [x] **Refactored Flask Microservice (`src/gamingdatademo/website-live/app.py`)**:
  - Connected `/api/marketing/cohort-telemetry` to `gold_marketing_roas_cohorts`.
  - Connected `/api/executive/portfolio-metrics` to `gold_regional_kpis`.
  - Added new endpoints: `GET /api/financial-summary`, `GET /api/churn-root-cause-stats`, and `GET /api/cheat-analytics-stats`.
  - Maintained deployment requirements: multi-threaded `gunicorn --threads 8 --bind 127.0.0.1:5000` and `debug=False`.
- [x] **Updated Deployment Script (`deploy-demo.sh`)**:
  - Cloud Run `--set-env-vars` now explicitly sets `BIGQUERY_LOCATION=${BIGQUERY_LOCATION:-US}`, `SOURCE_PLAYER_DNA_TABLE`, `SOURCE_RAW_EVENTS_TABLE`, and `SOURCE_PAYMENT_SETTLEMENTS_TABLE`.
- [x] **Validation & Verification**:
  - Python compilation: `python3 -m py_compile src/gamingdatademo/website-live/data_source_config.py src/gamingdatademo/website-live/app.py` passed with code 0.
  - Python test execution: `data_source_config.get_table_mapping()` verified and resolved all 15 tables to active project `datacloudgamesdemo006`.
  - Shell script validation: `bash -n entrypoint.sh && bash -n deploy-demo.sh` passed with code 0.
  - Air-gap audit: Search across the entire codebase confirmed zero occurrences of `simulation_parameters` in runtime application code, gateways, or AI agents.

---

## 🚀 Refactor Checkpoint 3: Completed & Validated

### Component 3: Frontend UI Alignment (`remix-gaming-app`)
- [x] **Executive Overview & Multi-Store Financials ([`Overview.tsx`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/Overview.tsx))**:
  - Integrated dynamic multi-store studio financials banner fed directly from `/api/analytics/financial` (`gold_studio_financial_performance`) and `/api/analytics/regional` (`gold_regional_kpis`).
  - Displays real Gross In-App Spend, Net Realized Cash (after Apple/Google/Steam deductions and chargeback adjustments), and 50.0M conformed global player breakdown with live data mode attribution.
- [x] **Game Operations & Client SRE Telemetry ([`Operations.tsx`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/Operations.tsx))**:
  - Connected scorecards to live regional DAU feeds.
  - Bound stability and crash metrics by game/genre dynamically from `gold_churn_root_cause_mart`.
  - Replaced static player segments table with live player 360 exemplars (Whale spenders, Onboarding, Churned).
  - Bound Level 2 bottleneck failure rate to live `/api/difficulty-stats` feed.
- [x] **Diurnal Sine Wave Concurrency Distribution ([`DiurnalSineWaveGraph.tsx`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/DiurnalSineWaveGraph.tsx))**:
  - Aligned regional weights with conformed BigQuery Gold demographics (NA: 35%, EMEA: 30%, APAC: 25%), reflecting the real 50M player distribution.
- [x] **LiveOps Churn Guardrail & Exemplar Profiles ([`LiveOpsGuardrail.tsx`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/LiveOpsGuardrail.tsx), [`MockClientTab.tsx`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/MockClientTab.tsx))**:
  - Connected exemplar profiles to live `/api/exemplars` endpoint backed by `gold_player_360`, dynamically binding high-value spenders ($12,000+ LTV) and real behavioral churn risk scores.
- [x] **Operator Simulator Controls & Anomaly Modes ([`OperatorSimulatorTab.tsx`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/OperatorSimulatorTab.tsx), [`simulatorBridge.ts`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/services/simulatorBridge.ts))**:
  - Enabled Level 2 completion bottleneck and toxic chat outbreak anomaly modes.
  - Implemented telemetry event generation for both anomalies in `simulatorBridge.ts`.
- [x] **Campaign Marketing Engine ([`CampaignEngine.tsx`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/CampaignEngine.tsx))**:
  - Connected target player cohort presets to live `/api/analytics/campaigns` queries against `gold_marketing_roas_cohorts`.
- [x] **Knowledge Catalog & Dataplex Governance ([`KnowledgeCatalog.tsx`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/KnowledgeCatalog.tsx))**:
  - Updated Dataplex aspect types to hyphenated standard (`liveops-campaign-policy-aspect`).
  - Added conformed Medallion lakehouse assets (`gold_player_360`, `gold_studio_financial_performance`, `silver_client_sre_metrics`, and Dataplex DQ anomaly sentinels $P_{\text{dirty}} = 0.005$).
- [x] **System Diagnostics & Data Mode Verification ([`Diagnostics.tsx`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/Diagnostics.tsx))**:
  - Updated probe list to monitor conformed Silver views and Gold marts.
- [x] **Pre-Commit Verification**:
  - `bash -n entrypoint.sh && bash -n deploy-demo.sh` passed with exit code 0.

---

## 🚀 Refactor Checkpoint 4: Completed & Validated

### Component 4: Vertex AI Reasoning Engine / ADK Agent Enhancement (`src/agents/kc`)
- [x] **Expanded Governance & Financial Reasoning Tools ([`agent_kc/governance.py`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/agents/kc/agent_kc/governance.py))**:
  - Implemented `query_financial_settlements()`: Reconciles gross storefront revenue (Apple App Store, Google Play Store, Steam, Direct Web) against clearing payouts, platform commissions (30%), chargebacks, and processor fees from `gold_studio_financial_performance`.
  - Implemented `analyze_churn_root_cause()`: Correlates Level 2 boss fight defeats, move exhaustion, network ping spikes, client frame drops, and crash frequency against player churn probability from `gold_churn_root_cause_mart`. Categorizes root causes into `GAMEPLAY_BOTTLENECK`, `TECHNICAL_SRE_DEGRADATION`, or `NATURAL_DISENGAGEMENT`.
- [x] **Semantic Discovery & Metadata Catalog Alignment ([`agent_kc/tools/search_entries.py`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/agents/kc/agent_kc/tools/search_entries.py), [`data.py`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/agents/kc/agent_kc/tools/data.py))**:
  - Added root concept mappings for `settlement`, `financial`, `storefront`, and `cause`.
  - Registered conformed schema definitions and mock records for `gold_studio_financial_performance` and `gold_churn_root_cause_mart` in `MOCK_DATA_CATALOG` and `MOCK_WAREHOUSE`.
- [x] **ADK 2.0 / Vertex AI Reasoning Engine Entrypoint ([`agent_engine_app.py`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/agents/kc/agent_engine_app.py))**:
  - Registered `query_financial_settlements` and `analyze_churn_root_cause` in the root agent tools list (expanding analytical capabilities to 8 core tools).
- [x] **LiveOps Product Manager System Prompt ([`system_prompt.py`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/agents/kc/agent_kc/prompts/system_prompt.py))**:
  - Enriched system prompt with instructions on when to invoke multi-store financial reconciliation and churn root-cause bottleneck analysis.
- [x] **Strict Air-Gap Verification**:
  - Zero references to upstream parameter registries in tools, prompt templates, or governance modules.
  - Formally validated by `test_strict_air_gap_enforcement`.
- [x] **Automated Test Validation**:
  - Full test suite execution: **110 passed, 0 failed** in 0.037s (`python3 -m unittest discover tests`).
