# Agentic Data Cloud - Unified Gaming Data, AI Governance & Executive Operations Platform

This repository reconciles three game analytics projects into a single, unified enterprise demonstration platform:

1. **Target Backend Architecture & Data Generator (`retail-data-and-ai-demo`)**: Provisions GCP infrastructure, Pub/Sub direct BigQuery streaming subscriptions, stored procedures, and BigQuery ML (BQML) churn prediction models.
2. **OmniArcade Governance & Vertex AI Agent Engine (`gamingdatademo`)**: Transforms raw telemetry into Gold feature tables via Dataform, enforces Dataplex Knowledge Catalog custom aspect tags & business glossaries, and deploys `google-adk` proactive agents.
3. **Player 360 Executive Operations Dashboard (`remix-gaming-app`)**: React 19 / Vite / Express platform featuring ADC authentication, real-time SSE event hub, knowledge catalog automatic rule discovery, and split-screen LiveOps churn guardrail simulator.

---

## 🚀 One-Step Automated Deployment

To deploy the entire end-to-end platform (Terraform -> Pub/Sub -> Dataform -> BQML -> Dataplex -> Cloud Build -> Public Cloud Run), execute the master deployment runbook:

### Prerequisites & Cloud Shell Setup

Before running the deployment:

1. **CLI Utilities**: Ensure `gcloud`, `bq`, `node` (v18+), `npm`, `python3`, and `terraform` (v1.5+) are installed.
2. **Google Cloud Shell Terraform Setup**:
   On fresh Google Cloud Shell instances, `command -v terraform` points to a placeholder stub (`/google/bin/terraform`) that will fail during `terraform init`. Install real Terraform in Cloud Shell before running:
   ```bash
   wget -O - https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(grep -oP '(?<=UBUNTU_CODENAME=).*' /etc/os-release || lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
   sudo apt update && sudo apt install -y terraform
   ```
3. **Automated API Bootstrapping**:
   Step 0 of `./deploy-demo.sh` automatically pre-enables foundational GCP APIs (`cloudresourcemanager`, `serviceusage`, `iam`, `artifactregistry`, `bigquery`, `pubsub`, etc.) so that Terraform can manage project services without 403 permission errors on new GCP projects.

```bash
# 1. Set your target GCP Project ID and region
gcloud config set project YOUR_PROJECT_ID
export GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
export GCP_LOCATION=us-central1

# 2. Authenticate with Google Cloud Application Default Credentials (ADC)
gcloud auth application-default login

# 3. Run the master deployment runbook
bash ./deploy-demo.sh
```

### Accessing the Public Cloud Run Application

The deployment script builds container images via **Cloud Build** and deploys the unified application to **Cloud Run** in public mode (`--allow-unauthenticated`).

Once deployment completes, the script outputs the public HTTP endpoint URL:
```bash
# Get service URL directly via gcloud
gcloud run services describe gaming-demo-app --region=us-central1 --format='value(status.url)'
```

---

## 💻 Manual Step-by-Step Deployment

If you prefer to run or test individual components manually:

### Step 1: Provision Core Infrastructure (Terraform)
> **Note**: Required GCP APIs (`pubsub`, `bigquery`, `dataplex`, `datalineage`, `dataform`, `run`, `cloudbuild`, `aiplatform`) and the Cloud Run runner service account (`gaming-runner-sa`) are automatically enabled and created when `industry_target=games` is set.

```bash
cd src/retail-data-and-ai-demo/infrastructure/terraform
terraform init
terraform apply -var="project_id=YOUR_PROJECT_ID" -var="industry_target=games" -auto-approve
```

### Step 2: Configure & Run Governance & Dataform Pipeline

```bash
cd src/gamingdatademo/scripts

# Create config.json (or rely on GOOGLE_CLOUD_PROJECT & GCP_LOCATION env vars)
cat <<EOF > config.json
{
  "project_id": "YOUR_PROJECT_ID",
  "project_number": "YOUR_PROJECT_NUMBER",
  "region": "us-central1",
  "multi_region": "us"
}
EOF

# Run Dataform pipeline
cd ../dataform
npx --yes @dataform/cli run . --vars=project_id:YOUR_PROJECT_ID,industry:games

# Register Dataplex Glossaries & Aspect Tags
cd ../scripts
python3 01_create_glossary.py
python3 08_create_churn_guardrail_aspects.py
python3 07_create_lineage.py
```

### Step 3: Build & Deploy Container to Public Cloud Run

```bash
# Build unified container image via Cloud Build
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_LOCATION=us-central1,_REPOSITORY=gaming-demo-images .

# Deploy to Cloud Run (Public/Unauthenticated mode)
gcloud run deploy gaming-demo-app \
  --image="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/gaming-demo-images/gaming-app:latest" \
  --region=us-central1 \
  --service-account="gaming-runner-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --allow-unauthenticated \
  --port=8080
```

---

## 📚 Technical Documentation & Architecture Deep Dives

Detailed architectural specifications and persona scripts are located in the [`docs/`](docs/) directory:

- [**`docs/integration-plan.md`**](docs/integration-plan.md): Master technical integration plan and multi-layer architecture diagram.
- [**`docs/churn-guardrail-plan.md`**](docs/churn-guardrail-plan.md): End-to-end real-time autonomous churn guardrail specification (<300ms pop-up execution SLA).
- [**`docs/frontend-backend-mapping.md`**](docs/frontend-backend-mapping.md): Endpoint mapping between Express server gateway, Vertex AI Agent Engine, Dataplex REST APIs, and React UI components.
- [**`docs/demoscript.md`**](docs/demoscript.md): Executive presentation script featuring Alex (VP of Marketing).
- [**`docs/demo-script-validation.md`**](docs/demo-script-validation.md): Line-by-line technical alignment validation matrix.
