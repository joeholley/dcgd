---
trigger: always_on
---

# Table Drift Immunity & Pure-Consumer Lakehouse Invariants

The following invariants apply to all coding, configuration, diagnostics, and deployment tasks within this repository.

## 1. Zero Hardcoding of Source Tables (Drift Immunity)
Because upstream schemas and table locations can vary between environments and generator versions, **no source table or dataset name may be hardcoded** in SQL queries, diagnostics probes, UI cards, or serving routes.

All table names must be dynamically resolved using:
- **TypeScript / Express / React**: `src/services/dataSourceConfig.ts` (`getTableMapping()`, `getSourceRawEventsTable()`, `getSourcePlayerDnaTable()`, `getSourcePaymentSettlementsTable()`)
- **Python / Flask**: `data_source_config.py` (`get_table_mapping()`, `get_gold_dataset()`, `get_silver_dataset()`, `get_reference_dataset()`)
- **Terraform**: `var.source_player_dna_table`, `var.source_raw_events_table`, `var.source_payment_settlements_table`
- **CLI / Cloud Run**: `--set-env-vars` passing `SOURCE_PLAYER_DNA_TABLE`, `SOURCE_RAW_EVENTS_TABLE`, `SOURCE_PAYMENT_SETTLEMENTS_TABLE`, `BIGQUERY_DATASET_GOLD`, `BIGQUERY_DATASET_SILVER`, `BIGQUERY_DATASET_REFERENCE`

## 2. Active Conformed Architecture vs. Deprecated Legacy Tables

| Category | Deprecated Legacy Table (DO NOT USE) | Active Conformed Resource | Configuration Variable |
| :--- | :--- | :--- | :--- |
| **Player Population** | `gaming_raw.gcp_players`, `synthetic_players` | `gaming_player_data.player_dna` | `SOURCE_PLAYER_DNA_TABLE` |
| **Raw Telemetry Stream** | `gaming_raw.live_session_events` | `gaming_raw.raw_events` | `SOURCE_RAW_EVENTS_TABLE` |
| **Monetization & Settlements** | `gaming_raw.iap_transactions` | `gaming_raw.payment_gateway_settlements`<br>`gaming_silver.silver_microtransactions` | `SOURCE_PAYMENT_SETTLEMENTS_TABLE` |
| **Telemetry SRE & Latency** | `gaming_silver.server_latency` | `gaming_silver.silver_client_sre_metrics` | `BIGQUERY_DATASET_SILVER` |
| **Campaign & ROAS** | `gaming_gold.gold_campaign_analytics` | `gaming_gold.gold_marketing_roas_cohorts` | `BIGQUERY_DATASET_GOLD` |
| **Retention Analytics** | `gaming_gold.gold_retention_adequacy` | `gaming_gold.gold_churn_root_cause_mart` | `BIGQUERY_DATASET_GOLD` |
| **Level Bottlenecks** | *Hardcoded in UI / JS* | `gaming_gold.gold_level_difficulty_funnel` | `BIGQUERY_DATASET_GOLD` |
| **Reference Releases** | *Hardcoded in UI / JS* | `gaming_reference_data.ref_client_releases` | `BIGQUERY_DATASET_REFERENCE` |
| **Level Balance Config** | *Hardcoded in UI / JS* | `gaming_reference_data.ref_level_configs` | `BIGQUERY_DATASET_REFERENCE` |

## 3. Strict Ground-Truth Air-Gap Invariant
- `gaming_player_data.simulation_parameters` (and helper views `v_latest_simulation_parameters`, `v_simulation_metrics_flattened`, `v_simulation_run_history`, `v_player_dna_parameter_history`) are **STRICTLY OFF-LIMITS** to runtime applications (`server.ts`, `app.py`), UI dashboards, diagnostics monitors, and AI agents.
- Runtime metrics and diagnostics must be derived purely bottom-up from conformed lakehouse tables.
- The simulation registry is reserved solely for headless CI/CD test oracles (`tests/test_simulation_reconciliation.py`).

## 4. In-Repo Data Generation Quarantine
- All legacy in-repo BigQuery generation routines in `retail-data-and-ai-demo` (`generate-players.sql.tftpl`, `populate-player-tables.sql.tftpl`, `generate-iap.sql.tftpl`) are deprecated, quarantined under `legacy-data-gen/`, and disabled via `enable_legacy_data_gen = false`.
- Never enable or re-introduce in-repo data generators as build or deployment steps unless explicitly instructed via the `--enable-legacy-data-gen` flag.

## 5. Upstream Per-Game Telemetry Discovery & Mandatory Deployer Selection Invariant
- Raw event tables are generated on a per-game basis by `eventsim` (e.g. `gaming_<game_name>_<id>.raw_events`), while global player demographics reside in `gaming_player_data.player_dna`.
- `gaming_raw` is the deprecated legacy dataset name.
- **Mandatory Discovery Exit Workflow**:
  - By default, when `deploy-demo.sh` runs without explicit game dataset substitutions (`--game-dataset`, `--raw-events-table`) and without `--enable-legacy-data-gen`, it **MUST**:
    1. Query `INFORMATION_SCHEMA.TABLES` for all discovered game datasets containing `raw_events`.
    2. Print the list of available game datasets and the exact command lines (both `./deploy-demo.sh --game-dataset=...` and Cloud Build) to execute the deployment script.
    3. **Exit immediately without auto-selecting or deploying**.
  - **AI Agent Directive**: Future AI agents MUST NEVER auto-select a game dataset, guess a default game title, or bypass this discovery exit unless the user explicitly provides `--game-dataset=<name>`, `--raw-events-table=<table_name>`, or `--enable-legacy-data-gen`.
