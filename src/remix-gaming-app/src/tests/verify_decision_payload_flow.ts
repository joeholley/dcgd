import { parseDecisionPayload } from "../components/sections/AgenticWorkflows";
import { 
  broadcastIncomingAgentEvent, 
  getSimulatorState, 
  resetCohortPromos, 
  normalizeCohortId 
} from "../services/simulatorBridge";

const calculateChurnProbability = (ex: { consecutiveDeaths: number; churnEvents: number }): number => {
  const deathWeight = ex.consecutiveDeaths * 0.30;
  const quitWeight = ex.churnEvents * 0.85;
  return Math.round(Math.min(0.99, Math.max(0.05, deathWeight + quitWeight)) * 100) / 100;
};

function runAudit() {
  console.log("=== STARTING REWORKED COHORT DECISION PAYLOAD AUDIT ===");
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, description: string) => {
    if (condition) {
      console.log(`[PASS] ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${description}`);
      failed++;
    }
  };

  // TEST 1: Decision Payload Parser with Reworked Cohort Payload
  const cohortResponseText = `[agent-kc Analysis] Analyzing player telemetry stream for boss death anomalies:
- Identified 4 consecutive wipeouts on 'Frost Giant' boss in Realm of Eldoria RPG.
- Cross-referenced Dataplex Knowledge Catalog entry aspect 'gaming-campaign-policy-aspect' & BQML churn model.

Decision Payload:

{
  "intervention_type": "proactive_churn_offer",
  "sku_id": "frost_giant_shield_pack",
  "discount_percentage": 25.0,
  "target_cohorts": [
    {
      "cohort_id": "Minnow",
      "churn_threshold": 0.85,
      "offer_details": "Compliant discount of 25% applied, as requested 80% exceeds Minnow tier cap (25%)."
    },
    {
      "cohort_id": "F2P",
      "churn_threshold": 0.85,
      "offer_details": "Compliant discount of 25% applied, as requested 80% exceeds F2P tier cap (25%)."
    }
  ],
  "reasoning": "Targeting Minnow and F2P cohorts with high churn probability (>=85%) who encountered difficulty with the Frost Giant Boss. Discount adjusted to comply with tier policy caps (max 25%)."
}`;

  const parsed = parseDecisionPayload(cohortResponseText);
  assert(parsed !== null, "parseDecisionPayload extracts non-null object from cohort response text");
  assert(parsed?.intervention_type === "proactive_churn_offer", "Extracted intervention_type equals 'proactive_churn_offer'");
  assert(parsed?.sku_id === "frost_giant_shield_pack", "Extracted sku_id equals 'frost_giant_shield_pack'");
  assert(parsed?.discount_percentage === 25.0, "Extracted discount_percentage equals 25.0");
  assert(parsed?.target_cohorts.length === 2, "Extracted 2 target cohorts");
  assert(parsed?.target_cohorts[0].cohort_id === "Minnow", "First target cohort equals 'Minnow'");
  assert(parsed?.target_cohorts[1].cohort_id === "F2P", "Second target cohort equals 'F2P'");
  assert(parsed?.target_cohorts[0].churn_threshold === 0.85, "Target cohort churn threshold equals 0.85");

  // TEST 2: Backward compatibility parser check for legacy player-targeted JSON
  const legacyResponseText = `Decision Payload:
{
  "intervention_type": "proactive_churn_offer",
  "sku_id": "frost_giant_shield_pack",
  "discount_percentage": 25.0,
  "target_players": [
    { "player_id": "PLAY-1", "payer_tier": "Minnow", "churn_probability": 0.87 },
    { "player_id": "PLAY-2", "payer_tier": "F2P", "churn_probability": 0.90 }
  ],
  "reasoning": "Legacy test"
}`;
  const parsedLegacy = parseDecisionPayload(legacyResponseText);
  assert(parsedLegacy !== null, "Legacy target_players payload parsed via backward compatibility");
  assert(parsedLegacy?.target_cohorts.length === 2, "Mapped 2 target_players to 2 target_cohorts");

  // TEST 2b: valid_player_tiers and offer_reason payload parsing (prevent React Error #31)
  const validTiersResponseText = `Decision Payload:
{
  "sku_id": "frost_giant_shield_pack",
  "discount_percentage": 25.0,
  "offer_reason": "Excessive wipeouts on Frost Giant boss",
  "valid_player_tiers": ["Minnow", "F2P"]
}`;
  const parsedValidTiers = parseDecisionPayload(validTiersResponseText);
  assert(parsedValidTiers !== null, "valid_player_tiers payload parsed successfully");
  assert(parsedValidTiers?.target_cohorts.length === 2, "Mapped valid_player_tiers array to 2 target_cohorts");
  assert(typeof parsedValidTiers?.reasoning === "string", "reasoning is guaranteed to be a string");
  assert(parsedValidTiers?.reasoning === "Excessive wipeouts on Frost Giant boss", "Extracted offer_reason as reasoning string");

  // TEST 3: Cohort ID normalization
  assert(normalizeCohortId("Minnow") === "Minnow", "normalizeCohortId('Minnow') returns 'Minnow'");
  assert(normalizeCohortId("F2P") === "F2P", "normalizeCohortId('F2P') returns 'F2P'");
  assert(normalizeCohortId("veteran_whale") === "Whale", "normalizeCohortId('veteran_whale') returns 'Whale'");

  // TEST 4: Event Emission & Simulator Bridge Promo State Sync
  resetCohortPromos();
  const stateBefore = getSimulatorState();
  assert(stateBefore.cohortPromos.Minnow.active === false, "Cohort Minnow promo starts inactive");
  assert(stateBefore.cohortPromos.F2P.active === false, "Cohort F2P promo starts inactive");

  const targetTiers = parsed ? parsed.target_cohorts.map(c => c.cohort_id) : [];
  const minChurn = parsed ? Math.min(...parsed.target_cohorts.map(c => c.churn_threshold)) : 0.85;

  broadcastIncomingAgentEvent({
    eventType: "in_game_retention_offer_injected",
    payload: {
      agentId: "Automated Player Retention Promo",
      intervention_type: parsed?.intervention_type,
      target_cohorts: targetTiers,
      sku_id: parsed?.sku_id,
      discount_percentage: parsed?.discount_percentage,
      churn_threshold: minChurn,
      target_cohort_details: parsed?.target_cohorts,
      reasoning: parsed?.reasoning,
      timestamp: Date.now()
    }
  });

  const stateAfter = getSimulatorState();
  assert(stateAfter.cohortPromos.Minnow.active === true, "Minnow cohort promo activated after event broadcast");
  assert(stateAfter.cohortPromos.F2P.active === true, "F2P cohort promo activated after event broadcast");
  assert(stateAfter.cohortPromos.Whale.active === false, "Whale cohort promo remains inactive (not targeted)");
  assert(stateAfter.cohortPromos.Minnow.discountPercentage === 25, "Minnow promo discount percentage set to 25%");
  assert(stateAfter.cohortPromos.Minnow.churnThreshold === 0.85, "Minnow promo churn threshold set to 0.85");

  // TEST 5: Churn Ratio Readout Display Logic
  const sampleExemplar = { consecutiveDeaths: 2, churnEvents: 0 };
  const currentChurnProb = calculateChurnProbability(sampleExemplar); // 2 * 0.30 = 0.60
  const currentChurnPct = (currentChurnProb * 100).toFixed(0);
  const threshPct = (stateAfter.cohortPromos.Minnow.churnThreshold * 100).toFixed(0);
  const ratioReadout = `${currentChurnPct}% / ${threshPct}%`;
  
  assert(currentChurnProb === 0.60, "Calculated exemplar churn probability equals 0.60 (60%)");
  assert(ratioReadout === "60% / 85%", "Ratio readout formats as '60% / 85%'");

  console.log(`\n=== AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
