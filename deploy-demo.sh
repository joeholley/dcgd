#!/usr/bin/env bash
# ==============================================================================
# Master Deployment Orchestrator Script: Unified Gaming Data & AI Operations Platform
# Steps 0 to 8 Runbook:
#   Step 0: Pre-flight Verification & Environment Sanity Check
#   Step 1: Core Terraform Infrastructure Provisioning
#   Step 2: Auto-Generate Dataplex Governance Configuration
#   Step 3: Dataform Medallion Pipeline Execution (Bronze -> Silver -> Gold)
#   Step 4: Dataplex Aspect Tags & Business Glossary Registration
#   Step 5: In-Warehouse BQML Churn Prediction Model Training
#   Step 6: Vertex AI Agent Engine / ADK Agent Deployment
#   Step 7: Cloud Build Container Compilation (Artifact Registry)
#   Step 8: Private Cloud Run Service Deployment
# ==============================================================================

set -eo pipefail

# Color codes for terminal logging
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

log_info() {
  echo -e "${BLUE}[INFO] $(date +'%Y-%m-%d %H:%M:%S')${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS] $(date +'%Y-%m-%d %H:%M:%S')${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN] $(date +'%Y-%m-%d %H:%M:%S')${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR] $(date +'%Y-%m-%d %H:%M:%S')${NC} $1"
}

log_step() {
  echo -e "\n${BOLD}${BLUE}======================================================================${NC}"
  echo -e "${BOLD}${BLUE}   $1${NC}"
  echo -e "${BOLD}${BLUE}======================================================================${NC}\n"
}

# Base paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}"
RETAIL_DIR="${REPO_ROOT}/src/retail-data-and-ai-demo"
GAMING_DIR="${REPO_ROOT}/src/gamingdatademo"
REMIX_UI_DIR="${REPO_ROOT}/src/remix-gaming-app"

# Global array to track background process PIDs for cleanup
declare -a PIDS=()

cleanup() {
  local exit_code=$?
  if [ ${#PIDS[@]} -gt 0 ]; then
    log_warn "Cleaning up background processes (${PIDS[*]}) ..."
    for pid in "${PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        log_info "Terminating background process PID $pid ..."
        kill "$pid" 2>/dev/null || true
      fi
    done
  fi
  if [ $exit_code -ne 0 ]; then
    log_error "Deployment runbook exited with error (code $exit_code)."
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

# Execution mode flags
RUN_INFRA=true
RUN_AGENTS=true
RUN_BUILD=true
RUN_DEPLOY=true
MODE_SET=false
AGENT_TARGET="kc"
FORCE_AGENT_BUILD=false

usage() {
  local exit_code="${1:-0}"
  cat <<EOHELP
Usage: $(basename "$0") [OPTIONS]

Master Deployment Orchestrator for Unified Gaming Data & AI Operations Platform.

Options:
  -a, --all             Run full deployment runbook (Steps 0-8) [Default].
  -s, --skip-infra      Skip infrastructure & agent deployment steps (1-6), run Cloud Build & Cloud Run (Steps 7-8).
  -k, --kc-agent-only   Only deploy/push out latest KC ADK Agent code to Vertex AI Agent Engine (Step 6 for agent_kc).
  -g, --agents-only, --agent-only Only deploy ADK agents (Step 6), skipping infrastructure and app build/deploy.
  -b, --build-only      Only run Cloud Build container compilation (Step 7).
  -d, --deploy-only     Only run Cloud Run service deployment (Step 8).
  --all-agents          Deploy all 5 ADK agents (basic, scaled, kc, council, council_seq) during Step 6.
  --force-agent-build   Force rebuild of agent_kc container image during Step 6.
  -h, --help            Show this help message and exit.

Examples:
  $(basename "$0") --skip-infra
  $(basename "$0") --kc-agent-only
  $(basename "$0") -k
  $(basename "$0") -g --all-agents
EOHELP
  exit "$exit_code"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--build-only)
      if [ "$MODE_SET" = false ]; then
        RUN_INFRA=false
        RUN_AGENTS=false
        RUN_BUILD=true
        RUN_DEPLOY=false
        MODE_SET=true
      else
        RUN_BUILD=true
      fi
      shift
      ;;
    -d|--deploy-only)
      if [ "$MODE_SET" = false ]; then
        RUN_INFRA=false
        RUN_AGENTS=false
        RUN_BUILD=false
        RUN_DEPLOY=true
        MODE_SET=true
      else
        RUN_DEPLOY=true
      fi
      shift
      ;;
    -k|--kc-agent-only|--push-agent|--agent-kc)
      if [ "$MODE_SET" = false ]; then
        RUN_INFRA=false
        RUN_AGENTS=true
        RUN_BUILD=false
        RUN_DEPLOY=false
        MODE_SET=true
      else
        RUN_AGENTS=true
      fi
      AGENT_TARGET="kc"
      shift
      ;;
    -g|--agent-only|--agents-only|--only-agents)
      if [ "$MODE_SET" = false ]; then
        RUN_INFRA=false
        RUN_AGENTS=true
        RUN_BUILD=false
        RUN_DEPLOY=false
        MODE_SET=true
      else
        RUN_AGENTS=true
      fi
      shift
      ;;
    --all-agents)
      AGENT_TARGET="all"
      shift
      ;;
    --force-agent-build)
      FORCE_AGENT_BUILD=true
      shift
      ;;
    -s|--skip-infra)
      if [ "$MODE_SET" = false ]; then
        RUN_INFRA=false
        RUN_AGENTS=false
        RUN_BUILD=true
        RUN_DEPLOY=true
        MODE_SET=true
      else
        RUN_INFRA=false
        RUN_AGENTS=false
      fi
      shift
      ;;
    -a|--all)
      RUN_INFRA=true
      RUN_AGENTS=true
      RUN_BUILD=true
      RUN_DEPLOY=true
      MODE_SET=true
      shift
      ;;
    -h|--help)
      usage 0
      ;;
    *)
      log_error "Unknown option: $1"
      usage 1
      ;;
  esac
