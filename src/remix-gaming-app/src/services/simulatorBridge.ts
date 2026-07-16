/**
 * Telemetry Routing & Simulator Bridge Service
 * Manages user-controllable LIVE (GCP) vs MOCKED (In-Memory) data routing mode,
 * persistent application state, bidirectional telemetry stream logs,
 * and cross-tab state synchronization via BroadcastChannel.
 */

export type RoutingMode = "LIVE" | "MOCKED";
export type PlayerCohortId = "Whale" | "Dolphin" | "Minnow" | "F2P";
export type AnomalyType = "none" | "high_churn_boss_deaths" | "level_2_bottleneck" | "toxic_chat";

export interface CohortStats {
  playerDeaths: number;
  quitAttempts: number;
}

export type CohortStatsMap = Record<PlayerCohortId, CohortStats>;

export interface CohortPromoState {
  active: boolean;
  discountPercentage: number;
  churnThreshold: number; // e.g. 0.85
  skuId: string;
  interventionType?: string;
}

export type CohortPromosMap = Record<PlayerCohortId, CohortPromoState>;

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
  cohortStats: CohortStatsMap;
  cohortPromos: CohortPromosMap;
}

export const STORAGE_KEYS = {
  SIMULATOR_STATE: "dcgd_simulator_app_state_v3",
  STREAM_LOGS: "dcgd_simulator_stream_logs_v2",
  ROUTING_MODE_LEGACY: "dcgd_telemetry_routing_mode",
};

export interface StreamLogEntry {
  id: string;
  timestamp: number;
  direction: "OUTGOING" | "INCOMING";
  eventType: string;
  transport: string;
  backend_mode: RoutingMode;
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
  topicName: string = "gaming-live-telemetry",
  projectId: string = "gaming-demo"
): string {
  return `https://console.cloud.google.com/cloudpubsub/topic/detail/${topicName}?project=${projectId}`;
}

export function normalizeCohortId(rawTier: string): PlayerCohortId | null {
  if (!rawTier) return null;
  const upper = rawTier.trim().toUpperCase();
  if (upper.includes("WHALE")) return "Whale";
  if (upper.includes("DOLPHIN")) return "Dolphin";
  if (upper.includes("MINNOW")) return "Minnow";
  if (upper.includes("F2P") || upper.includes("FREE")) return "F2P";
  return null;
}

const DEFAULT_COHORT_STATS: CohortStatsMap = {
  Whale: { playerDeaths: 0, quitAttempts: 0 },
  Dolphin: { playerDeaths: 0, quitAttempts: 0 },
  Minnow: { playerDeaths: 0, quitAttempts: 0 },
  F2P: { playerDeaths: 0, quitAttempts: 0 },
};

const DEFAULT_COHORT_PROMOS: CohortPromosMap = {
  Whale: { active: false, discountPercentage: 0, churnThreshold: 0.85, skuId: "" },
  Dolphin: { active: false, discountPercentage: 0, churnThreshold: 0.85, skuId: "" },
  Minnow: { active: false, discountPercentage: 0, churnThreshold: 0.85, skuId: "" },
  F2P: { active: false, discountPercentage: 0, churnThreshold: 0.85, skuId: "" },
};

const DEFAULT_STATE: SimulatorPersistentState = {
  routingMode: "LIVE",
  selectedCohort: "Whale",
  peakCCU: 250000,
  activeAnomaly: "high_churn_boss_deaths",
  activeTimezones: {
    apac: true,
    emea: true,
    na: true,
  },
  cohortStats: { ...DEFAULT_COHORT_STATS },
  cohortPromos: { ...DEFAULT_COHORT_PROMOS },
};

const CHANNEL_NAME = "omniarcade_simulator_channel";

// Stream Logging Pause Control
let isStreamLoggingPaused = false;

export function getStreamLoggingPaused(): boolean {
  return isStreamLoggingPaused;
}

export function setStreamLoggingPaused(paused: boolean): void {
  isStreamLoggingPaused = paused;
}

