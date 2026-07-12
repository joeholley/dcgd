/**
 * Telemetry Routing & Simulator Bridge Service
 * Manages user-controllable LIVE (GCP) vs MOCKED (In-Memory) data routing mode,
 * persistent application state, bidirectional telemetry stream logs,
 * and cross-tab state synchronization via BroadcastChannel.
 */

export type RoutingMode = "LIVE" | "MOCKED";
export type PlayerCohortId = "veteran_whale" | "casual_grinder" | "new_f2p_onboarding";
export type AnomalyType = "none" | "high_churn_boss_deaths" | "level_2_bottleneck" | "toxic_chat";

export interface SimulatorPersistentState {
  routingMode: RoutingMode;
  selectedCohort: PlayerCohortId;
  peakCCU: number;
  activeAnomaly: AnomalyType;
  activeTimezones: {
    apac: boolean;
    emea: boolean;
    na: boolean;
  };
}

export const STORAGE_KEYS = {
  SIMULATOR_STATE: "dcgd_simulator_app_state_v2",
  STREAM_LOGS: "dcgd_simulator_stream_logs_v2",
  ROUTING_MODE_LEGACY: "dcgd_telemetry_routing_mode",
};

export interface StreamLogEntry {
  id: string;
  timestamp: number;
  direction: "OUTGOING" | "INCOMING";
  eventType: string;
  transport: string;
  pubsubTopic?: string;
  gcpConsoleUrl?: string;
  success: boolean;
  errorMessage?: string;
  payload: Record<string, any>;
}

export interface SimulatorTelemetryEvent {
  type: string;
  count?: number;
  userId?: string;
  gameId?: string;
  timestamp?: number;
  payload?: Record<string, any>;
  pubsubTopic?: string;
}

export interface SimulatorStatePayload {
  isRunning: boolean;
  frequencyHz: number;
  targetCCU: number;
  activeAnomaly: string | null;
}

export function buildGcpConsolePubSubUrl(
  topicName: string = "omniarcade-live-telemetry",
  projectId: string = "omniarcade-demo"
): string {
  return `https://console.cloud.google.com/pubsub/topics/${topicName}?project=${projectId}`;
}

const DEFAULT_STATE: SimulatorPersistentState = {
  routingMode: "MOCKED",
  selectedCohort: "veteran_whale",
  peakCCU: 14280,
  activeAnomaly: "none",
  activeTimezones: {
    apac: true,
    emea: true,
    na: true,
  },
};

const CHANNEL_NAME = "omniarcade_simulator_channel";

// Load persistent state from localStorage
function loadInitialState(): SimulatorPersistentState {
  if (typeof localStorage === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIMULATOR_STATE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        routingMode: parsed.routingMode === "LIVE" ? "LIVE" : "MOCKED",
        selectedCohort: ["veteran_whale", "casual_grinder", "new_f2p_onboarding"].includes(parsed.selectedCohort)
          ? parsed.selectedCohort
          : "veteran_whale",
        peakCCU: typeof parsed.peakCCU === "number" ? parsed.peakCCU : 14280,
        activeAnomaly: ["none", "high_churn_boss_deaths", "level_2_bottleneck", "toxic_chat"].includes(parsed.activeAnomaly)
          ? parsed.activeAnomaly
          : "none",
        activeTimezones: {
          apac: parsed.activeTimezones?.apac ?? true,
          emea: parsed.activeTimezones?.emea ?? true,
          na: parsed.activeTimezones?.na ?? true,
        },
      };
    }
  } catch (e) {
    console.warn("Failed to parse simulator persistent state:", e);
  }
  return { ...DEFAULT_STATE };
}

let currentState: SimulatorPersistentState = loadInitialState();

// Load initial stream logs
function loadInitialLogs(): StreamLogEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STREAM_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Failed to parse stream logs:", e);
  }
  return [];
}

let currentLogs: StreamLogEntry[] = loadInitialLogs();

// Listeners
const stateListeners: Set<(state: SimulatorPersistentState) => void> = new Set();
const modeListeners: Set<(mode: RoutingMode) => void> = new Set();
const eventListeners: Set<(event: SimulatorTelemetryEvent) => void> = new Set();
const logListeners: Set<(logs: StreamLogEntry[]) => void> = new Set();
const simStatePayloadListeners: Set<(payload: SimulatorStatePayload) => void> = new Set();

// Initialize BroadcastChannel
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    console.warn("BroadcastChannel not supported in current environment", e);
  }
}

if (broadcastChannel) {
  broadcastChannel.onmessage = (msgEvent) => {
    if (!msgEvent.data) return;
    const { type, state, mode, telemetryEvent, logs, simStatePayload } = msgEvent.data;
    if (type === "STATE_CHANGE" && state) {
      currentState = state;
      notifyStateListeners();
    } else if (type === "MODE_CHANGE" && mode) {
      currentState.routingMode = mode;
      notifyStateListeners();
    } else if (type === "TELEMETRY_EVENT" && telemetryEvent) {
      eventListeners.forEach((fn) => fn(telemetryEvent));
    } else if (type === "LOGS_UPDATE" && Array.isArray(logs)) {
      currentLogs = logs;
      notifyLogListeners();
    } else if (type === "SIMULATOR_STATE_CHANGE" && simStatePayload) {
      simStatePayloadListeners.forEach((fn) => fn(simStatePayload));
    }
  };
}

function saveState() {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEYS.SIMULATOR_STATE, JSON.stringify(currentState));
      localStorage.setItem(STORAGE_KEYS.ROUTING_MODE_LEGACY, currentState.routingMode);
    } catch (e) {
      console.warn("Error saving simulator state:", e);
    }
  }
}

