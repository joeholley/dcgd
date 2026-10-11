#!/usr/bin/env python3
"""Pre-flight validator for Agentic Data Cloud (dcgd) Cloud Build substitutions and invariants.

Validates:
1. Cloud Build --substitutions keys and values (_GAME_DATASET, _GAME_DATASETS,
   _SOURCE_PLAYER_DNA_TABLE, _SOURCE_RAW_EVENTS_TABLE, _LOCATION, etc.).
2. Discovery Mode detection when no upstream game dataset is provided and
   _ENABLE_LEGACY_DATA_GEN is false.
3. Strict Ground-Truth Air-Gap invariant (rejects any reference to
   simulation_parameters or v_latest_simulation_parameters).
4. Table Drift Immunity (flags deprecated gaming_raw legacy table names when
   legacy mode is disabled).
5. Cloud Run --set-env-vars rules (forbids reserved PORT env var, requires
   PYTHON_PORT=5000).
6. Optional static repository checks (--check-repo-files) verifying entrypoint.sh
   uses gunicorn and dataSourceConfig files respect the simulation_parameters air-gap.
"""

import argparse
import os
import re
import sys
from typing import Dict, List, Tuple

# ============================================================================
# NAMED CONSTANTS (NO MAGIC NUMBERS)
# ============================================================================

KNOWN_SUBSTITUTION_KEYS: Tuple[str, ...] = (
    "_LOCATION",
    "_BIGQUERY_LOCATION",
    "_REPOSITORY",
    "_TAG",
    "_GAME_DATASET",
    "_GAME_DATASETS",
    "_SOURCE_PLAYER_DNA_TABLE",
    "_SOURCE_RAW_EVENTS_TABLE",
    "_SOURCE_PAYMENT_SETTLEMENTS_TABLE",
    "_ENABLE_LEGACY_DATA_GEN",
    "_PUBLISHER_NAME",
)

FORBIDDEN_AIRGAP_IDENTIFIERS: Tuple[str, ...] = (
    "simulation_parameters",
    "v_latest_simulation_parameters",
    "v_simulation_metrics_flattened",
    "v_simulation_run_history",
    "v_player_dna_parameter_history",
)

DEPRECATED_LEGACY_TABLES: Tuple[str, ...] = (
    "gcp_players",
    "synthetic_players",
    "live_session_events",
    "iap_transactions",
    "server_latency",
)

EXPECTED_PYTHON_PORT: str = "5000"
RESERVED_CLOUD_RUN_ENV_KEY: str = "PORT"

BQ_DATASET_REGEX = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,1023}$")
BQ_TABLE_REF_REGEX = re.compile(
    r"^[A-Za-z0-9_-]+(\.[A-Za-z_][A-Za-z0-9_]*){1,2}$"
)

EXIT_OK: int = 0
EXIT_VALIDATION_FAILED: int = 1
EXIT_USAGE_ERROR: int = 2


def parse_key_value_csv(raw_str: str) -> Tuple[Dict[str, str], List[str]]:
    """Parses a comma-separated KEY=VALUE string (supports quoted comma values)."""
    parsed: Dict[str, str] = {}
    errors: List[str] = []

    if not raw_str.strip():
        errors.append("Input key-value string cannot be empty.")
        return parsed, errors

    tokens = re.split(r",(?=[A-Za-z_][A-Za-z0-9_]*=)", raw_str.strip())
    for token in tokens:
        if "=" not in token:
            errors.append(f"Malformed token '{token}': expected KEY=VALUE format.")
            continue
        key, val = token.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        parsed[key] = val

    return parsed, errors


def check_airgap_and_legacy(
    label: str,
    value: str,
    enable_legacy: bool,
    errors: List[str],
    warnings: List[str],
) -> None:
    """Checks a table or dataset reference against air-gap and legacy quarantine rules."""
    lower_val = value.lower()
    for forbidden in FORBIDDEN_AIRGAP_IDENTIFIERS:
        if forbidden in lower_val:
            errors.append(
                f"Ground-Truth Air-Gap violation in {label}='{value}': "
                f"runtime configurations must NEVER reference '{forbidden}'."
            )

    if not enable_legacy:
        for legacy_tbl in DEPRECATED_LEGACY_TABLES:
            if re.search(rf"\b{re.escape(legacy_tbl)}\b", lower_val):
                errors.append(
                    f"Table Drift Immunity violation in {label}='{value}': "
                    f"'{legacy_tbl}' is a deprecated legacy table and _ENABLE_LEGACY_DATA_GEN is false."
                )
        if lower_val == "gaming_raw" or ".gaming_raw." in lower_val or lower_val.startswith("gaming_raw."):
            warnings.append(
                f"{label}='{value}' references legacy dataset 'gaming_raw' while _ENABLE_LEGACY_DATA_GEN is false; "
                f"prefer discovered per-game datasets (e.g., 'gaming_<title>_<id>')."
            )


