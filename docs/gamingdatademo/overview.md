Listed directory gamingdatademo
Viewed README.md:1-200
Viewed README.md:201-371
Listed directory agents
Listed directory scripts
Listed directory deploy
Listed directory stacks
Listed directory website-live
Listed directory demo
Listed directory snowflake
Listed directory dataform
Listed directory definitions
Listed directory eval
Listed directory adapting-agent

# OmniArcade Gaming Data & Knowledge Catalog Demo Overview

The **[gamingdatademo](../../src/gamingdatademo)** repository provides a full end-to-end data governance, metadata cataloging, and AI agent scaling platform for a hypothetical gaming studio (**OmniArcade**), built on **Google Cloud Platform (GCP)**.

---

## 💡 Executive Summary & Core Purpose

As enterprise data warehouses grow to hundreds of tables across disparate systems, standard LLM agents fail due to prompt window constraints, ambiguous schema selection, and lack of business context (known as the **"Agent Scale Problem"**).

This project demonstrates how **Google Cloud Knowledge Catalog (Dataplex)** combined with **Model Context Protocol (MCP)** enables AI agents to navigate enterprise scale (150+ tables, multiple legacy systems, custom business metrics) effectively.

### The 3-Tier Agent Narrative
1. **Basic Agent**: Knows 5 curated gold tables via static prompts. Works well for basic questions, but lacks scope.
2. **Scaled Agent**: Prompt contains names of 150+ tables. Fails on complex, ambiguous, or cross-domain queries.
3. **KC-Guided Agent**: Connects to **Dataplex Knowledge Catalog** via MCP APIs. Dynamically discovers tables, business glossary definitions, quality scores, and lineage to answer complex cross-domain questions accurately.

---

## 🏗️ Architecture & Technical Stack

```
ATLAS (IBM DB2 Mainframe)        FORTUNA (Temenos T24)       ARGUS (SAP S/4HANA)
 8 Telemetry Tables               3 Store Ops Tables          2 SRE Tables
       │                                 │                          │
       ▼                                 ▼                          ▼
telemetry_bronze (Raw Ingestion / CDC)
       │ Cleansing, Masking PII, Standardization
       ▼
telemetry_silver (Conformed Datasets & Constraints)
       │ Aggregations, Metric Calculations, Joins
       ▼
telemetry_gold (15 Analytics / Feature Tables)
       │
       ├── Business Glossary (80+ terms linked to columns)
       ├── Dataplex Scans & Custom Aspects (Quality, Compliance, Risk)
       └── Knowledge Catalog MCP APIs / REST Context Tools
                  │
                  ▼
         AI Agents (Vertex AI Agent Engine + ADK + Gemini + BigQuery)
```

- **Data Storage**: BigQuery (Bronze, Silver, Gold, Reference, Dashboards) & optional Snowflake integration.
- **Data Transformation & Pipelines**: Dataform & Python automation scripts.
- **Data Governance**: Dataplex Knowledge Catalog, Data Lineage, Custom Aspects, Glossary terms, Data Quality & Scans.
- **AI Agent Framework**: Google Agent Development Kit (`google-adk`), Gemini models, Vertex AI Agent Engine.
- **Web UI**: Flask application (`website-live`) with OAuth 2.0 authentication support deployed to Cloud Run.

---

## 📁 Repository Directory Breakdown

Here is how the codebase is organized:

```
gamingdatademo/
├── agents/             # AI Agents definitions & deployment scripts (Basic, Scaled, KC-Guided)
├── dataform/           # Dataform pipelines for BigQuery medallion tables
├── demo/               # Demonstration questions, notebook comparisons, and scripts
├── deploy/             # Automated GCP deployment scripts (Shell scripts & Terraform integration)
├── eval/               # Automated benchmark evaluation suite for evaluating agent performance
├── modules/            # Reusable Terraform infrastructure modules
├── scripts/            # Python scripts for building Knowledge Catalog assets, glossaries, and aspects
├── snowflake/          # Optional multi-cloud Snowflake integration (NEXUS market data)
├── stacks/             # Terragrunt infrastructure stack configurations
├── website-live/       # Interactive Web UI (Flask app deployed to Cloud Run for agent comparison)
├── BigQuery_Graph_Showcase.ipynb # Jupyter notebook demonstrating BigQuery Graph & Spanner Graph
├── README.md           # Main documentation & runbook
└── pyproject.toml / uv.lock # Python project dependencies managed via uv
```

