# Planning Document: Connecting `agent_kc` UI Elements to Live Google Cloud Reasoning Engine

## 1. Overview & Objective

This document outlines the architectural plan to ensure that **every UI element, page, component, and drawer interacting with or displaying `agent_kc` (Knowledge Catalog Guided Agent)** across the codebase can connect seamlessly to a live **Vertex AI Reasoning Engine** running on Google Cloud.

Additionally, this plan establishes a unified UI/UX standard for:
1. **Live vs. Mocked Status Chips / Badges**: Clearly visually indicating whether the agent execution rendered via live Google Cloud ADC / Vertex AI API, or via offline fallback mock data.
2. **Session ID Display & Inspection**: Displaying the active Google Agent Development Kit (ADK) session ID (`session_id`) returned from the Reasoning Engine (`:query` / `:streamQuery`) directly in the UI for debugging, session persistence, and audit logging.

---

## 2. Complete Inventory of `agent_kc` UI Elements

Below is the complete inventory of all UI locations across `src/gamingdatademo` and `src/remix-gaming-app` where `agent_kc` is present.

### 2.1 `src/gamingdatademo` (Python Flask / HTML5 Application)

#### 1. Main Chat Interface (`website-live/static/index.html` & `website-live/static/chat.js`)
* **Target UI Elements**:
  * Agent Selector Sub-Tab: `Knowledge Catalog Agent` button (`#agentSubTabs`, `index.html` L64-66, `chat.js` L220-229).
  * System Mode Badge: `#modeBadge` (`index.html` L42, `chat.js` L175-188).
  * Chat Response Header & Tool Call Cards: Displays tool execution steps (`query_bigquery_tables`) and Dataplex glossary popups (`chat.js` L270-331).
* **Current Endpoint**: WebSocket `/api/ws` (`app.py` L870–1037) & `/api/config`.
* **Required Enhancements**:
  * Add a persistent **Session ID Badge** under the agent title header in `chat.js`.
  * Update the `#modeBadge` to reflect real-time live connection status returned per chunk from WebSocket `/api/ws` (`type: "status"`, `live: true/false`, `session_id: "sess_..."`).

#### 2. GCP Health & Agent Diagnostics Dashboard (`website-live/static/health.html`)
* **Target UI Elements**:
  * Agent Status Grid Card: `Knowledge Catalog Analytics Agent (agent_kc)` connection status card (`health.html` L130-170).
* **Current Endpoint**: `GET /api/system/gcp-health` (`app.py` L1042-1085).
* **Required Enhancements**:
  * Display active Vertex AI Reasoning Engine Resource Name (`projects/.../locations/.../reasoningEngines/{agent_id}`).
  * Render explicit `LIVE` (Green) vs `MOCK` (Yellow) vs `OFFLINE` (Red) chip with latency breakdown.

#### 3. System Architecture Visualizer (`website-live/static/architecture.html`)
* **Target UI Elements**:
  * Visual Architecture Diagram Node: `agent_kc` Reasoning Engine node in the system diagram (`architecture.html`).
* **Current Endpoint**: `GET /api/system/gcp-health` & `GET /api/config`.
* **Required Enhancements**:
  * Dynamically illuminate the `agent_kc` diagram node with a `LIVE` pulse badge when active.

---

### 2.2 `src/remix-gaming-app` (React 19 / TypeScript Application)

#### 4. Agentic Workflows Hub (`src/components/sections/AgenticWorkflows.tsx`)
* **Target UI Elements**:
  * **Agent KC Operational Card**: Primary card for "Knowledge Catalog Agent (`agent_kc`)" (`AgenticWorkflows.tsx` L310-450).
  * **Workflow Execution Trace Panel**: Markdown response view rendering reasoning steps, prompt submissions, and execution history (`AgenticWorkflows.tsx` L945-1057).
  * **Data Cloud Pipeline Diagram**: Visual pipeline nodes (*Simulator Client* $\rightarrow$ *Pub/Sub* $\rightarrow$ *BigQuery* $\rightarrow$ *BQML & Dataplex* $\rightarrow$ *Gemini Enterprise*) (`AgenticWorkflows.tsx` L135-287).
* **Current Endpoints**: `POST /api/chat` (`server.ts` L996) and `GET /api/guardrail/agent-trace` (`server.ts` L1674).
* **Required Enhancements**:
  * Render an explicit **Session ID Badge** (`session_id`) in the top-right corner of the execution trace card with a copy-to-clipboard button.
  * Add a top-level **Live / Mock Mode Chip** next to the `agent_kc` card title indicating whether queries are routed directly to Vertex AI Reasoning Engine endpoint.

