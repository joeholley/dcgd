# Deployment & Build Rules

1. **Cloud Run Reserved Env Vars**:
   - Do NOT pass `PORT` in `--set-env-vars` when executing `gcloud run deploy`. Use `--port=<port>` instead.

2. **Dockerfile & Cloud Build Layer Caching**:
   - Copy dependency manifests (`package*.json`, `pyproject.toml`, `requirements.txt`) and run `npm ci` / `pip install` before copying full source code (`COPY src/`).
   - Use `pip install --no-deps` when re-installing local packages after source code copy.
   - In `cloudbuild.yaml`, build, tag, pull, and push intermediate multi-stage builder targets (`:builder`) for `--cache-from` reuse.

3. **BigQuery Dataset Pre-creation**:
   - Ensure `bq mk` is run for all parent datasets prior to running table creation DDL, DML, or Dataform pipelines.

4. **Internal Flask Service Runtime & Cloud Run Container Rules**:
   - **`entrypoint.sh` Startup**: The internal Python Flask service (`gamingdatademo/website-live`) MUST be launched with `gunicorn` (`--worker-class gthread --threads 8 --bind 127.0.0.1:5000 app:app`) inside `entrypoint.sh`. Never launch `python3 website-live/app.py` directly in `entrypoint.sh` as it triggers Werkzeug `debug=True` process forking and single-threaded socket binding collisions in non-TTY containers.
   - **`deploy-demo.sh` Cloud Run Env Vars**: Always pass `PYTHON_PORT=5000` in `--set-env-vars` during `gcloud run deploy`. Use `--port=8080` for the container ingress port (`PORT` is a Cloud Run reserved env var).
   - **`app.py` Environment Sanity**: `debug=False` must be used in `app.run()`. Wrap all `gcloud` CLI subprocess calls in try/except blocks since `gcloud` is not installed in the `python:3.11-slim` runtime container.
   - **Verification Checklist for `entrypoint.sh` & `deploy-demo.sh`**:
     1. Run `bash -n entrypoint.sh && bash -n deploy-demo.sh` to ensure bash syntax validity.
     2. Confirm `entrypoint.sh` uses `gunicorn` for `127.0.0.1:${PYTHON_PORT:-5000}`.
     3. Confirm `deploy-demo.sh` includes `PYTHON_PORT=5000` in `--set-env-vars` and `--port=8080`.
     4. Confirm `server.ts` proxy handlers route embedded iframe views (`/graph_visualization.html`, `/executive.html`, `/difficulty.html`, `/toxicity.html`) to `127.0.0.1:5000`.
