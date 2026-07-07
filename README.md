# Agentic Data Cloud - Unified Gaming Data, AI Governance & Executive Operations Platform

This repository reconciles three game analytics projects into a single, unified enterprise demonstration platform:

1. **Target Backend Architecture & Data Generator (`retail-data-and-ai-demo`)**: Provisions GCP infrastructure, Pub/Sub direct BigQuery streaming subscriptions, stored procedures, and BigQuery ML (BQML) churn prediction models.
2. **OmniArcade Governance & Vertex AI Agent Engine (`gamingdatademo`)**: Transforms raw telemetry into Gold feature tables via Dataform, enforces Dataplex Knowledge Catalog custom aspect tags & business glossaries, and deploys `google-adk` proactive agents.
3. **Player 360 Executive Operations Dashboard (`remix-gaming-app`)**: React 19 / Vite / Express platform featuring ADC authentication, real-time SSE event hub, knowledge catalog automatic rule discovery, and split-screen LiveOps churn guardrail simulator.

---

## 🚀 One-Step Automated Deployment

To deploy the entire end-to-end platform (Terraform -> Pub/Sub -> Dataform -> BQML -> Dataplex -> Agent -> UI), execute the master deployment runbook:

```bash
# 1. Authenticate with Google Cloud Application Default Credentials (ADC)
gcloud auth application-default login

# 2. Run the master deployment runbook
bash docs/deploy-demo.sh
```

---

## 💻 Manual Deployment & Running Locally

If you prefer to run or test individual components manually:

### Step 1: Provision Core Infrastructure (Terraform)
```bash
cd src/retail-data-and-ai-demo/infrastructure/terraform
terraform init
terraform apply -var="industry_target=games" -auto-approve
```

### Step 2: Run Dataform Pipeline & Dataplex Aspect Registration
```bash
cd src/gamingdatademo/dataform
dataform run --vars=industry:games

cd ../scripts
python3 01_create_glossary.py
python3 08_create_churn_guardrail_aspects.py
python3 07_create_lineage.py
```

### Step 3: Start Executive Remix Gaming UI Gateway
> **Note**: Create `src/remix-gaming-app/firebase-applet-config.json` (see `src/remix-gaming-app/firebase-applet-config.json.example` or `src/remix-gaming-app/README.md` for format and Firebase Console instructions).

```bash
cd src/remix-gaming-app
npm install
npm run dev
```
Open **`http://localhost:3000`** in your browser and select **LiveOps Guardrail** from the navigation sidebar.

---

## 📚 Technical Documentation & Architecture Deep Dives

Detailed architectural specifications and persona scripts are located in the [`docs/`](docs/) directory:

- [**`docs/integration-plan.md`**](docs/integration-plan.md): Master technical integration plan and multi-layer architecture diagram.
- [**`docs/churn-guardrail-plan.md`**](docs/churn-guardrail-plan.md): End-to-end real-time autonomous churn guardrail specification (<300ms pop-up execution SLA).
- [**`docs/frontend-backend-mapping.md`**](docs/frontend-backend-mapping.md): Endpoint mapping between Express server gateway, Vertex AI Agent Engine, Dataplex REST APIs, and React UI components.
- [**`docs/demoscript.md`**](docs/demoscript.md): Executive presentation script featuring Alex (VP of Marketing).
- [**`docs/demo-script-validation.md`**](docs/demo-script-validation.md): Line-by-line technical alignment validation matrix.
