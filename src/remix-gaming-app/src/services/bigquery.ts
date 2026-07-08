import { BigQuery } from "@google-cloud/bigquery";

// Types for omniarcade_gold Gold Medallion Feature Tables

export interface Player360Record {
  player_id: string;
  username: string;
  spend_tier: 'Whale' | 'Dolphin' | 'Minnow';
  ltv_dollars: number;
  churn_risk_score: number;
  total_playtime_minutes: number;
  total_matches_played: number;
  favorite_game_mode: string;
  device_family: string;
  registered_faction: string;
  last_active_timestamp: string;
  status: string;
}

export interface RegionalKPIRecord {
  region: string;
  country: string;
  dau: number;
  mau: number;
  arpu_dollars: number;
  total_revenue_dollars: number;
  active_sessions: number;
  avg_ping_ms: number;
  updated_at: string;
}

export interface CampaignAnalyticsRecord {
  campaign_id: string;
  campaign_name: string;
  target_segment: string;
  offer_sku: string;
  impressions: number;
  conversions: number;
  conversion_rate: number;
  churn_prevention_rate: number;
  incremental_revenue_dollars: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
}

// Global BigQuery client initialized with Application Default Credentials (ADC)
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'omniarcade-demo';
const datasetId = process.env.BIGQUERY_GOLD_DATASET || 'omniarcade_gold';

const bqClient = new BigQuery({
  projectId,
});

/**
 * Executes a parameterized SQL query against BigQuery with automatic fallback data.
 * Returns null if query fails due to connection or dataset unavailability, allowing
 * caller to distinguish between query failure and an empty result set (0 rows).
 */
