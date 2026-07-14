# Gemini Enterprise Agent Platform & ADK 2.0 Best Practices & Documentation Index

Agents working on this repository MUST consult this guide to locate modern best practices and canonical documentation for the **Gemini Enterprise Agent Platform** and **ADK Python 2.0**. Do not rely on stale pre-2026 training data or legacy Vertex AI interfaces.

---

## 1. Platform Foundations & Agent Architecture (ADK 2.0)

### Condensed Best Practices
- **Framework Standard**: Build agents using **ADK 2.0 Python SDK** (`google-adk[gcp,a2a]>=2.0.0`) with `Agent`, `Runner`, `App`, and session services.
- **Local Testing**: Standardize on `agents-cli playground` for interactive local testing and validation prior to deployment.
- **Container Pre-baking**: Pre-bake dependencies in standardized runner containers to eliminate remote deployment latencies.

### Documentation Mapping
- 📖 **ADK 2.0 Python Framework Fundamentals**: [https://adk.dev/2.0/](https://adk.dev/2.0/)
- 📖 **Agent Platform Architectural Overview**: [https://docs.cloud.google.com/gemini-enterprise-agent-platform/agents](https://docs.cloud.google.com/gemini-enterprise-agent-platform/agents)
- 📖 **Building Runtime Containers**: [https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime)
- 📖 **Deploying Containerized Agents**: [https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/runtime/deploy-an-agent](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/runtime/deploy-an-agent)
- 💡 **Tutorial Reference**: [Part 1: Platform Foundations](https://iromin.medium.com/tutorial-series-gemini-enterprise-agent-platform-part-1-platform-foundations-your-first-4f014ea3517d)

---

## 2. Native Tooling & Dynamic Data Connectivity

### Condensed Best Practices
- **Native FunctionTools Preference**: Implement API connectors as native Python `@FunctionTool` definitions in `app/agent.py` to keep containers self-contained without external binary sidecars.
- **Runtime Search & Context Discovery**: Prioritize dynamic catalog discovery tools (`search_entries`, `get_context`) over hardcoded database schemas.

### Documentation Mapping
- 📖 **ADK 2.0 Python Tools Reference**: [https://adk.dev/2.0/tools/](https://adk.dev/2.0/tools/)
- 📖 **Agent Platform Data Connections & Tools**: [https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime/tools](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime/tools)
- 💡 **Tutorial Reference**: [Part 2: Native Tools & Data](https://medium.com/google-cloud/tutorial-series-gemini-enterprise-agent-platform-part-2-native-tools-and-connecting-to-7e63c1964752)

---

## 3. Scaling Runtime State & Artifact Services

### Condensed Best Practices
- **AdkApp Container Wrapper**: Wrap root agents in `AdkApp` runtime templates (`vertexai.agent_engines.templates.adk.AdkApp`) to handle server lifecycle and operation registration.
- **Artifact Service Management**: Use `GcsArtifactService(bucket_name=...)` when `LOGS_BUCKET_NAME` is provided, falling back to `InMemoryArtifactService` for non-cloud runs.

### Documentation Mapping
- 📖 **ADK 2.0 Artifact Services**: [https://adk.dev/2.0/artifacts/](https://adk.dev/2.0/artifacts/)
- 📖 **Agent Memory & Runtime Scaling**: [https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime/memory](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime/memory)
- 💡 **Tutorial Reference**: [Part 3: Memory & Runtime](https://medium.com/google-cloud/tutorial-series-gemini-enterprise-agent-platform-part-3-scaling-with-agent-runtime-memory-1fe9fe48d829)

---

## 4. Enterprise Governance, IAM & Policy Validation

### Condensed Best Practices
- **Reasoning Engine Service Account IAM**: Grant permissions directly to `service-${PROJECT_NUMBER}@gcp-sa-aiplatform-re.iam.gserviceaccount.com`.
- **Dataplex Metadata Integration**: Embed aspect verification (`verify_aspect_compliance`) and policy checking (`verify_intervention_policy`) directly into agent reasoning steps.

### Documentation Mapping
- 📖 **Security, Service Accounts & IAM**: [https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/runtime/security-iam](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/runtime/security-iam)
- 📖 **Dataplex Asset & Aspect Governance**: [https://docs.cloud.google.com/dataplex/docs](https://docs.cloud.google.com/dataplex/docs)
- 💡 **Tutorial Reference**: [Part 4: Enterprise Governance & Security](https://medium.com/google-cloud/tutorial-series-gemini-enterprise-agent-platform-part-4-enterprise-governance-and-security-575228999bff)

---

## 5. Observability, Telemetry & Evaluation Loop

### Condensed Best Practices
- **Full Payload Capture**: Set `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true` to capture user prompts and model responses alongside tool calls in OpenTelemetry exports.
- **BigQuery Audit Logging**: Enable `BigQueryAgentAnalyticsPlugin` to automatically stream traces to BigQuery analytics tables.
- **Evaluation Iteration Workflow**: Run evaluation loops using `agents-cli eval generate`, `agents-cli eval grade`, and `agents-cli eval compare` before deploying to production.

### Documentation Mapping
- 📖 **ADK 2.0 Evaluation SDK**: [https://adk.dev/2.0/eval/](https://adk.dev/2.0/eval/)
- 📖 **Logging, Tracing & Observability**: [https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/runtime/logging-observability](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/runtime/logging-observability)
- 📖 **Evaluation & Quality Assurance**: [https://docs.cloud.google.com/gemini-enterprise-agent-platform/evaluate](https://docs.cloud.google.com/gemini-enterprise-agent-platform/evaluate)
- 💡 **Tutorial Reference**: [Part 5: Observability & Evaluation](https://medium.com/google-cloud/tutorial-series-gemini-enterprise-agent-platform-part-5-observability-and-evaluation-79c110c38028)
