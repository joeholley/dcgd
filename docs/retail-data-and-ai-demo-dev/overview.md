Listed directory retail-data-and-ai-demo-dev
Listed directory infrastructure
Searched for files: *
Viewed README.md:1-141
Viewed main.tf:1-32
Viewed service-api.tf:1-27
Viewed main.tf:1-33
Viewed bigquery.tf:1-78
Viewed bigquery-procedure.tf:1-79
Viewed generate-persons.sql.tftpl:1-18
Viewed populate-customer-tables.sql.tftpl:1-37

### Project Overview

This repository (**`retail-data-and-ai-demo-dev`**) contains Infrastructure-as-Code (Terraform) and BigQuery stored procedures designed to automatically provision and populate a **Google Cloud Retail Data & AI Demo** environment.

It features an AI-driven synthetic data generation pipeline using **BigQuery AI capabilities (`AI.GENERATE`)** integrated with Vertex AI to dynamically seed realistic retail data (customer profiles, shopping carts, and cross-cloud dataset simulations).

---

### Code Organization & Directory Structure

```
retail-data-and-ai-demo-dev/
├── README.md                           # Setup, deployment, and data population guide
├── infrastructure/                     # All GCP deployment code
│   ├── project-setup/                  # Phase 1: Service API enablement
│   │   ├── main.tf                     # Provider & Terraform configuration
│   │   ├── service-api.tf              # GCP service APIs (BigQuery, Vertex AI, etc.)
│   │   └── variables.tf                # Input variables for project setup
│   └── terraform/                      # Phase 2: Core demo infrastructure setup
│       ├── main.tf                     # Provider configuration
│       ├── variables.tf                # Configurable deployment variables
│       ├── bigquery.tf                 # Datasets (`retail` & `retail_synthetic`) and tables
│       ├── bigquery-procedure.tf       # BigQuery SQL routines deployment
│       ├── bigquery-schema/            # Table JSON schemas
│       │   ├── carts.json              # Shopping cart schema (partitioned & clustered)
│       │   ├── customers.json          # Customer schema
│       │   └── synthetic-person.json   # Base synthetic person schema
│       └── bigquery-routines/          # SQL Terraform templates (`.tftpl`) for routines
│           ├── generate-persons.sql.tftpl            # LLM call via BigQuery `AI.GENERATE`
│           ├── populate-customer-tables.sql.tftpl    # Populates GCP & simulated AWS customers
│           └── generate-carts.sql.tftpl              # Generates synthetic cart entries
```

---

### Breakdown of Core Components

#### 1. API Enablement Module ([project-setup](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/cloud-gtm/retail-data-and-ai-demo-dev/infrastructure/project-setup))
Initial Terraform layer responsible for activating required Google Cloud APIs:
- `bigquery.googleapis.com`
- `aiplatform.googleapis.com` (Vertex AI)
- `discoveryengine.googleapis.com`
- `cloudbuild.googleapis.com` & `iam.googleapis.com`

*Files:* [main.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/cloud-gtm/retail-data-and-ai-demo-dev/infrastructure/project-setup/main.tf), [service-api.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/cloud-gtm/retail-data-and-ai-demo-dev/infrastructure/project-setup/service-api.tf)

#### 2. BigQuery Data Architecture ([bigquery.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/cloud-gtm/retail-data-and-ai-demo-dev/infrastructure/terraform/bigquery.tf))
Provisions two BigQuery datasets:
- **`retail`**: Contains analytical production tables for customer presentation (`customers`, `carts`).
- **`retail_synthetic`**: Contains staging datasets (`synthetic_persons`, `aws_customers`) and stored procedures.

#### 3. AI Data Generation Pipelines ([bigquery-routines](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/cloud-gtm/retail-data-and-ai-demo-dev/infrastructure/terraform/bigquery-routines))
- **Identity Generation** ([generate-persons.sql.tftpl](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/cloud-gtm/retail-data-and-ai-demo-dev/infrastructure/terraform/bigquery-routines/generate-persons.sql.tftpl)): Executes `AI.GENERATE(...)` against Vertex AI endpoint models to synthesize realistic names and emails.
- **Customer Population** ([populate-customer-tables.sql.tftpl](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/cloud-gtm/retail-data-and-ai-demo-dev/infrastructure/terraform/bigquery-routines/populate-customer-tables.sql.tftpl)): Distributes identities between local GCP tables (`customers`) and simulated AWS tables (`aws_customers`) with randomized LTVs and order histories.
- **Cart Generation** ([generate-carts.sql.tftpl](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/cloud-gtm/retail-data-and-ai-demo-dev/infrastructure/terraform/bigquery-routines/generate-carts.sql.tftpl)): Builds shopping cart records associated with generated customers.