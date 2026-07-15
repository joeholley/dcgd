/**
 * Empirical Stress Harness: Data Cloud Telemetry Flow & LIVE vs MOCKED Fallback Behavior Verification
 */

import { 
  getRoutingMode, 
  setRoutingMode, 
  sendSimulatorEvent, 
  getStreamLogs, 
  clearStreamLogs 
} from "../services/simulatorBridge";

export async function runTelemetryFlowStressTests() {
  console.log("=== RUNNING TELEMETRY FLOW STRESS TEST 1: MOCKED Mode Behavior ===");
  clearStreamLogs();
  setRoutingMode("MOCKED");
  console.log(`Current Routing Mode: ${getRoutingMode()}`);

  const mockResult = await sendSimulatorEvent({
    type: "boss_death",
    count: 1,
    payload: { playerDeaths: 4, bossId: "frost_giant" }
  });

  console.log("Mock Event Result:", mockResult);
  const logsMock = getStreamLogs();
  console.log(`Logs recorded in MOCKED mode: ${logsMock.length}`);
  console.log(`Latest log transport: ${logsMock[0]?.transport}`);

  const mockedPassed = mockResult.success === true && 
                       mockResult.mode === "MOCKED" && 
                       logsMock[0]?.transport === "In-Memory BroadcastChannel";

  if (mockedPassed) {
    console.log("✓ MOCKED mode routing and stream log injection verified!");
  } else {
    console.error("❌ MOCKED mode routing test failed!");
  }

  console.log("\n=== RUNNING TELEMETRY FLOW STRESS TEST 2: LIVE Mode Fallback Behavior ===");
  clearStreamLogs();
  setRoutingMode("LIVE");
  console.log(`Current Routing Mode: ${getRoutingMode()}`);

  // In Node environment without running server endpoint, fetch will fail or target missing endpoint
  const liveResult = await sendSimulatorEvent({
    type: "boss_death",
    count: 1,
    payload: { playerDeaths: 4, bossId: "frost_giant" }
  });

  console.log("LIVE Event Result (Offline/No Server):", liveResult);
  const logsLive = getStreamLogs();
  console.log(`Logs recorded in LIVE mode: ${logsLive.length}`);
  console.log(`Latest log transport: ${logsLive[0]?.transport}`);
  console.log(`Latest log success status: ${logsLive[0]?.success}`);
  console.log(`Latest log error message: ${logsLive[0]?.errorMessage}`);

  const liveFallbackPassed = liveResult.success === false && 
                             liveResult.mode === "LIVE" && 
                             logsLive[0]?.success === false &&
                             !!logsLive[0]?.errorMessage;

  if (liveFallbackPassed) {
    console.log("✓ LIVE mode graceful fallback and error log reporting verified!");
  } else {
    console.error("❌ LIVE mode fallback test failed!");
  }

  return { mockedPassed, liveFallbackPassed };
}

runTelemetryFlowStressTests().catch(err => {
  console.error("Test execution failed:", err);
});
