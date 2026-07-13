# Architecture & Technical Plan: Synthetic Player & Transaction Generation Refactor

## Executive Summary
This document outlines the refactoring plan for the synthetic player and in-app purchase (IAP) transaction generation routines in BigQuery (`populate_player_tables` and `generate_iap`). The existing routines generated static cohorts with fixed spend values (e.g. 200 Dolphins at $120, 700 F2P at $0, 100 Whales at $750, and 0 Minnows), lacking realistic account age progression, cohort balance, and transaction timing.

The refactored system introduces:
1. **Dynamic Mobile Adoption Curve**: Spreads $y$ total player acquisitions across $x$ weeks (defaults: $y = 250,000$, $x = 6$ weeks) following an industry-standard mobile game adoption curve (peak launch adoption followed by organic baseline decay).
2. **Realistic Cohort & LTV Distribution**: Combines Leviathan/Kraken with Whales and maps Plankton to F2P, allocating player cohorts based on industry benchmarks.
3. **Age-Based Realized LTV Progression**: Models player lifetime spend as a function of account age ($t$), ensuring older players approach full target LTV while recent acquisitions exhibit early-stage spend.
4. **Lifetime Spaced-Out IAP Transactions**: Refactors transaction generation to schedule purchases between a player's `created_at` timestamp and `CURRENT_TIMESTAMP()`, matching realistic onboarding purchase velocity and standardized SKU price points.

---

## 1. Requirement & Parameter Specifications

### Input Parameters
The primary entry-point procedures in Terraform and BigQuery will accept configurable runtime parameters:
- `total_players` ($y$): Total volume of players to populate across the acquisition window (Default: `250,000`).
- `weeks_history` ($x$): Acquisition window duration in weeks prior to current date (Default: `6` weeks).

### Target Cohort Breakdown Matrix

| Cohort Name | Payer Tier (`payer_tier`) | % of Player Base | Typical Monthly Spend | Lifetime Value (LTV) Cap Range | Strategy / Characteristics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Whale** | `Whale` *(Combined Leviathan + Whale)* | **2.5%** *(0.1% Leviathan + 2.4% Whale)* | $50.00 – $1,000+ | **$500 – $10,000+** | High-value spenders; buy high-end progression, cosmetics, and gacha banners. |
| **Dolphin** | `Dolphin` | **12.5%** | $5.00 – $49.99 | **$50 – $500** | Mid-tier spenders; buy battle passes, season packs, and value bundles. |
| **Minnow** | `Minnow` *(Minnow / Shrimp)* | **45.0%** | $0.01 – $4.99 | **$1 – $50** | Light spenders; buy $0.99 - $4.99 starter packs or occasional microtransactions. |
| **F2P** | `F2P` *(Freeloader / Plankton)* | **40.0%** | $0.00 | **$0** | Non-paying baseline; critical for ecosystem, matchmaking, and social reach. |

---

## 2. Adoption Curve & Acquisition Scheduling Model

### Adoption Curve Formula (Modified Bass / Gamma Adoption)
Mobile game launch adoption exhibits a steep acquisition curve: initial launch marketing hype, peak acquisition around weeks 1–2, followed by exponential decay toward a steady organic baseline.

For $x$ total weeks, the relative weekly weight $W(w)$ for week $w \in [1, x]$ (where $w = 1$ is $x$ weeks ago and $w = x$ is the current week) is calculated as:

$$W(w) = (w + 0.5) \cdot e^{-\alpha \cdot (w - 1)}$$

Where $\alpha \approx \frac{2.5}{x}$. Normalized acquisition proportion for week $w$:

$$P(w) = \frac{W(w)}{\sum_{i=1}^x W(i)}$$

Weekly target count $N_w = \text{ROUND}(y \cdot P(w))$, satisfying:

$$\sum_{w=1}^x N_w = y$$

### Acquisition Timestamp Sampling
For a player assigned to week $w$:
- Start offset: $(x - w + 1) \times 7$ days ago.
- End offset: $(x - w) \times 7$ days ago.
- Player `created_at` timestamp is sampled uniformly between `start_offset` and `end_offset`:
$$\text{created\_at} = \text{CURRENT\_TIMESTAMP}() - \text{INTERVAL} \left( \text{end\_offset} + \text{RAND}() \times 7 \right) \text{ DAY}$$