export async function executeCustomQuery<T = any>(
  sqlQuery: string,
  params: Record<string, any> = {}
): Promise<T[] | null> {
  try {
    const options = {
      query: sqlQuery,
      params,
      location: process.env.BIGQUERY_LOCATION || process.env.GCP_LOCATION || 'us-central1',
    };
    const [rows] = await bqClient.query(options);
    return (rows as T[]) || [];
  } catch (error) {
    console.warn(`[BigQuery Service] Query execution falling back to simulated gold dataset due to: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Checks live connection to BigQuery for health diagnostics.
 */
export async function checkBigQueryHealth(): Promise<{
  status: 'LIVE' | 'MOCK';
  details: string;
  latency_ms: number;
}> {
  const start = Date.now();
  try {
    const options = {
      query: `SELECT 1 AS alive`,
      location: process.env.BIGQUERY_LOCATION || process.env.GCP_LOCATION || 'us-central1',
    };
    const [rows] = await bqClient.query(options);
    const latency = Date.now() - start;
    if (rows && rows.length > 0) {
      return {
        status: 'LIVE',
        details: `Connected to dataset '${datasetId}' in project '${projectId}'`,
        latency_ms: latency,
      };
    }
    return {
      status: 'MOCK',
      details: 'Query returned empty result; using mock dataset',
      latency_ms: latency,
    };
  } catch (err: any) {
    return {
      status: 'MOCK',
      details: `BigQuery query failed (${err?.message || 'connection error'}); using mock dataset`,
      latency_ms: Date.now() - start,
    };
  }
}

/**
 * Queries gold_player_360 table for executive player 360 profiles.
 */
export async function queryPlayer360(
  playerId?: string,
  limit: number = 20
): Promise<Player360Record[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const query = playerId
    ? `SELECT * FROM \`${projectId}.${datasetId}.gold_player_360\` WHERE player_id = @playerId LIMIT CAST(@limit AS INT64)`
    : `SELECT * FROM \`${projectId}.${datasetId}.gold_player_360\` ORDER BY ltv_dollars DESC LIMIT CAST(@limit AS INT64)`;

  const queryParams: Record<string, any> = { limit: safeLimit };
  if (playerId) queryParams.playerId = playerId;

  try {
    const rows = await executeCustomQuery<Player360Record>(query, queryParams);
    if (rows !== null) {
      return rows;
    }
  } catch (err) {
    console.warn('[BigQuery Service] Fetching fallback gold_player_360 records');
  }

  // Fallback / Dev Mode Data
  const mockData: Player360Record[] = [
    {
      player_id: 'player_cosmic_whale_42',
      username: 'CosmicWhale_42',
      spend_tier: 'Whale',
      ltv_dollars: 1240.50,
      churn_risk_score: 0.87,
      total_playtime_minutes: 4200,
      total_matches_played: 840,
      favorite_game_mode: 'Boss Raid Hardcore',
      device_family: 'iPad Pro',
      registered_faction: 'Solar Alliance',
      last_active_timestamp: new Date().toISOString(),
      status: 'High Churn Intent'
    },
    {
      player_id: 'player_loot_goblin_99',
      username: 'LootGoblinsMax',
      spend_tier: 'Whale',
      ltv_dollars: 980.00,
      churn_risk_score: 0.12,
      total_playtime_minutes: 3600,
      total_matches_played: 710,
      favorite_game_mode: 'PvP Arena',
      device_family: 'PC Desktop',
      registered_faction: 'Deep Space',
      last_active_timestamp: new Date().toISOString(),
      status: 'Active'
    },
    {
      player_id: 'player_hyper_pacer',
      username: 'HyperPacer99',
      spend_tier: 'Dolphin',
      ltv_dollars: 750.25,
      churn_risk_score: 0.45,
      total_playtime_minutes: 2100,
      total_matches_played: 450,
      favorite_game_mode: 'Speed Run',
      device_family: 'iPhone 15 Pro',
      registered_faction: 'Asphalt Kings',
      last_active_timestamp: new Date().toISOString(),
      status: 'Active'
    },
    {
      player_id: 'player_titan_striker',
      username: 'TitanStriker',
      spend_tier: 'Dolphin',
      ltv_dollars: 680.00,
      churn_risk_score: 0.28,
      total_playtime_minutes: 2950,
      total_matches_played: 590,
      favorite_game_mode: 'Guild Warfare',
      device_family: 'Android Pixel 8',
      registered_faction: 'Solar Alliance',
      last_active_timestamp: new Date().toISOString(),
      status: 'Active'
    }
  ];

  return playerId ? mockData.filter(p => p.player_id === playerId) : mockData.slice(0, safeLimit);
}

/**
 * Queries gold_regional_kpis table for global regional gaming metrics.
 */
export async function queryRegionalKPIs(
  region?: string,
  limit: number = 10
): Promise<RegionalKPIRecord[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const query = region
    ? `SELECT * FROM \`${projectId}.${datasetId}.gold_regional_kpis\` WHERE region = @region LIMIT CAST(@limit AS INT64)`
    : `SELECT * FROM \`${projectId}.${datasetId}.gold_regional_kpis\` ORDER BY dau DESC LIMIT CAST(@limit AS INT64)`;

  const queryParams: Record<string, any> = { limit: safeLimit };
  if (region) queryParams.region = region;

  try {
    const rows = await executeCustomQuery<RegionalKPIRecord>(query, queryParams);
    if (rows !== null) {
      return rows;
    }
  } catch (err) {
    console.warn('[BigQuery Service] Fetching fallback gold_regional_kpis records');
  }

  // Fallback / Dev Mode Data
  const mockData: RegionalKPIRecord[] = [
    {
      region: 'North America (us-central1)',
      country: 'USA',
      dau: 485000,
      mau: 1850000,
      arpu_dollars: 5.45,
      total_revenue_dollars: 2643250,
      active_sessions: 42100,
      avg_ping_ms: 18,
      updated_at: new Date().toISOString()
    },
    {
      region: 'East Asia (asia-northeast1)',
      country: 'Japan',
      dau: 620000,
      mau: 2400000,
      arpu_dollars: 6.80,
      total_revenue_dollars: 4216000,
      active_sessions: 58900,
      avg_ping_ms: 12,
      updated_at: new Date().toISOString()
    },
    {
      region: 'Europe West (europe-west1)',
      country: 'Germany',
      dau: 350000,
      mau: 1200000,
      arpu_dollars: 4.90,
      total_revenue_dollars: 1715000,
      active_sessions: 28400,
      avg_ping_ms: 24,
      updated_at: new Date().toISOString()
    }
  ];

  return region ? mockData.filter(r => r.region.toLowerCase().includes(region.toLowerCase())) : mockData.slice(0, safeLimit);
}

/**
 * Queries gold_campaign_analytics table for churn prevention offer performance.
 */
export async function queryCampaignAnalytics(
  campaignId?: string,
  limit: number = 10
): Promise<CampaignAnalyticsRecord[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const query = campaignId
    ? `SELECT * FROM \`${projectId}.${datasetId}.gold_campaign_analytics\` WHERE campaign_id = @campaignId LIMIT CAST(@limit AS INT64)`
    : `SELECT * FROM \`${projectId}.${datasetId}.gold_campaign_analytics\` ORDER BY incremental_revenue_dollars DESC LIMIT CAST(@limit AS INT64)`;

  const queryParams: Record<string, any> = { limit: safeLimit };
  if (campaignId) queryParams.campaignId = campaignId;

  try {
    const rows = await executeCustomQuery<CampaignAnalyticsRecord>(query, queryParams);
    if (rows !== null) {
      return rows;
    }
  } catch (err) {
    console.warn('[BigQuery Service] Fetching fallback gold_campaign_analytics records');
  }

  // Fallback / Dev Mode Data
  const mockData: CampaignAnalyticsRecord[] = [
    {
      campaign_id: 'campaign_frost_giant_guardrail',
      campaign_name: 'Frost Giant Shield Churn Guardrail',
      target_segment: 'High Churn Intent (Whale)',
      offer_sku: 'frost_giant_shield_pack',
      impressions: 1420,
      conversions: 1192,
      conversion_rate: 0.839,
      churn_prevention_rate: 0.912,
      incremental_revenue_dollars: 1180.08,
      status: 'ACTIVE'
    },
    {
      campaign_id: 'campaign_welcome_pack_v2',
      campaign_name: 'New Player VIP Starter Offer',
      target_segment: 'Onboarding (New Players)',
      offer_sku: 'starter_pack_gold',
      impressions: 8500,
      conversions: 3570,
      conversion_rate: 0.420,
      churn_prevention_rate: 0.650,
      incremental_revenue_dollars: 17814.30,
      status: 'ACTIVE'
    }
  ];

  return campaignId ? mockData.filter(c => c.campaign_id === campaignId) : mockData.slice(0, safeLimit);
}
