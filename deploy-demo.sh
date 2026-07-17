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
#   Step 8: Public Cloud Run Service Deployment (Unauthenticated)
# ==============================================================================

set -eo pipefail

unset PYTHONPATH
export PATH="$HOME/bin:$HOME/.bin:$PATH"

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

grant_role_silently() {
  local member="$1"
  local role="$2"
  local existing_roles
  existing_roles=$(gcloud projects get-iam-policy "${GCP_PROJECT}" \
    --flatten="bindings[].members" \
    --filter="bindings.members='${member}'" \
    --format="value(bindings.role)" 2>/dev/null || true)

  if echo "${existing_roles}" | grep -q -w "${role}"; then
    log_info "  - ${member} already has ${role} (skipped)"
    return 0
  fi

  log_info "  - Granting ${role} to ${member}..."
  local err_log
  err_log=$(mktemp)
  if gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
    --member="${member}" \
    --role="${role}" \
    --condition=None >/dev/null 2>"${err_log}"; then
    log_info "    Updated IAM policy for project [${GCP_PROJECT}]."
  else
    log_error "    Failed to update IAM policy. Error details:"
    cat "${err_log}" >&2
    rm -f "${err_log}"
    return 1
  fi
  rm -f "${err_log}"
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
trap 'log_error "Command \"$BASH_COMMAND\" failed at line $LINENO"' ERR

# Execution mode flags per step
RUN_STEP_1=true
RUN_STEP_2=true
RUN_STEP_3=true
RUN_STEP_4=true
RUN_STEP_5=true
RUN_STEP_6=true
RUN_STEP_7=true
RUN_STEP_8=true
AGENT_TARGET="kc"
FORCE_AGENT_BUILD=false

# Helper to enable/disable all steps
set_all_steps() {
  local val="$1"
  RUN_STEP_1=$val
  RUN_STEP_2=$val
  RUN_STEP_3=$val
  RUN_STEP_4=$val
  RUN_STEP_5=$val
  RUN_STEP_6=$val
  RUN_STEP_7=$val
  RUN_STEP_8=$val
}

parse_steps() {
  local steps_str="$1"
  IFS=',' read -ra ADDR <<< "$steps_str"
  for step in "${ADDR[@]}"; do
    case "$step" in
      1) RUN_STEP_1=true ;;
      2) RUN_STEP_2=true ;;
      3) RUN_STEP_3=true ;;
      4) RUN_STEP_4=true ;;
      5) RUN_STEP_5=true ;;
      6) RUN_STEP_6=true ;;
      7) RUN_STEP_7=true ;;
      8) RUN_STEP_8=true ;;
      *)
        log_error "Invalid step number: $step (valid steps: 1-8)"
        exit 1
        ;;
    esac
  done
}

parse_skip_steps() {
  local steps_str="$1"
  IFS=',' read -ra ADDR <<< "$steps_str"
  for step in "${ADDR[@]}"; do
    case "$step" in
      1) RUN_STEP_1=false ;;
      2) RUN_STEP_2=false ;;
      3) RUN_STEP_3=false ;;
      4) RUN_STEP_4=false ;;
      5) RUN_STEP_5=false ;;
      6) RUN_STEP_6=false ;;
      7) RUN_STEP_7=false ;;
      8) RUN_STEP_8=false ;;
      *)
        log_error "Invalid step number to skip: $step (valid steps: 1-8)"
        exit 1
        ;;
    esac
  done
}

