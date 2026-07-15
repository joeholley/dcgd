# Technical Specification: Player Retention Promo Agent Enhancements

## 1. Overview & Goal

This technical specification details required enhancements to the **Player Retention Promo Agent** card and its child components within the **Jingle Games Player 360 Platform** operational dashboard application ([`src/remix-gaming-app`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app)).

The updates focus on:
1. Setting default collapsed/active/autonomous card states upon application load.
2. Deferring offer generation in the **Operational Proposal** sub-card and **Execution & Approval Gate** until explicit single-run execution.
3. Replacing LLM Trace Diagnostics with a live, session-isolated **Agent response history** connected to `agent-kc`.
4. Renaming the Dynamic Actions Map to **Data Cloud Telemetry Flow** and dynamically driving node illumination and animation based on the Telemetry Simulator chip status.

---

## 2. Target Files & Location

- **Document Location**: `docs/player-retention-promo-agent-spec.md`
- **Application Components Modified**:
  - [`src/remix-gaming-app/src/components/sections/AgenticWorkflows.tsx`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/AgenticWorkflows.tsx)
  - [`src/remix-gaming-app/src/services/simulatorBridge.ts`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/services/simulatorBridge.ts)
  - [`src/remix-gaming-app/server.ts`](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/server.ts) (Backend route extensions if required for session trace logs)

---

## 3. Functional Requirements

### 3.1 Initial Agent Card & Control State
When a user opens the operational dashboard in their browser:

| Setting | Default Value | Description |
| :--- | :--- | :--- |
| **Card Expansion State** | `false` (Collapsed) | The retention agent card workspace is collapsed by default upon page load. |
| **Active Switch** | `true` (Active) | The agent control group indicates the agent is active. |
| **Autonomous Switch** | `false` (Disabled) | Autonomous execution is disabled by default (Single-Invocation mode active). |

- **State Model Update (`AgenticWorkflows.tsx`)**:
  ```typescript
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    "Automated Player Retention Promo": false, // Collapsed on load
  });

  const [agentActive, setAgentActive] = useState<Record<string, boolean>>({
    "Automated Player Retention Promo": true, // Active
  });

  const [agentAutonomous, setAgentAutonomous] = useState<Record<string, boolean>>({
    "Automated Player Retention Promo": false, // Non-autonomous / single-invocation
  });
  ```

---

### 3.2 Operational Proposal Sub-Card & Approval Gate Deferral

#### Initial Unengaged State (Pre-Execution)
- **Operational Proposal Sub-Card**:
  - Does **NOT** display any offer, target cohort metrics, discount percentages, or SKU IDs upon initial page load.
  - Displays a clean placeholder state: `"No active operational proposal evaluated yet. Click 'Execute Single Run' to analyze player telemetry."`
- **Execution & Approval Gate**:
  - Explicitly states: `"No offer currently active or pending approval."`
  - Approval/Reject action buttons are disabled or hidden until a single run has evaluated.

#### Executed State (Post Single Run Click)
- Clicking **Execute Single Run** in non-autonomous mode triggers evaluation.
- Upon completion, populates the **Operational Proposal** sub-card with:
  - Target Cohort: *Realm of Eldoria RPG - Veteran Whale Cohort*
  - Certified Reward SKU: `frost_giant_shield_pack`
  - Dataplex Aspect ID: `gaming-campaign-policy-aspect`
  - Max Discount Boundary: `85% (Requested: 80%)`
  - Churn Score: `89% (HIGH RISK)`
- Unlocks the **Execution & Approval Gate** to display approval buttons or status.

---

### 3.3 Agent Response History (formerly LLM Trace Diagnostics)

#### Component Overhaul & Renaming
- Sub-card title updated from `LLM Trace Diagnostics (Gemini Enterprise)` to **`Agent response history`**.
- Directly connected to `agent-kc` (`src/agents/kc`).
- Maintained as an in-memory/session-isolated prompt & response history log. Each browser tab/session receives its own isolated chat/trace buffer.

#### Initial Prompt & Response (On Load)
- Upon browser session creation (before user engagement), the component automatically loads a pre-packaged initial conversation entry:
  - **Prompt**: `"Summarize what you can do in 250 words"`
  - **Agent Response** (`agent-kc` summary):
    > *"I am the Knowledge Catalog (KC) Guided Agent for OmniArcade. I dynamically discover, govern, and analyze live player telemetry across 150+ BigQuery tables without reliance on hardcoded schema prompts. By leveraging Dataplex Knowledge Catalog metadata, entry aspect searches, data quality scores, and lineage graphs, I identify high-risk churn signals—such as repeated boss wipeouts among veteran whale cohorts—and construct policy-compliant retention campaigns. Every promotional recommendation enforces Dataplex guardrails, capping discounts within authorized boundaries while logging audit trails to BigQuery."*