function saveLogs() {
  if (typeof localStorage !== "undefined") {
    try {
      // Keep up to 150 log entries to avoid quota issues
      const trimmed = currentLogs.slice(-150);
      localStorage.setItem(STORAGE_KEYS.STREAM_LOGS, JSON.stringify(trimmed));
    } catch (e) {
      console.warn("Error saving stream logs:", e);
    }
  }
}

function notifyStateListeners() {
  saveState();
  stateListeners.forEach((fn) => fn(currentState));
  modeListeners.forEach((fn) => fn(currentState.routingMode));
}

function notifyLogListeners() {
  saveLogs();
  logListeners.forEach((fn) => fn(currentLogs));
}

// State Exported APIs
export function getSimulatorState(): SimulatorPersistentState {
  return currentState;
}

export function updateSimulatorState(updates: Partial<SimulatorPersistentState>): SimulatorPersistentState {
  currentState = {
    ...currentState,
    ...updates,
    activeTimezones: {
      ...currentState.activeTimezones,
      ...(updates.activeTimezones || {}),
    },
  };
  notifyStateListeners();
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "STATE_CHANGE", state: currentState });
  }
  return currentState;
}

export function onSimulatorStateUpdate(listener: (state: SimulatorPersistentState) => void): () => void {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

export function getRoutingMode(): RoutingMode {
  return currentState.routingMode;
}

export function setRoutingMode(mode: RoutingMode): void {
  updateSimulatorState({ routingMode: mode });
}

export function onRoutingModeChange(listener: (mode: RoutingMode) => void): () => void {
  modeListeners.add(listener);
  return () => {
    modeListeners.delete(listener);
  };
}

export function onSimulatorEvent(listener: (event: SimulatorTelemetryEvent) => void): () => void {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

export function onSimulatorStateChange(listener: (state: SimulatorStatePayload) => void): () => void {
  simStatePayloadListeners.add(listener);
  return () => {
    simStatePayloadListeners.delete(listener);
  };
}

export function broadcastSimulatorState(payload: SimulatorStatePayload): void {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "SIMULATOR_STATE_CHANGE", simStatePayload: payload });
  }
  simStatePayloadListeners.forEach((fn) => fn(payload));
}

// Log Exported APIs
export function getStreamLogs(): StreamLogEntry[] {
  return currentLogs;
}

export function addStreamLogEntry(entry: Omit<StreamLogEntry, "id">): StreamLogEntry {
  const newEntry: StreamLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    ...entry,
  };
  currentLogs = [...currentLogs, newEntry];
  notifyLogListeners();
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "LOGS_UPDATE", logs: currentLogs });
  }
  return newEntry;
}

export function clearStreamLogs(): void {
  currentLogs = [];
  notifyLogListeners();
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "LOGS_UPDATE", logs: currentLogs });
  }
}

export function onStreamLogUpdate(listener: (logs: StreamLogEntry[]) => void): () => void {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
}

export function broadcastIncomingAgentEvent(event: { eventType: string; payload: Record<string, any> }): void {
  const topicName = "omniarcade-live-telemetry";
  addStreamLogEntry({
    timestamp: Date.now(),
    direction: "INCOMING",
    eventType: event.eventType,
    transport: currentState.routingMode === "LIVE" ? "Vertex AI / Cloud PubSub" : "In-Memory Channel",
    pubsubTopic: topicName,
    gcpConsoleUrl: buildGcpConsolePubSubUrl(topicName),
    success: true,
    payload: event.payload,
  });
}

/**
 * Sends a telemetry event through either LIVE (GCP backend) or MOCKED (in-memory BroadcastChannel)
 */
export async function sendSimulatorEvent(event: SimulatorTelemetryEvent): Promise<{ success: boolean; mode: RoutingMode; data?: any }> {
  const mode = currentState.routingMode;
  const timestamp = event.timestamp || Date.now();
  const pubsubTopic = event.pubsubTopic || "omniarcade-live-telemetry";
  const gcpConsoleUrl = buildGcpConsolePubSubUrl(pubsubTopic);

  const payload = {
    ...event,
    timestamp,
    cohortId: currentState.selectedCohort,
    routingMode: mode,
  };

  // Local broadcast
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "TELEMETRY_EVENT", telemetryEvent: payload });
  }
  eventListeners.forEach((fn) => fn(payload));

  if (mode === "LIVE") {
    try {
      const response = await fetch("/api/telemetry/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      addStreamLogEntry({
        timestamp,
        direction: "OUTGOING",
        eventType: event.type,
        transport: "Cloud Pub/Sub HTTP Gateway",
        pubsubTopic,
        gcpConsoleUrl,
        success: true,
        payload: {
          ...payload,
          ...data,
        },
      });

      return { success: true, mode: "LIVE", data };
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      addStreamLogEntry({
        timestamp,
        direction: "OUTGOING",
        eventType: event.type,
        transport: "Cloud Pub/Sub HTTP Gateway",
        pubsubTopic,
        gcpConsoleUrl,
        success: false,
        errorMessage: errMsg,
        payload: {
          ...payload,
          error: errMsg,
        },
      });

      return { success: false, mode: "LIVE", data: { error: errMsg } };
    }
  } else {
    // MOCKED mode
    const mockData = {
      status: "MOCKED_SUCCESS",
      pubsubMessageId: `mock-msg-${Date.now()}`,
      bqmlPredictedScore: 0.89,
      riskTier: "HIGH",
    };

    addStreamLogEntry({
      timestamp,
      direction: "OUTGOING",
      eventType: event.type,
      transport: "In-Memory BroadcastChannel",
      pubsubTopic,
      gcpConsoleUrl,
      success: true,
      payload: {
        ...payload,
        ...mockData,
      },
    });

    return {
      success: true,
      mode: "MOCKED",
      data: mockData,
    };
  }
}
