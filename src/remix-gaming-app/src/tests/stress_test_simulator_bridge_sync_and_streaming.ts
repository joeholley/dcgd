/**
 * Empirical Stress Harness: Simulator Bridge Initial State Sync & Intermediate Streaming State Updates
 * Verifies Target 1 (onSimulatorStateChange initial delivery and state sync)
 * Verifies Target 2 (Intermediate streaming state entries and API resolution updates)
 */

import {
  onSimulatorStateChange,
  broadcastSimulatorState,
  getSimulatorStatePayload,
  SimulatorStatePayload,
  onStreamLogUpdate,
  addStreamLogEntry,
  getStreamLogs,
  clearStreamLogs,
  StreamLogEntry
} from "../services/simulatorBridge";

export interface AgentHistoryEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: string;
  agentName?: string;
  reasoningSteps?: string[];
  isStreaming?: boolean;
}

// Harness for simulating state machine & intermediate streaming entry transitions
class AgentHistoryManager {
  private history: Record<string, AgentHistoryEntry[]> = {};

  getHistory(wfId: string): AgentHistoryEntry[] {
    return this.history[wfId] || [];
  }

  // Phase 1: Create user request + intermediate streaming agent entry
  startExecution(wfId: string, userPrompt: string, thinkingSteps: string[]): { userEntryId: string; agtEntryId: string } {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userEntryId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const agtEntryId = `agt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const userEntry: AgentHistoryEntry = {
      id: userEntryId,
      role: "user",
      text: userPrompt,
      timestamp,
    };

    const streamingEntry: AgentHistoryEntry = {
      id: agtEntryId,
      role: "agent",
      agentName: "agent-kc",
      text: "[Evaluating player telemetry & Dataplex guardrail aspect policy...]",
      timestamp,
      isStreaming: true,
      reasoningSteps: thinkingSteps,
    };

    const existing = this.history[wfId] || [];
    this.history[wfId] = [...existing, userEntry, streamingEntry];

    return { userEntryId, agtEntryId };
  }

  // Phase 2: Resolve API response for the intermediate streaming entry
  resolveApiStream(wfId: string, targetEntryId: string, resolvedText: string): boolean {
    const list = this.history[wfId] || [];
    let updated = false;

    this.history[wfId] = list.map((entry) => {
      if (entry.id === targetEntryId && entry.isStreaming) {
        updated = true;
        return {
          ...entry,
          text: resolvedText,
          isStreaming: false,
        };
      }
      return entry;
    });

    return updated;
  }

  // Fallback / Step Timer Resolution for any remaining streaming entry
  resolveStepCompletion(wfId: string, fullResponseText: string): boolean {
    const list = this.history[wfId] || [];
    let updated = false;

    this.history[wfId] = list.map((entry) => {
      if (entry.isStreaming) {
        updated = true;
        return {
          ...entry,
          text: fullResponseText,
          isStreaming: false,
        };
      }
      return entry;
    });

    return updated;
  }
}

export async function runBridgeAndStreamingStressTests() {
  console.log("==========================================================");
  console.log("TARGET 1: Simulator Bridge Initial State Sync Verification");
  console.log("==========================================================");

  let target1Passed = true;

  // Test 1.1: Immediate Synchronous Delivery on Subscribe
  console.log("\n[Test 1.1] Verifying onSimulatorStateChange immediate initial state delivery on subscribe...");
  
  // Set explicit baseline state
  const initialPayload: SimulatorStatePayload = {
    isRunning: true,
    frequencyHz: 1,
    targetCCU: 250000,
    activeAnomaly: null,
  };
  broadcastSimulatorState(initialPayload);

  let listener1Received: SimulatorStatePayload | null = null;
  let listener1CallCount = 0;

  const unsub1 = onSimulatorStateChange((state) => {
    listener1CallCount++;
    listener1Received = { ...state };
  });

  // Verify callback executed IMMEDIATELY synchronously during subscribe
  if (listener1CallCount === 1 && listener1Received !== null) {
    const rec = listener1Received as SimulatorStatePayload;
    if (rec.isRunning === true && rec.targetCCU === 250000 && rec.activeAnomaly === null) {
      console.log("✓ Immediate delivery on subscribe verified: subscriber received initial state synchronously!");
    } else {
      console.error("❌ Immediate delivery mismatch! Received payload:", listener1Received);
      target1Passed = false;
    }
  } else {
    console.error(`❌ Subscribe failed to trigger synchronously! Call count: ${listener1CallCount}`);
    target1Passed = false;
  }

  // Test 1.2: State update broadcast to existing subscribers
  console.log("\n[Test 1.2] Broadcasting simulator state change to active subscribers...");
  const updatedPayload1: SimulatorStatePayload = {
    isRunning: false,
    frequencyHz: 2,
    targetCCU: 500000,
    activeAnomaly: "high_churn_boss_deaths",
  };
  broadcastSimulatorState(updatedPayload1);

  if (listener1CallCount === 2 && listener1Received !== null) {
    const rec = listener1Received as SimulatorStatePayload;
    if (rec.isRunning === false && rec.targetCCU === 500000 && rec.activeAnomaly === "high_churn_boss_deaths") {
      console.log("✓ Broadcast update received correctly by active subscriber!");
    } else {
      console.error("❌ Broadcast payload mismatch! Received:", listener1Received);
      target1Passed = false;
    }
  } else {
    console.error(`❌ Broadcast failed to trigger listener! Call count: ${listener1CallCount}`);
    target1Passed = false;
  }

  // Test 1.3: Component Mount After Active State Modification
  console.log("\n[Test 1.3] Verifying late subscriber (component mount) receives updated active state immediately on mount...");
  let listener2Received: SimulatorStatePayload | null = null;
  let listener2CallCount = 0;

  const unsub2 = onSimulatorStateChange((state) => {
    listener2CallCount++;
    listener2Received = { ...state };
  });

  if (listener2CallCount === 1 && listener2Received !== null) {
    const rec = listener2Received as SimulatorStatePayload;
    if (rec.isRunning === false && rec.targetCCU === 500000 && rec.activeAnomaly === "high_churn_boss_deaths") {
      console.log("✓ Late subscriber received active modified state on mount instantly!");
    } else {
      console.error("❌ Late subscriber state mismatch! Received:", listener2Received);
      target1Passed = false;
    }
  } else {
    console.error(`❌ Late subscribe failed to call listener synchronously! Call count: ${listener2CallCount}`);
    target1Passed = false;
  }

  // Test 1.4: Unsubscription & Clean-Up Test
  console.log("\n[Test 1.4] Testing listener unsubscription...");
  unsub1(); // Unsubscribe first listener

  const updatedPayload2: SimulatorStatePayload = {
    isRunning: true,
    frequencyHz: 1,
    targetCCU: 300000,
    activeAnomaly: "toxic_chat",
  };
  broadcastSimulatorState(updatedPayload2);

  if (listener1CallCount === 2 && listener2CallCount === 2) {
    console.log("✓ Listener 1 unsubscribed cleanly (call count stayed at 2), Listener 2 received update!");
  } else {
    console.error(`❌ Unsubscribe failed! listener1CallCount: ${listener1CallCount}, listener2CallCount: ${listener2CallCount}`);
    target1Passed = false;
  }

  unsub2(); // Clean up second listener

  // Test 1.5: High Concurrency Subscription Fuzzing (100 listeners, 50 broadcasts)
  console.log("\n[Test 1.5] Running high concurrency subscription stress test (100 listeners x 50 broadcasts)...");
  const numListeners = 100;
  const numBroadcasts = 50;
  const listenerCounts = new Array(numListeners).fill(0);
  const unsubs: Array<() => void> = [];

  for (let i = 0; i < numListeners; i++) {
    const idx = i;
    const unsub = onSimulatorStateChange((_s) => {
      listenerCounts[idx]++;
    });
    unsubs.push(unsub);
  }

  // Every subscriber gets 1 initial call on subscribe
  const allInitialSyncPassed = listenerCounts.every((cnt) => cnt === 1);

  // Perform broadcasts
  for (let b = 0; b < numBroadcasts; b++) {
    broadcastSimulatorState({
      isRunning: b % 2 === 0,
      frequencyHz: 1,
      targetCCU: 100000 + b * 1000,
      activeAnomaly: null,
    });
  }

  const allBroadcastsPassed = listenerCounts.every((cnt) => cnt === 1 + numBroadcasts);

  // Clean up all
  unsubs.forEach((unsub) => unsub());

  if (allInitialSyncPassed && allBroadcastsPassed) {
    console.log(`✓ High-concurrency state sync verified! All ${numListeners} listeners received initial sync + ${numBroadcasts} updates!`);
  } else {
    console.error("❌ High concurrency stress test failed!", { allInitialSyncPassed, allBroadcastsPassed });
    target1Passed = false;
  }

  console.log("\n==================================================================");
  console.log("TARGET 2: Intermediate Streaming Entries & API Resolution Verification");
  console.log("==================================================================");

  let target2Passed = true;

  // Test 2.1: Basic Intermediate Streaming Entry & Resolution Transition
  console.log("\n[Test 2.1] Verifying intermediate streaming entry creation and API resolution...");
  const manager = new AgentHistoryManager();
  const wfId = "Automated Player Retention Promo";
  const userPrompt = "How can you help with boss deaths?";
  const steps = ["step1", "step2"];

  const { agtEntryId } = manager.startExecution(wfId, userPrompt, steps);
  const historyBefore = manager.getHistory(wfId);
  const streamingEntryBefore = historyBefore.find((e) => e.id === agtEntryId);

  if (streamingEntryBefore && streamingEntryBefore.isStreaming === true && streamingEntryBefore.text.includes("[Evaluating")) {
    console.log("✓ Intermediate streaming entry created successfully with isStreaming: true!");
  } else {
    console.error("❌ Failed to create valid intermediate streaming entry:", streamingEntryBefore);
    target2Passed = false;
  }

  // Resolve API stream
  const resolvedText = "Resolved campaign decision text from Vertex AI API";
  const wasUpdated = manager.resolveApiStream(wfId, agtEntryId, resolvedText);
  const historyAfter = manager.getHistory(wfId);
  const streamingEntryAfter = historyAfter.find((e) => e.id === agtEntryId);

  if (wasUpdated && streamingEntryAfter && streamingEntryAfter.isStreaming === false && streamingEntryAfter.text === resolvedText) {
    console.log("✓ Intermediate streaming entry successfully updated upon API resolution (isStreaming flipped to false)!");
  } else {
    console.error("❌ API resolution update failed:", streamingEntryAfter);
    target2Passed = false;
  }

  // Test 2.2: Out-of-Order API Resolutions Across Multiple Concurrent Workflows
  console.log("\n[Test 2.2] Stress testing out-of-order API resolutions across concurrent workflows...");
  const mgr2 = new AgentHistoryManager();
  const execA = mgr2.startExecution("WF_A", "Prompt A", ["stepA"]);
  const execB = mgr2.startExecution("WF_B", "Prompt B", ["stepB"]);

  // Resolve WF_B first
  mgr2.resolveApiStream("WF_B", execB.agtEntryId, "Response B text");
  const histA_mid = mgr2.getHistory("WF_A");
  const histB_mid = mgr2.getHistory("WF_B");

  const wfA_still_streaming = histA_mid.find((e) => e.id === execA.agtEntryId)?.isStreaming === true;
  const wfB_resolved = histB_mid.find((e) => e.id === execB.agtEntryId)?.isStreaming === false;

  if (wfA_still_streaming && wfB_resolved) {
    console.log("✓ Out-of-order resolution handled isolated states correctly!");
  } else {
    console.error("❌ Isolated state failure in out-of-order resolution:", { wfA_still_streaming, wfB_resolved });
    target2Passed = false;
  }

  // Now resolve WF_A
  mgr2.resolveApiStream("WF_A", execA.agtEntryId, "Response A text");
  const histA_final = mgr2.getHistory("WF_A");
  const wfA_resolved = histA_final.find((e) => e.id === execA.agtEntryId)?.isStreaming === false;

  if (wfA_resolved) {
    console.log("✓ Late WF_A resolution completed without issue!");
  } else {
    console.error("❌ Late WF_A resolution failed!");
    target2Passed = false;
  }

  // Test 2.3: Async Latency Fuzzing & Rapid Iterations Stress Test (50 async executions)
  console.log("\n[Test 2.3] Fuzzing 50 rapid streaming executions with random API response delays...");
  const fuzzManager = new AgentHistoryManager();
  const iterations = 50;
  const executionTasks: Array<Promise<boolean>> = [];

  for (let i = 0; i < iterations; i++) {
    const subWfId = `wf-stress-${i % 5}`; // split among 5 workflows
    const { agtEntryId: entryId } = fuzzManager.startExecution(subWfId, `User prompt ${i}`, ["step 1"]);

    const delayMs = Math.floor(Math.random() * 50); // 0-50ms random delay
    const task = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        const ok = fuzzManager.resolveApiStream(subWfId, entryId, `Resolved text for execution ${i}`);
        resolve(ok);
      }, delayMs);
    });

    executionTasks.push(task);
  }

  const results = await Promise.all(executionTasks);
  const allResolvedOk = results.every((res) => res === true);

  // Verify no entries remain stranded in isStreaming: true
  let strandedCount = 0;
  for (let w = 0; w < 5; w++) {
    const subWfId = `wf-stress-${w}`;
    const entries = fuzzManager.getHistory(subWfId);
    strandedCount += entries.filter((e) => e.role === "agent" && e.isStreaming === true).length;
  }

  if (allResolvedOk && strandedCount === 0) {
    console.log(`✓ All 50 rapid streaming requests resolved correctly with 0 stranded entries!`);
  } else {
    console.error(`❌ Fuzzing test failed! allResolvedOk: ${allResolvedOk}, strandedCount: ${strandedCount}`);
    target2Passed = false;
  }

  // Test 2.4: Telemetry Log Streaming Events Verification
  console.log("\n[Test 2.4] Verifying behind-the-scenes stream telemetry log updates...");
  clearStreamLogs();
  let streamLogUpdateCount = 0;
  let latestLogsCaptured: StreamLogEntry[] = [];

  const unsubLogs = onStreamLogUpdate((logs) => {
    streamLogUpdateCount++;
    latestLogsCaptured = logs;
  });

  addStreamLogEntry({
    timestamp: Date.now(),
    direction: "INCOMING",
    eventType: "agent_trace_request",
    transport: "Vertex AI Stream Gateway",
    success: true,
    payload: { prompt: userPrompt, agentId: "agent-kc" }
  });

  addStreamLogEntry({
    timestamp: Date.now(),
    direction: "OUTGOING",
    eventType: "agent_trace_response",
    transport: "Vertex AI Stream Gateway",
    success: true,
    payload: { response: "Campaign approved", isStreaming: false }
  });

  unsubLogs();

  if (streamLogUpdateCount === 2 && latestLogsCaptured.length === 2 && latestLogsCaptured[0].eventType === "agent_trace_response") {
    console.log("✓ Stream telemetry log listener updates verified upon streaming events!");
  } else {
    console.error("❌ Telemetry log update test failed:", { streamLogUpdateCount, logCount: latestLogsCaptured.length });
    target2Passed = false;
  }

  console.log("\n==========================================================");
  console.log("STRESS TEST SUMMARY REPORT");
  console.log("==========================================================");
  console.log(`Target 1 (Simulator Bridge Initial State Sync): ${target1Passed ? "PASSED ✓" : "FAILED ❌"}`);
  console.log(`Target 2 (Intermediate Streaming Entries & Resolution): ${target2Passed ? "PASSED ✓" : "FAILED ❌"}`);

  if (!target1Passed || !target2Passed) {
    throw new Error("One or more stress test targets failed!");
  }

  return { target1Passed, target2Passed };
}

runBridgeAndStreamingStressTests().catch((err) => {
  console.error("Stress test harness error:", err);
  process.exit(1);
});
