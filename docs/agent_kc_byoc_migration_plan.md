# Migration Plan: Deploying agent_kc from Container Image on Gemini Enterprise Agent Platform

This document outlines the goal-oriented migration plan to transition the `agent_kc` deployment process to the **Deploy from Container Image** (Bring Your Own Container - BYOC) workflow on Gemini Enterprise Agent Platform.

All creation and lifecycle updates of the Agent Platform instances will be handled via a Python script utilizing the **Vertex AI SDK for Python** (decoupling the deployment step from Terraform).

---

## 1. Objectives

- **Control over Build Process**: Build and package a custom Docker container containing the agent execution environment, ADK runtime, and system-level/Python dependencies.
- **Low-Latency Builds**: Utilize Docker build caching and registry-based cache imports to minimize compilation time for subsequent builds.
- **SDK-Driven Deployments**: Manage the Agent Platform instance lifecycle (initial creation and subsequent container updates) via a Python deployment script using the Vertex AI Python SDK.

---

## 2. Key Architecture

```
[ Code Change ] 
       │
       ▼
 [ Cloud Build ] ──(Pulls Cache)──► [ Artifact Registry ]
       │                                     ▲
       ▼                                     │
(Builds & Pushes Image) ─────────────────────┘
       │
       ▼
 [ Deploy Job ] ──(Vertex AI Python SDK)──► [ Agent Runtime / Reasoning Engine ]
```

---

## 3. Migration Tasks

### Task 1: Package Agent Application into a Web Server Container
* **Goal**: Create or modify the `Dockerfile` for the `agent_kc` codebase so that it can run as an independent HTTP server.
* **Requirements**:
  - Base the runtime on `python:3.12-slim` to match python runtime versions.
  - Implement Docker layer caching by performing `pip install` on `requirements.txt` early in the build steps, before copying the agent's application code.
  - Expose port `8080` (or respect the `$PORT` environment variable) as expected by the Agent Runtime container environment.
  - Set the container's entrypoint or command to boot an HTTP API server exposing the agent (e.g., using `adk api_server` or running the `AdkApp` application via `uvicorn`).
* **Documentation References**:
  - *Deploy an Agent - Deploy from Container Image*: [Google Cloud Documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/runtime/deploy-an-agent#from-container-image)
  - *Bring Your Own Container (BYOC) Setup*: [Google Cloud BYOC Setup Documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime/setup#byoc)

### Task 2: Configure Cloud Build Pipeline for Image Generation & Caching
* **Goal**: Set up a Google Cloud Build pipeline job responsible only for compiling, caching, and storing the container image.
* **Requirements**:
  - Provision/assert an Artifact Registry Docker repository (e.g. `agent-images` in region `us-central1`).
  - Retrieve the previously built `latest` image from Artifact Registry to act as a cache source during the Docker build stage (`--cache-from`).
  - Build the Docker image with two tags: the unique commit/build SHA and the `latest` tag.
  - Push the generated container images to Artifact Registry.
* **Documentation References**:
  - *Build and push a Docker image with Cloud Build*: [Cloud Build Documentation](https://cloud.google.com/build/docs/build-push-docker-image)

### Task 3: Configure IAM Permissions for Agent Runtime (BYOC)
* **Goal**: Grant necessary IAM roles to the default Reasoning Engine service agent so the runtime is authorized to pull custom container images from Artifact Registry.
* **Requirements**:
  - Resolve the project number for the target deployment project.
  - Grant the **Artifact Registry Reader** (`roles/artifactregistry.reader`) role to the Reasoning Engine default service agent:
    `service-PROJECT_NUMBER@gcp-sa-aiplatform-re.iam.gserviceaccount.com`
  - *(Optional)*: If the Artifact Registry resides in a separate project, grant the **Artifact Registry Reader** role to the Agent Platform service agent:
    `service-PROJECT_NUMBER@gcp-sa-aiplatform.iam.gserviceaccount.com` inside the registry host project.
* **Documentation References**:
  - *Bring your own container (BYOC) - Grant Artifact Registry Reader role*: [Google Cloud setup#reader-role](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime/setup#reader-role)

### Task 4: Deploy & Register Agent Platform Instance via Vertex AI Python SDK
* **Goal**: Automate the creation and updates of the Agent Platform instance using a Python deployment script and the Vertex AI Python SDK.
* **Requirements**:
  - Implement a Python deployment script that initializes the SDK using `google-cloud-aiplatform`.
  - The script should check if the target agent (Reasoning Engine) resource already exists in the project and region.
  - **Recreation/Update**:
    - If the agent does not exist: Create a new Reasoning Engine instance by passing `container_spec` (configured with `image_uri`) and `service_account` parameters to the SDK client creation call.
    - If the agent exists: Call the SDK's update/patch client method targeting the specific reasoning engine resource name with an update mask to update the container specification spec.
  - Extract and store the resulting Reasoning Engine resource ID in a tracking file (e.g. `agent_kc.id`) for persistence and secret storage.
* **Documentation References**:
  - *Deploying from Container Image (Python SDK)*: [Deploy an Agent - Container Image Guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/runtime/deploy-an-agent#from-container-image)
  - *BYOC Notebook Tutorial*: [Google Cloud Generative AI GitHub Notebook](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/agents/agent_engine/tutorial_deploy_your_containerised_agent.ipynb)
  - *Vertex AI Python Client Library Reference*: [google-cloud-aiplatform Reference Documentation](https://cloud.google.com/python/docs/reference/aiplatform/latest)

### Task 5: Remove Agent Platform Resources from Terraform
* **Goal**: Cleanup Terraform code to avoid resource conflicts.
* **Requirements**:
  - Delete the `google_vertex_ai_reasoning_engine` resource block from the Terraform files (e.g., `service.tf`).
  - Ensure other shared backend infrastructure (e.g. BigQuery datasets, telemetry buckets, service accounts, IAM bindings) remains managed by Terraform.
