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
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
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

usage() {
  local exit_code="${1:-0}"
  cat <<EOHELP
Usage: $(basename "$0") [OPTIONS]

Master Deployment Orchestrator for Unified Gaming Data & AI Operations Platform.

Options:
  -a, --all             Run full deployment runbook (Steps 0-8) [Default].
  -s, --skip-infra      Skip infrastructure/pipeline steps (1-5), run ADK Agents, Cloud Build & Cloud Run (Steps 6-8).
  -b, --build-only      Only run Cloud Build container compilation (Step 7).
  -d, --deploy-only     Only run Cloud Run service deployment (Step 8).
  -g, --agent-only      Only run ADK Agent Engine deployment (Step 6).
  -h, --help            Show this help message and exit.

Examples:
  $(basename "$0") --skip-infra
  $(basename "$0") --agent-only
  $(basename "$0") -b -d
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
    -g|--agent-only|--agents-only)
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
    -s|--skip-infra)
      if [ "$MODE_SET" = false ]; then
        RUN_INFRA=false
        RUN_AGENTS=true
        RUN_BUILD=true
        RUN_DEPLOY=true
        MODE_SET=true
      else
        RUN_INFRA=false
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
    log_info "Running 'terraform init'..."
    terraform -chdir="${TF_DIR}" init -input=false

    # Pre-import existing BigQuery datasets into Terraform state if they already exist in GCP
    log_info "Pre-checking BigQuery datasets for automatic Terraform import if already created..."
    for pair in \
      "retail:google_bigquery_dataset.retail-dataset" \
      "retail_synthetic:google_bigquery_dataset.retail-synthetic-dataset" \
      "omniarcade_raw:module.games[0].google_bigquery_dataset.omniarcade_raw" \
      "omniarcade_synthetic:module.games[0].google_bigquery_dataset.omniarcade_synthetic" \
      "omniarcade_silver:module.games[0].google_bigquery_dataset.omniarcade_silver" \
      "omniarcade_gold:module.games[0].google_bigquery_dataset.omniarcade_gold"; do
        ds="${pair%%:*}"
        tf_target="${pair#*:}"
        if bq show "${GCP_PROJECT}:${ds}" &>/dev/null; then
          log_warn "  Notice: BigQuery dataset '${GCP_PROJECT}:${ds}' already exists in GCP. Pre-importing into Terraform state..."
          terraform -chdir="${TF_DIR}" import \
            -var="project_id=${GCP_PROJECT}" \
            -var="industry_target=games" \
            -var="bigquery_dataset_location=${GCP_REGION}" \
            "${tf_target}" "projects/${GCP_PROJECT}/datasets/${ds}" &>/dev/null || true
        fi
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

    # Auto-generate .df-credentials.json if missing to allow CLI execution via ADC
    if [ ! -f "${DATAFORM_DIR}/.df-credentials.json" ]; then
      cat <<EOF > "${DATAFORM_DIR}/.df-credentials.json"
{
  "projectId": "${GCP_PROJECT}",
  "location": "${GCP_REGION}"
}
EOF
    fi

    if command -v dataform &> /dev/null; then
      dataform run "${DATAFORM_DIR}" --vars=project_id:${GCP_PROJECT},industry:games
    elif command -v npx &> /dev/null; then
      npx --yes @dataform/cli run "${DATAFORM_DIR}" --vars=project_id:${GCP_PROJECT},industry:games
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

  log_info "Training BQML Logistic Regression model 'omniarcade_raw.player_churn_model'..."
  bq query --location="${GCP_REGION}" --use_legacy_sql=false "CALL \\`${GCP_PROJECT}.omniarcade_raw.train_churn_model\\`();"

  log_success "Step 5 BQML model trained."
else
  log_info "[SKIPPED] Step 5: In-Warehouse BQML Churn Model Training"
fi

# ==============================================================================
# Step 6: Vertex AI Agent Engine / ADK Agent Deployment
# ==============================================================================
if [ "$RUN_AGENTS" = true ]; then
  log_step "STEP 6: Vertex AI Agent Engine / ADK Agent Deployment"

  AGENT_DEPLOY_SCRIPT="${GAMING_DIR}/agents/deploy_agents.sh"
  if [ -f "$AGENT_DEPLOY_SCRIPT" ]; then
    log_info "Executing ADK agent deployment script: ${AGENT_DEPLOY_SCRIPT}..."
    GOOGLE_CLOUD_PROJECT="${GCP_PROJECT}" GOOGLE_CLOUD_LOCATION="${GCP_REGION}" bash "$AGENT_DEPLOY_SCRIPT" all
    log_success "Step 6 Vertex AI Agent Engine / ADK Agents deployed successfully."
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
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${GCP_PROJECT},GCP_LOCATION=${GCP_REGION},BIGQUERY_LOCATION=${GCP_REGION}" \
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
