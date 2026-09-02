/**
 * Centralized Data Source Configuration Resolver (Remix / Express Gateway)
 * 
 * Provides dynamic resolution of BigQuery project ID, dataset location, and
 * fully-qualified table names across Bronze/Silver/Gold layers based on
 * environment variables, preventing schema drift and enabling customizable
 * upstream simulator dataset binding.
 * 
 * NOTE: simulation_parameters is strictly off-limits for application gateways
 * and is intentionally excluded from this configuration.
 */

export interface TableMapping {
  // Source / Ingestion Tables
  sourcePlayerDna: string;
  sourceRawEvents: string;
  sourcePaymentSettlements: string;

  // Silver Conformance Layer
  silverMicrotransactions: string;
  silverMatchSessions: string;
  silverClientSreMetrics: string;
  silverMarketingAttribution: string;
  silverPlayerHistory: string;
  silverModerationAlerts: string;

  // Gold Analytical Marts
  goldStudioFinancial: string;
  goldPlayer360: string;
  goldChurnRootCause: string;
  goldMarketingRoas: string;
  goldRegionalKpis: string;
  goldCheatAnalytics: string;
  goldLevelDifficultyFunnel: string;

  // Reference Configuration & Releases
  refLevelConfigs: string;
  refClientReleases: string;
}

export function getGcpProjectId(): string {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    "datacloudgamesdemo006"
  );
}

export function getBigQueryLocation(): string {
  return (
    process.env.BIGQUERY_LOCATION ||
    process.env.BIGQUERY_DATASET_LOCATION ||
    process.env.GCP_LOCATION ||
    "US"
  );
}

export function getSilverDataset(): string {
  return process.env.BIGQUERY_DATASET_SILVER || "gaming_silver";
}

export function getGoldDataset(): string {
  return process.env.BIGQUERY_DATASET_GOLD || process.env.BIGQUERY_GOLD_DATASET || "gaming_gold";
}

export function getReferenceDataset(): string {
  return process.env.BIGQUERY_DATASET_REFERENCE || "gaming_reference_data";
}

export function getSourceRawEventsTable(): string {
  return (
    process.env.SOURCE_RAW_EVENTS_TABLE ||
    `${getGcpProjectId()}.gaming_raw.raw_events`
  );
}

export function getSourcePlayerDnaTable(): string {
  return (
    process.env.SOURCE_PLAYER_DNA_TABLE ||
    `${getGcpProjectId()}.gaming_player_data.player_dna`
  );
}

export function getSourcePaymentSettlementsTable(): string {
  return (
    process.env.SOURCE_PAYMENT_SETTLEMENTS_TABLE ||
    `${getGcpProjectId()}.gaming_raw.payment_gateway_settlements`
  );
}

export function getTableMapping(): TableMapping {
  const projectId = getGcpProjectId();
  const silverDs = getSilverDataset();
  const goldDs = getGoldDataset();
  const refDs = getReferenceDataset();

  return {
    sourcePlayerDna: getSourcePlayerDnaTable(),
    sourceRawEvents: getSourceRawEventsTable(),
    sourcePaymentSettlements: getSourcePaymentSettlementsTable(),

    silverMicrotransactions: `${projectId}.${silverDs}.silver_microtransactions`,
    silverMatchSessions: `${projectId}.${silverDs}.silver_match_sessions`,
    silverClientSreMetrics: `${projectId}.${silverDs}.silver_client_sre_metrics`,
    silverMarketingAttribution: `${projectId}.${silverDs}.silver_marketing_attribution`,
    silverPlayerHistory: `${projectId}.${silverDs}.silver_player_history`,
    silverModerationAlerts: `${projectId}.${silverDs}.silver_moderation_alerts`,

    goldStudioFinancial: `${projectId}.${goldDs}.gold_studio_financial_performance`,
    goldPlayer360: `${projectId}.${goldDs}.gold_player_360`,
    goldChurnRootCause: `${projectId}.${goldDs}.gold_churn_root_cause_mart`,
    goldMarketingRoas: `${projectId}.${goldDs}.gold_marketing_roas_cohorts`,
    goldRegionalKpis: `${projectId}.${goldDs}.gold_regional_kpis`,
    goldCheatAnalytics: `${projectId}.${goldDs}.gold_cheat_analytics`,
    goldLevelDifficultyFunnel: `${projectId}.${goldDs}.gold_level_difficulty_funnel`,

    refLevelConfigs: `${projectId}.${refDs}.ref_level_configs`,
    refClientReleases: `${projectId}.${refDs}.ref_client_releases`,
  };
}