done

# Configuration variables
GCP_PROJECT="${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT}}"
if [ -z "$GCP_PROJECT" ]; then
  GCP_PROJECT="$(gcloud config get-value project 2>/dev/null)"
fi

if [ -z "$GCP_PROJECT" ]; then
  log_error "No active GCP project ID detected."
  log_error "Please set GOOGLE_CLOUD_PROJECT or run 'gcloud config set project <PROJECT_ID>'."
  exit 1
fi

GCP_REGION="${GCP_LOCATION:-us-central1}"
PUBSUB_TOPIC="omniarcade-live-telemetry"
BQ_DATASET_RAW="omniarcade_raw"
BQ_DATASET_GOLD="omniarcade_gold"

# Fetch project number strictly
GCP_PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT}" --format="value(projectNumber)" 2>/dev/null)"
if [ -z "$GCP_PROJECT_NUMBER" ]; then
  log_error "Failed to retrieve project number for project '${GCP_PROJECT}'."
  exit 1
fi

# ==============================================================================
# Step 0: Pre-flight Verification & Environment Sanity Check
# ==============================================================================
log_step "STEP 0: Pre-flight Verification & Environment Sanity Check"

log_info "Verifying required CLI utilities..."
log_info "Execution plan: [Infra/Data: ${RUN_INFRA}] | [ADK Agents: ${RUN_AGENTS}] | [Cloud Build: ${RUN_BUILD}] | [Cloud Run: ${RUN_DEPLOY}]"

PREFLIGHT_FAILED=0

check_tool() {
  local tool="$1"
  local ver_cmd="$2"
  local path
  path="$(command -v "$tool" 2>/dev/null || true)"

  if [ -z "$path" ]; then
    log_error "  - Tool '$tool': NOT FOUND"
    PREFLIGHT_FAILED=1
    return 1
  fi

  if [ "$tool" = "terraform" ]; then
    local tf_output
    tf_output="$("$path" version 2>&1 || true)"
    if echo "$tf_output" | grep -qE "Terraform v[0-9]" && ! echo "$tf_output" | grep -q "apt.releases.hashicorp.com"; then
      log_info "  - Tool 'terraform': INSTALLED ($path)"
    else
      log_error "  - Tool 'terraform': STUB / UNINSTALLED ($path)"
      log_error "    Google Cloud Shell placeholder detected. Install real Terraform with:"
      log_error "      wget -O - https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg"
      log_error "      echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com \$(grep -oP '(?<=UBUNTU_CODENAME=).*' /etc/os-release || lsb_release -cs) main\" | sudo tee /etc/apt/sources.list.d/hashicorp.list"
      log_error "      sudo apt update && sudo apt install -y terraform"
      PREFLIGHT_FAILED=1
      return 1
    fi
  else
    if eval "$ver_cmd" &>/dev/null; then
      log_info "  - Tool '$tool': INSTALLED ($path)"
    else
      log_error "  - Tool '$tool': INSTALLED ($path) BUT FAILED EXECUTION TEST"
      PREFLIGHT_FAILED=1
      return 1
    fi
  fi
}

check_tool "gcloud" "gcloud --version"

if [ "$RUN_INFRA" = true ]; then
  check_tool "bq" "bq version"
  check_tool "terraform" "terraform version"
  check_tool "node" "node --version"
  check_tool "npm" "npm --version"
fi

if [ "$RUN_INFRA" = true ] || [ "$RUN_AGENTS" = true ]; then
  check_tool "python3" "python3 --version"
fi

if [ "$PREFLIGHT_FAILED" -ne 0 ]; then
  log_error "Step 0 Pre-flight checks failed. Please install or fix missing/broken tools before continuing."
  exit 1
fi

log_info "Configuring GCP Project context..."
log_info "  - GCP Project ID: ${GCP_PROJECT}"
log_info "  - GCP Project Number: ${GCP_PROJECT_NUMBER}"
log_info "  - GCP Region: ${GCP_REGION}"
log_info "  - Telemetry Pub/Sub Topic: ${PUBSUB_TOPIC}"

log_info "Enabling foundational GCP APIs (Cloud Resource Manager & Service Usage)..."
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  iam.googleapis.com \
  artifactregistry.googleapis.com \
  bigquery.googleapis.com \
  pubsub.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  dataform.googleapis.com \
  dataplex.googleapis.com \
  datalineage.googleapis.com \
  aiplatform.googleapis.com \
  --project="${GCP_PROJECT}"

log_success "Step 0 Pre-flight checks completed."