// Load persistent state from localStorage
function loadInitialState(): SimulatorPersistentState {
  if (typeof localStorage === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIMULATOR_STATE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        routingMode: parsed.routingMode === "MOCKED" ? "MOCKED" : "LIVE",
        selectedCohort: ["Whale", "Dolphin", "Minnow", "F2P"].includes(parsed.selectedCohort)
          ? parsed.selectedCohort
          : "Whale",
        peakCCU: typeof parsed.peakCCU === "number" ? parsed.peakCCU : 250000,
        activeAnomaly: ["none", "high_churn_boss_deaths", "level_2_bottleneck", "toxic_chat"].includes(parsed.activeAnomaly)
          ? parsed.activeAnomaly
          : "high_churn_boss_deaths",
        activeTimezones: {
          apac: parsed.activeTimezones?.apac ?? true,
          emea: parsed.activeTimezones?.emea ?? true,
          na: parsed.activeTimezones?.na ?? true,
        },
        cohortStats: {
          Whale: {
            playerDeaths: typeof parsed.cohortStats?.Whale?.playerDeaths === "number" ? parsed.cohortStats.Whale.playerDeaths : 0,
            quitAttempts: typeof parsed.cohortStats?.Whale?.quitAttempts === "number" ? parsed.cohortStats.Whale.quitAttempts : 0,
          },
          Dolphin: {
            playerDeaths: typeof parsed.cohortStats?.Dolphin?.playerDeaths === "number" ? parsed.cohortStats.Dolphin.playerDeaths : 0,
            quitAttempts: typeof parsed.cohortStats?.Dolphin?.quitAttempts === "number" ? parsed.cohortStats.Dolphin.quitAttempts : 0,
          },
          Minnow: {
            playerDeaths: typeof parsed.cohortStats?.Minnow?.playerDeaths === "number" ? parsed.cohortStats.Minnow.playerDeaths : 0,
            quitAttempts: typeof parsed.cohortStats?.Minnow?.quitAttempts === "number" ? parsed.cohortStats.Minnow.quitAttempts : 0,
          },
          F2P: {
            playerDeaths: typeof parsed.cohortStats?.F2P?.playerDeaths === "number" ? parsed.cohortStats.F2P.playerDeaths : 0,
            quitAttempts: typeof parsed.cohortStats?.F2P?.quitAttempts === "number" ? parsed.cohortStats.F2P.quitAttempts : 0,
          },
        },
        cohortPromos: {
          Whale: {
            active: Boolean(parsed.cohortPromos?.Whale?.active),
            discountPercentage: typeof parsed.cohortPromos?.Whale?.discountPercentage === "number" ? parsed.cohortPromos.Whale.discountPercentage : 0,
            churnThreshold: typeof parsed.cohortPromos?.Whale?.churnThreshold === "number" ? parsed.cohortPromos.Whale.churnThreshold : 0.85,
            skuId: parsed.cohortPromos?.Whale?.skuId || "",
            interventionType: parsed.cohortPromos?.Whale?.interventionType,
          },
          Dolphin: {
            active: Boolean(parsed.cohortPromos?.Dolphin?.active),
            discountPercentage: typeof parsed.cohortPromos?.Dolphin?.discountPercentage === "number" ? parsed.cohortPromos.Dolphin.discountPercentage : 0,
            churnThreshold: typeof parsed.cohortPromos?.Dolphin?.churnThreshold === "number" ? parsed.cohortPromos.Dolphin.churnThreshold : 0.85,
            skuId: parsed.cohortPromos?.Dolphin?.skuId || "",
            interventionType: parsed.cohortPromos?.Dolphin?.interventionType,
          },
          Minnow: {
            active: Boolean(parsed.cohortPromos?.Minnow?.active),
            discountPercentage: typeof parsed.cohortPromos?.Minnow?.discountPercentage === "number" ? parsed.cohortPromos.Minnow.discountPercentage : 0,
            churnThreshold: typeof parsed.cohortPromos?.Minnow?.churnThreshold === "number" ? parsed.cohortPromos.Minnow.churnThreshold : 0.85,
            skuId: parsed.cohortPromos?.Minnow?.skuId || "",
            interventionType: parsed.cohortPromos?.Minnow?.interventionType,
          },
          F2P: {
            active: Boolean(parsed.cohortPromos?.F2P?.active),
            discountPercentage: typeof parsed.cohortPromos?.F2P?.discountPercentage === "number" ? parsed.cohortPromos.F2P.discountPercentage : 0,
            churnThreshold: typeof parsed.cohortPromos?.F2P?.churnThreshold === "number" ? parsed.cohortPromos.F2P.churnThreshold : 0.85,
            skuId: parsed.cohortPromos?.F2P?.skuId || "",
            interventionType: parsed.cohortPromos?.F2P?.interventionType,
          },
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

let lastSimStatePayload: SimulatorStatePayload = {
  isRunning: true,
  frequencyHz: 1,
  targetCCU: 250000,
  activeAnomaly: "high_churn_boss_deaths",
};

export function getSimulatorStatePayload(): SimulatorStatePayload {
  return lastSimStatePayload;
}

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
      lastSimStatePayload = simStatePayload;
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
      // Keep up to 150 newest log entries to avoid quota issues
      const trimmed = currentLogs.slice(0, 150);
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
    cohortStats: {
      ...currentState.cohortStats,
      ...(updates.cohortStats || {}),
    },
    cohortPromos: {
      ...currentState.cohortPromos,
      ...(updates.cohortPromos || {}),
    },
  };
  notifyStateListeners();
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "STATE_CHANGE", state: currentState });
  }
  return currentState;
}