#### Single Run Trigger Prompt
- Clicking **Execute Single Run** appends the following canned user prompt to the session history log:
  - **User Prompt**: `"it seems that many players are dying on a boss and there is potentially a higher churn rate. How can you help?"`
- The system forwards this prompt to `agent-kc`, streaming the live reasoning steps and detailed response into the **Agent response history** log.

---

### 3.4 Data Cloud Telemetry Flow (formerly Dynamic Actions Map)

#### Component Overhaul & Renaming
- Sub-card title updated from `Dynamic Actions Map ({routingMode} MODE)` to **`Data Cloud Telemetry Flow`**.

#### Telemetry Simulator State Coupling
The illuminated state and data flow animation of nodes in the diagram are governed by the **Simulator Status** chip (located at the top of the application):

```mermaid
graph LR
    subgraph Simulator ON
        SC1[Simulator Client] -->|Animated Stream| PS1[Pub/Sub Topic]
        PS1 -->|Animated Stream| BQ1[BigQuery gold_player_360]
    end
    subgraph Simulator OFF
        SC2[Simulator Client (Unlit)]
        PS2[Pub/Sub Topic (Unlit)]
        BQ2[BigQuery gold_player_360 (LIT / Active)]
    end
```

#### Detailed Node Illumination Matrix

| Node | Simulator ON State | Simulator OFF State | Rationale |
| :--- | :--- | :--- | :--- |
| **Simulator Client** | **Lit Up** + Pulsing Animation | **Unlit / Dimmed** (No animation) | Emitting live/mock events when ON; dormant when OFF. |
| **Pub/Sub Topic** | **Lit Up** + Pulsing Animation | **Unlit / Dimmed** (No animation) | Ingesting stream messages when ON; dormant when OFF. |
| **BigQuery Data Warehouse** | **Lit Up** (Active state) | **Lit Up** (Active state) | **Always accessible** by `agent-kc` for queries regardless of real-time ingestion state. |

---

## 4. UI Layout & Wireframe Overview

```
+-----------------------------------------------------------------------------------+
| Player Retention Promo Agent [ACTIVE] [SINGLE-INVOCATION MODE]        [V] Expand  |
+-----------------------------------------------------------------------------------+
| (WHEN EXPANDED)                                                                   |
|                                                                                   |
| +-----------------------------------------+ +-----------------------------------+ |
| | Operational Proposal Details            | | Execution & Approval Gate         | |
| | [PRE-RUN]: "No active proposal evaluated| | [PRE-RUN]: "No offer active."     | |
| |  Click 'Execute Single Run' to evaluate"| |                                   | |
| | [POST-RUN]: Cohort, SKU, Churn 89%, etc.| | [Execute Single Run Button]       | |
| +-----------------------------------------+ +-----------------------------------+ |
|                                                                                   |
| +-----------------------------------------+ +-----------------------------------+ |
| | Agent response history                  | | Data Cloud Telemetry Flow         | |
| | - Prompt: "Summarize what you can do..."| | [Sim Client] -> [Pub/Sub] -> [BigQuery]| |
| | - Response: "I am the KC Agent..."      | | (Animates if Simulator Chip ON;  | |
| | - [Single Run]: "it seems players die..."| |  BigQuery stays lit if OFF)     | |
| +-----------------------------------------+ +-----------------------------------+ |
+-----------------------------------------------------------------------------------+
```

---

## 5. Verification & Acceptance Criteria

1. **Initial Page Load Test**:
   - Verify the retention agent card starts **collapsed**.
   - Expand card: Verify **Active** toggle is ON, **Autonomous** toggle is OFF.
   - Verify **Operational Proposal** and **Approval Gate** show no active offer.
   - Verify **Agent response history** displays the 250-word capability summary for prompt `"Summarize what you can do in 250 words"`.

2. **Single Run Execution Test**:
   - Click **Execute Single Run**.
   - Verify prompt `"it seems that many players are dying on a boss and there is potentially a higher churn rate. How can you help?"` is appended to **Agent response history**.
   - Verify **Operational Proposal** populates with SKU (`frost_giant_shield_pack`), churn score (`89%`), and aspect policy details.
   - Verify **Execution & Approval Gate** unlocks approval buttons.

3. **Telemetry Flow Animation & Simulator Status Test**:
   - Toggle Telemetry Simulator **ON**: Verify Simulator Client, Pub/Sub, and BigQuery nodes light up with streaming animation.
   - Toggle Telemetry Simulator **OFF**: Verify Simulator Client and Pub/Sub unlight/pause animation, while BigQuery remains lit up.
