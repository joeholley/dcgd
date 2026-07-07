Viewed customers.json:1-34

### How `populate-customer-tables.sql.tftpl` Works

The file [populate-customer-tables.sql.tftpl](../../src/retail-data-and-ai-demo/infrastructure/terraform/bigquery-routines/populate-customer-tables.sql.tftpl) is a **Terraform SQL template** used to create a BigQuery stored procedure (`retail_synthetic.populate_customer_tables`). It takes synthetic identity data (`synthetic_persons`) and creates populated customer profiles with simulated retail order history metrics.

Here is a step-by-step breakdown of how it operates:

#### 1. Terraform Template Interpolation
Terraform replaces place-holder variables enclosed in `${...}` when provisioning the routine in [bigquery-procedure.tf](../../src/retail-data-and-ai-demo/infrastructure/terraform/bigquery-procedure.tf#L45-L49):
* `${persons_table}` $\rightarrow$ Fully qualified name of `retail_synthetic.synthetic_persons`
* `${gcp_customers_table}` $\rightarrow$ Fully qualified name of `retail.customers`
* `${aws_customers_table}` $\rightarrow$ Fully qualified name of `retail_synthetic.aws_customers`

#### 2. Random Data Generation via Temporary UDF (`customer_values()`)
The script defines a temporary SQL function [customer_values()](../../src/retail-data-and-ai-demo/infrastructure/terraform/bigquery-routines/populate-customer-tables.sql.tftpl#L1-L10) that computes synthetic retail metrics for each row:
* **`customer_since_date`**: Subtracted up to ~10,000 days (~27 years) from today.
* **`last_purchase_date`**: Added up to 5,000 days after registration date (capped at current date via `LEAST()`).
* **`ltv`** (Lifetime Value): Generated randomly between `$0.00` and `$5,000.00` using `CAST(rand() * 5000 AS DECIMAL)`.
* **`order_count`**: Generated randomly between 0 and 50 purchases using `CAST(rand() * 50 AS INT64)`.

#### 3. Cross-Cloud Identity Simulation (GCP vs. AWS)
The procedure runs two `INSERT INTO` statements:
* **GCP Customer Table**: Generates IDs prefixed with `customer` (e.g. `customer101`).
* **AWS Customer Table**: Generates IDs prefixed with `user` (e.g. `user101`).

Both tables share identical email addresses generated from `synthetic_persons`, allowing demo users to demonstrate **entity resolution** or data clean rooms across multi-cloud sources by matching on email.

---

### Modifying for Gaming In-App Purchase (IAP) Histories

To convert retail order histories into **Game IAP Histories**, you can track gaming-specific metrics such as player spend tiers (*Whale, Dolphin, Minnow, F2P*), platform (*iOS, Android, PC, Console*), primary purchase categories (*Skins, Battle Pass, Currency Packs, Boosters*), and total IAP transactions.

#### Step 1: Update the BigQuery Schema
Update or replace [customers.json](../../src/retail-data-and-ai-demo/infrastructure/terraform/bigquery-schema/customers.json) with gaming/IAP fields:

```json
[
  { "mode": "REQUIRED", "name": "player_id", "type": "STRING" },
  { "mode": "REQUIRED", "name": "email", "type": "STRING" },
  { "mode": "REQUIRED", "name": "platform", "type": "STRING" },
  { "mode": "REQUIRED", "name": "total_iap_spend", "type": "NUMERIC" },
  { "mode": "REQUIRED", "name": "iap_count", "type": "INTEGER" },
  { "mode": "REQUIRED", "name": "payer_tier", "type": "STRING" },
  { "mode": "REQUIRED", "name": "favorite_category", "type": "STRING" },
  { "mode": "REQUIRED", "name": "last_iap_date", "type": "DATE" },
  { "mode": "REQUIRED", "name": "registration_date", "type": "DATE" }
]
```

#### Step 2: Adapt the SQL Routine Template

Modify [populate-customer-tables.sql.tftpl](../../src/retail-data-and-ai-demo/infrastructure/terraform/bigquery-routines/populate-customer-tables.sql.tftpl) to compute game IAP attributes:

```sql
CREATE TEMP FUNCTION player_iap_values()
RETURNS STRUCT<
  total_iap_spend DECIMAL,
  iap_count INT64,
  payer_tier STRING,
  favorite_category STRING,
  platform STRING,
  registration_date DATE,
  last_iap_date DATE
>
AS (
  (
    WITH base AS (
      SELECT 
        DATE_SUB(CURRENT_DATE(), INTERVAL CAST(rand() * 1000 AS INT64) DAY) AS reg_date,
        -- Generate exponential distribution for spend to simulate realistic gaming spend (Whales vs Minnows)
        CAST(POW(rand(), 4) * 2500 AS DECIMAL) AS spend,
        ["iOS", "Android", "PC", "PlayStation", "Xbox"][OFFSET(CAST(FLOOR(rand() * 5) AS INT64))] AS platform_val,
        ["Battle Pass", "Skins & Cosmetics", "Currency Packs", "Gacha & Loot Boxes", "XP Boosters"][OFFSET(CAST(FLOOR(rand() * 5) AS INT64))] AS cat_val
    )
    SELECT STRUCT(
      spend AS total_iap_spend,
      IF(spend > 0, CAST(1 + rand() * 40 AS INT64), 0) AS iap_count,
      CASE 
        WHEN spend > 500 THEN 'Whale'
        WHEN spend > 50 THEN 'Dolphin'
        WHEN spend > 0 THEN 'Minnow'
        ELSE 'F2P'
      END AS payer_tier,
      cat_val AS favorite_category,
      platform_val AS platform,
      reg_date AS registration_date,
      LEAST(CURRENT_DATE(), DATE_ADD(reg_date, INTERVAL CAST(rand() * 1000 AS INT64) DAY)) AS last_iap_date
    )
    FROM base
  )
);

-- Ingest into primary GCP Game Players dataset
INSERT INTO `${gcp_customers_table}`
  (player_id, email, platform, total_iap_spend, iap_count, payer_tier, favorite_category, last_iap_date, registration_date)
(
  WITH gcp_players AS (
    SELECT 
      CONCAT('player_', CAST(person.person_id AS STRING)) AS player_id,
      person.email AS email,
      player_iap_values() AS stats
    FROM `${persons_table}` person 
    WHERE rand() <= percentage_of_gcp_customers / 100
  )
  SELECT 
    player_id, 
    email, 
    stats.platform, 
    stats.total_iap_spend, 
    stats.iap_count, 
    stats.payer_tier, 
    stats.favorite_category, 
    stats.last_iap_date, 
    stats.registration_date
  FROM gcp_players
);
```

#### Key Enhancements in the Gaming Adaptation:
1. **Power Law / Heavy-Tail Spend Distribution (`POW(rand(), 4)`)**: Reflects real-world gaming economics where a small percentage of players ("Whales") generate most revenue.
2. **Payer Tier Categorization (`Whale`, `Dolphin`, `Minnow`, `F2P`)**: Automatically classifies players based on threshold spending.
3. **Gaming Metadata**: Adds item purchase preference (`Skins`, `Battle Pass`, `Currency Packs`) and platform segmentation (`iOS`, `Android`, `PC`, etc.).