export function resetCohortStats(cohortId: PlayerCohortId): void {
  const updatedCohortStats = {
    ...currentState.cohortStats,
    [cohortId]: { playerDeaths: 0, quitAttempts: 0 },
  };
  updateSimulatorState({ cohortStats: updatedCohortStats });
}

export function updateCohortStats(
  cohortId: PlayerCohortId,
  stats: Partial<CohortStats>
): void {
  const current = currentState.cohortStats[cohortId] || { playerDeaths: 0, quitAttempts: 0 };
  const updatedCohortStats = {
    ...currentState.cohortStats,
    [cohortId]: {
      playerDeaths: typeof stats.playerDeaths === "number" ? stats.playerDeaths : current.playerDeaths,
      quitAttempts: typeof stats.quitAttempts === "number" ? stats.quitAttempts : current.quitAttempts,
    },
  };
  updateSimulatorState({ cohortStats: updatedCohortStats });
}

export function resetCohortPromos(): void {
  updateSimulatorState({
    cohortPromos: {
      Whale: { active: false, discountPercentage: 0, churnThreshold: 0.85, skuId: "" },
      Dolphin: { active: false, discountPercentage: 0, churnThreshold: 0.85, skuId: "" },
      Minnow: { active: false, discountPercentage: 0, churnThreshold: 0.85, skuId: "" },
      F2P: { active: false, discountPercentage: 0, churnThreshold: 0.85, skuId: "" },
    },
  });
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
  listener(lastSimStatePayload);
  return () => {
    simStatePayloadListeners.delete(listener);
  };
}

export function broadcastSimulatorState(payload: SimulatorStatePayload): void {
  lastSimStatePayload = payload;
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "SIMULATOR_STATE_CHANGE", simStatePayload: payload });
  }
  simStatePayloadListeners.forEach((fn) => fn(payload));
}

// Log Exported APIs
export function getStreamLogs(): StreamLogEntry[] {
  return currentLogs;
}

export function addStreamLogEntry(entry: Omit<StreamLogEntry, "id" | "backend_mode"> & { backend_mode?: RoutingMode }): StreamLogEntry | null {
  if (isStreamLoggingPaused) {
    return null;
  }
  const newEntry: StreamLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    backend_mode: entry.backend_mode || currentState.routingMode,
    ...entry,
  };
  currentLogs = [newEntry, ...currentLogs];
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
  const topicName = "gaming-live-telemetry";
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

  if (event.eventType === "in_game_retention_offer_injected") {
    const payload = event.payload || {};
    let targetCohorts: PlayerCohortId[] = [];

    if (Array.isArray(payload.target_cohorts)) {
      targetCohorts = payload.target_cohorts.map((c: string) => normalizeCohortId(c)).filter(Boolean) as PlayerCohortId[];
    } else if (Array.isArray(payload.target_players)) {
      targetCohorts = Array.from(new Set(payload.target_players.map((p: any) => normalizeCohortId(p.payer_tier)).filter(Boolean))) as PlayerCohortId[];
    } else if (payload.cohortId) {
      const normalized = normalizeCohortId(payload.cohortId);
      if (normalized) targetCohorts = [normalized];
    }

    if (targetCohorts.length === 0) {
      targetCohorts = ["Minnow", "F2P"];
    }

    const discountPercentage = typeof payload.discount_percentage === "number"
      ? payload.discount_percentage
      : (typeof payload.discount === "string" ? parseFloat(payload.discount) : 25);

    const churnThreshold = typeof payload.churn_threshold === "number"
      ? payload.churn_threshold
      : 0.85;

    const skuId = payload.sku_id || payload.sku || "frost_giant_shield_pack";

    const updatedPromos = { ...currentState.cohortPromos };
    targetCohorts.forEach((cohort) => {
      updatedPromos[cohort] = {
        active: true,
        discountPercentage,
        churnThreshold,
        skuId,
        interventionType: payload.intervention_type || "proactive_churn_offer",
      };
    });

    updateSimulatorState({ cohortPromos: updatedPromos });
  }
}

/**
 * Sends a telemetry event through either LIVE (GCP backend) or MOCKED (in-memory BroadcastChannel)
 */
export async function sendSimulatorEvent(event: SimulatorTelemetryEvent): Promise<{ success: boolean; mode: RoutingMode; data?: any }> {
  const mode = currentState.routingMode;
  const timestamp = event.timestamp || Date.now();
  const pubsubTopic = event.pubsubTopic || "gaming-live-telemetry";
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