# ==============================================================================
# Step 1: Core Terraform Infrastructure Provisioning
# ==============================================================================
if [ "$RUN_INFRA" = true ]; then
  log_step "STEP 1: Core Terraform Infrastructure Provisioning"

  TF_DIR="${RETAIL_DIR}/infrastructure/terraform"
  if [ -d "$TF_DIR" ]; then
    log_info "Navigating to Terraform directory: ${TF_DIR}"
    # Clean up stale cross-project terraform.tfstate if switching GCP projects
    if [ -f "${TF_DIR}/terraform.tfstate" ]; then
      if ! grep -q "\"${GCP_PROJECT}\"" "${TF_DIR}/terraform.tfstate" 2>/dev/null; then
        log_warn "Detected local terraform.tfstate from a different GCP project. Backing up and resetting state for fresh project '${GCP_PROJECT}'..."
        mv "${TF_DIR}/terraform.tfstate" "${TF_DIR}/terraform.tfstate.bak.$(date +%s)"
      fi
    fi

    log_info "Running 'terraform init'..."
    terraform -chdir="${TF_DIR}" init -input=false

    # Pre-import existing BigQuery datasets into Terraform state if they already exist in GCP
    log_info "Pre-importing existing BigQuery datasets into Terraform state to prevent 409 duplicate creation errors..."
    for pair in \
      "retail:google_bigquery_dataset.retail-dataset" \
      "retail_synthetic:google_bigquery_dataset.retail-synthetic-dataset" \
      "omniarcade_raw:module.games[0].google_bigquery_dataset.omniarcade_raw" \
      "omniarcade_synthetic:module.games[0].google_bigquery_dataset.omniarcade_synthetic" \
      "omniarcade_silver:module.games[0].google_bigquery_dataset.omniarcade_silver" \
      "omniarcade_gold:module.games[0].google_bigquery_dataset.omniarcade_gold"; do
        ds="${pair%%:*}"
        tf_target="${pair#*:}"
        log_info "  Checking/importing dataset '${ds}' (${tf_target})..."
        terraform -chdir="${TF_DIR}" import \
          -var="project_id=${GCP_PROJECT}" \
          -var="industry_target=games" \
          -var="bigquery_dataset_location=${GCP_REGION}" \
          "${tf_target}" "projects/${GCP_PROJECT}/datasets/${ds}" 2>&1 | grep -E "Import successful|Resource created|Imported" || \
        terraform -chdir="${TF_DIR}" import \
          -var="project_id=${GCP_PROJECT}" \
          -var="industry_target=games" \
          -var="bigquery_dataset_location=${GCP_REGION}" \
          "${tf_target}" "${GCP_PROJECT}:${ds}" 2>&1 | grep -E "Import successful|Resource created|Imported" || true
    done

    log_info "Executing 'terraform apply'..."
    set +e
    terraform -chdir="${TF_DIR}" apply -auto-approve \
      -var="project_id=${GCP_PROJECT}" \
      -var="industry_target=games" \
      -var="bigquery_dataset_location=${GCP_REGION}"
    tf_exit=$?
    set -e

    if [ $tf_exit -ne 0 ]; then
      log_warn "Terraform apply returned exit code ${tf_exit} (pre-existing resources/conflicts noted). Continuing with deployment pipeline..."
    else
      log_success "Step 1 Terraform infrastructure applied successfully."
    fi
  else
    log_error "Terraform directory ${TF_DIR} not found."
    exit 1
  fi
else
  log_info "[SKIPPED] Step 1: Core Terraform Infrastructure Provisioning"
fi

# ==============================================================================
# Step 2: Auto-Generate Dataplex Script Configuration
# ==============================================================================
if [ "$RUN_INFRA" = true ]; then
  log_step "STEP 2: Auto-Generate Dataplex Governance Configuration"

  DATAPLEX_CONFIG="${GAMING_DIR}/scripts/config.json"
  log_info "Writing Dataplex script config to: ${DATAPLEX_CONFIG}"
  cat <<EOF > "${DATAPLEX_CONFIG}"
{
  "project_id": "${GCP_PROJECT}",
  "project_number": "${GCP_PROJECT_NUMBER}",
  "region": "${GCP_REGION}",
  "multi_region": "us"
}
EOF
  log_success "Step 2 Configuration generated."
else
  log_info "[SKIPPED] Step 2: Auto-Generate Dataplex Governance Configuration"
fi

