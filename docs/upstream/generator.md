# Deterministic Nested Player Population Generator

[![Target: BigQuery](https://img.shields.io/badge/Environment-Google%20BigQuery-blue)](https://cloud.google.com/bigquery)
[![Build: Cloud Build](https://img.shields.io/badge/CI%2FCD-Google%20Cloud%20Build-4285F4)](cloudbuild.yaml)
[![Tests: Passing](https://img.shields.io/badge/Validation-Passing-brightgreen)](tests/test_player_generator.py)

A stateless, procedural population generator built for **Google BigQuery**. It dynamically synthesizes reproducible, high-fidelity player demographics and nested per-genre behavioral profiles without massive static storage overhead.

> [!NOTE]
> ### 🎮 In Plain English: What Does This Do & Why Is It Useful?
> Building large-scale data analytics demos for the gaming industry usually requires generating, storing, and loading massive datasets containing millions of synthetic player profiles. This tool solves that problem by **procedurally generating millions of realistic player profiles directly inside Google BigQuery on demand**.
>
> It lays the foundation for **big data gaming industry demos**—allowing developers, data engineers, and solution architects to simulate realistic player populations (including spending habits, skill tiers, preferred platforms, and game genres) instantly, reliably, and with zero static storage overhead.

---

## 💡 Overview & Architectural Philosophy

Instead of generating and maintaining petabytes of static synthetic player data, this system uses on-the-fly compute. By combining a sequential player index with deterministic pseudo-random hash functions (`FARM_FINGERPRINT`), the exact same player population is generated consistently across executions.

```
                       ┌────────────────────────┐  
                       │    Core Player Table   │  
                       │  (ID, Region, Platform)│  
                       └───────────┬────────────┘  
                                   │  
                                   ▼  
                   ┌────────────────────────────────┐  
                   │ genre_profiles (ARRAY of STRUCTS)  
                   ├────────────────────────────────┤  
                   │  - genre: 'RPG'                │  
                   │  - preference_weight: 0.65     │  
                   │  - skill_tier: 'Diamond'       │  
                   │  - monetization_tier: 'Whale'  │  
                   │  - session_length_mu: 4.1      │  
                   └────────────────────────────────┘
```

### Key Features
* 🚀 **Zero Storage Bloat**: Procedurally compute billions of player profiles on-demand.
* 🛡️ **Mathematical Reproducibility**: 100% reproducible population across environments using deterministic hash seeds.
* 🔀 **Independent Demographics**: Independent random streams decouple Region and Platform assignments.
* 📉 **Variance Preserving Covariance**: Linear combination ($\alpha X_{\text{base}} + \sqrt{1-\alpha^2} Z$) maintains standard normal unit variance ($\sigma \approx 1.0$) across skill and spend probits.
* 🔌 **Telemetry Integration Ready**: Downstream telemetry systems can unnest `genre_profiles` to simulate game events without writing back to the core demographic table.

---

## 📁 Repository Structure

```
.
├── README.md                          # Project documentation
├── Dockerfile                         # Container build definition with layer caching
├── cloudbuild.yaml                    # Google Cloud Build container build pipeline target
├── cloudbuild-runner.yaml             # Google Cloud Build generator execution target
├── run_generator.py                   # Execution script for BigQuery or Python generation
├── .dockerignore                      # Docker context upload exclusions
├── .gcloudignore                      # Google Cloud Build upload exclusions
├── .gitignore                         # Git repository commit exclusions (__pycache__, bytecode, venvs)
├── requirements.txt                   # Python dependencies for build, validation & BigQuery
├── docs/
│   └── player_generator_spec.md       # Full technical specification & math framework
├── infra/
│   └── setup_cloud_build.sh           # Script to enable APIs & configure SA IAM roles (build & run stages)
├── sql/
│   └── generate_player_dna.sql        # Production BigQuery DDL/DML SQL script
└── tests/
    └── test_player_generator.py       # Python validation test suite
```

---

## 🧮 Mathematical Framework

1. **Deterministic PRNG Stream**:
   $$u = \frac{\text{ABS}(\text{FARM\_FINGERPRINT}(\text{seed})) \pmod{10^9} + 0.5}{10^9} \in (0, 1)$$

2. **Inverse Transform Sampling (Probit)**:
   Maps $u \sim \text{Uniform}(0, 1)$ to standard normal random variables $Z \sim N(0, 1)$ using Acklam's algorithm with numerical boundary clamping $[10^{-9}, 1 - 10^{-9}]$ to eliminate `NULL` outputs.

3. **Covariance Model**:
   $$X_{i,g} = \alpha X_{i,\text{base}} + \sqrt{1 - \alpha^2} Z_{i,g}$$
   * **Skill ($\alpha = 0.70$)**: $0.70 X_{\text{base\_skill}} + 0.71414284 Z_{\text{genre\_skill}}$
   * **Spend ($\alpha = 0.60$)**: $0.60 X_{\text{base\_spend}} + 0.80000000 Z_{\text{genre\_spend}}$

4. **Monetization Tiering & F2P Safeguard**:
   * `Whale` ($X > 2.0$), `Dolphin` ($1.2 < X \le 2.0$), `Minnow` ($-0.2 < X \le 1.2$), `F2P` ($X \le -0.2$).
   * Non-spending `F2P` profiles explicitly map `spend_mu = NULL` and `spend_sigma = NULL` to prevent non-zero spend generation downstream.

---

## 🚀 Quick Start

### 1. Run Generator in BigQuery

Execute [generate_player_dna.sql](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/generator/sql/generate_player_dna.sql) in Google BigQuery to create or regenerate the `player_dna` table:

```sql
-- Drops existing table if present and creates/replaces `your_project.your_dataset.player_dna`
-- Generates 2,000,000 deterministic player profiles by default
```

### 2. Extract Downstream Game Profiles

Unnest `genre_profiles` to query specific game populations (e.g. RPG environment):

```sql
SELECT  
  player_id,  
  region,  
  platform,  
  profile.preference_weight,  
  profile.skill_tier,  
  profile.monetization_tier,  
  profile.spend_mu,  
  profile.spend_sigma,  
  profile.session_length_mu,  
  profile.session_length_sigma  
FROM  
  `your_project.your_dataset.player_dna`,  
  UNNEST(genre_profiles) AS profile  
WHERE  
  profile.genre = 'RPG';
```

---

## 🏗️ Google Cloud Build Architecture & Multi-Stage Targets

The repository includes a multi-stage Google Cloud Build setup with two separately triggerable execution targets, each using a dedicated service account:

1. **Stage 1: Container Build Target ([cloudbuild.yaml](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/generator/cloudbuild.yaml))**: Builds and caches the Docker container image (`gcr.io/$PROJECT_ID/player-generator`). Uses builder service account `generator-cloud-build-sa`.
2. **Stage 2: Generator Execution Target ([cloudbuild-runner.yaml](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/generator/cloudbuild-runner.yaml))**: Runs the player population generator script inside Cloud Build against Google BigQuery. Uses dedicated runner service account `generator-runner-sa`.

---

### Layer Caching Architecture
1. **Dependency Layer Separation**: `requirements.txt` is copied and installed in an early Docker layer before application source code.
2. **Fast Incremental Rebuilds**: Modifying `sql/generate_player_dna.sql` or `tests/test_player_generator.py` reuses cached Python dependency layers, reducing build times from minutes to seconds.
3. **Cloud Build Cache**: `cloudbuild.yaml` pulls the latest image (`--cache-from`) prior to building.
4. **Context Optimization**: Both `.dockerignore` and `.gcloudignore` filter out local virtual environments (`.venv/`, `venv/`), cache files (`__pycache__/`, `.pytest_cache/`), and git logs.
5. **Real-Time Terminal Log Streaming**: Standard Cloud Storage build logging allows `gcloud builds submit` to automatically stream build step outputs directly to your terminal console in real-time.

---

### Required Google Cloud APIs

The Cloud Build pipeline stages require the following Google Cloud service APIs:

| Stage | Service API | API Identifier | Purpose |
| :--- | :--- | :--- | :--- |
| **Stage 1 & 2** | **Cloud Build API** | `cloudbuild.googleapis.com` | Executes build workflows, manages build steps, and orchestrates container compilation. |
| **Stage 1** | **Container Registry API** | `containerregistry.googleapis.com` | Manages image indexing and tag storage under `gcr.io`. |
| **Stage 1 & 2** | **Cloud Storage API** | `storage.googleapis.com` | Stores build source context tarballs, build logs, and underlying image layers. |
| **Stage 1** | **Artifact Registry API** | `artifactregistry.googleapis.com` | Modern artifact repository management and image vulnerability scanning. |
| **Stage 2** | **BigQuery API** | `bigquery.googleapis.com` | Product API used by the generator script to compile and execute population queries. |

---

### Dedicated Service Accounts & IAM Roles

Two separate service accounts are configured for strict least-privilege security boundaries:

| Stage | Service Account | Default Name | Assigned IAM Roles | Scope & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1 (Builder)** | `generator-cloud-build-sa` | `generator-cloud-build-sa@$PROJECT_ID.iam.gserviceaccount.com` | `roles/cloudbuild.builds.builder`<br>`roles/artifactregistry.writer`<br>`roles/storage.admin`<br>`roles/storage.objectAdmin`<br>`roles/logging.logWriter` | Compiles Docker layers, runs unit tests, and pushes images to Container Registry. |
| **Stage 2 (Runner)** | `generator-runner-sa` | `generator-runner-sa@$PROJECT_ID.iam.gserviceaccount.com` | `roles/bigquery.jobUser`<br>`roles/bigquery.dataEditor`<br>`roles/artifactregistry.reader`<br>`roles/storage.admin`<br>`roles/storage.objectAdmin`<br>`roles/logging.logWriter` | Executes `run_generator.py` inside Cloud Build to run BigQuery generation jobs. |

---

### 🔧 Automated Infrastructure Provisioning

A utility script is provided in [infra/setup_cloud_build.sh](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/generator/infra/setup_cloud_build.sh) to automatically enable required APIs, provision service accounts, and assign requisite IAM roles. Each stage can be enabled or disabled independently.

```bash
# Make the script executable (if not already set)
chmod +x infra/setup_cloud_build.sh

# Option 1: Provision everything (Stage 1 + Stage 2, default behavior)
./infra/setup_cloud_build.sh

# Option 2: Provision Stage 1 (Container Build) only
./infra/setup_cloud_build.sh --build-only

# Option 3: Provision Stage 2 (Generator Execution) only
./infra/setup_cloud_build.sh --run-only

# Custom project or service account names
PROJECT_ID="your-gcp-project-id" BUILDER_SA_NAME="generator-cloud-build-sa" RUNNER_SA_NAME="generator-runner-sa" ./infra/setup_cloud_build.sh
```

---

### Triggering Cloud Build Targets

```bash
# Single chained command to provision infrastructure, build container, and execute population generator (2M default):
infra/setup_cloud_build.sh && gcloud builds submit --config=cloudbuild.yaml . && gcloud builds submit --config=cloudbuild-runner.yaml .

# Target 1: Build & test container image (Stage 1)
gcloud builds submit --config=cloudbuild.yaml .

# Target 2: Run player generator in Cloud Build (Stage 2)
gcloud builds submit --config=cloudbuild-runner.yaml .

# Target 2 (with custom BigQuery dataset/table/player count substitutions):
gcloud builds submit --config=cloudbuild-runner.yaml --substitutions=_DATASET=gaming_custom_dataset,_TABLE=my_players,_NUM_PLAYERS=5000000 .
```

---

## 🧪 Local Testing & Validation

Run the Python statistical validation test suite:

```bash
python3 tests/test_player_generator.py -v
```

### Test Coverage
* ✅ **Determinism**: 100% bitwise reproducibility across runs.
* ✅ **Demographic Independence**: Chi-square cross-tabulation check across all 12 Region x Platform combinations.
* ✅ **Zero NULL Risk**: Boundary testing guarantees no unexpected `NULL` values.
* ✅ **Covariance & Variance Preservation**: Verifies unit variance ($\sigma \approx 1.0$) and target correlation coefficients ($\alpha = 0.70, 0.60$).
* ✅ **F2P NULL Safeguard**: Verifies `spend_mu` and `spend_sigma` are `None` if and only if tier is `F2P`.
* ✅ **Preference Weight Vector**: Confirms $\sum \text{preference\_weight} = 1.0$ per player.

---

## 📜 License

Internal project - refer to [player_generator_spec.md](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/generator/docs/player_generator_spec.md) for full architectural details.
