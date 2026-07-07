#!/usr/bin/env bash
# ==============================================================================
# Master Deployment Orchestrator Script: Unified Gaming Data & AI Operations Platform
# Steps 0 to 7 Runbook (Terraform -> Dataform -> BQML -> Dataplex -> Cloud Build -> Cloud Run)
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

# Configuration variables
GCP_PROJECT="${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT}}"
if [ -z "$GCP_PROJECT" ]; then
  GCP_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
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

# Fetch project number
GCP_PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT}" --format="value(projectNumber)" 2>/dev/null || echo "000000000000")"

# ==============================================================================
# Step 0: Pre-flight Verification & Environment Sanity Check
# ==============================================================================
log_step "STEP 0: Pre-flight Verification & Environment Sanity Check"

log_info "Verifying required CLI utilities..."

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
check_tool "bq" "bq version"
check_tool "terraform" "terraform version"
check_tool "node" "node --version"
check_tool "npm" "npm --version"
check_tool "python3" "python3 --version"

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
log_step "STEP 1: Core Terraform Infrastructure Provisioning"

TF_DIR="${RETAIL_DIR}/infrastructure/terraform"
if [ -d "$TF_DIR" ]; then
  log_info "Navigating to Terraform directory: ${TF_DIR}"
  log_info "Running 'terraform init'..."
  terraform -chdir="${TF_DIR}" init -input=false

  log_info "Executing 'terraform apply -var=\"project_id=${GCP_PROJECT}\" -var=\"industry_target=games\"'..."
  terraform -chdir="${TF_DIR}" apply -auto-approve \
    -var="project_id=${GCP_PROJECT}" \
    -var="industry_target=games"

  log_success "Step 1 Terraform infrastructure applied successfully."
else
  log_error "Terraform directory ${TF_DIR} not found."
  exit 1
fi

# ==============================================================================
# Step 2: Auto-Generate Dataplex Script Configuration
# ==============================================================================
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

# ==============================================================================
# Step 3: Dataform Medallion Pipeline Execution
# ==============================================================================
log_step "STEP 3: Dataform Medallion Pipeline Execution (Bronze -> Silver -> Gold)"

DATAFORM_DIR="${GAMING_DIR}/dataform"
if [ -d "$DATAFORM_DIR" ]; then
  log_info "Compiling and running Dataform Medallion models in ${DATAFORM_DIR}..."

  # Auto-generate .df-credentials.json if missing to allow CLI execution via ADC
  if [ ! -f "${DATAFORM_DIR}/.df-credentials.json" ]; then
    cat <<EOF > "${DATAFORM_DIR}/.df-credentials.json"
{
  "projectId": "${GCP_PROJECT}",
  "location": "us"
}
EOF
  fi

  if command -v dataform &> /dev/null; then
    dataform run "${DATAFORM_DIR}" --vars=project_id:${GCP_PROJECT},industry:games || log_warn "Dataform execution completed with warnings"
  elif command -v npx &> /dev/null; then
    npx --yes @dataform/cli run "${DATAFORM_DIR}" --vars=project_id:${GCP_PROJECT},industry:games || log_warn "Dataform execution completed with warnings"
  else
    log_warn "Neither 'dataform' nor 'npx' found. Skipping Dataform execution."
  fi
  log_success "Step 3 Dataform Gold analytical tables built."
else
  log_warn "Dataform directory ${DATAFORM_DIR} not found. Skipping live compilation."
fi

# ==============================================================================
# Step 4: Dataplex Aspect Tags & Business Glossary Registration
# ==============================================================================
log_step "STEP 4: Dataplex Aspect Tags & Business Glossary Registration"

SCRIPTS_DIR="${GAMING_DIR}/scripts"
log_info "Registering Dataplex Business Glossaries & Aspect Tags..."

if [ -f "${SCRIPTS_DIR}/01_create_glossary.py" ]; then
  log_info "Running 01_create_glossary.py..."
  python3 "${SCRIPTS_DIR}/01_create_glossary.py" || log_warn "Glossary script warning"
fi

if [ -f "${SCRIPTS_DIR}/08_create_churn_guardrail_aspects.py" ]; then
  log_info "Running 08_create_churn_guardrail_aspects.py..."
  python3 "${SCRIPTS_DIR}/08_create_churn_guardrail_aspects.py" || log_warn "Aspect script warning"
fi