---

### Detailed Directory Summary

| Directory | Purpose | Key Files / Subdirectories |
| :--- | :--- | :--- |
| **[agents/](../../src/gamingdatademo/agents)** | Implementation of all 3 agent architectures using `google-adk`. | • [deploy_agents.sh](../../src/gamingdatademo/agents/deploy_agents.sh)<br>• [agent_basic/](../../src/gamingdatademo/agents/agent_basic)<br>• [agent_scaled/](../../src/gamingdatademo/agents/agent_scaled)<br>• [agent_kc/](../../src/gamingdatademo/agents/agent_kc) |
| **[scripts/](../../src/gamingdatademo/scripts)** | Python automation to set up Knowledge Catalog, Glossary, Aspects, Lineage & Quality Scans. | • [01_create_glossary.py](../../src/gamingdatademo/scripts/01_create_glossary.py)<br>• [04_create_aspects.py](../../src/gamingdatademo/scripts/04_create_aspects.py)<br>• [07_create_lineage.py](../../src/gamingdatademo/scripts/07_create_lineage.py)<br>• [common.py](../../src/gamingdatademo/scripts/common.py) |
| **[deploy/](../../src/gamingdatademo/deploy)** | Shell scripts for full platform provisioning and tear-down. | • [deploy-full.sh](../../src/gamingdatademo/deploy/deploy-full.sh)<br>• [post_deploy.sh](../../src/gamingdatademo/deploy/post_deploy.sh)<br>• [clean_up.sh](../../src/gamingdatademo/deploy/clean_up.sh) |
| **[dataform/](../../src/gamingdatademo/dataform)** | Dataform SQLX pipeline definitions for generating Bronze/Silver/Gold BigQuery datasets. | • [definitions/](../../src/gamingdatademo/dataform/definitions)<br>• [workflow_settings.yaml](../../src/gamingdatademo/dataform/workflow_settings.yaml) |
| **[website-live/](../../src/gamingdatademo/website-live)** | Flask web UI allowing interactive side-by-side comparison of the three agents. | • [app.py](../../src/gamingdatademo/website-live/app.py)<br>• [Dockerfile](../../src/gamingdatademo/website-live/Dockerfile)<br>• [deploy.sh](../../src/gamingdatademo/website-live/deploy.sh) |
| **[eval/](../../src/gamingdatademo/eval)** | Automated evaluation framework to benchmark agents against standard queries. | • [run_eval.py](../../src/gamingdatademo/eval/run_eval.py)<br>• [test_cases.yaml](../../src/gamingdatademo/eval/test_cases.yaml)<br>• [metrics.py](../../src/gamingdatademo/eval/metrics.py) |
| **[demo/](../../src/gamingdatademo/demo)** | Demo runbooks, test queries across difficulty tiers, and interactive Jupyter notebook. | • [demo_questions.md](../../src/gamingdatademo/demo/demo_questions.md)<br>• [agent_comparison.ipynb](../../src/gamingdatademo/demo/agent_comparison.ipynb) |
| **[stacks/](../../src/gamingdatademo/stacks)** & **[modules/](../../src/gamingdatademo/modules)** | Infrastructure-as-code (Terraform / Terragrunt) for GCP infrastructure. | Foundation, Networking, BigQuery, Dataplex, and Catalog stacks. |
| **[snowflake/](../../src/gamingdatademo/snowflake)** | Multi-cloud setup for integrating external Snowflake datasets into Dataplex catalog. | • [00_setup_nexus_data.py](../../src/gamingdatademo/snowflake/00_setup_nexus_data.py) |