/**
 * Telemetry Routing & Simulator Bridge Service
 * Manages user-controllable LIVE (GCP) vs MOCKED (In-Memory) data routing mode
 * and provides cross-tab / cross-window state synchronization via BroadcastChannel.
 * 
 * // TODO: [Backend Integration] Wire up live gRPC / HTTP2 stream to Cloud Pub/Sub ingestion gateway
 */

export type RoutingMode = "LIVE" | "MOCKED";

export interface SimulatorTelemetryEvent {
  type: string;
  count?: number;
  userId?: string;
  gameId?: string;
  timestamp?: number;
  payload?: Record<string, any>;
}

const STORAGE_KEY = "dcgd_telemetry_routing_mode";
const CHANNEL_NAME = "omniarcade_simulator_channel";

const getInitialRoutingMode = (): RoutingMode => {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "LIVE" || stored === "MOCKED") {
      return stored;
    }
  }
  return "MOCKED";
};

let currentMode: RoutingMode = getInitialRoutingMode();

// Initialize BroadcastChannel if available in browser environment
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    console.warn("BroadcastChannel not supported in current environment", e);
  }
}

const modeListeners: Set<(mode: RoutingMode) => void> = new Set();
const eventListeners: Set<(event: SimulatorTelemetryEvent) => void> = new Set();

if (broadcastChannel) {
  broadcastChannel.onmessage = (msgEvent) => {
    if (!msgEvent.data) return;
    const { type, mode, telemetryEvent } = msgEvent.data;
    if (type === "MODE_CHANGE" && mode) {
      currentMode = mode;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, mode);
      }
      modeListeners.forEach((fn) => fn(mode));
    } else if (type === "TELEMETRY_EVENT" && telemetryEvent) {
      eventListeners.forEach((fn) => fn(telemetryEvent));
    }
  };
}

export function getRoutingMode(): RoutingMode {
  return currentMode;
}

export function setRoutingMode(mode: RoutingMode): void {
  currentMode = mode;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, mode);
  }
  modeListeners.forEach((fn) => fn(mode));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "MODE_CHANGE", mode });
  }
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

/**
 * Sends a telemetry event through either LIVE (GCP backend) or MOCKED (in-memory BroadcastChannel)
 */
export async function sendSimulatorEvent(event: SimulatorTelemetryEvent): Promise<{ success: boolean; mode: RoutingMode; data?: any }> {
  const payload = {
    ...event,
    timestamp: event.timestamp || Date.now(),
    routingMode: currentMode,
  };

  // Broadcast locally to all open tabs / windows regardless of mode
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "TELEMETRY_EVENT", telemetryEvent: payload });
  }
  eventListeners.forEach((fn) => fn(payload));

  if (currentMode === "LIVE") {
    // LIVE Mode: Post to GCP Telemetry Ingestion Endpoint
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
      return { success: true, mode: "LIVE", data };
    } catch (err) {
      console.warn("[simulatorBridge] LIVE mode telemetry post failed, falling back to local broadcast:", err);
      return { success: false, mode: "LIVE", data: { error: String(err) } };
    }
  } else {
    // MOCKED Mode: Directly return simulated success with zero network latency
    return {
      success: true,
      mode: "MOCKED",
      data: {
        status: "MOCKED_SUCCESS",
        pubsubMessageId: `mock-msg-${Date.now()}`,
        bqmlPredictedScore: 0.89,
        riskTier: "HIGH",
      },
    };
  }
}