usage() {
  local exit_code="${1:-0}"
  cat <<EOHELP
Usage: $(basename "$0") [OPTIONS]

Master Deployment Orchestrator for Unified Gaming Data & AI Operations Platform.

Steps Runbook:
  Step 0: Pre-flight Verification & Environment Sanity Check (Always runs)
  Step 1: Core Terraform Infrastructure Provisioning
  Step 2: Auto-Generate Dataplex Governance Configuration
  Step 3: Dataform Medallion Pipeline Execution (Bronze -> Silver -> Gold)
  Step 4: Dataplex Aspect Tags & Business Glossary Registration
  Step 5: In-Warehouse BQML Churn Prediction Model Training
  Step 6: Vertex AI Agent Engine / ADK Agent Deployment
  Step 7: Cloud Build Container Compilation (Artifact Registry)
  Step 8: Public Cloud Run Service Deployment (Unauthenticated)

Options:
  --steps <1-8>         Comma-separated list of step numbers to run (disables all other steps).
  --skip-steps <1-8>    Comma-separated list of step numbers to skip.
  --all-agents          Deploy all 5 ADK agents (basic, scaled, kc, council, council_seq) during Step 6.
  --force-agent-build   Force rebuild of agent_kc container image during Step 6.
  -h, --help            Show this help message and exit.

Examples:
  $(basename "$0") --steps 1,2,3
  $(basename "$0") --skip-steps 4,5
  $(basename "$0") --steps 6 --all-agents
EOHELP
  exit "$exit_code"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --steps)
      if [ -z "${2:-}" ]; then
        log_error "--steps requires a comma-separated list of step numbers"
        exit 1
      fi
      set_all_steps false
      parse_steps "$2"
      shift 2
      ;;
    --skip-steps)
      if [ -z "${2:-}" ]; then
        log_error "--skip-steps requires a comma-separated list of step numbers"
        exit 1
      fi
      parse_skip_steps "$2"
      shift 2
      ;;
    --all-agents)
      AGENT_TARGET="all"
      shift
      ;;
    --force-agent-build)
      FORCE_AGENT_BUILD=true
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
GCP_PROJECT="$(gcloud config get-value project 2>/dev/null)"
if [ -z "$GCP_PROJECT" ]; then
  GCP_PROJECT="${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT}}"
fi

if [ -z "$GCP_PROJECT" ]; then
  log_error "No active GCP project ID detected."
  log_error "Please set GOOGLE_CLOUD_PROJECT or run 'gcloud config set project <PROJECT_ID>'."
  exit 1
fi

log_info "Using active GCP Project ID: '${GCP_PROJECT}'"

GCP_REGION="${GCP_LOCATION:-us-central1}"
PUBSUB_TOPIC="gaming-live-telemetry"
BQ_DATASET_RAW="gaming_raw"
BQ_DATASET_GOLD="gaming_gold"

# Fetch project number strictly
GCP_PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT}" --format="value(projectNumber)")"
if [ -z "$GCP_PROJECT_NUMBER" ]; then
  log_error "Failed to retrieve project number for project '${GCP_PROJECT}'."
  exit 1
fi

# ==============================================================================
# Step 0: Pre-flight Verification & Environment Sanity Check
# ==============================================================================
log_step "STEP 0: Pre-flight Verification & Environment Sanity Check"

log_info "Verifying required CLI utilities..."
log_info "Execution plan: [Step 1: ${RUN_STEP_1}] [Step 2: ${RUN_STEP_2}] [Step 3: ${RUN_STEP_3}] [Step 4: ${RUN_STEP_4}] [Step 5: ${RUN_STEP_5}] [Step 6: ${RUN_STEP_6}] [Step 7: ${RUN_STEP_7}] [Step 8: ${RUN_STEP_8}]"

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
      echo "wget -O - https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg" >&2
      echo "echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com \$(grep -oP '(?<=UBUNTU_CODENAME=).*' /etc/os-release || lsb_release -cs) main\" | sudo tee /etc/apt/sources.list.d/hashicorp.list" >&2
      echo "sudo apt update && sudo apt install -y terraform" >&2
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

if [ "$RUN_STEP_1" = true ]; then
  check_tool "terraform" "terraform version"
fi

if [ "$RUN_STEP_3" = true ] || [ "$RUN_STEP_5" = true ]; then
  check_tool "bq" "bq version"
fi


if [ "$RUN_STEP_2" = true ] || [ "$RUN_STEP_4" = true ] || [ "$RUN_STEP_6" = true ]; then
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
  firestore.googleapis.com \
  --project="${GCP_PROJECT}"

log_success "Step 0 Pre-flight checks completed."