def validate_substitutions(
    sub_map: Dict[str, str],
) -> Tuple[List[str], List[str], str]:
    """Validates Cloud Build substitution key-value pairs. Returns (errors, warnings, mode_summary)."""
    errors: List[str] = []
    warnings: List[str] = []

    for key in sub_map:
        if not key.startswith("_"):
            errors.append(
                f"Substitution key '{key}' must start with an underscore (e.g., '_GAME_DATASET')."
            )
        elif key not in KNOWN_SUBSTITUTION_KEYS:
            warnings.append(
                f"Unrecognized substitution key '{key}'. Standard keys: {', '.join(KNOWN_SUBSTITUTION_KEYS)}."
            )

    enable_legacy_str = sub_map.get("_ENABLE_LEGACY_DATA_GEN", "false").lower()
    if enable_legacy_str not in ("true", "false"):
        errors.append(
            f"Invalid _ENABLE_LEGACY_DATA_GEN='{sub_map.get('_ENABLE_LEGACY_DATA_GEN')}': must be 'true' or 'false'."
        )
    enable_legacy = enable_legacy_str == "true"

    game_dataset = sub_map.get("_GAME_DATASET", "").strip()
    game_datasets = sub_map.get("_GAME_DATASETS", "").strip()
    raw_events = sub_map.get("_SOURCE_RAW_EVENTS_TABLE", "").strip()
    player_dna = sub_map.get("_SOURCE_PLAYER_DNA_TABLE", "").strip()
    settlements = sub_map.get("_SOURCE_PAYMENT_SETTLEMENTS_TABLE", "").strip()

    if game_dataset:
        if not BQ_DATASET_REGEX.match(game_dataset):
            errors.append(
                f"Invalid _GAME_DATASET='{game_dataset}': must be a valid BigQuery dataset name."
            )
        check_airgap_and_legacy("_GAME_DATASET", game_dataset, enable_legacy, errors, warnings)

    if game_datasets:
        for ds in [d.strip() for d in game_datasets.split(",") if d.strip()]:
            if not BQ_DATASET_REGEX.match(ds):
                errors.append(
                    f"Invalid dataset '{ds}' in _GAME_DATASETS: must be a valid BigQuery dataset name."
                )
            check_airgap_and_legacy("_GAME_DATASETS", ds, enable_legacy, errors, warnings)

    for label, tbl_val in (
        ("_SOURCE_RAW_EVENTS_TABLE", raw_events),
        ("_SOURCE_PLAYER_DNA_TABLE", player_dna),
        ("_SOURCE_PAYMENT_SETTLEMENTS_TABLE", settlements),
    ):
        if tbl_val:
            if not BQ_TABLE_REF_REGEX.match(tbl_val):
                errors.append(
                    f"Invalid {label}='{tbl_val}': expected 'dataset.table' or 'project.dataset.table'."
                )
            check_airgap_and_legacy(label, tbl_val, enable_legacy, errors, warnings)

    if not enable_legacy and not game_dataset and not game_datasets and not raw_events:
        mode_summary = "DISCOVERY_MODE (Step 0 will query INFORMATION_SCHEMA.TABLES, print commands, and exit 1)"
        warnings.append(
            "No _GAME_DATASET, _GAME_DATASETS, or _SOURCE_RAW_EVENTS_TABLE provided with _ENABLE_LEGACY_DATA_GEN=false. "
            "Cloud Build will run in Discovery Mode and exit after printing available datasets."
        )
    elif enable_legacy:
        mode_summary = "LEGACY_DATA_GEN_MODE"
    else:
        target_ds = game_dataset or game_datasets or raw_events
        mode_summary = f"DEPLOY_MODE (target={target_ds})"

    return errors, warnings, mode_summary


def validate_cloud_run_env_vars(env_vars_str: str, enable_legacy: bool) -> Tuple[List[str], List[str]]:
    """Validates a Cloud Run --set-env-vars string against container and air-gap rules."""
    errors: List[str] = []
    warnings: List[str] = []

    env_map, parse_errs = parse_key_value_csv(env_vars_str)
    errors.extend(parse_errs)

    if RESERVED_CLOUD_RUN_ENV_KEY in env_map:
        errors.append(
            "Cloud Run reserved variable violation: 'PORT' must NOT be passed in --set-env-vars; "
            "use '--port=8080' on gcloud run deploy instead."
        )

    if "PYTHON_PORT" not in env_map:
        warnings.append(
            f"Missing 'PYTHON_PORT={EXPECTED_PYTHON_PORT}' in --set-env-vars; "
            f"deploy-demo.sh and cloudbuild.yaml require PYTHON_PORT={EXPECTED_PYTHON_PORT}."
        )
    elif env_map["PYTHON_PORT"] != EXPECTED_PYTHON_PORT:
        warnings.append(
            f"PYTHON_PORT='{env_map['PYTHON_PORT']}' differs from standard internal Flask port ({EXPECTED_PYTHON_PORT})."
        )

    for key, val in env_map.items():
        check_airgap_and_legacy(f"env:{key}", val, enable_legacy, errors, warnings)

    return errors, warnings


