# Medallion Lakehouse Schemas, Dynamic Table Mapping & Parameters Reference

## 1. Dynamic Table Resolution Contract (`dataSourceConfig.ts` & `data_source_config.py`)

To guarantee **Table Drift Immunity**, neither the Express gateway (`src/remix-gaming-app`) nor the Flask service (`src/gamingdatademo/website-live`) hardcodes BigQuery table names. Both resolve table IDs at runtime from environment variables via `getTableMapping()` / `get_table_mapping()`:

| Logical Key (`dataSourceConfig.ts` / `data_source_config.py`) | Controlling Environment Variable | Default Resolution Pattern | Layer / Role |
| :--- | :--- | :--- | :--- |
| `sourcePlayerDna` / `source_player_dna` | `SOURCE_PLAYER_DNA_TABLE` | `<PROJECT_ID>.gaming_player_data.player_dna` | Upstream Player Population (`generator`) |
| `sourceRawEvents` / `source_raw_events` | `SOURCE_RAW_EVENTS_TABLE` | `<PROJECT_ID>.<GAME_DATASET>.raw_events` | Upstream Per-Game Telemetry (`eventsim`) |
| `sourcePaymentSettlements` / `source_payment_settlements` | `SOURCE_PAYMENT_SETTLEMENTS_TABLE` | `<PROJECT_ID>.<GAME_DATASET>.payment_gateway_settlements` | Upstream Store Clearing Feed (`eventsim`) |
| `simulatorWebappDemoRawEvents` / `simulator_webapp_demo_raw_events` | `SIMULATOR_WEBAPP_DEMO_RAW_EVENTS_TABLE` | `<PROJECT_ID>.<RAW_DS>.simulator_webapp_demo_raw_events` | Interactive Web Simulator Stream |
| `silverMicrotransactions` / `silver_microtransactions` | `BIGQUERY_DATASET_SILVER` (`gaming_silver`) | `<PROJECT_ID>.gaming_silver.silver_microtransactions` | Conformed IAP & Store Transactions |
| `silverMatchSessions` / `silver_match_sessions` | `BIGQUERY_DATASET_SILVER` (`gaming_silver`) | `<PROJECT_ID>.gaming_silver.silver_match_sessions` | Conformed Match & Session Summaries |
| `silverClientSreMetrics` / `silver_client_sre_metrics` | `BIGQUERY_DATASET_SILVER` (`gaming_silver`) | `<PROJECT_ID>.gaming_silver.silver_client_sre_metrics` | Conformed Client FPS, Ping & Crash SRE |
| `silverMarketingAttribution` / `silver_marketing_attribution` | `BIGQUERY_DATASET_SILVER` (`gaming_silver`) | `<PROJECT_ID>.gaming_silver.silver_marketing_attribution` | Conformed UA Install Attribution |
| `silverPlayerHistory` / `silver_player_history` | `BIGQUERY_DATASET_SILVER` (`gaming_silver`) | `<PROJECT_ID>.gaming_silver.silver_player_history` | Historical Player State Transitions |
| `silverModerationAlerts` / `silver_moderation_alerts` | `BIGQUERY_DATASET_SILVER` (`gaming_silver`) | `<PROJECT_ID>.gaming_silver.silver_moderation_alerts` | Conformed Chat & Anti-Cheat Alerts |
| `goldStudioFinancial` / `gold_studio_financial` | `BIGQUERY_DATASET_GOLD` (`gaming_gold`) | `<PROJECT_ID>.gaming_gold.gold_studio_financial_performance` | Gross Spend, 30% Store Fees & Net Cash |
| `goldPlayer360` / `gold_player_360` | `BIGQUERY_DATASET_GOLD` (`gaming_gold`) | `<PROJECT_ID>.gaming_gold.gold_player_360` | Unified Player 360 & LTV Features |
| `goldChurnRootCause` / `gold_churn_root_cause` | `BIGQUERY_DATASET_GOLD` (`gaming_gold`) | `<PROJECT_ID>.gaming_gold.gold_churn_root_cause_mart` | Churn Drivers (Toxicity, Difficulty,Ping) |
| `goldMarketingRoas` / `gold_marketing_roas` | `BIGQUERY_DATASET_GOLD` (`gaming_gold`) | `<PROJECT_ID>.gaming_gold.gold_marketing_roas_cohorts` | Campaign ROAS & Cohort Payback |
| `goldRegionalKpis` / `gold_regional_kpis` | `BIGQUERY_DATASET_GOLD` (`gaming_gold`) | `<PROJECT_ID>.gaming_gold.gold_regional_kpis` | Regional DAU, MAU & ARPU Rollups |
| `goldCheatAnalytics` / `gold_cheat_analytics` | `BIGQUERY_DATASET_GOLD` (`gaming_gold`) | `<PROJECT_ID>.gaming_gold.gold_cheat_analytics` | Cheat & Economy Exploit Mart |
| `goldLevelDifficultyFunnel` / `gold_level_difficulty_funnel` | `BIGQUERY_DATASET_GOLD` (`gaming_gold`) | `<PROJECT_ID>.gaming_gold.gold_level_difficulty_funnel` | Per-Level Failure & Chokepoint Funnel |
| `refLevelConfigs` / `ref_level_configs` | `BIGQUERY_DATASET_REFERENCE` (`gaming_reference_data`) | `<PROJECT_ID>.gaming_reference_data.ref_level_configs` | Level Move Limits & Boss HP Reference |
| `refClientReleases` / `ref_client_releases` | `BIGQUERY_DATASET_REFERENCE` (`gaming_reference_data`) | `<PROJECT_ID>.gaming_reference_data.ref_client_releases` | Client Patch & Build Version Registry |