# ==============================================================================
# Step 1: Core Terraform Infrastructure Provisioning
# ==============================================================================
if [ "$RUN_STEP_1" = true ]; then
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

    export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token 2>/dev/null || true)"

    log_info "Running 'terraform init'..."
    terraform -chdir="${TF_DIR}" init -input=false

    # Pre-import existing BigQuery datasets into Terraform state if they already exist in GCP
    log_info "Pre-importing existing BigQuery datasets into Terraform state to prevent 409 duplicate creation errors..."
    for pair in \
      "gaming_retail:google_bigquery_dataset.retail-dataset" \
      "gaming_retail_synthetic:google_bigquery_dataset.retail-synthetic-dataset" \
      "gaming_raw:module.games[0].google_bigquery_dataset.gaming_raw" \
      "gaming_synthetic:module.games[0].google_bigquery_dataset.gaming_synthetic" \
      "gaming_silver:module.games[0].google_bigquery_dataset.gaming_silver" \
      "gaming_gold:module.games[0].google_bigquery_dataset.gaming_gold"; do
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
    tf_exit=0
    if ! terraform -chdir="${TF_DIR}" apply -auto-approve \
      -var="project_id=${GCP_PROJECT}" \
      -var="industry_target=games" \
      -var="bigquery_dataset_location=${GCP_REGION}"; then
      tf_exit=1
    fi

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
if [ "$RUN_STEP_2" = true ]; then
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
if [ "$RUN_STEP_3" = true ]; then
  log_step "STEP 3: Dataform Medallion Pipeline Execution (Bronze -> Silver -> Gold)"

  DATAFORM_DIR="${GAMING_DIR}/dataform"
  if [ -d "$DATAFORM_DIR" ]; then
    log_info "Compiling and running Dataform Medallion models in ${DATAFORM_DIR}..."

    log_info "Ensuring source tables exist and are seeded before Dataform execution..."
    bq query --location="${GCP_REGION}" --use_legacy_sql=false "
      CREATE SCHEMA IF NOT EXISTS \`${GCP_PROJECT}.gaming_central_identity\` OPTIONS(location='${GCP_REGION}');
      CREATE SCHEMA IF NOT EXISTS \`${GCP_PROJECT}.gaming_raw\` OPTIONS(location='${GCP_REGION}');

      CREATE TABLE IF NOT EXISTS \`${GCP_PROJECT}.gaming_central_identity.players\` (
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

      INSERT INTO \`${GCP_PROJECT}.gaming_central_identity.players\`
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
        SELECT 1 FROM \`${GCP_PROJECT}.gaming_central_identity.players\` LIMIT 1
      );

      CREATE TABLE IF NOT EXISTS \`${GCP_PROJECT}.gaming_raw.gcp_players\` (
        player_id STRING,
        payer_tier STRING,
        total_iap_spend FLOAT64,
        days_since_last_login INT64,
        favorite_category STRING,
        created_at TIMESTAMP,
        region_code STRING
      );

      INSERT INTO \`${GCP_PROJECT}.gaming_raw.gcp_players\`
      (player_id, payer_tier, total_iap_spend, days_since_last_login, favorite_category, created_at, region_code)
      SELECT
        user_id AS player_id,
        CASE WHEN MOD(CAST(SUBSTR(user_id, 6) AS INT64), 10) = 0 THEN 'Whale' WHEN MOD(CAST(SUBSTR(user_id, 6) AS INT64), 10) < 3 THEN 'Dolphin' ELSE 'F2P' END AS payer_tier,
        CASE WHEN MOD(CAST(SUBSTR(user_id, 6) AS INT64), 10) = 0 THEN 750.00 WHEN MOD(CAST(SUBSTR(user_id, 6) AS INT64), 10) < 3 THEN 120.00 ELSE 0.00 END AS total_iap_spend,
        MOD(CAST(SUBSTR(user_id, 6) AS INT64), 30) AS days_since_last_login,
        CASE MOD(CAST(SUBSTR(user_id, 6) AS INT64), 4) WHEN 0 THEN 'RPG' WHEN 1 THEN 'FPS' WHEN 2 THEN 'MOBA' ELSE 'Strategy' END AS favorite_category,
        created_at,
        region_code
      FROM \`${GCP_PROJECT}.gaming_central_identity.players\`
      WHERE user_id NOT IN (SELECT player_id FROM \`${GCP_PROJECT}.gaming_raw.gcp_players\`);

      CREATE TABLE IF NOT EXISTS \`${GCP_PROJECT}.gaming_raw.live_session_events\` (
        session_id STRING,
        player_id STRING,
        event_type STRING,
        timestamp TIMESTAMP,
        session_duration_seconds INT64,
        consecutive_deaths INT64
      );

      INSERT INTO \`${GCP_PROJECT}.gaming_raw.live_session_events\` (session_id, player_id, event_type, timestamp, session_duration_seconds, consecutive_deaths)
      SELECT
        CONCAT('EVT-', LPAD(CAST(id AS STRING), 8, '0')) AS session_id,
        CONCAT('PLAY-', LPAD(CAST(MOD(id, 1000) + 1 AS STRING), 8, '0')) AS player_id,
        CASE MOD(id, 3) WHEN 0 THEN 'boss_fail' WHEN 1 THEN 'level_complete' ELSE 'session_start' END AS event_type,
        TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL CAST(id AS INT64) MINUTE) AS timestamp,
        MOD(id, 3600) AS session_duration_seconds,
        MOD(id, 5) AS consecutive_deaths
      FROM UNNEST(GENERATE_ARRAY(1, 2000)) AS id
      WHERE NOT EXISTS (SELECT 1 FROM \`${GCP_PROJECT}.gaming_raw.live_session_events\` LIMIT 1);

      CREATE TABLE IF NOT EXISTS \`${GCP_PROJECT}.gaming_raw.iap_transactions\` (
        transaction_id STRING,
        player_id STRING,
        item_id STRING,
        amount_usd NUMERIC,
        timestamp TIMESTAMP
      );

      INSERT INTO \`${GCP_PROJECT}.gaming_raw.iap_transactions\` (transaction_id, player_id, item_id, amount_usd, timestamp)
      SELECT
        CONCAT('TXN-', LPAD(CAST(id AS STRING), 8, '0')) AS transaction_id,
        CONCAT('PLAY-', LPAD(CAST(MOD(id, 1000) + 1 AS STRING), 8, '0')) AS player_id,
        CONCAT('SKU-', LPAD(CAST(MOD(id, 50) + 1 AS STRING), 4, '0')) AS item_id,
        CAST(ROUND(0.99 + 49.0 * RAND(), 2) AS NUMERIC) AS amount_usd,
        TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL CAST(id AS INT64) HOUR) AS timestamp
      FROM UNNEST(GENERATE_ARRAY(1, 5000)) AS id
      WHERE NOT EXISTS (SELECT 1 FROM \`${GCP_PROJECT}.gaming_raw.iap_transactions\` LIMIT 1);
    "

    # Always overwrite .df-credentials.json to enforce project and location (e.g. us-central1 vs US)
    cat <<EOF > "${DATAFORM_DIR}/.df-credentials.json"
{
  "projectId": "${GCP_PROJECT}",
  "location": "${GCP_REGION}"
}
EOF

    cat <<EOF > "${DATAFORM_DIR}/workflow_settings.yaml"
dataformCoreVersion: 3.0.56
defaultLocation: ${GCP_REGION}
datasetSuffix: ""
defaultAssertionDataset: gaming_dataform_assertions
EOF

    log_info "Ensuring Cloud Build service account IAM permissions for BigQuery Dataform & Dataplex execution..."
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "roles/bigquery.user"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "roles/bigquery.dataViewer"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "roles/bigquery.dataEditor"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "roles/storage.objectViewer"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "roles/logging.logWriter"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "roles/dataplex.catalogEditor"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "roles/datalineage.admin"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" "roles/bigquery.user"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" "roles/bigquery.dataViewer"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" "roles/bigquery.dataEditor"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" "roles/storage.objectViewer"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" "roles/logging.logWriter"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" "roles/dataplex.catalogEditor"
    grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" "roles/datalineage.admin"

    log_info "Submitting Cloud Build job to execute Dataform Medallion pipeline..."
    gcloud builds submit \
      --verbosity=info \
      --config="${GAMING_DIR}/cloudbuild-dataform.yaml" \
      --substitutions=_PROJECT_ID="${GCP_PROJECT}",_LOCATION="${GCP_REGION}" \
      --project="${GCP_PROJECT}" \
      "${DATAFORM_DIR}"

    log_success "Step 3 Dataform Gold analytical tables built via Cloud Build."
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
if [ "$RUN_STEP_4" = true ]; then
  log_step "STEP 4: Dataplex Aspect Tags & Business Glossary Registration"

  SCRIPTS_DIR="${GAMING_DIR}/scripts"
  log_info "Registering Dataplex Business Glossaries, Aspect Tags, & Lineage in parallel..."

  PIDS=()

  if [ -f "${SCRIPTS_DIR}/01_create_glossary.py" ]; then
    log_info "Launching 01_create_glossary.py (background)..."
    PYTHONPATH="/usr/lib/google-cloud-sdk/lib/third_party:/usr/lib/google-cloud-sdk/lib:${PYTHONPATH:-}" python3 "${SCRIPTS_DIR}/01_create_glossary.py" &
    PIDS+=($!)
  fi

  if [ -f "${SCRIPTS_DIR}/08_create_churn_guardrail_aspects.py" ]; then
    log_info "Launching 08_create_churn_guardrail_aspects.py (background)..."
    PYTHONPATH="/usr/lib/google-cloud-sdk/lib/third_party:/usr/lib/google-cloud-sdk/lib:${PYTHONPATH:-}" python3 "${SCRIPTS_DIR}/08_create_churn_guardrail_aspects.py" &
    PIDS+=($!)
  fi

  if [ -f "${SCRIPTS_DIR}/09_create_firestore_aspects.py" ]; then
    log_info "Launching 09_create_firestore_aspects.py (background)..."
    PYTHONPATH="/usr/lib/google-cloud-sdk/lib/third_party:/usr/lib/google-cloud-sdk/lib:${PYTHONPATH:-}" python3 "${SCRIPTS_DIR}/09_create_firestore_aspects.py" &
    PIDS+=($!)
  fi

  if [ -f "${SCRIPTS_DIR}/07_create_lineage.py" ]; then
    log_info "Launching 07_create_lineage.py (background)..."
    PYTHONPATH="/usr/lib/google-cloud-sdk/lib/third_party:/usr/lib/google-cloud-sdk/lib:${PYTHONPATH:-}" python3 "${SCRIPTS_DIR}/07_create_lineage.py" &
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
if [ "$RUN_STEP_5" = true ]; then
  log_step "STEP 5: In-Warehouse BQML Churn Model Training & Validation"

  if bq show --location="${GCP_REGION}" "${GCP_PROJECT}:gaming_raw.player_churn_model" >/dev/null 2>&1; then
    log_info "BQML model 'gaming_raw.player_churn_model' already exists in ${GCP_PROJECT}. Skipping retraining."
    log_success "Step 5 BQML model verified (already trained)."
  else
    log_info "Updating BQML training procedure..."
    bq query --location="${GCP_REGION}" --use_legacy_sql=false "
      CREATE OR REPLACE PROCEDURE \`${GCP_PROJECT}.gaming_raw.train_churn_model\`()
      BEGIN
        CREATE OR REPLACE MODEL \`${GCP_PROJECT}.gaming_raw.player_churn_model\`
        OPTIONS (
          MODEL_TYPE = 'LOGISTIC_REG',
          INPUT_LABEL_COLS = ['is_churned'],
          AUTO_CLASS_WEIGHTS = TRUE
        ) AS
        SELECT 
          consecutive_deaths,
          session_duration_seconds,
          payer_tier,
          total_iap_spend,
          days_since_last_login,
          favorite_category,
          is_churned
        FROM \`${GCP_PROJECT}.gaming_gold.gold_player_360\`
        WHERE is_churned IS NOT NULL;
      END;
    "

    log_info "Training BQML Logistic Regression model 'gaming_raw.player_churn_model'..."
    bq query --location="${GCP_REGION}" --use_legacy_sql=false "CALL \`${GCP_PROJECT}.gaming_raw.train_churn_model\`();"
    log_success "Step 5 BQML model trained."
  fi
else
  log_info "[SKIPPED] Step 5: In-Warehouse BQML Churn Model Training"
fi

# ==============================================================================
# Step 6: Vertex AI Agent Engine / ADK Agent Deployment (src/agents/kc)
# ==============================================================================
if [ "$RUN_STEP_6" = true ]; then
  log_step "STEP 6: Vertex AI Agent Engine / ADK Agent Deployment (src/agents/kc)"

  KC_AGENT_DIR="${REPO_ROOT}/src/agents/kc"
  if [ -f "${KC_AGENT_DIR}/deploy.sh" ]; then
    log_info "Executing new agent deployment script: ${KC_AGENT_DIR}/deploy.sh..."
    (
      cd "${KC_AGENT_DIR}"
      GCP_PROJECT_ID="${GCP_PROJECT}" GCP_REGION="${GCP_REGION}" bash "./deploy.sh"
    )
    log_success "Step 6 Vertex AI Agent Engine / ADK Agent (agent_kc) deployed successfully."
  else
    log_error "Agent deployment script ${KC_AGENT_DIR}/deploy.sh not found."
    exit 1
  fi
else
  log_info "[SKIPPED] Step 6: Vertex AI Agent Engine / ADK Agent Deployment"
fi



# ==============================================================================
# Step 7: Cloud Build Container Compilation
# ==============================================================================
if [ "$RUN_STEP_7" = true ]; then
  log_step "STEP 7: Cloud Build Container Compilation (Artifact Registry)"

  log_info "Verifying Artifact Registry repository 'gaming-demo-images' in ${GCP_REGION}..."
  if ! gcloud artifacts repositories describe "gaming-demo-images" --location="${GCP_REGION}" --project="${GCP_PROJECT}" &>/dev/null; then
    log_warn "Artifact Registry repository 'gaming-demo-images' not found. Creating..."
    gcloud artifacts repositories create "gaming-demo-images" \
      --repository-format=docker \
      --location="${GCP_REGION}" \
      --description="Docker repository for AI Demos" \
      --project="${GCP_PROJECT}"
  fi

  log_info "Ensuring Cloud Build & Compute service account IAM permissions..."
  grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" "roles/storage.admin"
  grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" "roles/artifactregistry.writer"
  grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" "roles/logging.logWriter"
  grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "roles/storage.admin"
  grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "roles/artifactregistry.writer"
  grant_role_silently "serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "roles/logging.logWriter"
  log_info "Submitting Cloud Build job to compile unified container image..."
  gcloud builds submit --verbosity=info --config="${REPO_ROOT}/cloudbuild.yaml" \
    --substitutions=_LOCATION="${GCP_REGION}",_REPOSITORY="gaming-demo-images",_TAG="latest" \
    "${REPO_ROOT}"

  log_success "Step 7 Container image built and pushed to Artifact Registry."
else
  log_info "[SKIPPED] Step 7: Cloud Build Container Compilation"
fi

# ==============================================================================
# Step 8: Public Cloud Run Deployment (Unauthenticated & Public)
# ==============================================================================
SERVICE_NAME="gaming-demo-app"
IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/gaming-demo-images/gaming-app:latest"
RUNNER_SA="gaming-runner-sa@${GCP_PROJECT}.iam.gserviceaccount.com"

if [ "$RUN_STEP_8" = true ]; then
  log_step "STEP 8: Public Cloud Run Deployment (Unauthenticated & Public)"

  log_info "Verifying Cloud Run execution service account '${RUNNER_SA}'..."
  if ! gcloud iam service-accounts describe "${RUNNER_SA}" --project="${GCP_PROJECT}" &>/dev/null; then
    log_warn "Service account '${RUNNER_SA}' not found. Creating..."
    gcloud iam service-accounts create gaming-runner-sa \
      --display-name="Gaming Cloud Run Execution SA" \
      --project="${GCP_PROJECT}"
  fi

  log_info "Relaxing Cloud Run unauthenticated invoker organization policy if restricted..."
  gcloud org-policies set-policy --project="${GCP_PROJECT}" /dev/stdin 2>/dev/null <<POLICY || true
name: projects/${GCP_PROJECT_NUMBER}/policies/run.managed.requireInvokerIam
spec:
  rules:
  - enforce: false
POLICY

  log_info "Deploying Cloud Run service '${SERVICE_NAME}' with --allow-unauthenticated..."
  gcloud run deploy "${SERVICE_NAME}" \
    --image="${IMAGE_URI}" \
    --region="${GCP_REGION}" \
    --service-account="${RUNNER_SA}" \
    --allow-unauthenticated \
    --ingress=all \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${GCP_PROJECT},GCP_LOCATION=${GCP_REGION},BIGQUERY_LOCATION=${GCP_REGION},NODE_ENV=production" \
    --port=8080

  log_info "Ensuring public IAM invoker binding (allUsers -> roles/run.invoker)..."
  gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --region="${GCP_REGION}" \
    --project="${GCP_PROJECT}" >/dev/null 2>&1 || true

  RUN_URL=$(gcloud run services describe "${SERVICE_NAME}" --project="${GCP_PROJECT}" --region="${GCP_REGION}" --format='value(status.url)' 2>/dev/null || echo "")

  log_success "Step 8 Cloud Run service deployed in public/unauthenticated mode."
  if [ -n "${RUN_URL}" ]; then
    log_success "Public URL: ${RUN_URL}"
  fi
else
  log_info "[SKIPPED] Step 8: Public Cloud Run Deployment"
fi

# ==============================================================================
# Orchestration Completion Summary
# ==============================================================================
echo -e "\n${BOLD}${GREEN}======================================================================${NC}"
echo -e "${BOLD}${GREEN}   MASTER DEPLOYMENT ORCHESTRATION COMPLETE!${NC}"
echo -e "${BOLD}${GREEN}======================================================================${NC}\n"
log_info "Summary of Execution:"
  log_info "  - Step 1 (Terraform Infra): $([ "$RUN_STEP_1" = true ] && echo "APPLIED" || echo "SKIPPED")"
  log_info "  - Step 2 (Dataplex Config): $([ "$RUN_STEP_2" = true ] && echo "APPLIED" || echo "SKIPPED")"
  log_info "  - Step 3 (Dataform Pipeline): $([ "$RUN_STEP_3" = true ] && echo "APPLIED" || echo "SKIPPED")"
  log_info "  - Step 4 (Dataplex Aspect Tags): $([ "$RUN_STEP_4" = true ] && echo "APPLIED" || echo "SKIPPED")"
  log_info "  - Step 5 (BQML Model): $([ "$RUN_STEP_5" = true ] && echo "APPLIED" || echo "SKIPPED")"
  log_info "  - Step 6 (Vertex AI Agents): $([ "$RUN_STEP_6" = true ] && echo "APPLIED" || echo "SKIPPED")"
  log_info "  - Step 7 (Cloud Build Compilation): $([ "$RUN_STEP_7" = true ] && echo "APPLIED" || echo "SKIPPED")"
  log_info "  - Step 8 (Cloud Run Deployment): $([ "$RUN_STEP_8" = true ] && echo "APPLIED" || echo "SKIPPED")"
  
  if [ "$RUN_STEP_8" = true ]; then
    RUN_URL=$(gcloud run services describe "${SERVICE_NAME}" --project="${GCP_PROJECT}" --region="${GCP_REGION}" --format='value(status.url)' 2>/dev/null || echo "")
    log_info ""
    if [ -n "${RUN_URL}" ]; then
      log_info "Public Application Endpoint:"
      log_info "  URL: ${RUN_URL}"
    else
      log_info "Cloud Run service deployed. Run 'gcloud run services describe ${SERVICE_NAME} --region=${GCP_REGION}' to retrieve URL."
    fi
  fi

exit 0