def strip_comments_and_docstrings(source_text: str) -> str:
    """Removes triple-quoted Python docstrings, C-style block comments, and single-line comments."""
    cleaned = re.sub(r'"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'', "", source_text)
    cleaned = re.sub(r"/\*[\s\S]*?\*/", "", cleaned)
    cleaned = re.sub(r"(?m)^\s*(#|//).*$", "", cleaned)
    return cleaned


def validate_repo_files(repo_root: str) -> Tuple[List[str], List[str]]:
    """Statically checks entrypoint.sh and dataSourceConfig files for architectural compliance."""
    errors: List[str] = []
    warnings: List[str] = []

    entrypoint_path = os.path.join(repo_root, "entrypoint.sh")
    if not os.path.isfile(entrypoint_path):
        errors.append(f"Missing entrypoint.sh at '{entrypoint_path}'.")
    else:
        with open(entrypoint_path, "r", encoding="utf-8") as f:
            content = f.read()
        if "gunicorn" not in content:
            errors.append("entrypoint.sh must launch the internal Flask service using 'gunicorn'.")
        if re.search(r"python3?\s+.*app\.py", content):
            errors.append(
                "entrypoint.sh must NOT invoke 'python3 app.py' directly (causes Werkzeug debug socket issues)."
            )

    config_rel_paths = (
        "src/remix-gaming-app/src/services/dataSourceConfig.ts",
        "src/gamingdatademo/website-live/data_source_config.py",
    )
    for rel_path in config_rel_paths:
        full_path = os.path.join(repo_root, rel_path)
        if not os.path.isfile(full_path):
            warnings.append(f"Data source config file not found at '{full_path}'.")
            continue
        with open(full_path, "r", encoding="utf-8") as f:
            raw_text = f.read()
        active_code = strip_comments_and_docstrings(raw_text).lower()
        for forbidden in FORBIDDEN_AIRGAP_IDENTIFIERS:
            if forbidden in active_code:
                errors.append(
                    f"Air-Gap violation in {rel_path}: found forbidden identifier '{forbidden}' in active code."
                )

    return errors, warnings


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate dcgd Cloud Build substitutions, Cloud Run env vars, and repository invariants."
    )
    parser.add_argument(
        "--substitutions",
        type=str,
        default=None,
        help="Cloud Build --substitutions string (e.g. '_GAME_DATASET=gaming_foo_123,_LOCATION=us-central1')",
    )
    parser.add_argument(
        "--set-env-vars",
        type=str,
        default=None,
        help="Optional gcloud run deploy --set-env-vars string to validate",
    )
    parser.add_argument(
        "--check-repo-files",
        type=str,
        default=None,
        metavar="REPO_ROOT",
        help="Optional path to dcgd repository root to verify entrypoint.sh and dataSourceConfig files",
    )
    return parser


def main() -> int:
    parser = build_arg_parser()
    try:
        args = parser.parse_args()
    except SystemExit as exc:
        return EXIT_USAGE_ERROR if exc.code != 0 else EXIT_OK

    if (
        args.substitutions is None
        and args.set_env_vars is None
        and args.check_repo_files is None
    ):
        print(
            "[FAIL] Specify at least one of --substitutions, --set-env-vars, or --check-repo-files.",
            file=sys.stderr,
        )
        return EXIT_USAGE_ERROR

    all_errors: List[str] = []
    all_warnings: List[str] = []
    summaries: List[str] = []
    enable_legacy = False

    if args.substitutions is not None:
        sub_map, parse_errs = parse_key_value_csv(args.substitutions)
        all_errors.extend(parse_errs)
        enable_legacy = sub_map.get("_ENABLE_LEGACY_DATA_GEN", "false").lower() == "true"
        sub_errs, sub_warns, mode_summary = validate_substitutions(sub_map)
        all_errors.extend(sub_errs)
        all_warnings.extend(sub_warns)
        summaries.append(f"substitutions={mode_summary}")

    if args.set_env_vars is not None:
        env_errs, env_warns = validate_cloud_run_env_vars(args.set_env_vars, enable_legacy)
        all_errors.extend(env_errs)
        all_warnings.extend(env_warns)
        summaries.append("cloud_run_env_vars=VALIDATED")

    if args.check_repo_files is not None:
        repo_errs, repo_warns = validate_repo_files(args.check_repo_files)
        all_errors.extend(repo_errs)
        all_warnings.extend(repo_warns)
        summaries.append(f"repo_files={os.path.abspath(args.check_repo_files)}")

    for warn in all_warnings:
        print(f"[WARN] {warn}", file=sys.stderr)

    if all_errors:
        for err in all_errors:
            print(f"[FAIL] {err}", file=sys.stderr)
        return EXIT_VALIDATION_FAILED

    print(f"[PASS] dcgd configuration and invariants verified ({', '.join(summaries)}).")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
