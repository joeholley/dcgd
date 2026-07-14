# Player 360 Executive Operations & LiveOps Churn Guardrail Dashboard

An enterprise React 19 + Express web application providing real-time game analytics, Dataplex Knowledge Catalog integration, and autonomous churn intervention capabilities built on Google Cloud.

---

## 🌟 Key Features

- **LiveOps Churn Guardrail Split-Screen View**:
  - **Game Client Simulator**: Interactive RPG boss fight simulator emitting telemetry events (`boss_fail`, `quit_intent`) into Cloud Pub/Sub via Express `/api/telemetry/stream`.
  - **Dynamic In-Game Pop-Up**: Intercepts exit intent with pre-cached certified offers (`$0.99 Frost Giant Shield Pack`) executing in `<300ms`.
  - **Real-Time LiveOps Observatory**: Pushes real-time SSE telemetry streams, BQML radial churn propensity gauge (25% -> 50% -> 87%), Dataplex policy verification card, and closed-loop revenue counters (+1 Churn Averted, +$0.99 Revenue).
- **Knowledge Catalog Automatic Rule Discovery**: Allows executives to input natural language business rules and generate Dataplex Aspect tags and BigQuery Row Access Policy SQL without writing raw code.
- **ADC Security Model**: Built using Google Cloud Application Default Credentials (ADC) with `@google-cloud/aiplatform`, `@google-cloud/pubsub`, `@google-cloud/bigquery`, and `google-auth-library`.

---

## 🚀 Quick Start & Deployment

### 1. Prerequisites
- **Node.js**: v18+
- **Google Cloud SDK & CLI Tools**: `gcloud`, `bq`, `python3`, and `terraform` (v1.5+). Note: On fresh Cloud Shell instances, run `sudo apt update && sudo apt install -y terraform` if `command -v terraform` points to a placeholder.
- **Application Default Credentials**: Logged into ADC:
  ```bash
  gcloud auth application-default login
  ```
- **Firebase Configuration (`firebase-applet-config.json`)**:
  Create `firebase-applet-config.json` in `src/remix-gaming-app/` (you can use `firebase-applet-config.json.example` as a template).

  **How to obtain your credentials**:
  1. Go to [Firebase Console](https://console.firebase.google.com/).
  2. Select your Firebase project and click **Project Settings** (gear icon) -> **General**.
  3. Under **Your apps**, locate your Web App registration and select **Config**.
  4. Copy the config parameters into `src/remix-gaming-app/firebase-applet-config.json`.

  **Expected JSON Format**:
  ```json
  {
    "projectId": "YOUR_PROJECT_ID",
    "appId": "YOUR_APP_ID",
    "apiKey": "YOUR_FIREBASE_API_KEY",
    "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
    "firestoreDatabaseId": "(default)",
    "storageBucket": "YOUR_PROJECT_ID.firebasestorage.app",
    "messagingSenderId": "YOUR_MESSAGING_SENDER_ID"
  }
  ```



### 2. Full Platform Deployment (Cloud Build & Private Cloud Run)
To deploy the entire backend infrastructure, Dataform pipelines, BQML model, Dataplex tags, and unified UI in one command:
```bash
# From repository root:
bash ./deploy-demo.sh
```

### 3. Accessing the Private Cloud Run Deployment

After deployment, access the private Cloud Run service from Cloud Shell:

```bash
gcloud run services proxy gaming-demo-app --port=8080 --region=us-central1
```
Then click **Web Preview** -> **Preview on port 8080** in Google Cloud Shell.

### 4. Running UI Development Server Locally
```bash
# Install dependencies
npm install

# Start local server (Express gateway + Vite frontend)
npm run dev
```

Open **`http://localhost:3000`** in your browser and select **LiveOps Guardrail** from the navigation bar.

---

## 🛠️ Architecture & Backend Services

- **Express Gateway (`server.ts`)**:
  - `POST /api/telemetry/stream`: Formats `snake_case` JSON telemetry, publishes to Pub/Sub topic `gaming-live-telemetry`, executes BQML `ML.PREDICT`, and streams SSE risk updates.
  - `GET /api/guardrail/events`: Real-time SSE event hub for connected client dashboards.
  - `GET /api/catalog/search` & `POST /api/catalog/rules/discover`: Dataplex Knowledge Catalog proxy endpoints.
  - `POST /api/chat`: Vertex AI Agent Engine (`google-adk`) proxy route.
- **BigQuery Client (`src/services/bigquery.ts`)**: Parameterized query client accessing `gaming_gold` Gold feature tables with simulated local fallback support.
