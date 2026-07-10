# Migration Plan: Deploying agent_kc from Container Image (BYOC)

This plan outlines the steps to migrate the deployment process for `agent_kc` to the **Deploy from Container Image** (Bring Your Own Container - BYOC) workflow on Vertex AI Agent Runtime.

It implements a Docker layer caching strategy in Cloud Build to minimize build latency.

---

## Proposed Changes

### Step 1: Update the Dockerfile
We will update [Dockerfile](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_kc/Dockerfile) to:
- Use `python:3.12-slim` to match the python runtime version.
- Expose port `8080` (required by Vertex AI Agent Runtime for container health checks and request routing).
- Serve the agent using `adk api_server app --port 8080`.

#### Proposed Dockerfile:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install standard dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent codebase
COPY . .

# Expose port for Vertex AI Agent Runtime container routing
EXPOSE 8080

# Serve the agent using ADK's built-in API server
CMD ["adk", "api_server", "app", "--port", "8080"]
```

---

### Step 2: Create a Container Deployment Python Script
We will create `src/gamingdatademo/agents/deploy_container.py` to deploy/update the reasoning engine with the custom container image using the `google-cloud-aiplatform` library.

#### Proposed `src/gamingdatademo/agents/deploy_container.py`:
```python
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import sys
from google.cloud import aiplatform_v1beta1 as aiplatform

def main():
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT") or os.environ.get("PROJECT_ID")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    image_uri = os.environ.get("CONTAINER_IMAGE_URI")
    display_name = os.environ.get("AGENT_DISPLAY_NAME", "OmniArcade KC Agent")
    agent_id = os.environ.get("AGENT_ID")
    
    if not project_id or not image_uri:
        print("Error: GOOGLE_CLOUD_PROJECT and CONTAINER_IMAGE_URI env vars are required.", file=sys.stderr)
        sys.exit(1)

    print(f"Initializing Vertex AI Client for project={project_id}, location={location}")
    client_options = {"api_endpoint": f"{location}-aiplatform.googleapis.com"}
    client = aiplatform.ReasoningEngineServiceClient(client_options=client_options)
    
    parent = f"projects/{project_id}/locations/{location}"
    
    container_spec = aiplatform.ReasoningEngineSpec.ContainerSpec(
        image_uri=image_uri,
    )
    
    spec = aiplatform.ReasoningEngineSpec(
        container_spec=container_spec,
    )
    
    reasoning_engine = aiplatform.ReasoningEngine(
        display_name=display_name,
        spec=spec,
    )
    
    if agent_id and agent_id != "None" and agent_id.strip():
        name = f"projects/{project_id}/locations/{location}/reasoningEngines/{agent_id}"
        print(f"Attempting to update existing Reasoning Engine: {name}")
        reasoning_engine.name = name
        
        request = aiplatform.UpdateReasoningEngineRequest(
            reasoning_engine=reasoning_engine,
            update_mask={"paths": ["spec"]},
        )
        try:
            operation = client.update_reasoning_engine(request=request)
            print("Waiting for update operation to complete...")
            response = operation.result()
            new_id = response.name.split("/")[-1]
            print(f"SUCCESS: Updated Reasoning Engine ID: {new_id}")
            with open("agent_kc.id", "w") as f:
                f.write(new_id)
            return
        except Exception as e:
            print(f"Failed to update in-place, creating new Reasoning Engine instance. Detail: {e}")
            reasoning_engine.name = ""

    print(f"Creating new Reasoning Engine resource '{display_name}' with container image: {image_uri}")
    request = aiplatform.CreateReasoningEngineRequest(
        parent=parent,
        reasoning_engine=reasoning_engine,
    )
    operation = client.create_reasoning_engine(request=request)
    print("Waiting for creation operation to complete...")
    response = operation.result()
    new_id = response.name.split("/")[-1]
    print(f"SUCCESS: Created Reasoning Engine ID: {new_id}")
    with open("agent_kc.id", "w") as f:
        f.write(new_id)

if __name__ == "__main__":
    main()