---

## 3. Age-Based Player LTV & Total Spend Model

### Account Age Proportion
Player account age ratio $t_p \in (0, 1]$ is defined as:

$$t_p = \frac{\text{TIMESTAMP\_DIFF}(\text{CURRENT\_TIMESTAMP}(), \text{created\_at}, \text{HOUR})}{x \times 168 \text{ HOURS}}$$

### Cohort LTV Realization Curve
Realized cumulative spend for player $p$ is modeled as a non-linear saturation curve:

$$\text{Target LTV}_p = \text{Sampled LTV Range}(\text{Cohort}_p) \times \text{LogNormal}(\mu=0, \sigma=0.35)$$

$$\text{Realized Spend}_p = \text{Target LTV}_p \cdot \left( 1 - e^{-k \cdot t_p^\beta} \right)$$

- **Minnow / Dolphin**: $k \approx 3.5, \beta \approx 0.8$ (spend early during onboarding).
- **Whale**: $k \approx 2.2, \beta \approx 1.1$ (sustained spend trajectory over multi-week tenure).
- **F2P**: $\text{Realized Spend}_p = 0.00$.

---

## 4. Spaced-Out Transaction Generation Model

### Transaction Frequency & SKU Price Points
For each paying player with $\text{Realized Spend}_p > 0$:

1. **SKU Selection Matrix**:
   - **Minnow**: $0.99, $1.99, $2.99, $4.99
   - **Dolphin**: $4.99, $9.99, $14.99, $24.99, $49.99
   - **Whale**: $19.99, $49.99, $99.99, $199.99

2. **Transaction Spacing (Onboarding Purchase Velocity)**:
   - 60% of transactions occur within the first 14 days of `created_at`.
   - Remaining transactions space out exponentially over player tenure:
   $$\tau_i = \text{created\_at} + (\text{CURRENT\_TIMESTAMP}() - \text{created\_at}) \cdot (u_i)^\gamma$$
   Where $u_i \sim U(0, 1)$ sorted in ascending order and shape factor $\gamma \approx 1.8$.

3. **Exact Reconciled Spend**:
   - Individual transaction amounts $a_1, a_2, \dots, a_k$ are matched to valid price points such that:
   $$\sum_{i=1}^k a_i = \text{ROUND}(\text{Realized Spend}_p, 2)$$

---

## 5. Implementation Roadmap & File Targets

### Affected Repository Files
1. **[games-bigquery-procedure.tf](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/retail-data-and-ai-demo/infrastructure/terraform/games/games-bigquery-procedure.tf#L41-L77)**: Add `weeks_history` parameter to routine signature.
2. **[populate-player-tables.sql.tftpl](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/retail-data-and-ai-demo/infrastructure/terraform/games/games-bigquery-routines/populate-player-tables.sql.tftpl)**: Refactor SQL procedure to compute weekly adoption weights, age-based join dates, and log-normal cohort spend targets.
3. **[generate-iap.sql.tftpl](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/retail-data-and-ai-demo/infrastructure/terraform/games/games-bigquery-routines/generate-iap.sql.tftpl)**: Refactor SQL procedure to schedule spaced transactions across player tenure.
4. **[gold_player_360.sqlx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/gamingdatademo/dataform/definitions/telemetry_gold/gold_player_360.sqlx)**: Verify SQL aggregations and metric consistency across Gold feature tables.

---

## Verification & Acceptance Plan

1. **Cohort Ratio Verification**: Query `payer_tier` distribution in BigQuery; confirm Whales ~2.5%, Dolphins ~12.5%, Minnows ~45%, F2P ~40%.
2. **Adoption Curve Check**: Verify `created_at` weekly distribution follows the peak-and-decay curve across the 6-week window.
3. **Spend & LTV Consistency**: Verify Minnow spend bounds ($0.01 - $50), Dolphin spend bounds ($50 - $500), and Whale spend bounds ($500+).
4. **Transaction Alignment**: Confirm $\text{SUM}(\text{amount\_usd})$ in `iap_transactions` for each player matches `total_iap_spend` in `gcp_players`.
