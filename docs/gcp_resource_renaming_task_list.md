# **Google Cloud Resource Rename & Rebrand - Engineering Task List**

This document plans out the updates required to rename all Google Cloud resources used by the gaming application. The audit spans `src/simulator`, `src/remix-gaming-app`, and `src/gamingdatademo` to inventory resources, identify naming inconsistencies, and enforce a strict renaming policy where all resource names start with the prefix **"gaming-"** (or **"gaming_"** where hyphens are not allowed, such as BigQuery datasets) or **"Gaming "** for display names.

---

## **1. Dataplex Infrastructure & Assets**
Update all occurrences of financial-themed (FSI) naming conventions and align other resource groups to the unified gaming naming system.

- [ ] **Rename Dataplex Entry Groups**:
  - Rename `gaming-atlas-player-telemetry` (ATLAS Player Telemetry Engine) to `gaming-atlas-player-telemetry`.
  - Rename `gaming-fortuna-liveops-store` (FORTUNA LiveOps Store) to `gaming-fortuna-liveops-store`.
  - Rename `gaming-argus-server-analytics` (ARGUS Server Analytics & Risk) to `gaming-argus-server-analytics`.
  - Rename `gaming-apollon-marketing-ops` (APOLLON Campaign Manager) to `gaming-gaming-apollon-marketing-ops`.
  - Rename `gaming-firebase-mobile-analytics` (FIREBASE Mobile Analytics) to `gaming-gaming-firebase-mobile-analytics`.
  - Update resource declarations in:
    - [dataplex-entry-types/main.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/modules/dataplex-entry-types/main.tf#L368-L390)
    - [00_create_dataplex_infra.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/00_create_dataplex_infra.py#L161-L168)
    - [03_create_source_entries.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/03_create_source_entries.py)

- [ ] **Rename Dataplex Aspect Types**:
  - Rebrand global aspect types to start with `gaming-`:
    - `gaming-data-classification` -> `gaming-data-classification`
    - `gaming-data-retention` -> `gaming-data-retention`
    - `gaming-regulatory-compliance` -> `gaming-regulatory-compliance`
    - `gaming-data-lineage-metadata` -> `gaming-data-lineage-metadata`
    - `gaming-access-control` -> `gaming-access-control`
    - `gaming-risk-classification` -> `gaming-risk-classification`
    - `gaming-regulatory-reporting` -> `gaming-regulatory-reporting`
  - Rebrand marker aspect types to start with `gaming-`:
    - `gaming-db2-instance` -> `gaming-gaming-db2-instance`
    - `gaming-db2-schema` -> `gaming-gaming-db2-schema`
    - `gaming-db2-table` -> `gaming-gaming-db2-table`
    - `gaming-temenos-instance` -> `gaming-gaming-temenos-instance`
    - `gaming-temenos-table` -> `gaming-gaming-temenos-table`
    - `gaming-sap-instance` -> `gaming-gaming-sap-instance`
    - `gaming-sap-table` -> `gaming-gaming-sap-table`
  - Update resource declarations and logic in:
    - [dataplex-entry-types/main.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/modules/dataplex-entry-types/main.tf#L222-L363)
    - [00_create_dataplex_infra.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/00_create_dataplex_infra.py#L76-L160)
    - [04_create_aspects.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/04_create_aspects.py)
    - [08_create_churn_guardrail_aspects.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/08_create_churn_guardrail_aspects.py)
    - [server.ts](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/server.ts#L781-L797) (update aspect type names in SSE routing and proxy mappings)
    - [agent.py (Knowledge Catalog Agent)](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_kc/app/agent.py#L127-L144)

- [ ] **Rename Dataplex Business Glossary**:
  - Rename Dataplex Glossary ID `gaming-studios-glossary-us` to `gaming-studios-glossary-us`.
  - Update references in:
    - [common.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/common.py#L39)
    - [12_enrich_glossary.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/12_enrich_glossary.py)
    - [agent.py (Knowledge Catalog Agent)](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_kc/app/agent.py#L416)

- [ ] **Rename Dataplex Rule Library**:
  - Rename `gaming-rule-library-global` to `gaming-rule-library-global`.
  - Update references in:
    - [10_create_rule_library.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/10_create_rule_library.py#L31)

---

## **2. Data Catalog Taxonomy**
Rebrand the column-level data classification taxonomy and tags.

- [ ] **Rename Taxonomy & Policy Tags**:
  - Rename taxonomy `google_data_catalog_taxonomy.gaming_data_classification` with display name `"Gaming Data Classification"` to `"Gaming Data Classification"`.
  - Rebrand policy tags to start with `"Gaming "`:
    - `Highly Sensitive PII` -> `Gaming Highly Sensitive PII`
    - `Sensitive PII` -> `Gaming Sensitive PII`
    - `Confidential Financial` -> `Gaming Confidential Operational`
    - `Internal` -> `Gaming Internal`
  - Update references and resource definitions in:
    - [data-catalog-taxonomy/main.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/modules/data-catalog-taxonomy/main.tf#L24-L51)
    - [16_create_policy_tags.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/16_create_policy_tags.py)

---

## **3. BigQuery Datasets, Tables, Models, & Log Sinks**
Audit and rename analytical datasets, ML models, external connections, and logger sinks. Datasets must use the **"gaming_"** prefix due to hyphens being prohibited in BigQuery dataset IDs.

- [ ] **Rename Medallion Datasets & Tables**:
  - Rename medallion layer datasets to start with `gaming_`:
    - `gaming_telemetry_bronze` -> `gaming_gaming_telemetry_bronze`
    - `gaming_telemetry_silver` -> `gaming_gaming_telemetry_silver`
    - `gaming_telemetry_gold` -> `gaming_gaming_telemetry_gold`
    - `gaming_telemetry_reference` -> `gaming_gaming_telemetry_reference`
    - `gaming_telemetry_dashboards` -> `gaming_gaming_telemetry_dashboards`
    - `gaming_telemetry_scan_results` -> `gaming_gaming_telemetry_scan_results`
    - `gaming_agent_analytics` -> `gaming_gaming_agent_analytics`
  - Update dataset declarations and SQL creations in:
    - [bigquery-medallion/main.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/modules/bigquery-medallion/main.tf#L64-L90)
    - [bigquery-reference/main.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/modules/bigquery-reference/main.tf#L30-L35)
    - [bigquery-dashboards/main.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/modules/bigquery-dashboards/main.tf#L39-L44)
    - [03-bigquery/main.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/stacks/03-bigquery/main.tf)
    - [common.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/common.py#L45-L81) (medallion mappings and dictionary indexes)
    - [app.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/website-live/app.py#L412-L415) (medallion routing mappings)
    - [agent.py (Knowledge Catalog Agent)](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_kc/app/agent.py#L88-L92) (System instructions listing medallion layer datasets)

- [ ] **Rename Legacy Gaming Datasets**:
  - Rename older app datasets:
    - `gaming_raw` -> `gaming_raw`
    - `gaming_gold` -> `gaming_gold`
    - `gaming_silver` -> `gaming_silver`
  - Update references in:
    - [server.ts](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/server.ts) (references in SSE routes, exemplars resolution, and diagnostic loops)
    - [bigquery.ts](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/services/bigquery.ts#L47) (update dataset default `gaming_gold`)
    - [app.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/website-live/app.py) (update dataset queries inside API routes)

- [ ] **Rename BigQuery ML Models**:
  - Rename models to start with `gaming_`:
    - `gaming_raw.gaming_player_churn_model` -> `gaming_gaming_player_churn_model` (under dataset `gaming_silver`)
    - `gaming_gold.gaming_predictive_ltv_model` -> `gaming_gaming_predictive_ltv_model` (under dataset `gaming_gold`)
  - Update SQL references in:
    - [server.ts](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/server.ts#L70) (update default `BQML_MODEL_NAME`)
    - [server.ts](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/server.ts#L975) (LTV model lookup SQL query)
    - [server.ts](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/server.ts#L1189) (Predictive LTV model lookup SQL query)
    - [app.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/website-live/app.py#L990) (Diagnostic model references)

- [ ] **Rename Agent Log Telemetry Datasets, Connections, & Sinks**:
  - Update reasoning engine telemetry configs.
  - Rebrand log sinks: `${var.project_name}-genai-logs` -> `gaming-genai-logs` and `${var.project_name}-feedback` -> `gaming-feedback`
  - Rebrand connection: `${var.project_name}-genai-telemetry` -> `gaming-genai-telemetry`
  - Update definitions in:
    - [telemetry.tf (Agent Basic Terraform)](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_basic/deployment/terraform/single-project/telemetry.tf#L16-L87)
    - Keep sync across all other agents' Terraform folders (`agent_kc`, `agent_scaled`, `marketing_agent_swarm`, `agent_council_sequential`).

---

## **4. Cloud Storage Logs & Telemetry Buckets**
Rename object storage resources holding telemetry logs and container codes.

- [ ] **Rename GCS Buckets**:
  - Rebrand GCS logs buckets to start with `gaming-`: `${var.project_id}-${var.project_name}-logs` -> `gaming-${var.project_id}-logs`
  - Update definitions in:
    - [storage.tf (Agent Basic GCS Bucket)](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_basic/deployment/terraform/single-project/storage.tf#L21)
    - Keep sync across all other agents' GCS Terraform files.

---

## **5. Vertex AI Agent Engine & Artifact Registry**
Audit reasoning engine templates and container deployment metadata.

- [ ] **Rename Deployed Reasoning Engines**:
  - Rename display names to start with `"Gaming "`:
    - `"Gaming Knowledge Catalog Agent"` -> `"Gaming Knowledge Catalog Agent"`
    - `"Gaming Basic Agent"` -> `"Gaming Basic Agent"`
    - `"Gaming Scaled Agent"` -> `"Gaming Scaled Agent"`
    - `"Gaming Marketing Agent Council"` -> `"Gaming Marketing Agent Council"`
    - `"Gaming Sequential Marketing Agent Council"` -> `"Gaming Sequential Marketing Agent Council"`
  - Update reasoning engine display names in:
    - [deploy_agents.sh](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/deploy_agents.sh#L277)
    - [deploy_container.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/deploy_container.py#L39)

- [ ] **Rename Artifact Registry Repositories & Image URIs**:
  - Rename Artifact Registry repository `gaming-agent-images` to `gaming-gaming-agent-images`.
  - Update repository reference inside:
    - [deploy_agents.sh](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/deploy_agents.sh#L316) (update `CONTAINER_IMAGE_URI`)
    - [deploy-demo.sh](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/deploy-demo.sh#L687) (update `AGENT_REPO` description)

---

## **6. Cloud Spanner Graph Database**
Rename relational spanner nodes.

- [ ] **Rename Cloud Spanner Instances & Databases**:
  - Rename Spanner Instance `gaming-spanner-demo` to `gaming-spanner-demo`.
  - Rename Spanner Database `gaming-graph-db` to `gaming-graph-db`.
  - Update connection variables in:
    - [21_deploy_spanner_graph_live.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/21_deploy_spanner_graph_live.py#L25-L26)
    - [22_destroy_spanner_infra.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/22_destroy_spanner_infra.py#L21)
    - [23_generate_graph_visualization.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/scripts/23_generate_graph_visualization.py#L23-L24)

---

## **7. Cloud Run & Submissions Build**
Rename public gateways and container repositories.

- [ ] **Rename Cloud Run Service & Runner SA**:
  - Rename Cloud Run Service `gaming-demo-app` to `gaming-demo-app`.
  - Rename Artifact Registry repository `gaming-demo-images` to `gaming-demo-images`.
  - Rename Runner Service Account `gaming-runner-sa` -> `gaming-runner-sa`.
  - Update references inside:
    - [deploy-demo.sh](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/deploy-demo.sh#L775-L777) (redefine variables `SERVICE_NAME`, `IMAGE_URI`, and `RUNNER_SA`)
    - [cloudbuild.yaml](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/cloudbuild.yaml#L11-L56) (redefine `_REPOSITORY` default substitution)

---

## **8. Pub/Sub Streaming Ingest**
Rename message streaming pipes.

- [ ] **Rename Pub/Sub Topic**:
  - Rename Pub/Sub Topic `gaming-live-telemetry` to `gaming-live-telemetry`.
  - Update logic in:
    - [simulator.py](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/simulator/simulator.py#L48) (default topic environment variables)
    - [server.ts](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/server.ts#L69) (update default `PUBSUB_TOPIC_NAME` fallback)

---

## **9. Service Accounts & IAM bindings**
Rename accounts and roles bindings.

- [ ] **Rename FSI Governance SA**:
  - Rename service account `gaming-governance-sa` to `gaming-governance-sa`.
  - Rename display name `"Gaming Knowledge Catalog Demo Service Account"` to `"Gaming Knowledge Catalog Demo Service Account"`.
  - Update variables and definitions in:
    - [service-account/main.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/modules/service-account/main.tf#L18-L21)

---

## **10. Resources Flagged for Remediation (Cannot start with "gaming-" / "Gaming ")**
Identify resources that have hard limits or built-in specifications that prevent renaming with the custom prefix.

- **Google Cloud Project ID**: The Project ID is defined externally at the billing and organization level. Any resources that must inherit or contain the project ID (such as default Firebase domain urls, e.g. `YOUR_PROJECT_ID.firebaseapp.com`, or default App Engine endpoints) cannot start with `"gaming-"` unless the host GCP Project ID itself is recreated or migrated to one that begins with the `"gaming-"` string.
- **Dataplex System-Defined Entry Groups**: Standard built-in Google Cloud entry groups like `@bigquery` and `@dataplex` are system-managed resources and cannot be renamed or customized with a prefix.
- **Third-Party Integrations**: Comparative industry datasets stored on external platforms, such as Snowflake data (e.g. `NEXUS_MARKET_DATA.SCHEMA.TABLE`), are governed by third-party vendor schemas and cannot be renamed locally with a GCP-style prefix.