```

---

### Step 3: Update deploy_agents.sh
Modify `deploy_kc` in [deploy_agents.sh](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/deploy_agents.sh) to run the `deploy_container.py` helper script instead of `run_agents_cli_deploy`.

#### Proposed Diff for `deploy_agents.sh`:
```diff
 deploy_kc() {
-    local extra_args=()
-    if [ -n "${KC_AGENT_ID:-}" ]; then
-        echo "  Updating existing agent ID: ${KC_AGENT_ID}"
-        extra_args+=(--agent_engine_id "${KC_AGENT_ID}")
-    fi
-    
-    if run_agents_cli_deploy "OmniArcade KC Agent" "${SCRIPT_DIR}/agent_kc" "${extra_args[@]}"; then
-        KC_AGENT_ID=$(cat "${SCRIPT_DIR}/agent_kc.id" 2>/dev/null || true)
-        export KC_AGENT_ID
-        # Publish to Gemini Enterprise Agent Registry
-        pushd "${SCRIPT_DIR}/agent_kc" >/dev/null
-        agents-cli publish gemini-enterprise --project="${PROJECT_ID}" --region="${REGION}" || true
-        popd >/dev/null
-    else
-        return 1
-    fi
+    echo "=== Deploying OmniArcade KC Agent from Container Image ==="
+    local agent_id_val="${KC_AGENT_ID:-}"
+    
+    export CONTAINER_IMAGE_URI="us-central1-docker.pkg.dev/${PROJECT_ID}/agent-images/agent-kc:latest"
+    export AGENT_ID="${agent_id_val}"
+    export AGENT_DISPLAY_NAME="OmniArcade KC Agent"
+    
+    pip install --quiet "google-cloud-aiplatform>=1.60"
+    python3 "${SCRIPT_DIR}/deploy_container.py"
+    
+    KC_AGENT_ID=$(cat "${SCRIPT_DIR}/agent_kc.id" 2>/dev/null || true)
+    export KC_AGENT_ID
 }
```

---

### Step 4: Update cloudbuild-agents.yaml
Insert container image building, caching, and pushing steps in [cloudbuild-agents.yaml](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/cloudbuild-agents.yaml) before the agent deployment step.

#### Proposed Diff for `cloudbuild-agents.yaml`:
```diff
         }
         CFGEOF
 
+  # ── Step 3.1: Ensure Artifact Registry repository exists ─────────────────
+  - id: create-ar-repo
+    name: gcr.io/cloud-builders/gcloud
+    entrypoint: bash
+    args:
+      - -c
+      - |
+        set -euo pipefail
+        PROJECT_ID=$$(cat /workspace/project_id.txt)
+        gcloud artifacts repositories create agent-images \
+          --project="$$PROJECT_ID" \
+          --repository-format=docker \
+          --location=us-central1 \
+          --description="Docker repository for AI agents" \
+          --quiet || true
+
+  # ── Step 3.2: Configure docker authentication ─────────────────────────────
+  - id: configure-docker-auth
+    name: gcr.io/cloud-builders/gcloud
+    entrypoint: bash
+    args:
+      - -c
+      - |
+        set -euo pipefail
+        PROJECT_ID=$$(cat /workspace/project_id.txt)
+        gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
+
+  # ── Step 3.3: Pull previous image for cache ───────────────────────────────
+  - id: pull-cache
+    name: gcr.io/cloud-builders/docker
+    entrypoint: bash
+    args:
+      - -c
+      - |
+        set -euo pipefail
+        PROJECT_ID=$$(cat /workspace/project_id.txt)
+        docker pull us-central1-docker.pkg.dev/$$PROJECT_ID/agent-images/agent-kc:latest || true
+
+  # ── Step 3.4: Build Docker image using cache ──────────────────────────────
+  - id: build-image
+    name: gcr.io/cloud-builders/docker
+    entrypoint: bash
+    args:
+      - -c
+      - |
+        set -euo pipefail
+        PROJECT_ID=$$(cat /workspace/project_id.txt)
+        IMAGE="us-central1-docker.pkg.dev/$$PROJECT_ID/agent-images/agent-kc"
+        docker build \
+          --cache-from "$$IMAGE:latest" \
+          -t "$$IMAGE:latest" \
+          -t "$$IMAGE:$$COMMIT_SHA" \
+          -f agents/agent_kc/Dockerfile \
+          agents/agent_kc
+
+  # ── Step 3.5: Push Docker image ───────────────────────────────────────────
+  - id: push-image
+    name: gcr.io/cloud-builders/docker
+    entrypoint: bash
+    args:
+      - -c
+      - |
+        set -euo pipefail
+        PROJECT_ID=$$(cat /workspace/project_id.txt)
+        IMAGE="us-central1-docker.pkg.dev/$$PROJECT_ID/agent-images/agent-kc"
+        docker push "$$IMAGE:latest"
+        docker push "$$IMAGE:$$COMMIT_SHA"
+
   # ── Step 4: Deploy agents + persist IDs ─────────────────────────────────
   - id: deploy-agents
```

---

### Step 5: Update Terraform service.tf
Update [service.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/agents/agent_kc/deployment/terraform/single-project/service.tf) to ignore container spec changes, so that subsequently applied Terraform runs do not wipe out our custom container deployment.

#### Proposed Diff for `service.tf`:
```diff
   lifecycle {
     ignore_changes = [
       spec[0].source_code_spec,
+      spec[0].container_spec,
     ]
   }
```