> **Strict Ground-Truth Air-Gap**: `gaming_player_data.simulation_parameters` and its views (`v_latest_simulation_parameters`, `v_simulation_metrics_flattened`, `v_simulation_run_history`, `v_player_dna_parameter_history`) are **intentionally excluded** from `dataSourceConfig.ts` and `data_source_config.py`. Never add them to runtime services.

---

## 2. Deprecated Legacy Tables vs. Active Conformed Resources

| Domain | Deprecated Resource (DO NOT USE) | Active Conformed Resource |
| :--- | :--- | :--- |
| **Player Population** | `gaming_raw.gcp_players`, `synthetic_players` | `<discovered_dataset>.player_dna` (`SOURCE_PLAYER_DNA_TABLE`) |
| **Raw Telemetry Stream** | `gaming_raw.live_session_events` | `<discovered_game_dataset>.raw_events` (`SOURCE_RAW_EVENTS_TABLE`) |
| **Monetization & IAP** | `gaming_raw.iap_transactions` | `<discovered_game_dataset>.payment_gateway_settlements` & `gaming_silver.silver_microtransactions` |
| **Client Latency & SRE** | `gaming_silver.server_latency` | `gaming_silver.silver_client_sre_metrics` |
| **Marketing & ROAS** | `gaming_gold.gold_campaign_analytics` | `gaming_gold.gold_marketing_roas_cohorts` |
| **Retention & Churn** | `gaming_gold.gold_retention_adequacy` | `gaming_gold.gold_churn_root_cause_mart` |

---

## 3. Cloud Build Substitutions (`cloudbuild.yaml`)

| Substitution Variable | Default | Description & Constraints |
| :--- | :--- | :--- |
| `_LOCATION` | `us-central1` | Target GCP region for Cloud Run and Artifact Registry |
| `_BIGQUERY_LOCATION` | `US` | BigQuery dataset location (`US` multi-region by default) |
| `_REPOSITORY` | `gaming-demo-images` | Artifact Registry Docker repository name |
| `_TAG` | `latest` | Container image tag (note: `:builder` is also pushed for layer caching) |
| `_GAME_DATASET` | `""` (empty) | Single upstream per-game dataset name (e.g., `gaming_neonvortex_7491282640212123500`) |
| `_GAME_DATASETS` | `""` (empty) | Comma-separated list of upstream per-game datasets |
| `_SOURCE_PLAYER_DNA_TABLE` | `""` (auto-discovered) | Full table ID (`project.dataset.player_dna`); auto-discovered from `INFORMATION_SCHEMA.TABLES` if omitted |
| `_SOURCE_RAW_EVENTS_TABLE` | `""` (derived) | Derived as `${PROJECT_ID}.${_GAME_DATASET}.raw_events` or explicitly overridden |
| `_SOURCE_PAYMENT_SETTLEMENTS_TABLE` | `""` (probed) | Probed via `bq show` in `${_GAME_DATASET}.payment_gateway_settlements` if omitted |
| `_ENABLE_LEGACY_DATA_GEN` | `'false'` | Set to `'true'` only when explicitly testing quarantined `gaming_raw` legacy tables |

---

## 4. Terraform Variables (`src/retail-data-and-ai-demo/infrastructure/terraform/variables.tf`)

| Terraform Variable | Default | Description |
| :--- | :--- | :--- |
| `project_id` | *(required)* | Target GCP Project ID |
| `industry_target` | `"retail"` | **Must be set to `"games"`** (or `"all"`) to provision gaming infrastructure (`games/*.tf`) |
| `gcp_region` | `"us-central1"` | Region for Artifact Registry and regional resources |
| `games_dataset_location` | `"US"` | BigQuery location for gaming Medallion datasets |
| `source_player_dna_table` | `"gaming_player_data.player_dna"` | Upstream player population table |
| `source_raw_events_table` | `"gaming_raw.raw_events"` | Upstream raw CloudEvents table |
| `source_payment_settlements_table` | `"gaming_raw.payment_gateway_settlements"` | Upstream payment gateway settlements table |
| `source_simulation_parameters_table` | `"gaming_player_data.simulation_parameters"` | Used **ONLY** by headless CI/CD reconciliation test suites |
| `enable_legacy_data_gen` | `false` | Keeps deprecated SQL data generator routines disabled |
| `firestore_location` | `"us-central1"` | Region for Cloud Firestore Native database |

---

## 5. `deploy-demo.sh` CLI Flags Reference

*Note: Per workspace rules, never execute `deploy-demo.sh` directly on a local workstation; use `gcloud builds submit --config=cloudbuild.yaml`. These flags document how the orchestrator parses parameters when invoked inside CI/Cloud Build runners:*

- `--game-dataset <NAME>`: Upstream per-game dataset name.
- `--raw-events-table <TABLE>`: Explicit raw events table (`<dataset>.raw_events`).
- `--player-dna-table <TABLE>`: Explicit player DNA table (`<dataset>.player_dna`).
- `--settlements-table <TABLE>`: Explicit payment settlements table.
- `--publisher-name <NAME>` / `--studio-name <NAME>`: Customizes studio branding across the UI (default: `'Jingle Games'`).
- `--steps <1-8>` / `--skip-steps <1-8>`: Runs or skips specific runbook steps (`1`=Terraform, `2`=Config, `3`=Dataform, `4`=Dataplex, `5`=BQML, `6`=ADK Agents, `7`=Container Build, `8`=Cloud Run).
- `--all-agents`: Deploys all 5 ADK agents (`basic`, `scaled`, `kc`, `council`, `council_seq`) during Step 6 instead of only `kc`.
- `--force-agent-build`: Forces container image rebuild for `agent_kc` during Step 6.
- `--enable-legacy-data-gen`: Opts into quarantined legacy `gaming_raw` tables.