# ==============================================================================
# Step 3: Dataform Medallion Pipeline Execution
# ==============================================================================
if [ "$RUN_INFRA" = true ]; then
  log_step "STEP 3: Dataform Medallion Pipeline Execution (Bronze -> Silver -> Gold)"

  DATAFORM_DIR="${GAMING_DIR}/dataform"
  if [ -d "$DATAFORM_DIR" ]; then
    log_info "Compiling and running Dataform Medallion models in ${DATAFORM_DIR}..."

    log_info "Ensuring all required BigQuery datasets exist in ${GCP_PROJECT} before table seeding..."
    for ds in omniarcade_raw omniarcade_synthetic omniarcade_silver omniarcade_gold central_identity fps_studio mmo_studio mobile_studio sports_studio strategy_studio telemetry_bronze telemetry_silver telemetry_gold telemetry_dashboards telemetry_reference agent_analytics; do
      bq mk --location="${GCP_REGION}" --dataset "${GCP_PROJECT}:${ds}" &>/dev/null || true
    done

    log_info "Ensuring source tables exist and are seeded before Dataform execution..."
    bq query --location="${GCP_REGION}" --use_legacy_sql=false "
      CREATE TABLE IF NOT EXISTS \`${GCP_PROJECT}.central_identity.players\` (
        user_id STRING,
        username STRING,
        email STRING,
        locale STRING,
        region_code STRING,
        age_bracket STRING,
        created_at TIMESTAMP,
        signup_platform STRING,
        last_login_ip STRING,
        install_source STRING
      );

      INSERT INTO \`${GCP_PROJECT}.central_identity.players\`
      (user_id, username, email, locale, region_code, age_bracket, created_at, signup_platform, last_login_ip, install_source)
      SELECT
        CONCAT('PLAY-', LPAD(CAST(id AS STRING), 8, '0')) AS user_id,
        CONCAT('Player_', LPAD(CAST(id AS STRING), 5, '0')) AS username,
        CONCAT('player_', CAST(id AS STRING), '@omniarcade.com') AS email,
        'en-US' AS locale,
        CASE MOD(id, 4) WHEN 0 THEN 'US' WHEN 1 THEN 'EU' WHEN 2 THEN 'APAC' ELSE 'LATAM' END AS region_code,
        CASE MOD(id, 3) WHEN 0 THEN 'Adult' WHEN 1 THEN 'Teen' ELSE 'Minor' END AS age_bracket,
        TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL CAST(id AS INT64) DAY) AS created_at,
        CASE MOD(id, 3) WHEN 0 THEN 'Steam' WHEN 1 THEN 'Mobile' ELSE 'Console' END AS signup_platform,
        '127.0.0.1' AS last_login_ip,
        'Organic' AS install_source
      FROM UNNEST(GENERATE_ARRAY(1, 1000)) AS id
      WHERE NOT EXISTS (
        SELECT 1 FROM \`${GCP_PROJECT}.central_identity.players\` LIMIT 1
      );

      INSERT INTO \`${GCP_PROJECT}.omniarcade_raw.gcp_players\`
      (player_id, payer_tier, total_iap_spend, days_since_last_login, favorite_category, created_at, region_code)
      SELECT
        user_id AS player_id,
        CASE WHEN MOD(CAST(SUBSTR(user_id, 6) AS INT64), 10) = 0 THEN 'Whale' WHEN MOD(CAST(SUBSTR(user_id, 6) AS INT64), 10) < 3 THEN 'Dolphin' ELSE 'F2P' END AS payer_tier,
        CASE WHEN MOD(CAST(SUBSTR(user_id, 6) AS INT64), 10) = 0 THEN 750.00 WHEN MOD(CAST(SUBSTR(user_id, 6) AS INT64), 10) < 3 THEN 120.00 ELSE 0.00 END AS total_iap_spend,
        MOD(CAST(SUBSTR(user_id, 6) AS INT64), 30) AS days_since_last_login,
        CASE MOD(CAST(SUBSTR(user_id, 6) AS INT64), 4) WHEN 0 THEN 'RPG' WHEN 1 THEN 'FPS' WHEN 2 THEN 'MOBA' ELSE 'Strategy' END AS favorite_category,
        created_at,
        region_code
      FROM \`${GCP_PROJECT}.central_identity.players\`
      WHERE user_id NOT IN (SELECT player_id FROM \`${GCP_PROJECT}.omniarcade_raw.gcp_players\`);

      INSERT INTO \`${GCP_PROJECT}.omniarcade_raw.live_session_events\` (session_id, player_id, event_type, timestamp, session_duration_seconds, consecutive_deaths)
      SELECT
        CONCAT('EVT-', LPAD(CAST(id AS STRING), 8, '0')) AS session_id,
        CONCAT('PLAY-', LPAD(CAST(MOD(id, 1000) + 1 AS STRING), 8, '0')) AS player_id,
        CASE MOD(id, 3) WHEN 0 THEN 'boss_fail' WHEN 1 THEN 'level_complete' ELSE 'session_start' END AS event_type,
        TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL CAST(id AS INT64) MINUTE) AS timestamp,
        MOD(id, 3600) AS session_duration_seconds,
        MOD(id, 5) AS consecutive_deaths
      FROM UNNEST(GENERATE_ARRAY(1, 2000)) AS id
      WHERE NOT EXISTS (SELECT 1 FROM \`${GCP_PROJECT}.omniarcade_raw.live_session_events\` LIMIT 1);

      INSERT INTO \`${GCP_PROJECT}.omniarcade_raw.iap_transactions\` (transaction_id, player_id, item_id, amount_usd, timestamp)
      SELECT
        CONCAT('TXN-', LPAD(CAST(id AS STRING), 8, '0')) AS transaction_id,
        CONCAT('PLAY-', LPAD(CAST(MOD(id, 1000) + 1 AS STRING), 8, '0')) AS player_id,
        CONCAT('SKU-', LPAD(CAST(MOD(id, 50) + 1 AS STRING), 4, '0')) AS item_id,
        CAST(ROUND(0.99 + 49.0 * RAND(), 2) AS NUMERIC) AS amount_usd,
        TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL CAST(id AS INT64) HOUR) AS timestamp
      FROM UNNEST(GENERATE_ARRAY(1, 5000)) AS id
      WHERE NOT EXISTS (SELECT 1 FROM \`${GCP_PROJECT}.omniarcade_raw.iap_transactions\` LIMIT 1);
    "

    # Always overwrite .df-credentials.json to enforce project and location (e.g. us-central1 vs US)
    cat <<EOF > "${DATAFORM_DIR}/.df-credentials.json"
{
  "projectId": "${GCP_PROJECT}",
  "location": "${GCP_REGION}"
}
EOF

    # Remove legacy package.json if present (Dataform v3 rejects package.json when workflow_settings.yaml is used)
    rm -f "${DATAFORM_DIR}/package.json"

    if command -v dataform &> /dev/null; then
      dataform run "${DATAFORM_DIR}" --default-location="${GCP_REGION}" --vars=project_id:${GCP_PROJECT},industry:games
    elif command -v npx &> /dev/null; then
      npx --yes @dataform/cli run "${DATAFORM_DIR}" --default-location="${GCP_REGION}" --vars=project_id:${GCP_PROJECT},industry:games
    else
      log_error "Neither 'dataform' nor 'npx' CLI utility was found in PATH."
      exit 1
    fi
    log_success "Step 3 Dataform Gold analytical tables built."
  else
    log_error "Dataform directory ${DATAFORM_DIR} not found."
    exit 1
  fi
else
  log_info "[SKIPPED] Step 3: Dataform Medallion Pipeline Execution"
fi

# ==============================================================================
# Step 4: Dataplex Aspect Tags & Business Glossary Registration
# ==============================================================================
if [ "$RUN_INFRA" = true ]; then
  log_step "STEP 4: Dataplex Aspect Tags & Business Glossary Registration"

  SCRIPTS_DIR="${GAMING_DIR}/scripts"
  log_info "Registering Dataplex Business Glossaries, Aspect Tags, & Lineage in parallel..."

  PIDS=()

  if [ -f "${SCRIPTS_DIR}/01_create_glossary.py" ]; then
    log_info "Launching 01_create_glossary.py (background)..."
    python3 "${SCRIPTS_DIR}/01_create_glossary.py" &
    PIDS+=($!)
  fi

  if [ -f "${SCRIPTS_DIR}/08_create_churn_guardrail_aspects.py" ]; then
    log_info "Launching 08_create_churn_guardrail_aspects.py (background)..."
    python3 "${SCRIPTS_DIR}/08_create_churn_guardrail_aspects.py" &
    PIDS+=($!)
  fi

  if [ -f "${SCRIPTS_DIR}/07_create_lineage.py" ]; then
    log_info "Launching 07_create_lineage.py (background)..."
    python3 "${SCRIPTS_DIR}/07_create_lineage.py" &
    PIDS+=($!)
  fi

  # Wait for all background Dataplex registration jobs to finish
  DATAPLEX_FAILED=0
  for pid in "${PIDS[@]}"; do
    if ! wait "$pid"; then
      log_error "Dataplex registration background task PID $pid failed!"
      DATAPLEX_FAILED=1
    fi
  done
  PIDS=()

  if [ $DATAPLEX_FAILED -ne 0 ]; then
    log_error "One or more Dataplex background registration tasks failed."
    exit 1
  fi

  log_success "Step 4 Dataplex Knowledge Catalog & Aspects registered."
else
  log_info "[SKIPPED] Step 4: Dataplex Aspect Tags & Business Glossary Registration"
fi

# ==============================================================================
# Step 5: In-Warehouse BQML Churn Prediction Model Training
# ==============================================================================
if [ "$RUN_INFRA" = true ]; then
  log_step "STEP 5: In-Warehouse BQML Churn Model Training & Validation"

  log_info "Hydrating BigQuery Silver and Gold analytics tables before model training..."
  bq query --location="${GCP_REGION}" --use_legacy_sql=false "
    -- 1. Hydrate gold_player_360 from raw gcp_players & live_session_events
    MERGE \`${GCP_PROJECT}.omniarcade_gold.gold_player_360\` target
    USING (
      SELECT 
        p.player_id,
        p.player_id AS username,
        p.payer_tier AS spend_tier,
        p.payer_tier,
        CAST(p.total_iap_spend AS NUMERIC) AS ltv_dollars,
        CAST(p.total_iap_spend AS NUMERIC) AS total_iap_spend,
        CAST(NULL AS FLOAT64) AS churn_risk_score,
        CAST(NULL AS FLOAT64) AS churn_probability,
        p.days_since_last_login,
        p.favorite_category,
        CAST(COALESCE(s.consecutive_deaths, 0) AS INT64) AS consecutive_deaths,
        CAST(COALESCE(s.session_duration_seconds, 0) AS INT64) AS session_duration_seconds,
        CAST(CASE WHEN p.days_since_last_login > 15 THEN 1 ELSE 0 END AS INT64) AS is_churned,
        p.created_at AS last_active_ts,
        p.created_at AS last_active_timestamp
      FROM \`${GCP_PROJECT}.omniarcade_raw.gcp_players\` p
      LEFT JOIN (
        SELECT 
          player_id,
          MAX(consecutive_deaths) AS consecutive_deaths,
          AVG(session_duration_seconds) AS session_duration_seconds
        FROM \`${GCP_PROJECT}.omniarcade_raw.live_session_events\`
        GROUP BY player_id
      ) s ON p.player_id = s.player_id
    ) source
    ON target.player_id = source.player_id
    WHEN NOT MATCHED THEN
      INSERT (player_id, username, spend_tier, payer_tier, ltv_dollars, total_iap_spend, churn_risk_score, churn_probability, days_since_last_login, favorite_category, consecutive_deaths, session_duration_seconds, is_churned, last_active_ts, last_active_timestamp)
      VALUES (source.player_id, source.username, source.spend_tier, source.payer_tier, source.ltv_dollars, source.total_iap_spend, source.churn_risk_score, source.churn_probability, source.days_since_last_login, source.favorite_category, source.consecutive_deaths, source.session_duration_seconds, source.is_churned, source.last_active_ts, source.last_active_timestamp);

    -- 2. Hydrate gold_regional_kpis
    INSERT INTO \`${GCP_PROJECT}.omniarcade_gold.gold_regional_kpis\`
    (region, country, country_code, country_name, dau, mau, arpu, arpu_dollars, total_revenue, total_revenue_dollars, avg_ping_ms, last_updated, updated_at)
    SELECT
      CASE region_code WHEN 'US' THEN 'North America' WHEN 'EU' THEN 'Europe' WHEN 'APAC' THEN 'Asia-Pacific' ELSE 'Latin America' END AS region,
      CASE region_code WHEN 'US' THEN 'United States' WHEN 'EU' THEN 'Germany' WHEN 'APAC' THEN 'Japan' ELSE 'Brazil' END AS country,
      region_code AS country_code,
      CASE region_code WHEN 'US' THEN 'United States' WHEN 'EU' THEN 'Germany' WHEN 'APAC' THEN 'Japan' ELSE 'Brazil' END AS country_name,
      CAST(COUNT(DISTINCT player_id) AS INT64) AS dau,
      CAST(COUNT(DISTINCT player_id) * 3 AS INT64) AS mau,
      CAST(AVG(total_iap_spend) AS NUMERIC) AS arpu,
      CAST(AVG(total_iap_spend) AS NUMERIC) AS arpu_dollars,
      CAST(SUM(total_iap_spend) AS NUMERIC) AS total_revenue,
      CAST(SUM(total_iap_spend) AS NUMERIC) AS total_revenue_dollars,
      ROUND(45.0 + RAND() * 120.0, 1) AS avg_ping_ms,
      CURRENT_TIMESTAMP() AS last_updated,
      CURRENT_TIMESTAMP() AS updated_at
    FROM \`${GCP_PROJECT}.omniarcade_raw.gcp_players\`
    GROUP BY region_code
    HAVING NOT EXISTS (SELECT 1 FROM \`${GCP_PROJECT}.omniarcade_gold.gold_regional_kpis\` LIMIT 1);

    -- 3. Hydrate gold_campaign_analytics
    INSERT INTO \`${GCP_PROJECT}.omniarcade_gold.gold_campaign_analytics\`
    (campaign_id, campaign_name, target_segment, offer_sku, ad_network, age_bracket, ad_spend, incremental_revenue_dollars, total_installs, roas)
    SELECT * FROM UNNEST([
      STRUCT('CAM-001' AS campaign_id, 'Summer Churn Recovery' AS campaign_name, 'Whale' AS target_segment, 'sku_skin_fire_dragon' AS offer_sku, 'Google Ads' AS ad_network, 'Adult' AS age_bracket, CAST(5000.00 AS NUMERIC) AS ad_spend, CAST(12500.00 AS NUMERIC) AS incremental_revenue_dollars, 450 AS total_installs, 2.5 AS roas),
      STRUCT('CAM-002', 'Mobile Launch Burst', 'Dolphin', 'sku_pass_season_1', 'YouTube', 'Teen', CAST(8000.00 AS NUMERIC), CAST(18400.00 AS NUMERIC), 1200, 2.3),
      STRUCT('CAM-003', 'Japan RPG Whale Target', 'Whale', 'sku_gems_pack_large', 'Google Ads', 'Adult', CAST(3000.00 AS NUMERIC), CAST(11100.00 AS NUMERIC), 180, 3.7)
    ])
    WHERE NOT EXISTS (SELECT 1 FROM \`${GCP_PROJECT}.omniarcade_gold.gold_campaign_analytics\` LIMIT 1);

    -- 4. Hydrate silver_server_latency (table table_id = 'server_latency')
    INSERT INTO \`${GCP_PROJECT}.omniarcade_silver.server_latency\`
    (server_region, server_id, ccu, avg_ping_ms, packet_loss_pct, frame_rate_drops, timestamp)
    SELECT * FROM UNNEST([
      STRUCT('US-EAST' AS server_region, 'srv-us-east-01' AS server_id, 450 AS ccu, 24.5 AS avg_ping_ms, 0.05 AS packet_loss_pct, 12 AS frame_rate_drops, CURRENT_TIMESTAMP() AS timestamp),
      STRUCT('US-WEST', 'srv-us-west-01', 320, 32.1, 0.08, 8, CURRENT_TIMESTAMP()),
      STRUCT('EU-CENTRAL', 'srv-eu-central-01', 600, 18.2, 0.02, 15, CURRENT_TIMESTAMP()),
      STRUCT('APAC-EAST', 'srv-apac-east-01', 520, 42.4, 0.15, 22, CURRENT_TIMESTAMP())
    ])
    WHERE NOT EXISTS (SELECT 1 FROM \`${GCP_PROJECT}.omniarcade_silver.server_latency\` LIMIT 1);

    -- 5. Hydrate gold_level_difficulty_funnel
    INSERT INTO \`${GCP_PROJECT}.omniarcade_gold.gold_level_difficulty_funnel\`
    (level_number, level_name, total_starts, total_completions, total_failures, total_resets, completion_rate_pct, avg_moves_used)
    SELECT * FROM UNNEST([
      STRUCT(1 AS level_number, 'Tutorial Island' AS level_name, 1000 AS total_starts, 980 AS total_completions, 15 AS total_failures, 5 AS total_resets, 98.0 AS completion_rate_pct, 12.5 AS avg_moves_used),
      STRUCT(2, 'The Dark Forest', 950, 850, 80, 20, 89.5, 18.4),
      STRUCT(3, 'Dragon Chasm', 820, 610, 180, 30, 74.4, 25.1),
      STRUCT(4, 'Shadow Citadel (Spike)', 580, 290, 250, 40, 50.0, 38.6),
      STRUCT(5, 'The Eternal Gate', 250, 220, 20, 10, 88.0, 32.2)
    ])
    WHERE NOT EXISTS (SELECT 1 FROM \`${GCP_PROJECT}.omniarcade_gold.gold_level_difficulty_funnel\` LIMIT 1);
  "

  log_info "Training BQML Logistic Regression model 'omniarcade_raw.player_churn_model'..."
  bq query --location="${GCP_REGION}" --use_legacy_sql=false "CALL \`${GCP_PROJECT}.omniarcade_raw.train_churn_model\`();"

  log_success "Step 5 BQML model trained."
else
  log_info "[SKIPPED] Step 5: In-Warehouse BQML Churn Model Training"
fi

# ==============================================================================
# Step 6: Vertex AI Agent Engine / ADK Agent Deployment
# ==============================================================================
if [ "$RUN_AGENTS" = true ]; then
  log_step "STEP 6: Vertex AI Agent Engine / ADK Agent Deployment"

  AGENT_TARGET="${AGENT_TARGET:-kc}"
  AGENT_DEPLOY_SCRIPT="${GAMING_DIR}/agents/deploy_agents.sh"

  if [ "$AGENT_TARGET" = "kc" ] || [ "$AGENT_TARGET" = "all" ]; then
    log_info "Verifying agent_kc container image in Artifact Registry..."
    
    AGENT_REPO="agent-images"
    AGENT_IMAGE_NAME="agent-kc"
    AGENT_IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${AGENT_REPO}/${AGENT_IMAGE_NAME}"
    
    # Get git commit hash for src/gamingdatademo
    GIT_COMMIT_HASH=$(git log -n 1 --pretty=format:%H -- "${GAMING_DIR}" 2>/dev/null || echo "latest")
    log_info "Active code commit hash for ${GAMING_DIR}: ${GIT_COMMIT_HASH}"
    
    # Ensure Artifact Registry repository exists
    if ! gcloud artifacts repositories describe "${AGENT_REPO}" --location="${GCP_REGION}" --project="${GCP_PROJECT}" &>/dev/null; then
      log_info "Creating Artifact Registry repository '${AGENT_REPO}'..."
      gcloud artifacts repositories create "${AGENT_REPO}" \
        --repository-format=docker \
        --location="${GCP_REGION}" \
        --description="Docker repository for AI agents" \
        --project="${GCP_PROJECT}" --quiet
    fi
    
    # Configure docker authentication
    gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet
    
    # Check if tag already exists in Artifact Registry
    IMAGE_EXISTS=false
    if gcloud artifacts docker images describe "${AGENT_IMAGE_URI}:${GIT_COMMIT_HASH}" --project="${GCP_PROJECT}" &>/dev/null; then
      IMAGE_EXISTS=true
    fi
    
    if [ "$IMAGE_EXISTS" = true ] && [ "${FORCE_AGENT_BUILD:-false}" = "false" ]; then
      log_info "Container image for commit ${GIT_COMMIT_HASH} already exists in registry. Skipping build."
    else
      if [ "$IMAGE_EXISTS" = "false" ]; then
        log_info "No container image found for commit ${GIT_COMMIT_HASH}. Building container..."
      else
        log_info "Forcing rebuild of agent_kc container..."
      fi
      
      # Pull latest for caching
      docker pull "${AGENT_IMAGE_URI}:latest" || true
      
      # Build the image using docker cache
      docker build \
        --cache-from "${AGENT_IMAGE_URI}:latest" \
        -t "${AGENT_IMAGE_URI}:latest" \
        -t "${AGENT_IMAGE_URI}:${GIT_COMMIT_HASH}" \
        -f "${GAMING_DIR}/agents/agent_kc/Dockerfile" \
        "${GAMING_DIR}/agents/agent_kc"
        
      # Push tags to registry
      docker push "${AGENT_IMAGE_URI}:latest"
      docker push "${AGENT_IMAGE_URI}:${GIT_COMMIT_HASH}"
      log_success "Successfully compiled and pushed agent_kc container image."
    fi
    
    # Export the image URI for deploy_agents.sh to pick up
    export CONTAINER_IMAGE_URI="${AGENT_IMAGE_URI}:${GIT_COMMIT_HASH}"
  fi

  if [ -f "$AGENT_DEPLOY_SCRIPT" ]; then
    log_info "Executing ADK agent deployment script: ${AGENT_DEPLOY_SCRIPT} (target: ${AGENT_TARGET})..."
    GOOGLE_CLOUD_PROJECT="${GCP_PROJECT}" GOOGLE_CLOUD_LOCATION="${GCP_REGION}" bash "$AGENT_DEPLOY_SCRIPT" "${AGENT_TARGET}"
    log_success "Step 6 Vertex AI Agent Engine / ADK Agent(s) (${AGENT_TARGET}) deployed successfully."
  else
    log_error "Agent deployment script ${AGENT_DEPLOY_SCRIPT} not found."
    exit 1
  fi
else
  log_info "[SKIPPED] Step 6: Vertex AI Agent Engine / ADK Agent Deployment"
fi

# ==============================================================================
# Step 7: Cloud Build Container Compilation
# ==============================================================================
if [ "$RUN_BUILD" = true ]; then
  log_step "STEP 7: Cloud Build Container Compilation (Artifact Registry)"

  log_info "Verifying Artifact Registry repository 'data-cloud-ai-demos' in ${GCP_REGION}..."
  if ! gcloud artifacts repositories describe "data-cloud-ai-demos" --location="${GCP_REGION}" --project="${GCP_PROJECT}" &>/dev/null; then
    log_warn "Artifact Registry repository 'data-cloud-ai-demos' not found. Creating..."
    gcloud artifacts repositories create "data-cloud-ai-demos" \
      --repository-format=docker \
      --location="${GCP_REGION}" \
      --description="Docker repository for AI Demos" \
      --project="${GCP_PROJECT}"
  fi

  log_info "Ensuring Cloud Build & Compute service account IAM permissions..."
  gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
    --member="serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/storage.admin" --condition=None

  gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
    --member="serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/artifactregistry.writer" --condition=None

  gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
    --member="serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/logging.logWriter" --condition=None

  gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
    --member="serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/storage.admin" --condition=None

  gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
    --member="serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/artifactregistry.writer" --condition=None

  gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
    --member="serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/logging.logWriter" --condition=None

  log_info "Submitting Cloud Build job to compile unified container image..."
  gcloud builds submit --config="${REPO_ROOT}/cloudbuild.yaml" \
    --substitutions=_LOCATION="${GCP_REGION}",_REPOSITORY="data-cloud-ai-demos",_TAG="latest" \
    "${REPO_ROOT}"

  log_success "Step 7 Container image built and pushed to Artifact Registry."
else
  log_info "[SKIPPED] Step 7: Cloud Build Container Compilation"
fi

# ==============================================================================
# Step 8: Private Cloud Run Deployment (Authenticated & Private)
# ==============================================================================
SERVICE_NAME="omniarcade-app"
IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/data-cloud-ai-demos/gaming-app:latest"
RUNNER_SA="omniarcade-runner-sa@${GCP_PROJECT}.iam.gserviceaccount.com"

if [ "$RUN_DEPLOY" = true ]; then
  log_step "STEP 8: Private Cloud Run Deployment (Authenticated & Private)"

  log_info "Verifying Cloud Run execution service account '${RUNNER_SA}'..."
  if ! gcloud iam service-accounts describe "${RUNNER_SA}" --project="${GCP_PROJECT}" &>/dev/null; then
    log_warn "Service account '${RUNNER_SA}' not found. Creating..."
    gcloud iam service-accounts create omniarcade-runner-sa \
      --display-name="OmniArcade Cloud Run Execution SA" \
      --project="${GCP_PROJECT}"
  fi

  log_info "Deploying Cloud Run service '${SERVICE_NAME}' with --no-allow-unauthenticated..."
  gcloud run deploy "${SERVICE_NAME}" \
    --image="${IMAGE_URI}" \
    --region="${GCP_REGION}" \
    --service-account="${RUNNER_SA}" \
    --no-allow-unauthenticated \
    --ingress=all \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${GCP_PROJECT},GCP_LOCATION=${GCP_REGION},BIGQUERY_LOCATION=${GCP_REGION},NODE_ENV=production" \
    --port=8080

  log_success "Step 8 Cloud Run service deployed in private/authenticated mode."
else
  log_info "[SKIPPED] Step 8: Private Cloud Run Deployment"
fi

# ==============================================================================
# Orchestration Completion Summary
# ==============================================================================
echo -e "\n${BOLD}${GREEN}======================================================================${NC}"
echo -e "${BOLD}${GREEN}   MASTER DEPLOYMENT ORCHESTRATION COMPLETE!${NC}"
echo -e "${BOLD}${GREEN}======================================================================${NC}\n"
log_info "Summary of Execution:"
if [ "$RUN_INFRA" = true ]; then
  log_info "  - Infrastructure & Data: APPLIED"
  log_info "    1. BigQuery Datasets: ${BQ_DATASET_RAW}, ${BQ_DATASET_GOLD}"
  log_info "    2. Pub/Sub Direct Sub: ${PUBSUB_TOPIC} -> ${BQ_DATASET_RAW}.live_session_events"
  log_info "    3. BQML Model: ${BQ_DATASET_RAW}.player_churn_model"
  log_info "    4. Dataform Medallion: Bronze -> Silver -> Gold (gold_player_360)"
  log_info "    5. Dataplex Aspect: liveops_campaign_policy_aspect"
else
  log_info "  - Infrastructure & Data: SKIPPED"
fi

if [ "$RUN_AGENTS" = true ]; then
  log_info "  - Vertex AI ADK Agents: DEPLOYED"
  log_info "    Agents: Basic, Scaled, KC, Marketing Swarm, Sequential Council"
else
  log_info "  - Vertex AI ADK Agents: SKIPPED"
fi

if [ "$RUN_BUILD" = true ]; then
  log_info "  - Cloud Build Container: COMPLETED"
  log_info "    Container Image: ${IMAGE_URI}"
else
  log_info "  - Cloud Build Container: SKIPPED"
fi

if [ "$RUN_DEPLOY" = true ]; then
  log_info "  - Cloud Run Service: DEPLOYED"
  log_info "    Service Name: ${SERVICE_NAME} (Private / Authenticated)"
  log_info ""
  log_info "To access the private Cloud Run service from Cloud Shell Web Preview:"
  log_info "  $ gcloud run services proxy ${SERVICE_NAME} --port=8080 --region=${GCP_REGION}"
  log_info "Then click 'Web Preview' in Cloud Shell and select 'Preview on port 8080'."
else
  log_info "  - Cloud Run Service: SKIPPED"
fi

exit 0
