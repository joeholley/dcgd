# Refactoring and Verification Plan: `agent_kc` Upgrade

This document outlines the step-by-step plan to refactor the Knowledge Catalog Guided Agent (`agent_kc`), upgrade its model, align its dependencies with the latest GA version of the Google Agent Development Kit (ADK), audit BQ/Dataplex tables, and update the deployment pipeline to conform to the latest Gemini Enterprise Agent Platform documentation.

---

## 1. Objectives & Scope
- **Target Component**: `src/gamingdatademo/agents/agent_kc`
- **Model Upgrade**: Migrate from `gemini-2.5-flash` to `gemini-3.5-flash`.
- **SDK Upgrade**: Align and freeze the ADK version to current GA (`google-adk>=2.0.0`).
- **Data & Setup Audit**: Validate BigQuery dataset/table mappings, Dataplex aspect configurations, and verify setup integration in `deploy-demo.sh`.
- **Deployment Modernization**: Update the build/deploy logic to leverage the latest `agents-cli deploy` command group.

---

## 2. Refactoring Tasks

### Task 2.1: Model Version Update
Update the model identifier to use `gemini-3.5-flash` in all logical files for the agent.
- **Files to Edit**:
  1. [agent.py (Root)](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_kc/agent.py#L492)
  2. [app/agent.py (Production App)](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_kc/app/agent.py#L492)
- **Change**:
  ```python
  root_agent = Agent(
      name="game_kc_agent",
-     model="gemini-2.5-flash",
+     model="gemini-3.5-flash",
      instruction=_kc_instruction,
      tools=_kc_tools,
  )
  ```

### Task 2.2: ADK SDK Upgrade
Ensure that dependencies in both Hatch config (`pyproject.toml`) and the pip requirements lockfile are fully aligned with the stable GA release of `google-adk`.
- **Files to Edit**:
  1. [requirements.txt](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_kc/requirements.txt)
- **Change**:
  Ensure `requirements.txt` mirrors the dependencies specified in `pyproject.toml` (which already defines `google-adk[gcp]>=2.0.0,<3.0.0`):
  ```diff
- google-adk>=0.3.0
+ google-adk[gcp]>=2.0.0,<3.0.0
  ```

---

## 3. Data & Setup Audit

### BQ & Knowledge Catalog Access Audit
Below is a verification of the BigQuery tables, views, and Dataplex elements accessed by `agent_kc`, confirming they are stood up correctly by `deploy-demo.sh`:

| Data Asset Name | Medallion Layer / Type | Provisioned by `deploy-demo.sh`? | Seeding / Hydration Query | Dataplex Registry Aspect |
| :--- | :--- | :--- | :--- | :--- |
| `omniarcade_gold.gold_player_360` | Gold Feature Table | **Yes** (Steps 1 & 3 via Terraform & Dataform) | Hydrated during Step 5 (Logistic regression merge) | `liveops_campaign_policy_aspect` & `certified_reward_sku_aspect` (Step 4 script) |
| `omniarcade_gold.gold_campaign_analytics` | Gold Table | **Yes** (Steps 1 & 3 via Terraform & Dataform) | Seeded during Step 5 | `liveops_campaign_policy_aspect` & `certified_reward_sku_aspect` (Step 4 script) |
| `omniarcade_gold.gold_regional_kpis` | Gold Table | **Yes** (Steps 1 & 3 via Terraform & Dataform) | Seeded during Step 5 | None |
| `omniarcade_silver.server_latency` | Silver Table | **Yes** (Step 3 via Dataform) | Seeded during Step 5 | None |
| `omniarcade_gold.gold_level_difficulty_funnel` | Gold Table | **Yes** (Step 3 via Dataform) | Seeded during Step 5 | None |
| Dataplex Business Glossary | Business Glossary | **Yes** (Step 4 via Python script) | `omniarcade-studios-glossary-us` created and terms seeded by `01_create_glossary.py` | None |

### Table Name Verification
All references inside the agent instruction prompts and aspect scripts have been checked against the Dataform compilation targets (`schema: "omniarcade_gold"`, `schema: "omniarcade_silver"`):
- Verified that tables starting with `gold_` reside in `omniarcade_gold` or `telemetry_gold`. Both namespaces are correctly cataloged and indexable.
- verified that `08_create_churn_guardrail_aspects.py` correctly maps aspects to `omniarcade_gold.gold_player_360` and `omniarcade_gold.gold_campaign_analytics`.

---

## 4. Deployment Modernization

The Vertex AI Agent Engine platform has transitioned to the unified **Gemini Enterprise Agent Platform**. We will update the deployment runner from the legacy ADK deployment container command (`adk deploy`) to the standard **Agents CLI** (`agents-cli deploy`).

### Task 4.1: Update Deployment Manifest
Update `agents-cli-manifest.yaml` to specify the correct default location for the demo environment (`us-central1`).
- **File to Edit**:
  - [agents-cli-manifest.yaml](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_kc/agents-cli-manifest.yaml)
- **Change**:
  ```yaml
  name: "agent-kc"
  acli_version: "0.5.1"
  agent_directory: "app"
- region: "us-east1"
+ region: "us-central1"
  ```

### Task 4.2: Refactor `deploy_agents.sh`
Modify the agent deployment helper script to call `agents-cli deploy` rather than `adk deploy`.
- **File to Edit**:
  - [deploy_agents.sh](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/deploy_agents.sh)
- **Change (Lines 147-154)**:
  ```bash
      local adk_exit=0
-     adk deploy agent_engine \
-         --project="${PROJECT_ID}" \
-         --region="${REGION}" \
-         --display_name="${agent_name}" \
-         --otel_to_cloud \
-         "${extra_args[@]}" \
-         "${agent_dir}" 2>&1 | tee "${tmp_log}" || adk_exit=$?
+     # Deploys using the unified Agents CLI framework conforming to latest Agent Platform guidelines
+     pushd "${agent_dir}" >/dev/null
+     agents-cli deploy \
+         --project="${PROJECT_ID}" \
+         --region="${REGION}" \
+         "${extra_args[@]}" 2>&1 | tee "${tmp_log}" || adk_exit=$?
+     popd >/dev/null
  ```

### Task 4.3: Add Registry Publish Step
Add a registration step in the deploy script to publish the deployed agent to Gemini Enterprise.
- **Change (Lines 229-234)**:
  ```bash
      if run_adk_deploy "OmniArcade KC Agent" "${SCRIPT_DIR}/agent_kc" "${extra_args[@]}"; then
          KC_AGENT_ID=$(cat "${SCRIPT_DIR}/agent_kc.id" 2>/dev/null || true)
          export KC_AGENT_ID
+         # Publish to Gemini Enterprise Agent Registry
+         pushd "${SCRIPT_DIR}/agent_kc" >/dev/null
+         agents-cli publish gemini-enterprise --project="${PROJECT_ID}" --region="${REGION}" || true
+         popd >/dev/null
      else
  ```

---

## 5. Reference Documentation

Implementors should consult the following resources before and during the refactoring process:

1.  **Vertex AI Agent Platform / Agent Engine Overview**:
    - [GCP Documentation: Overview](https://cloud.google.com/vertex-ai/generative-ai/docs/agent-platform/overview)
2.  **Developing and Deploying Agents**:
    - [GCP Documentation: Build and deploy an agent](https://cloud.google.com/vertex-ai/generative-ai/docs/agent-platform/deploy)
3.  **Agents CLI Reference**:
    - [Agents CLI GitHub repository & manual](https://github.com/google/agents-cli)
4.  **Vertex AI Reasoning Engine API**:
    - [Reasoning Engine Python SDK Reference](https://cloud.google.com/vertex-ai/generative-ai/docs/reasoning-engine/overview)