#### 5. PineCore AI Assistant Drawer (`src/components/sections/GamingAssistant.tsx`)
* **Target UI Elements**:
  * Floating Chat Drawer: Global drawer accessible from all app tabs (`GamingAssistant.tsx` L52-416).
  * Stepper Execution Visualizer: 3-step execution status indicator (`Dataplex Schema Search` $\rightarrow$ `Aspect Tag Verification` $\rightarrow$ `BigQuery SQL Execution`) (`GamingAssistant.tsx` L87-119).
* **Current Endpoint**: `POST /api/chat` (`server.ts` L996).
* **Required Enhancements**:
  * Display a `Session ID: {session_id}` pill badge inside the drawer header when connected to Google Cloud.
  * Update the execution stepper to pull live telemetry status and mode (`LIVE` vs `SIMULATED`) from `/api/chat` API responses.

#### 6. GCP Health Diagnostic Observatory (`src/components/sections/GCPHealth.tsx`)
* **Target UI Elements**:
  * `agent_kc` Service Card: Dedicated health card for `Knowledge Catalog Agent (agent_kc)` (`GCPHealth.tsx` L108-113, L192-240).
* **Current Endpoint**: `GET /api/system/gcp-health` (`server.ts` L1381).
* **Required Enhancements**:
  * Expose the full endpoint details, active reasoning engine ID, and live vs quiet fallback status badge in the UI card.

#### 7. LiveOps Guardrail Automation (`src/components/sections/LiveOpsGuardrail.tsx`)
* **Target UI Elements**:
  * Agent Execution Trace Log: Real-time trace visualizer rendering churn retention offer proposals (`LiveOpsGuardrail.tsx` L120-250).
  * Pub/Sub & Agent SSE Stream Box: Real-time event log (`LiveOpsGuardrail.tsx` L690-729).
* **Current Endpoints**: `GET /api/guardrail/agent-trace` (`server.ts` L1674) & `GET /api/guardrail/events` (`server.ts` L834).
* **Required Enhancements**:
  * Render the live ADK `session_id` directly inside the agent trace payload box.
  * Display a mode badge (`LIVE GCP REASONING ENGINE` vs `FALLBACK GUARDRAIL`) above the proposed action card.

#### 8. Mock Mobile Client Sandbox (`src/components/sections/MockClientTab.tsx`)
* **Target UI Elements**:
  * Dynamic Offer Banner: In-game pop-up modal displaying dynamic promotional offers (`MockClientTab.tsx` L60-180).
* **Integration Routing Pattern**:
  * *Indirect Asynchronous Data Routing*: `agent_kc` does not trigger the client directly. Actions/offers formulated by `agent_kc` are posted to an operational backend storage store (such as **Firebase Realtime Database (RTDB)** or **Cloud Spanner**).
  * The mock mobile client component subscribes asynchronously to changes in this storage store (or via real-time SSE stream bridges) to deliver in-game retention pop-up banners when new offer records arrive.
* **Current Endpoint**: SSE stream `/api/guardrail/events` (subscribing to storage updates).
* **Required Enhancements**:
  * Display a subtle session & provenance metadata pill (`Origin: agent_kc | Session: sess_... | Datastore Sync: Live`) inside the mobile promo modal footer.

---

## 3. Standardized API & Response Payload Contracts

To ensure consistent behavior across all frontend elements, the backend routes (`server.ts` and `app.py`) will return standardized response metadata for all `agent_kc` operations.

> [!IMPORTANT]
> **Status Integrity Rule**: The standardized schema MUST NOT force endpoints to report `"SUCCESS"` when an error or exception occurs. If a request encounters an authentication failure, invalid model response, unreachable reasoning engine endpoint, or internal error, the `status` field must explicitly reflect the error state (e.g. `"ERROR"` or `"FALLBACK"`), accompanied by descriptive `error` messages.

### Standard Agent Response Schema (`/api/chat` & `/api/guardrail/agent-trace`)

#### Successful Execution Example:
```json
{
  "status": "SUCCESS",
  "agent_id": "projects/123456789/locations/us-central1/reasoningEngines/987654321",
  "agent_name": "Knowledge Catalog Agent (agent_kc)",
  "session_id": "sess_1721088000_a1b2c3d4",
  "mode": "LIVE", // "LIVE" | "MOCK" | "HYBRID"
  "live": true,
  "endpoint": "https://us-central1-aiplatform.googleapis.com/v1/projects/.../reasoningEngines/...",
  "latency_ms": 342,
  "response_text": "...",
  "trace_steps": [ ... ]
}
```

