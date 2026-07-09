# Deployment & Build Rules

1. **Cloud Run Reserved Env Vars**:
   - Do NOT pass `PORT` in `--set-env-vars` when executing `gcloud run deploy`. Use `--port=<port>` instead.

2. **Dockerfile & Cloud Build Layer Caching**:
   - Copy dependency manifests (`package*.json`, `pyproject.toml`, `requirements.txt`) and run `npm ci` / `pip install` before copying full source code (`COPY src/`).
   - Use `pip install --no-deps` when re-installing local packages after source code copy.
   - In `cloudbuild.yaml`, build, tag, pull, and push intermediate multi-stage builder targets (`:builder`) for `--cache-from` reuse.

3. **BigQuery Dataset Pre-creation**:
   - Ensure `bq mk` is run for all parent datasets prior to running table creation DDL, DML, or Dataform pipelines.