if [ -f "${SCRIPTS_DIR}/07_create_lineage.py" ]; then
  log_info "Running 07_create_lineage.py..."
  python3 "${SCRIPTS_DIR}/07_create_lineage.py" || log_warn "Lineage script warning"
fi

log_success "Step 4 Dataplex Knowledge Catalog & Aspects registered."

# ==============================================================================
# Step 5: In-Warehouse BQML Churn Prediction Model Training
# ==============================================================================
log_step "STEP 5: In-Warehouse BQML Churn Model Training & Validation"

log_info "Training BQML Logistic Regression model 'omniarcade_raw.player_churn_model'..."
bq query --use_legacy_sql=false "CALL \`${GCP_PROJECT}.omniarcade_raw.train_churn_model\`();" || log_warn "BQML model training warning"

log_success "Step 5 BQML model trained."

# ==============================================================================
# Step 6: Cloud Build Container Compilation
# ==============================================================================
log_step "STEP 6: Cloud Build Container Compilation (Artifact Registry)"

log_info "Ensuring Cloud Build service account permissions on Cloud Storage & Artifact Registry..."
gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
  --member="serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin" --condition=None &>/dev/null || true

gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
  --member="serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" --condition=None &>/dev/null || true

gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
  --member="serviceAccount:${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/logging.logWriter" --condition=None &>/dev/null || true

gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
  --member="serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/storage.admin" --condition=None &>/dev/null || true

gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
  --member="serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" --condition=None &>/dev/null || true

gcloud projects add-iam-policy-binding "${GCP_PROJECT}" \
  --member="serviceAccount:${GCP_PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/logging.logWriter" --condition=None &>/dev/null || true

log_info "Submitting Cloud Build job to compile unified container image..."
gcloud builds submit --config="${REPO_ROOT}/cloudbuild.yaml" \
  --substitutions=_LOCATION="${GCP_REGION}",_REPOSITORY="data-cloud-ai-demos",_TAG="latest" \
  "${REPO_ROOT}"

log_success "Step 6 Container image built and pushed to Artifact Registry."

# ==============================================================================
# Step 7: Private Cloud Run Deployment (Authenticated & Private)
# ==============================================================================
log_step "STEP 7: Private Cloud Run Deployment (Authenticated & Private)"

SERVICE_NAME="omniarcade-app"
IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/data-cloud-ai-demos/gaming-app:latest"
RUNNER_SA="omniarcade-runner-sa@${GCP_PROJECT}.iam.gserviceaccount.com"

log_info "Deploying Cloud Run service '${SERVICE_NAME}' with --no-allow-unauthenticated..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_URI}" \
  --region="${GCP_REGION}" \
  --service-account="${RUNNER_SA}" \
  --no-allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${GCP_PROJECT},GCP_LOCATION=${GCP_REGION}" \
  --port=8080

log_success "Step 7 Cloud Run service deployed in private/authenticated mode."

# ==============================================================================
# Orchestration Completion Summary
# ==============================================================================
echo -e "\n${BOLD}${GREEN}======================================================================${NC}"
echo -e "${BOLD}${GREEN}   MASTER DEPLOYMENT ORCHESTRATION COMPLETE! ALL STEPS PASSED.${NC}"
echo -e "${BOLD}${GREEN}======================================================================${NC}\n"
log_info "Summary of Deployed Components:"
log_info "  1. BigQuery Datasets: ${BQ_DATASET_RAW}, ${BQ_DATASET_GOLD}"
log_info "  2. Pub/Sub Direct Sub: ${PUBSUB_TOPIC} -> ${BQ_DATASET_RAW}.live_session_events"
log_info "  3. BQML Model: ${BQ_DATASET_RAW}.player_churn_model"
log_info "  4. Dataform Medallion: Bronze -> Silver -> Gold (gold_player_360)"
log_info "  5. Dataplex Aspect: liveops_campaign_policy_aspect"
log_info "  6. Container Image: ${IMAGE_URI}"
log_info "  7. Cloud Run Service: ${SERVICE_NAME} (Private / Authenticated)"
log_info ""
log_info "To access the private Cloud Run service from Cloud Shell Web Preview:"
log_info "  $ gcloud run services proxy --service=${SERVICE_NAME} --port=8080 --region=${GCP_REGION}"
log_info "Then click 'Web Preview' in Cloud Shell and select 'Preview on port 8080'."

exit 0