#### Error Encountered Example (Status Integrity Preserved):
```json
{
  "status": "ERROR",
  "agent_id": "projects/123456789/locations/us-central1/reasoningEngines/987654321",
  "agent_name": "Knowledge Catalog Agent (agent_kc)",
  "session_id": "sess_1721088000_a1b2c3d4",
  "mode": "MOCK",
  "live": false,
  "error": "ADC authentication failure or Vertex AI Reasoning Engine timeout (504)",
  "response_text": "[Fallback Analysis] Local synthetic fallback output rendered due to upstream error...",
  "trace_steps": [ ... ]
}
```

---

## 4. UI Component Design Specifications

### 4.1 Live/Mock Chip Component Specification (`DataModeBadge`)
* **Live Mode Badge**: Green accent background (`bg-emerald-500/10 border-emerald-500/30 text-emerald-400`), featuring a pulsing green indicator dot and label: `LIVE GCP REASONING ENGINE`.
* **Mock Mode Badge**: Amber accent background (`bg-amber-500/10 border-amber-500/30 text-amber-400`), featuring a static yellow dot and label: `OFFLINE MOCK FALLBACK`.
* **Error Mode Badge**: Red accent background (`bg-red-500/10 border-red-500/30 text-red-400`), featuring a static alert icon and label: `AGENT ERROR / UNREACHABLE`.

### 4.2 ADK Session ID Display Badge
* **Styling**: Monospace font (`font-mono text-[11px]`), background pill (`bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1.5`).
* **Interactive Behavior**: Clicking the badge copies the full `session_id` to the user's clipboard and displays a temporary tooltip notification (`Session ID Copied!`).

---

## 5. Step-by-Step Implementation Blueprint (No Code Changes Yet)

### Step 1: Update Server Payload Helpers (`server.ts` & `app.py`)
1. Extend `queryADKReasoningEngine()` in `server.ts` to explicitly capture and expose `sessionId`, `endpoint`, and `live` status flags.
2. Update `/api/chat` and `/api/guardrail/agent-trace` endpoints in `server.ts` to return standardized session metadata without forcing `"SUCCESS"` on error conditions.
3. Update WebSocket `/api/ws` handler in `app.py` to send an initial `session_init` event containing `session_id` and `mode`.

### Step 2: Implement Shared React Badges in `src/remix-gaming-app`
1. Update `src/components/DataModeBadge.tsx` to accept optional `sessionId` and `agentId` props.
2. Add a reusable `SessionIdBadge` component with clipboard copy functionality.

### Step 3: Integrate into Remix UI Sections
1. **`AgenticWorkflows.tsx`**: Add `SessionIdBadge` and mode chip to the agent execution results header and trace step log.
2. **`GamingAssistant.tsx`**: Render live mode status and session ID inside the floating chat header and response bubbles.
3. **`LiveOpsGuardrail.tsx`**: Bind `session_id` from `/api/guardrail/agent-trace` to the trace step visualizer.
4. **`MockClientTab.tsx`**: Add datastore subscription provenance pill indicating updates originate from `agent_kc` via datastore routing (e.g. Firebase RTDB / Spanner).
5. **`GCPHealth.tsx`**: Ensure `agent_kc` card highlights active reasoning engine endpoint and session latency.

### Step 4: Integrate into Flask Static HTML/JS in `src/gamingdatademo`
1. Update `chat.js` to parse `session_id` and `mode` from `/api/ws` WebSocket stream messages.
2. Render a session badge element `#agentSessionBadge` in `index.html` chat header.

---

## 6. Verification & Test Plan

Once implementation begins, the following validation steps will be performed:
1. **Live Connectivity Test**: Authenticate with Google ADC (`gcloud auth application-default login`), deploy `agent_kc`, and verify that all UI elements show `LIVE` mode chips and valid Google Cloud session IDs (`sess_...`).
2. **Error & Fallback Handling Test**: Simulate an API exception / authentication error and verify that `status` returns `"ERROR"` or `"FALLBACK"` (not forced `"SUCCESS"`), rendering the appropriate error/mock UI status badges.
3. **Async Datastore Routing Test**: Confirm that offers formulated by `agent_kc` are correctly written to the intermediate database (Firebase RTDB / Spanner) and that `MockClientTab.tsx` dynamically picks up the updates via subscription.
4. **Session Continuity Test**: Submit consecutive prompts in `GamingAssistant.tsx` and `index.html` to confirm that the same `session_id` is maintained across turns.
