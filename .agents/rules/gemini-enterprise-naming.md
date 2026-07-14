# Gemini Enterprise Agent Platform Naming and Tooling Rules

All agent development, configuration, documentation, deployment scripts, and code implementation across this repository MUST adhere to the following product naming and tooling standards established following the April 23rd, 2026 launch of the [Gemini Enterprise Agent Platform](https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform):

## Mandatory Product Terminology

1. **Use Gemini Enterprise Agent Platform Terminology**:
   - Use **Gemini Enterprise Agent Platform** (or **Agent Engine** / **Agent Runtime**) for hosting, execution, and deployment contexts.
   - Use `agents-cli` and `google-genai` / `google-adk` SDKs and tooling.

2. **Avoid Legacy "Vertex AI" Branding**:
   - Do NOT use the legacy product term **Vertex AI** in user-facing prompts, code comments, documentation, UI strings, or deployment titles.
   - Replace references to "Vertex AI Reasoning Engine" with **Gemini Enterprise Agent Engine** or **Agent Runtime**.
   - Standardize SDK initialization and configuration options around `google-genai` and Gemini Enterprise interfaces.
