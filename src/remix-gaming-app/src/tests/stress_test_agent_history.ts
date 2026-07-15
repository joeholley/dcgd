/**
 * Empirical Stress Harness: Agent Response History State & Keys Verification
 */

interface AgentHistoryEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: string;
  agentName?: string;
  reasoningSteps?: string[];
  isStreaming?: boolean;
}

const INITIAL_KC_PROMPT = "Summarize what you can do in 250 words";
const INITIAL_KC_RESPONSE = "I am the Knowledge Catalog (KC) Guided Agent...";
const EXECUTE_RUN_USER_PROMPT = "it seems that many players are dying on a boss...";

function createInitialState(): Record<string, AgentHistoryEntry[]> {
  return {
    "Automated Player Retention Promo": [
      {
        id: "init-prompt-kc",
        role: "user",
        text: INITIAL_KC_PROMPT,
        timestamp: "10:00 AM",
      },
      {
        id: "init-response-kc",
        role: "agent",
        agentName: "agent-kc",
        text: INITIAL_KC_RESPONSE,
        timestamp: "10:00 AM",
      },
    ],
  };
}

// Replicate exact reducer / logic from AgenticWorkflows.tsx handleExecute & completion effect
class AgentHistoryHarness {
  state: Record<string, AgentHistoryEntry[]> = createInitialState();

  handleExecute(id: string) {
    if (id === "Automated Player Retention Promo") {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      // Exact code from Worker 2's fix in AgenticWorkflows.tsx:
      const existing = this.state[id] || [];
      this.state[id] = [
        ...existing,
        {
          id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: "user",
          text: EXECUTE_RUN_USER_PROMPT,
          timestamp: timeStr,
        },
        {
          id: `agt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: "agent",
          agentName: "agent-kc",
          text: "[Evaluating player telemetry & Dataplex guardrail aspect policy...]",
          timestamp: timeStr,
          isStreaming: true,
          reasoningSteps: ["step 1", "step 2"],
        }
      ];
    }
  }

  onCompletion(executingId: string, fullResponseText: string) {
    // Exact code from Worker 2's fix in AgenticWorkflows.tsx:
    const list = (this.state[executingId] || []).map((entry) =>
      entry.isStreaming === true
        ? { ...entry, text: fullResponseText, isStreaming: false }
        : entry
    );
    this.state[executingId] = list;
  }
}

export function runAgentHistoryStressTests() {
  console.log("=== RUNNING STRESS TEST 1: Rapid Clicks Key Collision ===");
  const harness1 = new AgentHistoryHarness();
  
  // Rapidly trigger 5 executions in a single tick (same millisecond)
  for (let i = 0; i < 5; i++) {
    harness1.handleExecute("Automated Player Retention Promo");
  }

  const entries = harness1.state["Automated Player Retention Promo"];
  const keys = entries.map(e => e.id);
  const uniqueKeys = new Set(keys);

  console.log(`Total entries: ${entries.length}`);
  console.log(`Total unique React keys: ${uniqueKeys.size}`);
  
  const hasKeyCollision = uniqueKeys.size < keys.length;
  if (hasKeyCollision) {
    console.error("❌ BUG REPRODUCED: Key collision detected across rapid clicks!");
    const keyCounts: Record<string, number> = {};
    keys.forEach(k => keyCounts[k] = (keyCounts[k] || 0) + 1);
    const duplicates = Object.entries(keyCounts).filter(([_, count]) => count > 1);
    console.error("Duplicate keys:", duplicates);
  } else {
    console.log("✓ No key collisions in single-tick execution.");
  }

  console.log("\n=== RUNNING STRESS TEST 2: Multi-Execution Stranded Streaming Entries ===");
  const harness2 = new AgentHistoryHarness();
  
  // Execution 1 starts
  harness2.handleExecute("Automated Player Retention Promo");
  const agent1Index = harness2.state["Automated Player Retention Promo"].length - 1;

  // Execution 2 starts before Execution 1 completes
  harness2.handleExecute("Automated Player Retention Promo");

  // Execution finishes for current run
  harness2.onCompletion("Automated Player Retention Promo", "Completed response text");

  const history2 = harness2.state["Automated Player Retention Promo"];
  const agent1 = history2[agent1Index];
  const agent2 = history2[history2.length - 1];

  console.log(`Agent 1 text: "${agent1.text}" | isStreaming: ${agent1.isStreaming}`);
  console.log(`Agent 2 text: "${agent2.text}" | isStreaming: ${agent2.isStreaming}`);

  let isCorrupted = false;
  if (agent1.isStreaming === true || agent1.text.includes("[Evaluating")) {
    console.error("❌ BUG REPRODUCED: Execution 1 agent history entry was left stranded in streaming state!");
    isCorrupted = true;
  } else {
    console.log("✓ All previous entries resolved correctly.");
  }

  return { hasKeyCollision, isCorrupted };
}

runAgentHistoryStressTests();
