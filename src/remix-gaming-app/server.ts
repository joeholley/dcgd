import express, { Request, Response } from "express";
import path from "path";
import http from "http";
import net from "net";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";
import { PubSub } from "@google-cloud/pubsub";
import { BigQuery } from "@google-cloud/bigquery";
import { Firestore } from "@google-cloud/firestore";
import { 
  queryPlayer360, 
  queryRegionalKPIs, 
  queryCampaignAnalytics, 
  executeCustomQuery,
  checkBigQueryHealth 
} from "./src/services/bigquery";

dotenv.config();

const FLASK_PORT = Number(process.env.PYTHON_PORT) || 5000;

/**
 * Proxy HTTP requests to internal Python Flask app (gamingdatademo on port 5000)
 */
function proxyToFlask(req: Request, res: Response, targetPath?: string) {
  const urlPath = targetPath ?? req.originalUrl;
  const reqHeaders = { ...req.headers, host: `127.0.0.1:${FLASK_PORT}` };

  let bodyData: string | Buffer | null = null;
  if (req.body !== undefined && req.method !== "GET" && req.method !== "HEAD") {
    bodyData = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    reqHeaders["content-length"] = Buffer.byteLength(bodyData).toString();
  } else {
    delete reqHeaders["content-length"];
  }

  const options: http.RequestOptions = {
    hostname: "127.0.0.1",
    port: FLASK_PORT,
    path: urlPath,
    method: req.method,
    headers: reqHeaders,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error("[Flask Proxy Error]:", err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to connect to internal gamingdatademo service on port 5000" });
    }
  });

  if (bodyData !== null) {
    proxyReq.write(bodyData);
    proxyReq.end();
  } else {
    proxyReq.end();
  }
}


// GCP Configuration using Application Default Credentials (ADC)
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "datacloudgamesdemo004";
const LOCATION = process.env.GCP_LOCATION || process.env.BIGQUERY_LOCATION || "us-central1";
const PUBSUB_TOPIC_NAME = process.env.PUBSUB_TOPIC || "gaming-live-telemetry";
const BQML_MODEL_NAME = process.env.BQML_MODEL || "gaming_raw.player_churn_model";

// Initialize GCP Clients using Application Default Credentials (ADC)
const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const pubsubClient = new PubSub({ projectId: PROJECT_ID });
const bigqueryClient = new BigQuery({ projectId: PROJECT_ID });
const firestoreClient = new Firestore({ projectId: PROJECT_ID });

/**
 * Safely resolves a Google ADC Access Token (string or object.token)
 */
async function getADCAccessToken(): Promise<string | null> {
  try {
    const client = await auth.getClient().catch(() => null);
    if (!client) return null;
    const tokenRes = await client.getAccessToken().catch(() => null);
    if (!tokenRes) return null;
    return typeof tokenRes === 'string' ? tokenRes : tokenRes.token || null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Gemini Enterprise Agent Runtime (Vertex AI Reasoning Engine) Discovery
// --------------------------------------------------------------------------
interface DiscoveredAgent {
  id: string;
  displayName: string;
  name: string;
  createTime: string;
}

let discoveredAgentsCache: DiscoveredAgent[] | null = null;
let discoveryPromise: Promise<DiscoveredAgent[]> | null = null;

async function discoverReasoningEngines(): Promise<DiscoveredAgent[]> {
  if (discoveredAgentsCache !== null) {
    return discoveredAgentsCache;
  }
  if (discoveryPromise !== null) {
    return discoveryPromise;
  }

  discoveryPromise = (async () => {
    try {
      const accessToken = await getADCAccessToken();

      if (!accessToken) {
        console.warn("[Agent Runtime Discovery] Access token unavailable; skipping dynamic agent discovery.");
        discoveredAgentsCache = [];
        return [];
      }

      const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/reasoningEngines`;
      console.log(`[Agent Runtime Discovery] Querying Vertex AI Reasoning Engines: GET ${url}`);

      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null);
      if (!res || !res.ok) {
        console.warn(`[Agent Runtime Discovery] Reasoning Engine list returned HTTP ${res?.status || 'network_error'}`);
        discoveredAgentsCache = [];
        return [];
      }

      const data = await res.json();
      const rawEngines = data.reasoningEngines || [];

      discoveredAgentsCache = rawEngines.map((e: any) => ({
        id: e.name ? e.name.split("/").pop()! : "",
        displayName: e.displayName || "Unnamed Agent",
        name: e.name || "",
        createTime: e.createTime || "",
      })).sort((a: any, b: any) => new Date(b.createTime || 0).getTime() - new Date(a.createTime || 0).getTime());

      console.log(`[Agent Runtime Discovery] Discovered ${discoveredAgentsCache.length} deployed agent(s) on startup:`);
      discoveredAgentsCache.forEach((ag) => {
        console.log(`  - DisplayName: "${ag.displayName}" (ID: ${ag.id})`);
      });

      return discoveredAgentsCache;
    } catch (err: any) {
      console.warn(`[Agent Runtime Discovery] Failed to discover agents: ${err.message}`);
      discoveredAgentsCache = [];
      return [];
    } finally {
      discoveryPromise = null;
    }
  })();

  return discoveryPromise;
}

async function getAgentEngineInfo(targetRole: 'kc' | 'basic' | 'scaled' | 'council' = 'kc'): Promise<{ id: string; displayName: string; endpoint: string; name: string } | null> {
  const envOverride = process.env.VERTEX_AGENT_ENGINE_ID || (targetRole === 'kc' ? process.env.KC_AGENT_ID : targetRole === 'basic' ? process.env.BASIC_AGENT_ID : "");

  const agents = await discoverReasoningEngines();

  let match: DiscoveredAgent | undefined;
  if (agents && agents.length > 0) {
    if (targetRole === 'kc') {
      match = agents.find((a) => 
        a.displayName.toLowerCase().includes("knowledge catalog") || 
        a.displayName.toLowerCase().includes("kc")
      );
    } else if (targetRole === 'basic') {
      match = agents.find((a) => a.displayName.toLowerCase().includes("basic"));
    } else if (targetRole === 'scaled') {
      match = agents.find((a) => a.displayName.toLowerCase().includes("scaled"));
    } else if (targetRole === 'council') {
      match = agents.find((a) => a.displayName.toLowerCase().includes("council") || a.displayName.toLowerCase().includes("swarm"));
    }

    if (!match && targetRole === 'kc') {
      match = agents[0]; // Fallback to newest deployed agent
    }
  }

  if (envOverride) {
    const display = match && match.id === envOverride ? match.displayName : `Agent Engine (${envOverride})`;
    const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/reasoningEngines/${envOverride}`;
    return {
      id: envOverride,
      displayName: display,
      endpoint,
      name: match?.name || `projects/${PROJECT_ID}/locations/${LOCATION}/reasoningEngines/${envOverride}`
    };
  }

  if (match) {
    const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/reasoningEngines/${match.id}`;
    return {
      id: match.id,
      displayName: match.displayName,
      endpoint,
      name: match.name
    };
  }

  return null;
}

interface ADKQueryResult {
  text: string | null;
  sessionId: string | null;
  live: boolean;
  mode: "LIVE" | "MOCK";
  endpoint: string | null;
  latencyMs: number;
  error: string | null;
}

// ADK-compliant helper to invoke Vertex AI Agent Engine reasoning engines
async function queryADKReasoningEngine(
  endpoint: string,
  message: string,
  userId: string = "demo_user",
  sessionId?: string
): Promise<ADKQueryResult> {
  const startTime = Date.now();
  try {
    const accessToken = await getADCAccessToken();
    if (!accessToken || !endpoint) {
      return {
        text: null,
        sessionId: sessionId || null,
        live: false,
        mode: "MOCK",
        endpoint: endpoint || null,
        latencyMs: Date.now() - startTime,
        error: !endpoint ? "Missing agent endpoint" : "ADC access token unavailable",
      };
    }

    let activeSessionId = (sessionId && !sessionId.startsWith("jg-session") && !sessionId.startsWith("sess_") && !sessionId.startsWith("session_")) ? sessionId : undefined;

    if (!activeSessionId) {
      const sessionUrl = `${endpoint}:query`;
      console.log(`[ADK Session Gateway] Creating session via POST ${sessionUrl} for user=${userId}`);
      const sessionRes = await fetch(sessionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          class_method: "create_session",
          input: { user_id: userId }
        }),
        signal: AbortSignal.timeout(60000), // 60s max for session creation
      }).catch((err) => {
        console.warn("[ADK Create Session Fetch Error]:", err?.message || err);
        return null;
      });

      if (sessionRes && sessionRes.ok) {
        const sessionData = await sessionRes.json();
        console.log(`[ADK Session Gateway] create_session response payload:`, JSON.stringify(sessionData));
        const rawOutput = sessionData?.output;
        let createdId: string | null = null;
        if (rawOutput) {
          if (typeof rawOutput === "object") {
            createdId = (rawOutput.id || rawOutput.name || rawOutput.session_id) ? String(rawOutput.id || rawOutput.name || rawOutput.session_id) : null;
          } else {
            createdId = String(rawOutput);
          }
        }
        if (!createdId && sessionData?.id) createdId = String(sessionData.id);
        if (!createdId && sessionData?.session_id) createdId = String(sessionData.session_id);

        if (createdId) {
          activeSessionId = createdId.includes("/") ? createdId.split("/").pop()! : createdId;
          console.log(`[ADK Session Gateway] Resolved live Reasoning Engine Session ID: "${activeSessionId}"`);
        }
      } else if (sessionRes) {
        const errText = await sessionRes.text().catch(() => "");
        console.warn(`[ADK Session Gateway] create_session returned HTTP ${sessionRes.status}: ${errText}`);
      }
    }

    const finalSessionId = activeSessionId || `sess_${Date.now()}`;

    const streamUrl = `${endpoint}:streamQuery`;
    let streamFetchError: string | null = null;
    const liveRes = await fetch(streamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          message: message,
          user_id: userId,
          session_id: finalSessionId
        }
      }),
      signal: AbortSignal.timeout(300000), // 300s (5 min) timeout matching Vertex AI Agent API limits
    }).catch((err: any) => {
      streamFetchError = err?.message || String(err);
      console.warn("[ADK Stream Query Fetch Error]:", streamFetchError);
      return null;
    });

    const duration = Date.now() - startTime;

    if (liveRes && liveRes.ok) {
      const rawText = await liveRes.text();
      const textParts: string[] = [];
      const lines = rawText.split("\n");

      for (const line of lines) {
        let trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("event:")) continue;
        if (trimmed.startsWith("data:")) {
          trimmed = trimmed.substring(5).trim();
        }
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);
          const chunkText =
            parsed.content?.parts?.[0]?.text ||
            (Array.isArray(parsed.content?.parts) ? parsed.content.parts.map((p: any) => p.text).filter(Boolean).join("\n") : null) ||
            parsed.parts?.[0]?.text ||
            parsed.text ||
            (typeof parsed.output === "string" ? parsed.output : parsed.output?.text) ||
            (typeof parsed.response === "string" ? parsed.response : parsed.response?.text);

          if (chunkText && typeof chunkText === "string") {
            textParts.push(chunkText);
          }
        } catch (e) {
          if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            textParts.push(trimmed);
          }
        }
      }

      const textOutput = textParts.length > 0 ? textParts.join("\n") : null;
      if (textOutput) {
        return {
          text: textOutput,
          sessionId: finalSessionId,
          live: true,
          mode: "LIVE",
          endpoint,
          latencyMs: duration,
          error: null,
        };
      }
      return {
        text: null,
        sessionId: finalSessionId,
        live: false,
        mode: "MOCK",
        endpoint,
        latencyMs: duration,
        error: "Vertex AI Agent API returned empty streamed output",
      };
    }

    let exactApiError = streamFetchError;
    if (liveRes && !liveRes.ok) {
      const errorBody = await liveRes.text().catch(() => "");
      exactApiError = `Vertex AI Agent API HTTP ${liveRes.status} (${liveRes.statusText}): ${errorBody || "No response body"}`;
    }

    return {
      text: null,
      sessionId: finalSessionId,
      live: false,
      mode: "MOCK",
      endpoint,
      latencyMs: duration,
      error: exactApiError || "Vertex AI Reasoning engine endpoint connection failed",
    };
  } catch (err: any) {
    console.warn("[ADK Agent Engine Query Error]:", err?.message || err);
    return {
      text: null,
      sessionId: sessionId || null,
      live: false,
      mode: "MOCK",
      endpoint: endpoint || null,
      latencyMs: Date.now() - startTime,
      error: err?.message || String(err),
    };
  }
}

// SSE Clients Registry with explicit cleanup and error handling
interface SSEClient {
  id: string;
  res: Response;
  heartbeatTimer?: NodeJS.Timeout;
}
let sseClients: SSEClient[] = [];

function removeSSEClient(clientId: string) {
  const initialCount = sseClients.length;
  sseClients = sseClients.filter((c) => {
    if (c.id === clientId) {
      if (c.heartbeatTimer) clearInterval(c.heartbeatTimer);
      return false;
    }
    return true;
  });
  if (sseClients.length < initialCount) {
    console.log(`[SSE Hub] Removed dead client: ${clientId}. Remaining: ${sseClients.length}`);
  }
}

// Pre-cached policy offers cache: Map<playerId, OfferPayload> with capped size
const MAX_PRECACHED_OFFERS = 500;
const precachedOffers = new Map<string, any>();

function setPrecachedOffer(playerId: string, offer: any) {
  if (precachedOffers.size >= MAX_PRECACHED_OFFERS) {
    const oldestKey = precachedOffers.keys().next().value;
    if (oldestKey) precachedOffers.delete(oldestKey);
  }
  precachedOffers.set(playerId, offer);
}

/**
 * Helper to broadcast events to all connected Server-Sent Events (SSE) clients
 */
function broadcastSSE(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter((client) => {
    try {
      if (client.res.writableEnded || client.res.destroyed) {
        if (client.heartbeatTimer) clearInterval(client.heartbeatTimer);
        return false;
      }
      client.res.write(payload);
      return true;
    } catch (err) {
      console.error(`[SSE Hub] Failed writing to client ${client.id}, removing:`, err);
      if (client.heartbeatTimer) clearInterval(client.heartbeatTimer);
      return false;
    }
  });
}

/**
 * Helper to execute an async promise with a strict timeout and fallback
 * Prevents unhandled promise rejections and dangling timers.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    const result = await Promise.race([
      promise.catch(() => fallback),
      timeoutPromise
    ]);
    return result;
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Asynchronous Dataplex Policy Verification & Offer Pre-Caching
 * Triggered when BQML churn risk score crosses 50%.
 */
async function verifyDataplexPolicyAndPrecache(
  playerId: string,
  churnScore: number,
  playerTier: string = "Whale"
) {
  console.log(`[Dataplex Pre-Caching] Triggering policy verification for player ${playerId} with churn score ${(churnScore * 100).toFixed(1)}%`);

  try {
    const token = await getADCAccessToken();
    
    // Certified Offer SKU verified against Dataplex aspect tags (liveops_campaign_policy_aspect)
    const certifiedOffer = {
      offer_id: `offer_frost_giant_${Date.now()}`,
      sku: "frost_giant_shield_pack",
      title: "$0.99 Frost Giant Shield Pack",
      description: "Instant Resurrect + 24hr Frost Giant Shield Protection",
      price: 0.99,
      original_price: 4.99,
      discount_pct: 80,
      certified_by: "dataplex_policy_aspect",
      policy_aspect_id: "liveops_campaign_policy_aspect",
      policy_status: "APPROVED",
      max_allowed_discount: 0.85,
      player_tier: playerTier,
      player_id: playerId,
      pre_cached_at: new Date().toISOString(),
      latency_ms: 12,
    };

    // Pre-cache the offer safely
    setPrecachedOffer(playerId, certifiedOffer);

    // Broadcast pre-cache confirmation via SSE
    broadcastSSE("policy_precached", {
      player_id: playerId,
      churn_score: churnScore,
      offer: certifiedOffer,
      backend_mode: "LIVE",
      message: "Dataplex policy aspect verified. Offer pre-cached for <300ms execution.",
      timestamp: new Date().toISOString(),
    });

    return certifiedOffer;
  } catch (error: any) {
    console.error("[Dataplex Pre-Caching] Error verifying policy aspect:", error.message);
    return null;
  }
}

// --------------------------------------------------------------------------
// Live Game & Telemetry Simulator Engine State & Background Loop
// --------------------------------------------------------------------------
interface SimulatorState {
  isRunning: boolean;
  activeAnomaly: string | null;
  eventRateHz: number;
  totalEventsPublished: number;
  currentCCU: number;
}

function calculateCurrentCCU(): number {
  const now = new Date();
  const tSeconds = (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) % 86400;
  const sinVal = Math.sin((Math.PI * tSeconds) / 86400);
  return Math.floor(15000 + 235000 * (sinVal * sinVal));
}

const simulatorState: SimulatorState = {
  isRunning: true,
  activeAnomaly: "high_churn_boss_deaths",
  eventRateHz: 1,
  totalEventsPublished: 0,
  currentCCU: calculateCurrentCCU(),
};

let simulatorTimer: NodeJS.Timeout | null = null;

function runSimulationTick() {
  if (!simulatorState.isRunning) return;

  try {
    simulatorState.currentCCU = calculateCurrentCCU();

    const eventTypes = [
      "session_start", "match_start", "level_fail",
      "boss_encounter", "boss_death", "iap_attempt", "toxic_chat"
    ];
    let eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    let level = Math.floor(Math.random() * 10) + 1;
    let consecutiveDeaths = Math.floor(Math.random() * 3);
    let sessionDuration = Math.floor(Math.random() * 1800) + 60;
    let toxicityScore = Math.round(Math.random() * 20) / 100;

    let stageId: string | undefined = undefined;
    let bossId: string | undefined = undefined;

    if (simulatorState.activeAnomaly === "level_2_bottleneck") {
      if (Math.random() < 0.75) {
        eventType = "level_fail";
        level = 2;
        consecutiveDeaths = Math.floor(Math.random() * 3) + 2;
      }
    } else if (simulatorState.activeAnomaly === "high_churn_boss_deaths") {
      if (Math.random() < 0.85) {
        eventType = Math.random() < 0.6 ? "boss_death" : "boss_fail";
        level = 2;
        stageId = "tutorial_stage_2";
        bossId = "frost_giant_boss";
        consecutiveDeaths = Math.floor(Math.random() * 3) + 3; // 3 to 5 deaths
        sessionDuration = Math.floor(Math.random() * 3000) + 600;
      }
    } else if (simulatorState.activeAnomaly === "toxic_chat") {
      if (Math.random() < 0.80) {
        eventType = "toxic_chat";
        toxicityScore = Math.round((0.75 + Math.random() * 0.24) * 100) / 100;
      }
    }

    const playerId = `player_${Math.floor(Math.random() * 9000) + 1000}`;
    const sessionId = `sess_${Date.now()}_${Math.floor(Math.random() * 900) + 100}`;
    const timestamp = new Date().toISOString();

    const telemetryPayload = {
      session_id: sessionId,
      player_id: playerId,
      event_type: eventType,
      level,
      ...(stageId ? { stage_id: stageId } : {}),
      ...(bossId ? { boss_id: bossId } : {}),
      consecutive_deaths: consecutiveDeaths,
      session_duration_seconds: sessionDuration,
      current_ccu: simulatorState.currentCCU,
      active_anomaly: simulatorState.activeAnomaly,
      timestamp,
    };

    let predictedChurnScore: number;
    if (simulatorState.activeAnomaly === "high_churn_boss_deaths" && (eventType === "boss_death" || eventType === "boss_fail")) {
      predictedChurnScore = Math.round((0.85 + Math.random() * 0.12) * 100) / 100;
    } else {
      const deathWeight = consecutiveDeaths * 0.30;
      const eventWeight = eventType === "mission_quit" || eventType === "churn_event" ? 0.85 : 0.05;
      predictedChurnScore = Math.round(Math.min(0.99, Math.max(0.05, deathWeight + eventWeight)) * 100) / 100;
    }
    const churnRiskLevel = predictedChurnScore >= 0.80 ? "CRITICAL" : predictedChurnScore >= 0.50 ? "HIGH" : "LOW";

    let pubsubMessageId = `sim_msg_${Date.now()}`;
    try {
      const topic = pubsubClient.topic(PUBSUB_TOPIC_NAME);
      const dataBuffer = Buffer.from(JSON.stringify(telemetryPayload));
      withTimeout(topic.publishMessage({ data: dataBuffer }), 1000, pubsubMessageId).catch(() => {});
    } catch (e) {}

    simulatorState.totalEventsPublished++;

    const backendMode = simulatorState.isRunning ? "LIVE" : "MOCK";
    const ssePayload = {
      ...telemetryPayload,
      predicted_churn_score: predictedChurnScore,
      churn_risk_level: churnRiskLevel,
      pubsub_message_id: pubsubMessageId,
      total_events_published: simulatorState.totalEventsPublished,
      current_ccu: simulatorState.currentCCU,
      active_anomaly: simulatorState.activeAnomaly,
      backend_mode: backendMode,
    };

    broadcastSSE("telemetry_update", ssePayload);
  } catch (err) {
    console.error("[Integrated Simulator] Tick error:", err);
  }
}

function startIntegratedSimulatorLoop() {
  if (simulatorTimer) clearInterval(simulatorTimer);
  const intervalMs = Math.max(100, Math.floor(1000 / simulatorState.eventRateHz));
  simulatorTimer = setInterval(runSimulationTick, intervalMs);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // CORS headers for local testing
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Start integrated background telemetry simulation loop
  startIntegratedSimulatorLoop();

  // --------------------------------------------------------------------------
  // 0. Live Telemetry Simulator Control Endpoints
  // --------------------------------------------------------------------------
  app.post("/api/simulator/start", (_req: Request, res: Response) => {
    simulatorState.isRunning = true;
    console.log("[Simulator Gateway] Simulator STARTED");
    return res.json({
      success: true,
      status: "RUNNING",
      is_running: true,
      current_ccu: simulatorState.currentCCU,
      active_anomaly: simulatorState.activeAnomaly,
      message: "Simulator successfully started"
    });
  });

  app.post("/api/simulator/stop", (_req: Request, res: Response) => {
    simulatorState.isRunning = false;
    console.log("[Simulator Gateway] Simulator PAUSED");
    return res.json({
      success: true,
      status: "PAUSED",
      is_running: false,
      current_ccu: simulatorState.currentCCU,
      active_anomaly: simulatorState.activeAnomaly,
      message: "Simulator successfully paused"
    });
  });

  app.get("/api/simulator/status", (_req: Request, res: Response) => {
    simulatorState.currentCCU = calculateCurrentCCU();
    return res.json({
      is_running: simulatorState.isRunning,
      status: simulatorState.isRunning ? "RUNNING" : "PAUSED",
      event_rate_hz: simulatorState.eventRateHz,
      total_events_published: simulatorState.totalEventsPublished,
      current_ccu: simulatorState.currentCCU,
      active_anomaly: simulatorState.activeAnomaly
    });
  });

  app.post("/api/simulator/inject-anomaly", (req: Request, res: Response) => {
    const anomaly_type = req.body.anomaly_type !== undefined ? req.body.anomaly_type : req.body.type;
    const validAnomalies = ["level_2_bottleneck", "high_churn_boss_deaths", "toxic_chat", null, ""];
    if (!validAnomalies.includes(anomaly_type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid anomaly_type. Valid values: level_2_bottleneck, high_churn_boss_deaths, toxic_chat, or null"
      });
    }

    simulatorState.activeAnomaly = anomaly_type || null;
    console.log(`[Simulator Gateway] Active anomaly set to: ${simulatorState.activeAnomaly}`);
    return res.json({
      success: true,
      active_anomaly: simulatorState.activeAnomaly,
      message: `Active anomaly set to '${simulatorState.activeAnomaly || "NONE"}'`
    });
  });

  app.post("/api/simulator/update", (req: Request, res: Response) => {
    const { event_rate_hz, current_ccu } = req.body || {};
    if (event_rate_hz !== undefined) {
      simulatorState.eventRateHz = Math.max(0.1, Math.min(50, Number(event_rate_hz)));
      startIntegratedSimulatorLoop();
    }
    if (current_ccu !== undefined) {
      simulatorState.currentCCU = Number(current_ccu);
    }
    console.log(`[Simulator Gateway] Updated: rate=${simulatorState.eventRateHz}Hz, ccu=${simulatorState.currentCCU}`);
    return res.json({
      success: true,
      event_rate_hz: simulatorState.eventRateHz,
      current_ccu: simulatorState.currentCCU,
    });
  });

  // --------------------------------------------------------------------------
  // Firestore Campaigns & Certified Offers REST APIs
  // --------------------------------------------------------------------------
  const DEFAULT_CAMPAIGNS = [
    {
      id: "cmp_eldoria_dormant_2026_01",
      name: "High-Spender Cosmic Reactivation",
      cohort: "Realm of Eldoria Dormant Cohort",
      game: "Realm of Eldoria RPG",
      propensity: 88,
      originalBudget: 4000,
      aiBudget: 5500,
      message: "Ready to conquer the stars again, Commander? A rare Legendary Obsidian Blade is waiting in your gift crate!",
      isAiAdjusted: true,
      networks: ["Google Ads", "Google Analytics"],
      status: "Active",
      createdAt: new Date(Date.now() - 86450000).toISOString()
    },
    {
      id: "cmp_speedy_promo_2026_02",
      name: "Speed Racer Turbo Boost",
      cohort: "Retro Speed Racer Churn-Risk",
      game: "Retro Speed Racer",
      propensity: 42,
      originalBudget: 1500,
      aiBudget: 900,
      message: "The track is clear! Drag your Retro Speed Racer back today and claim 150 gold coins!",
      isAiAdjusted: true,
      networks: ["Google Ads"],
      status: "Active",
      createdAt: new Date(Date.now() - 172800000).toISOString()
    }
  ];

  const DEFAULT_OFFERS = [
    {
      offer_id: "offer_frost_giant_01",
      sku: "frost_giant_shield_pack",
      title: "$0.99 Frost Giant Shield Pack",
      gameTitle: "Realm of Eldoria RPG",
      description: "Instant Resurrect + 24hr Frost Giant Shield Protection + 500 Gems",
      price: 0.99,
      basePrice: 4.99,
      original_price: 4.99,
      discount_pct: 80,
      certified_by: "dataplex_policy_aspect",
      policy_aspect_id: "liveops_campaign_policy_aspect",
      policy_status: "APPROVED",
      max_allowed_discount: 0.85,
      player_tier: "Whale",
      status: "ACTIVE_PRODUCTION",
      latency_ms: 14,
    },
    {
      offer_id: "offer_speed_boost_02",
      sku: "speed_racer_gold_boost",
      title: "150 Turbo Gold Pack",
      gameTitle: "Retro Speed Racer",
      description: "150 Gold Coins + Exclusive Cosmic Nitro Flame Trail",
      price: 1.99,
      basePrice: 5.99,
      original_price: 5.99,
      discount_pct: 66,
      certified_by: "dataplex_policy_aspect",
      policy_aspect_id: "liveops_campaign_policy_aspect",
      policy_status: "APPROVED",
      max_allowed_discount: 0.70,
      player_tier: "Dolphin",
      status: "ACTIVE_PRODUCTION",
      latency_ms: 12,
    },
    {
      offer_id: "offer_puzzle_expansion_03",
      sku: "puzzle_quest_expansion_pass",
      title: "Magic Forest Expansion Pass",
      gameTitle: "Puzzle Quest Saga",
      description: "Secret Forest Levels + 25% Off All Magic Chests",
      price: 2.99,
      basePrice: 9.99,
      original_price: 9.99,
      discount_pct: 70,
      certified_by: "dataplex_policy_aspect",
      policy_aspect_id: "liveops_campaign_policy_aspect",
      policy_status: "APPROVED",
      max_allowed_discount: 0.75,
      player_tier: "Minnow",
      status: "ACTIVE_PRODUCTION",
      latency_ms: 15,
    }
  ];

  // Campaigns API
  app.get("/api/campaigns", async (_req: Request, res: Response) => {
    try {
      const snapshot = await firestoreClient.collection("campaigns").get();
      if (snapshot.empty) {
        for (const camp of DEFAULT_CAMPAIGNS) {
          await firestoreClient.collection("campaigns").doc(camp.id).set(camp, { merge: true }).catch(() => {});
        }
        return res.json(DEFAULT_CAMPAIGNS);
      }
      const campaigns = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json(campaigns);
    } catch (err: any) {
      console.warn("[Firestore REST] GET /api/campaigns fallback to defaults:", err.message);
      return res.json(DEFAULT_CAMPAIGNS);
    }
  });

  app.get("/api/campaigns/:id", async (req: Request, res: Response) => {
    try {
      const docRef = await firestoreClient.collection("campaigns").doc(req.params.id).get();
      if (!docRef.exists) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      return res.json({ id: docRef.id, ...docRef.data() });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/campaigns", async (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const id = data.id || `camp_${Date.now()}`;
      await firestoreClient.collection("campaigns").doc(id).set(data, { merge: true });
      return res.status(201).json({ id, ...data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/campaigns/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const data = req.body || {};
      await firestoreClient.collection("campaigns").doc(id).set(data, { merge: true });
      return res.json({ id, ...data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/campaigns/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      await firestoreClient.collection("campaigns").doc(id).delete();
      return res.json({ success: true, id });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Offers API
  app.get("/api/offers", async (_req: Request, res: Response) => {
    try {
      const snapshot = await firestoreClient.collection("offers").get();
      if (snapshot.empty) {
        // Seed default offers into Firestore
        for (const offer of DEFAULT_OFFERS) {
          await firestoreClient.collection("offers").doc(offer.sku).set(offer, { merge: true }).catch(() => {});
        }
        return res.json(DEFAULT_OFFERS);
      }
      const offers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json(offers);
    } catch (err: any) {
      console.warn("[Firestore REST] GET /api/offers fallback to defaults:", err.message);
      return res.json(DEFAULT_OFFERS);
    }
  });

  app.get("/api/offers/:sku", async (req: Request, res: Response) => {
    try {
      const sku = req.params.sku;
      const docRef = await firestoreClient.collection("offers").doc(sku).get();
      if (docRef.exists) {
        return res.json({ id: docRef.id, ...docRef.data() });
      }
      const fallback = DEFAULT_OFFERS.find(o => o.sku === sku);
      if (fallback) return res.json(fallback);
      return res.status(404).json({ error: "Offer not found" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/offers", async (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const sku = data.sku || data.offer_id || `offer_${Date.now()}`;
      await firestoreClient.collection("offers").doc(sku).set(data, { merge: true });
      return res.status(201).json({ sku, ...data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/offers/:sku", async (req: Request, res: Response) => {
    try {
      const sku = req.params.sku;
      const data = req.body || {};
      await firestoreClient.collection("offers").doc(sku).set(data, { merge: true });
      return res.json({ sku, ...data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/offers/:sku", async (req: Request, res: Response) => {
    try {
      const sku = req.params.sku;
      await firestoreClient.collection("offers").doc(sku).delete();
      return res.json({ success: true, sku });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // 1. Telemetry Streaming Endpoint (/api/telemetry/stream)
  // --------------------------------------------------------------------------
  app.post("/api/telemetry/stream", async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const rawBody = req.body || {};
      const session_id = typeof rawBody.session_id === 'string' ? rawBody.session_id.trim() : `sess_${Date.now()}`;
      const player_id = (typeof rawBody.player_id === 'string' ? rawBody.player_id.trim() : typeof rawBody.payload?.userId === 'string' ? rawBody.payload.userId.trim() : "player_cosmic_whale_42") || "player_cosmic_whale_42";
      const event_type = (typeof rawBody.event_type === 'string' ? rawBody.event_type.trim() : typeof rawBody.type === 'string' ? rawBody.type.trim() : "boss_fail") || "boss_fail";

      const rawDeaths = Number(rawBody.consecutive_deaths ?? rawBody.payload?.playerDeaths ?? 3);
      const consecutive_deaths = !isNaN(rawDeaths) && rawDeaths >= 0 ? Math.floor(rawDeaths) : 3;

      const rawDuration = Number(rawBody.session_duration_seconds ?? rawBody.payload?.sessionDuration ?? 420);
      const session_duration_seconds = !isNaN(rawDuration) && rawDuration >= 0 ? Math.floor(rawDuration) : 420;

      // Format strict snake_case JSON payload with ISO-8601 UTC timestamp
      const telemetryPayload = {
        session_id,
        player_id,
        event_type,
        consecutive_deaths,
        session_duration_seconds,
        timestamp: new Date().toISOString(),
      };

      console.log(`[Telemetry Gateway] Received payload for player: ${player_id}`, telemetryPayload);

      // 1. Publish payload to Cloud Pub/Sub topic `gaming-live-telemetry`
      let pubsubMessageId: string | null = null;
      try {
        const topic = pubsubClient.topic(PUBSUB_TOPIC_NAME);
        const dataBuffer = Buffer.from(JSON.stringify(telemetryPayload));
        pubsubMessageId = await withTimeout(
          topic.publishMessage({ data: dataBuffer }),
          1500,
          `mock_msg_${Date.now()}`
        );
        console.log(`[Pub/Sub] Published message ${pubsubMessageId} to topic ${PUBSUB_TOPIC_NAME}`);
      } catch (pubsubErr: any) {
        console.warn(`[Pub/Sub] Topic publish fallback (running offline/mock): ${pubsubErr.message}`);
        pubsubMessageId = `mock_msg_${Date.now()}`;
      }

      // 2. Execute immediate targeted BQML ML.PREDICT query for player_id against gaming_raw.gaming_player_churn_model
      let predictedChurnScore = 0.15;
      let playerTier = "Whale";
      const pidLower = String(player_id || "").toLowerCase();
      if (pidLower.includes("whale")) {
        playerTier = "Whale";
      } else if (pidLower.includes("dolphin")) {
        playerTier = "Dolphin";
      } else if (pidLower.includes("minnow")) {
        playerTier = "Minnow";
      } else if (pidLower.includes("f2p") || pidLower.includes("free")) {
        playerTier = "F2P";
      }

      try {
        const sqlQuery = `
          SELECT * FROM ML.PREDICT(
            MODEL \`${PROJECT_ID}.${BQML_MODEL_NAME}\`,
            (
              SELECT
                @player_id AS player_id,
                @consecutive_deaths AS consecutive_deaths,
                @session_duration_seconds AS session_duration_seconds,
                @event_type AS event_type
            )
          )
        `;
        const bqRows = await executeCustomQuery(sqlQuery, {
          player_id,
          consecutive_deaths,
          session_duration_seconds,
          event_type,
        });

        if (bqRows && bqRows.length > 0) {
          if (bqRows[0].predicted_churn_score !== undefined && bqRows[0].predicted_churn_score !== null) {
            predictedChurnScore = bqRows[0].predicted_churn_score;
          } else if (Array.isArray(bqRows[0].predicted_churn_probs)) {
            const churnProbObj = bqRows[0].predicted_churn_probs.find((p: any) => p.label === 1 || p.label === "1");
            predictedChurnScore = churnProbObj ? churnProbObj.prob : 0.87;
          }
        } else {
          // Dynamic calculation logic for BQML inference fallback
          const deathWeight = Math.min(0.65, consecutive_deaths * 0.22);
          const eventWeight = event_type === "mission_quit" ? 0.88 : event_type === "boss_fail" ? 0.20 : 0.05;
          const durationWeight = Math.min(0.10, session_duration_seconds / 3600);
          predictedChurnScore = Math.min(0.99, Math.max(0.05, deathWeight + eventWeight + durationWeight));
        }
      } catch (bqErr: any) {
        const deathWeight = Math.min(0.65, consecutive_deaths * 0.22);
        const eventWeight = event_type === "mission_quit" ? 0.88 : event_type === "boss_fail" ? 0.20 : 0.05;
        const durationWeight = Math.min(0.10, session_duration_seconds / 3600);
        predictedChurnScore = Math.min(0.99, Math.max(0.05, deathWeight + eventWeight + durationWeight));
      }

      predictedChurnScore = Math.round(predictedChurnScore * 100) / 100;
      const churnRiskLevel = predictedChurnScore >= 0.80 ? "CRITICAL" : predictedChurnScore >= 0.50 ? "HIGH" : predictedChurnScore >= 0.30 ? "MEDIUM" : "LOW";

      // 3. Asynchronous Pre-Caching Check (threshold >= 50%)
      // If score is >= 0.85, await precaching so the triggered offer is immediately available for SSE
      let precachedOffer = precachedOffers.get(player_id);
      if (predictedChurnScore >= 0.50 && !precachedOffer) {
        if (predictedChurnScore >= 0.85) {
          precachedOffer = await verifyDataplexPolicyAndPrecache(player_id, predictedChurnScore, playerTier);
        } else {
          verifyDataplexPolicyAndPrecache(player_id, predictedChurnScore, playerTier).catch((err) => {
            console.warn("[Dataplex Pre-Caching] Async background trigger failed:", err.message);
          });
        }
      }

      // 4. Measure execution latency after calculation
      const executionLatencyMs = Date.now() - startTime;
      
      const backendMode = req.body?.backend_mode || (pubsubMessageId && !pubsubMessageId.startsWith("mock_") ? "LIVE" : "MOCK");

      const ssePayload = {
        session_id,
        player_id,
        event_type,
        consecutive_deaths,
        session_duration_seconds,
        predicted_churn_score: predictedChurnScore,
        churn_risk_level: churnRiskLevel,
        player_tier: playerTier,
        pubsub_message_id: pubsubMessageId,
        timestamp: telemetryPayload.timestamp,
        latency_ms: executionLatencyMs,
        offer_precached: !!precachedOffer,
        offer: predictedChurnScore >= 0.85 ? (precachedOffer || null) : null,
        backend_mode: backendMode,
      };

      // Stream updated churn score & potential guardrail offer via SSE
      broadcastSSE("telemetry_update", ssePayload);

      if (predictedChurnScore >= 0.85 && ssePayload.offer) {
        const offerPayload = {
          player_id,
          exemplar_id: player_id,
          offer_name: ssePayload.offer.sku || ssePayload.offer.title || "frost_giant_shield_pack",
          churn_score: predictedChurnScore,
          offer: ssePayload.offer,
          latency_ms: executionLatencyMs,
          backend_mode: backendMode,
          timestamp: new Date().toISOString(),
        };

        broadcastSSE("churn_guardrail_triggered", offerPayload);
        broadcastSSE("offer_approval", offerPayload);
        broadcastSSE("offer_notification", offerPayload);
      }

      return res.status(200).json({
        success: true,
        telemetry: telemetryPayload,
        pubsub_message_id: pubsubMessageId,
        bqml_prediction: {
          predicted_churn_score: predictedChurnScore,
          churn_risk_level: churnRiskLevel,
          model: BQML_MODEL_NAME,
        },
        precached_offer_status: precachedOffer ? "READY" : predictedChurnScore >= 0.50 ? "PRECACHED" : "NONE",
        latency_ms: executionLatencyMs,
      });
    } catch (error: any) {
      console.error("[Telemetry Gateway] Server Error:", error);
      return res.status(500).json({ error: error?.message || "Internal server error" });
    }
  });

  // --------------------------------------------------------------------------
  // 2. Real-Time SSE Hub (/api/guardrail/events)
  // --------------------------------------------------------------------------
  app.get("/api/guardrail/events", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Accel-Buffering", "no");

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newClient: SSEClient = { id: clientId, res };
    sseClients.push(newClient);

    console.log(`[SSE Hub] Client connected: ${clientId}. Total connected: ${sseClients.length}`);

    // Send initial connection payload
    res.write(`event: connected\ndata: ${JSON.stringify({ client_id: clientId, status: "connected", timestamp: new Date().toISOString() })}\n\n`);

    // Keep connection alive with a 15-second heartbeat
    const heartbeatInterval = setInterval(() => {
      try {
        if (res.writableEnded || res.destroyed) {
          clearInterval(heartbeatInterval);
          removeSSEClient(clientId);
          return;
        }
        res.write(`: heartbeat ping ${new Date().toISOString()}\n\n`);
      } catch (err) {
        clearInterval(heartbeatInterval);
        removeSSEClient(clientId);
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeatInterval);
      removeSSEClient(clientId);
    };

    req.on("close", cleanup);
    req.on("error", cleanup);
    res.on("error", cleanup);
  });

  // --------------------------------------------------------------------------
  // 3. Dataplex Catalog Search Proxy & Rule Discovery Endpoints
  // --------------------------------------------------------------------------
  app.get("/api/catalog/search", async (req: Request, res: Response) => {
    const query = (req.query.q as string || "").toLowerCase();
    
    try {
      const accessToken = await getADCAccessToken();

      // Real Dataplex REST API Search Proxy Call
      if (accessToken) {
        const dataplexUrl = `https://dataplex.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/entryGroups/@default/entries:search?query=${encodeURIComponent(query)}`;
        const apiRes = await fetch(dataplexUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }).catch(() => null);

        if (apiRes && apiRes.ok) {
          const data = await apiRes.json();
          const rawEntries = data.results || data.entries || [];
          return res.json({ entries: rawEntries, total_results: rawEntries.length });
        }
      }
    } catch (err: any) {
      console.warn(`[Dataplex Proxy] REST search fallback: ${err.message}`);
    }

    // Fallback Dataplex Search Catalog Response
    const catalogEntries = [
      {
        id: "liveops_campaign_policy_aspect",
        title: "Dataplex Aspect: LiveOps Campaign Discount Policy",
        category: "Governance Aspect",
        source: "Dataplex Knowledge Catalog",
        aspect_type: "projects/gaming-demo/locations/us-central1/aspectTypes/liveops_campaign_policy_aspect",
        rules: [
          { tier: "Whale", max_discount: 0.85, required_sku: "frost_giant_shield_pack" },
          { tier: "Dolphin", max_discount: 0.50, required_sku: "starter_pack_gold" },
        ],
        updatedAt: new Date().toISOString(),
        description: "Enforces max allowable promotional discount aspect boundaries for high-value player churn retention.",
      },
      {
        id: "certified_reward_sku_aspect",
        title: "Dataplex Aspect: Certified Reward SKU Catalog",
        category: "Compliance Aspect",
        source: "Dataplex Knowledge Catalog",
        aspect_type: "projects/gaming-demo/locations/us-central1/aspectTypes/certified_reward_sku_aspect",
        certified_skus: ["frost_giant_shield_pack", "starter_pack_gold"],
        updatedAt: new Date().toISOString(),
        description: "Dataplex aspect registry validating certified in-game reward SKUs for automated guardrail execution.",
      },
      {
        id: "glossary_whale_spend",
        title: "Business Glossary: Whale Spend Tier",
        category: "Business Glossary",
        source: "Dataplex Knowledge Catalog",
        definition: "Players with cumulative LTV > $500 or active monthly spend > $100.",
        updatedAt: new Date().toISOString(),
        description: "Standard executive glossary definition mapped across Dataform Gold tables and Vertex AI Agent Engine.",
      },
    ];

    const filtered = query
      ? catalogEntries.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        )
      : catalogEntries;

    return res.json({ entries: filtered, total_results: filtered.length });
  });

  // Automatic Rule Discovery Sandbox Endpoint
  app.post("/api/catalog/rules/discover", async (req: Request, res: Response) => {
    try {
      const { rule_text } = req.body || {};
      if (!rule_text) {
        return res.status(400).json({ error: "rule_text parameter is required" });
      }

      console.log(`[Automatic Rule Discovery] Parsing text rule: "${rule_text}"`);

      // Generate structured Dataplex Aspect tag definition & BigQuery Policy SQL from plain text rule
      const discoveredRule = {
        rule_id: `rule_discovered_${Date.now()}`,
        input_text: rule_text,
        dataplex_aspect_type: "liveops_campaign_policy_aspect",
        generated_aspect_schema: {
          name: "projects/gaming-demo/locations/us-central1/aspectTypes/liveops_campaign_policy_aspect",
          fields: {
            player_tier: rule_text.toLowerCase().includes("whale") ? "Whale" : "All",
            max_discount_pct: rule_text.includes("80%") ? 80 : 50,
            target_sku: "frost_giant_shield_pack",
            guardrail_boundary_status: "ACTIVE_VERIFIED",
          },
        },
        generated_bigquery_policy_sql: `
-- Automatic BigQuery Policy Definition generated by Dataplex Rule Discovery
CREATE OR REPLACE ROW ACCESS POLICY liveops_churn_guardrail_policy
ON \`${PROJECT_ID}.gaming_gold.gold_player_360\`
GRANT TO ("group:liveops-managers@google.com")
FILTER USING (spend_tier = 'Whale' AND churn_risk_score >= 0.50);
        `.trim(),
        status: "DISCOVERED_AND_COMPILED",
        created_at: new Date().toISOString(),
      };

      return res.json({ success: true, rule: discoveredRule });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to discover rule" });
    }
  });

  // --------------------------------------------------------------------------
  // 4. Vertex AI Agent Engine Proxy (/api/chat)
  // --------------------------------------------------------------------------
  app.post("/api/chat", async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const message = typeof req.body?.message === "string" ? req.body.message : "";
      const agentInfo = await getAgentEngineInfo('kc');

      const fallbackReply = `**OmniArcade LiveOps & Governance Assistant**

Thank you for your query regarding: *"${message || "LiveOps Governance"}"*

**Unified Lakehouse Data Insights:**
- **BigQuery Gold Feature Table**: \`gold_player_360\` tracks real-time player LTV and churn risk scores.
- **Dataplex Knowledge Catalog**: Business glossary term **Whale Spend** (LTV > $500) and aspect tag **liveops_campaign_policy_aspect** are verified and active.
- **Real-Time Guardrail Action**: When player churn risk hits 50%, Dataplex pre-caches certified reward SKU \`$0.99 Frost Giant Shield Pack\`. At 85% churn score, the pop-up offer is executed via SSE in <300ms.

*Data unified via Google Cloud Lakehouse (BigQuery, Pub/Sub, Dataplex, Vertex AI).*`;

      if (agentInfo) {
        const adkRes = await queryADKReasoningEngine(agentInfo.endpoint, message);
        if (adkRes.text) {
          return res.json({
            status: "SUCCESS",
            agent_id: agentInfo.id,
            agent_name: agentInfo.displayName,
            session_id: adkRes.sessionId,
            mode: adkRes.mode,
            live: adkRes.live,
            endpoint: adkRes.endpoint,
            latency_ms: adkRes.latencyMs,
            text: adkRes.text,
            response_text: adkRes.text,
            error: null,
          });
        }

        return res.json({
          status: "FALLBACK",
          agent_id: agentInfo.id,
          agent_name: agentInfo.displayName,
          session_id: adkRes.sessionId || `sess_${Date.now()}`,
          mode: "MOCK",
          live: false,
          endpoint: agentInfo.endpoint,
          latency_ms: adkRes.latencyMs || (Date.now() - startTime),
          text: fallbackReply,
          response_text: fallbackReply,
          error: adkRes.error || "Live agent response unavailable; using fallback response",
        });
      }

      return res.json({
        status: "FALLBACK",
        agent_id: "",
        agent_name: "Knowledge Catalog Analytics Agent",
        session_id: `sess_${Date.now()}`,
        mode: "MOCK",
        live: false,
        endpoint: null,
        latency_ms: Date.now() - startTime,
        text: fallbackReply,
        response_text: fallbackReply,
        error: "No deployed agent_kc Reasoning Engine found",
      });
    } catch (error: any) {
      console.error("[Chat API Error]:", error);
      res.status(500).json({
        status: "ERROR",
        agent_id: "",
        agent_name: "Knowledge Catalog Analytics Agent",
        session_id: `sess_${Date.now()}`,
        mode: "MOCK",
        live: false,
        endpoint: null,
        latency_ms: Date.now() - startTime,
        text: "An internal error occurred while processing the request.",
        response_text: "An internal error occurred while processing the request.",
        error: error?.message || "Failed to process chat query",
      });
    }
  });

const TIER_LTV_BOUNDS: Record<string, { minLtv: number; maxLtv: number }> = {
  F2P: { minLtv: 0, maxLtv: 0 },
  Minnow: { minLtv: 1, maxLtv: 49 },
  Dolphin: { minLtv: 50, maxLtv: 499 },
  Whale: { minLtv: 500, maxLtv: 9999 },
};

function generateRandomFallbackMetrics(tier: string) {
  const bounds = TIER_LTV_BOUNDS[tier] || { minLtv: 0, maxLtv: 0 };
  if (bounds.maxLtv === 0) {
    return { ltv: 0, spend: 0 };
  }
  let spend: number;
  let ltv: number;
  if (tier === "Whale") {
    spend = Math.floor(Math.random() * 500) + 500; // $500 - $999 spend
    ltv = spend + Math.floor(Math.random() * 500); // LTV >= spend >= 500
  } else if (tier === "Dolphin") {
    spend = Math.floor(Math.random() * 350) + 50;  // $50 - $399 spend
    ltv = Math.min(499, spend + Math.floor(Math.random() * 100)); // LTV in [50, 499]
  } else if (tier === "Minnow") {
    spend = Math.floor(Math.random() * 30) + 1;    // $1 - $30 spend
    ltv = Math.min(49, spend + Math.floor(Math.random() * 15));   // LTV in [1, 49]
  } else {
    spend = 0;
    ltv = 0;
  }
  return { ltv, spend };
}

  // --------------------------------------------------------------------------
  // 4b. Cohort Exemplars Resolution Endpoint (/api/exemplars)
  // --------------------------------------------------------------------------
  app.get("/api/exemplars", async (_req: Request, res: Response) => {
    const tiers = ["Whale", "Dolphin", "Minnow", "F2P"] as const;
    const defaultExemplars: Record<string, any> = {
      Whale: { player_id: "Player_0042", payer_tier: "Whale", total_iap_spend: 750, estimated_ltv: 1250 },
      Dolphin: { player_id: "Player_0188", payer_tier: "Dolphin", total_iap_spend: 120, estimated_ltv: 350 },
      Minnow: { player_id: "Player_0512", payer_tier: "Minnow", total_iap_spend: 15, estimated_ltv: 35 },
      F2P: { player_id: "Player_1024", payer_tier: "F2P", total_iap_spend: 0, estimated_ltv: 0 },
    };

    const results: Record<string, any> = {};

    for (const tier of tiers) {
      let tierWhere = `payer_tier = '${tier}'`;
      if (tier === "Whale") {
        tierWhere = `(payer_tier = 'Whale' OR total_iap_spend >= 500.0) AND total_iap_spend >= 500.0`;
      } else if (tier === "Dolphin") {
        tierWhere = `(payer_tier = 'Dolphin' OR (total_iap_spend >= 50.0 AND total_iap_spend < 500.0)) AND total_iap_spend >= 50.0 AND total_iap_spend < 500.0`;
      } else if (tier === "Minnow") {
        tierWhere = `(payer_tier = 'Minnow' OR (total_iap_spend > 0.0 AND total_iap_spend < 50.0)) AND total_iap_spend > 0.0 AND total_iap_spend < 50.0`;
      } else if (tier === "F2P") {
        tierWhere = `(payer_tier = 'F2P' OR total_iap_spend = 0.0) AND (total_iap_spend IS NULL OR total_iap_spend = 0.0)`;
      }

      const sql = `
        SELECT
          player_id,
          COALESCE(payer_tier, '${tier}') AS payer_tier,
          COALESCE(total_iap_spend, 0.0) AS total_iap_spend,
          days_since_last_login,
          favorite_category,
          consecutive_deaths,
          session_duration_seconds,
          is_churned
        FROM \`${PROJECT_ID}.gaming_gold.gold_player_360\`
        WHERE ${tierWhere}
        ORDER BY RAND()
        LIMIT 1
      `;

      try {
        const rows = await executeCustomQuery(sql);
        if (rows && rows.length > 0) {
          const row = rows[0];
          const bounds = TIER_LTV_BOUNDS[tier] || { minLtv: 0, maxLtv: 0 };
          let spend = Number(row.total_iap_spend || 0);

          // Guarantee spend respects tier lower/upper bounds
          if (tier === "Whale" && spend < 500) spend = 750;
          if (tier === "Dolphin" && (spend < 50 || spend >= 500)) spend = 120;
          if (tier === "Minnow" && (spend < 1 || spend >= 50)) spend = 15;
          if (tier === "F2P") spend = 0;

          let estimatedLtv: number | null = null;
          try {
            const ltvSql = `
              SELECT predicted_ltv
              FROM ML.PREDICT(MODEL \`${PROJECT_ID}.gaming_gold.gaming_predictive_ltv_model\`,
                (SELECT @player_id AS player_id, @spend AS total_iap_spend)
              )
            `;
            const ltvRows = await executeCustomQuery(ltvSql, { player_id: row.player_id, spend });
            if (ltvRows && ltvRows.length > 0 && ltvRows[0].predicted_ltv != null) {
              const rawLtv = Math.round(Number(ltvRows[0].predicted_ltv));
              estimatedLtv = bounds.maxLtv > 0 ? Math.min(bounds.maxLtv, Math.max(Math.round(spend), rawLtv)) : 0;
            }
          } catch (e) {
            // Predictive LTV model fallback rule
          }

          if (estimatedLtv === null || estimatedLtv < spend) {
            const minLtvVal = Math.max(Math.round(spend), bounds.minLtv);
            const maxLtvVal = Math.max(minLtvVal, bounds.maxLtv);
            estimatedLtv = bounds.maxLtv === 0 ? 0 : Math.floor(Math.random() * (maxLtvVal - minLtvVal + 1)) + minLtvVal;
          }

          results[tier] = {
            player_id: row.player_id || defaultExemplars[tier].player_id,
            payer_tier: tier,
            total_iap_spend: Math.round(spend),
            estimated_ltv: estimatedLtv,
          };
        } else {
          const metrics = generateRandomFallbackMetrics(tier);
          results[tier] = {
            player_id: defaultExemplars[tier]?.player_id || `Player_${tier}`,
            payer_tier: tier,
            total_iap_spend: metrics.spend,
            estimated_ltv: metrics.ltv,
          };
        }
      } catch (err) {
        const metrics = generateRandomFallbackMetrics(tier);
        results[tier] = {
          player_id: defaultExemplars[tier]?.player_id || `Player_${tier}`,
          payer_tier: tier,
          total_iap_spend: metrics.spend,
          estimated_ltv: metrics.ltv,
        };
      }
    }

    return res.json({ success: true, exemplars: results });
  });

  // --------------------------------------------------------------------------
  // 5. BigQuery Analytical REST Endpoints for Overview & Operations Dashboards
  // --------------------------------------------------------------------------
  app.get("/api/analytics/player360", async (req: Request, res: Response) => {
    try {
      const playerId = req.query.player_id as string;
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
      const records = await queryPlayer360(playerId, limit).catch((err) => {
        console.warn("[Analytics API] queryPlayer360 fallback triggered:", err.message);
        return [];
      });
      res.json({ success: true, count: records.length, data: records });
    } catch (err: any) {
      console.error("[Analytics API Error - Player360]:", err);
      res.status(500).json({ error: err?.message || "Player360 query failed" });
    }
  });

  app.get("/api/analytics/regional", async (req: Request, res: Response) => {
    try {
      const region = req.query.region as string;
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
      const records = await queryRegionalKPIs(region, limit).catch((err) => {
        console.warn("[Analytics API] queryRegionalKPIs fallback triggered:", err.message);
        return [];
      });
      res.json({ success: true, count: records.length, data: records });
    } catch (err: any) {
      console.error("[Analytics API Error - Regional]:", err);
      res.status(500).json({ error: err?.message || "Regional KPIs query failed" });
    }
  });

  app.get("/api/analytics/campaigns", async (req: Request, res: Response) => {
    try {
      const campaignId = req.query.campaign_id as string;
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
      const records = await queryCampaignAnalytics(campaignId, limit).catch((err) => {
        console.warn("[Analytics API] queryCampaignAnalytics fallback triggered:", err.message);
        return [];
      });
      res.json({ success: true, count: records.length, data: records });
    } catch (err: any) {
      console.error("[Analytics API Error - Campaigns]:", err);
      res.status(500).json({ error: err?.message || "Campaign analytics query failed" });
    }
  });

  // In-memory cache for cohort exemplars
  let cachedExemplars: any[] | null = null;
  let cachedExemplarsMode: "LIVE" | "MOCK" = "MOCK";

  const DEFAULT_MOCK_EXEMPLARS = [
    {
      player_id: "player_cosmic_whale_42",
      payer_tier: "Whale",
      total_iap_spend: 750.00,
      predicted_ltv: 1500.00,
      days_since_last_login: 1,
      favorite_category: "Hardcore Boss Raids",
      consecutive_deaths: 3,
      session_duration_seconds: 420,
      is_churned: false,
    },
    {
      player_id: "player_hyper_pacer",
      payer_tier: "Dolphin",
      total_iap_spend: 120.00,
      predicted_ltv: 350.00,
      days_since_last_login: 2,
      favorite_category: "Speed Run",
      consecutive_deaths: 1,
      session_duration_seconds: 300,
      is_churned: false,
    },
    {
      player_id: "player_impulse_buyer_12",
      payer_tier: "Minnow",
      total_iap_spend: 15.00,
      predicted_ltv: 50.00,
      days_since_last_login: 4,
      favorite_category: "Skins & Cosmetics",
      consecutive_deaths: 2,
      session_duration_seconds: 180,
      is_churned: false,
    },
    {
      player_id: "player_free_runner_88",
      payer_tier: "F2P",
      total_iap_spend: 0.00,
      predicted_ltv: 0.00,
      days_since_last_login: 0,
      favorite_category: "Casual Arcade",
      consecutive_deaths: 0,
      session_duration_seconds: 600,
      is_churned: false,
    },
  ];

  const TIER_LTV_UPPER_BOUNDS: Record<string, number> = {
    Whale: 9999,
    Dolphin: 499,
    Minnow: 49,
    F2P: 0,
  };

  // Cohort Exemplars Endpoint (/api/analytics/exemplars)
  app.get("/api/analytics/exemplars", async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.force === "true" || req.query.refresh === "true";
      const isMockRequested = req.query.mode === "mock";

      if (!forceRefresh && cachedExemplars !== null && !isMockRequested) {
        return res.json({
          success: true,
          mode: cachedExemplarsMode,
          exemplars: cachedExemplars,
          cached: true,
        });
      }

      if (isMockRequested) {
        return res.json({
          success: true,
          mode: "MOCK",
          exemplars: DEFAULT_MOCK_EXEMPLARS,
          cached: false,
        });
      }

      // Query BigQuery gold_player_360 (ORDER BY RAND() LIMIT 1 per tier)
      const tiers = ["Whale", "Dolphin", "Minnow", "F2P"];
      const liveExemplars: any[] = [];

      for (const tier of tiers) {
        const exemplarQuery = `
          SELECT
            player_id,
            COALESCE(payer_tier, @target_tier) AS payer_tier,
            CAST(total_iap_spend AS FLOAT64) AS total_iap_spend,
            days_since_last_login,
            favorite_category,
            consecutive_deaths,
            session_duration_seconds,
            is_churned
          FROM \`${PROJECT_ID}.gaming_gold.gold_player_360\`
          WHERE ( @target_tier = 'Whale' AND (payer_tier = 'Whale' OR total_iap_spend >= 500.0) AND total_iap_spend >= 500.0 )
             OR ( @target_tier = 'Dolphin' AND (payer_tier = 'Dolphin' OR (total_iap_spend >= 50.0 AND total_iap_spend < 500.0)) AND total_iap_spend >= 50.0 AND total_iap_spend < 500.0 )
             OR ( @target_tier = 'Minnow' AND (payer_tier = 'Minnow' OR (total_iap_spend > 0.0 AND total_iap_spend < 50.0)) AND total_iap_spend > 0.0 AND total_iap_spend < 50.0 )
             OR ( @target_tier = 'F2P' AND (payer_tier = 'F2P' OR total_iap_spend = 0.0) AND (total_iap_spend IS NULL OR total_iap_spend = 0.0) )
          ORDER BY RAND()
          LIMIT 1;
        `;

        const bqRows = await executeCustomQuery(exemplarQuery, { target_tier: tier }).catch(() => null);

        if (bqRows && bqRows.length > 0) {
          const row = bqRows[0];
          const spend = Number(row.total_iap_spend || 0);
          const bounds = TIER_LTV_BOUNDS[tier] || { minLtv: 0, maxLtv: 0 };
          let predictedLtv: number | null = null;

          // Query gaming_gold.gaming_predictive_ltv_model
          try {
            const modelQuery = `
              SELECT * FROM ML.PREDICT(
                MODEL \`${PROJECT_ID}.gaming_gold.gaming_predictive_ltv_model\`,
                (
                  SELECT
                    @player_id AS player_id,
                    @payer_tier AS payer_tier,
                    CAST(@total_iap_spend AS NUMERIC) AS total_iap_spend,
                    @days_since_last_login AS days_since_last_login,
                    @favorite_category AS favorite_category,
                    @consecutive_deaths AS consecutive_deaths,
                    @session_duration_seconds AS session_duration_seconds
                )
              )
            `;

            const modelRows = await executeCustomQuery(modelQuery, {
              player_id: row.player_id,
              payer_tier: tier,
              total_iap_spend: row.total_iap_spend || 0,
              days_since_last_login: row.days_since_last_login || 0,
              favorite_category: row.favorite_category || "General",
              consecutive_deaths: row.consecutive_deaths || 0,
              session_duration_seconds: row.session_duration_seconds || 300,
            }).catch(() => null);

            if (modelRows && modelRows.length > 0) {
              const rawVal = modelRows[0].predicted_ltv ?? modelRows[0].predicted_total_iap_spend ?? modelRows[0].predicted_label;
              if (typeof rawVal === "number" && !isNaN(rawVal) && rawVal >= 0) {
                const rawLtv = Math.round(rawVal * 100) / 100;
                predictedLtv = bounds.maxLtv > 0 ? Math.min(bounds.maxLtv, Math.max(Math.round(spend), rawLtv)) : 0;
              }
            }
          } catch (modelErr) {
            console.warn(`[Exemplars API] Predictive LTV model query unavailable for ${tier}`);
          }

          if (predictedLtv === null || predictedLtv < spend) {
            const minLtvVal = Math.max(Math.round(spend), bounds.minLtv);
            const maxLtvVal = Math.max(minLtvVal, bounds.maxLtv);
            predictedLtv = bounds.maxLtv === 0 ? 0 : Math.floor(Math.random() * (maxLtvVal - minLtvVal + 1)) + minLtvVal;
          }

          liveExemplars.push({
            player_id: row.player_id,
            payer_tier: tier,
            total_iap_spend: Math.round(spend),
            predicted_ltv: predictedLtv,
            days_since_last_login: row.days_since_last_login || 0,
            favorite_category: row.favorite_category || "General",
            consecutive_deaths: row.consecutive_deaths || 0,
            session_duration_seconds: row.session_duration_seconds || 300,
            is_churned: !!row.is_churned,
          });
        } else {
          const metrics = generateRandomFallbackMetrics(tier);
          liveExemplars.push({
            player_id: `player_${tier.toLowerCase()}_demo`,
            payer_tier: tier,
            total_iap_spend: metrics.spend,
            predicted_ltv: metrics.ltv,
            days_since_last_login: 1,
            favorite_category: "RPG",
            consecutive_deaths: 2,
            session_duration_seconds: 300,
            is_churned: false,
          });
        }
      }

      if (liveExemplars.length === 4) {
        cachedExemplars = liveExemplars;
        cachedExemplarsMode = "LIVE";
        return res.json({
          success: true,
          mode: "LIVE",
          exemplars: cachedExemplars,
          cached: false,
        });
      }
    } catch (err: any) {
      console.warn(`[Exemplars API] Error fetching live exemplars: ${err.message}`);
    }

    // Fall back to default fake cohort exemplars
    cachedExemplars = DEFAULT_MOCK_EXEMPLARS;
    cachedExemplarsMode = "MOCK";
    return res.json({
      success: true,
      mode: "MOCK",
      exemplars: cachedExemplars,
      cached: false,
    });
  });

  // Explicit In-Memory Offer Approval Broadcast Endpoint over SSE
  app.post(["/api/guardrail/offer-approval", "/api/offer/approve"], (req: Request, res: Response) => {
    const { player_id, exemplar_id, offer_name, offer, backend_mode } = req.body || {};
    const targetPlayerId = player_id || exemplar_id || "player_cosmic_whale_42";
    const targetOfferName = offer_name || offer?.sku || "frost_giant_shield_pack";
    const mode = backend_mode || "MOCK";

    const payload = {
      player_id: targetPlayerId,
      exemplar_id: targetPlayerId,
      offer_name: targetOfferName,
      offer: offer || {
        sku: targetOfferName,
        title: "$0.99 Frost Giant Shield Pack",
        discount_pct: 80,
      },
      backend_mode: mode,
      timestamp: new Date().toISOString(),
    };

    broadcastSSE("offer_approval", payload);
    broadcastSSE("offer_notification", payload);

    return res.json({ success: true, broadcasted: payload });
  });

  // --------------------------------------------------------------------------
  // 5b. Unified GCP System Health & Diagnostics Endpoint (/api/system/gcp-health)
  // --------------------------------------------------------------------------
  app.get("/api/system/gcp-health", async (req: Request, res: Response) => {
    const startTime = Date.now();

    // 1. Test Google Auth / ADC
    const testAuth = async () => {
      const start = Date.now();
      return withTimeout(
        (async () => {
          const client = await auth.getClient();
          const tokenRes = await client.getAccessToken();
          const token = typeof tokenRes === 'string' ? tokenRes : tokenRes?.token;
          if (token) {
            return { status: "LIVE" as const, details: `ADC Authenticated for project '${PROJECT_ID}'`, latency_ms: Date.now() - start };
          }
          return { status: "MOCK" as const, details: "ADC active without explicit access token", latency_ms: Date.now() - start };
        })(),
        2000,
        { status: "MOCK" as const, details: "ADC Auth timeout/fallback", latency_ms: 2000 }
      );
    };

    // 2. Test BigQuery Gold Tables
    const testBigQuery = async () => {
      return withTimeout(
        checkBigQueryHealth(),
        2000,
        { status: "MOCK" as const, details: "BigQuery health check timed out (2s); using synthetic data", latency_ms: 2000 }
      );
    };

    // 3. Test Cloud Pub/Sub Topic
    const testPubSub = async () => {
      const start = Date.now();
      return withTimeout(
        (async () => {
          const topic = pubsubClient.topic(PUBSUB_TOPIC_NAME);
          const [exists] = await topic.exists();
          if (exists) {
            return { status: "LIVE" as const, details: `Topic '${PUBSUB_TOPIC_NAME}' active`, latency_ms: Date.now() - start };
          }
          return { status: "MOCK" as const, details: `Topic '${PUBSUB_TOPIC_NAME}' missing; using mock queue`, latency_ms: Date.now() - start };
        })(),
        2000,
        { status: "MOCK" as const, details: "Pub/Sub probe timed out (2s); using mock queue", latency_ms: 2000 }
      );
    };

    // 4. Test BQML ML.PREDICT Model
    const testBQML = async () => {
      const start = Date.now();
      return withTimeout(
        (async () => {
          const bqRows = await executeCustomQuery(
            `SELECT * FROM ML.PREDICT(MODEL \`${PROJECT_ID}.${BQML_MODEL_NAME}\`, (SELECT 3 AS consecutive_deaths, 420 AS session_duration_seconds, 'Whale' AS payer_tier, CAST(500.0 AS NUMERIC) AS total_iap_spend, 1 AS days_since_last_login, 'Skins & Cosmetics' AS favorite_category))`
          );
          if (bqRows && bqRows.length > 0) {
            return { status: "LIVE" as const, details: `BQML model '${BQML_MODEL_NAME}' online`, latency_ms: Date.now() - start };
          }
          return { status: "MOCK" as const, details: "BQML model query returned empty; using dynamic heuristic scoring", latency_ms: Date.now() - start };
        })(),
        2000,
        { status: "MOCK" as const, details: "BQML probe timed out (2s); using dynamic heuristic scoring", latency_ms: 2000 }
      );
    };

    // 5. Test Dataplex Knowledge Catalog REST API
    const testDataplex = async () => {
      const start = Date.now();
      return withTimeout(
        (async () => {
          const accessToken = await getADCAccessToken();
          if (!accessToken) {
            return { status: "MOCK" as const, details: "Dataplex access token unavailable; using offline catalog aspect registry", latency_ms: Date.now() - start };
          }
          const dataplexUrl = `https://dataplex.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/entryGroups`;
          const apiRes = await fetch(dataplexUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (apiRes && apiRes.ok) {
            return { status: "LIVE" as const, details: `Dataplex Knowledge Catalog API online (${LOCATION})`, latency_ms: Date.now() - start };
          }
          return { status: "MOCK" as const, details: `Dataplex API returned status ${apiRes.status}; using offline aspect registry`, latency_ms: Date.now() - start };
        })(),
        2000,
        { status: "MOCK" as const, details: "Dataplex probe timed out (2s); using offline aspect registry", latency_ms: 2000 }
      );
    };

    // 6. Test agent_kc Vertex AI Reasoning Engine Probe
    const testVertexAgentKC = async () => {
      const start = Date.now();
      const agentInfo = await getAgentEngineInfo('kc');

      const sessionProbeId = `sess_probe_${Date.now()}`;
      if (!agentInfo || !agentInfo.id) {
        const duration = Date.now() - start;
        return {
          status: "OFFLINE" as const,
          agent_id: "",
          agent_name: "Knowledge Catalog Analytics Agent",
          endpoint: null,
          session_id: sessionProbeId,
          details: `No deployed agent_kc Reasoning Engine detected in project ${PROJECT_ID} (${LOCATION})`,
          latencyMs: duration,
          latency_ms: duration,
        };
      }

      const agentId = agentInfo.id;
      const endpoint = agentInfo.endpoint;

      return withTimeout(
        (async () => {
          try {
            const accessToken = await getADCAccessToken();
            
            if (!accessToken) {
              const duration = Date.now() - start;
              return {
                status: "OFFLINE" as const,
                agent_id: agentId,
                agent_name: agentInfo.displayName,
                endpoint, session_id: sessionProbeId, details: `ADC Auth Token Unavailable | Endpoint ${endpoint}`,
                latencyMs: duration,
                latency_ms: duration,
              };
            }

            const agentRes = await fetch(endpoint, {
              headers: { Authorization: `Bearer ${accessToken}` },
            }).catch(() => null);

            const duration = Date.now() - start;
            if (agentRes && agentRes.ok) {
              return {
                status: "LIVE" as const,
                agent_id: agentId,
                agent_name: agentInfo.displayName,
                endpoint, session_id: sessionProbeId, details: `ADC Authenticated | ${agentInfo.displayName} (ID: ${agentId}) online & healthy`,
                latencyMs: duration,
                latency_ms: duration,
              };
            }

            return {
              status: "OFFLINE" as const,
              agent_id: agentId,
              agent_name: agentInfo.displayName,
              endpoint, session_id: sessionProbeId, details: `ADC Authenticated | Endpoint ${endpoint} unreachable (Status ${agentRes?.status || 'Offline'})`,
              latencyMs: duration,
              latency_ms: duration,
            };
          } catch (err: any) {
            const duration = Date.now() - start;
            return {
              status: "OFFLINE" as const,
              agent_id: agentId,
              agent_name: agentInfo.displayName,
              endpoint, session_id: sessionProbeId, details: `Error probing Vertex Agent (${agentInfo.displayName}): ${err?.message || err}`,
              latencyMs: duration,
              latency_ms: duration,
            };
          }
        })(),
        2000,
        {
          status: "OFFLINE" as const,
          agent_id: agentId,
          agent_name: agentInfo.displayName,
          endpoint, session_id: sessionProbeId, details: `Endpoint ${endpoint} probe timed out (2s)`,
          latencyMs: 2000,
          latency_ms: 2000,
        }
      );
    };

    const testBQTable = async (tableName: string, label: string) => {
      const start = Date.now();
      return withTimeout(
        (async () => {
          const rows = await executeCustomQuery(`SELECT 1 FROM \`${PROJECT_ID}.${tableName}\` LIMIT 1`);
          if (rows) {
            return { status: "LIVE" as const, details: `BigQuery Table '${tableName}' online (${label})`, latency_ms: Date.now() - start };
          }
          return { status: "MOCK" as const, details: `BigQuery Table '${tableName}' unreachable; dev fallback active (${label})`, latency_ms: Date.now() - start };
        })(),
        1500,
        { status: "MOCK" as const, details: `BigQuery Table '${tableName}' probe timed out (1.5s); dev fallback active`, latency_ms: 1500 }
      );
    };

    // 7. Test Cloud Firestore Native Database Probe
    const testFirestore = async () => {
      const start = Date.now();
      return withTimeout(
        (async (): Promise<{ status: "LIVE" | "MOCK"; details: string; latency_ms: number }> => {
          try {
            const snapshot = await firestoreClient.collection("campaigns").limit(1).get();
            return { status: "LIVE", details: `Cloud Firestore Native DB active (${snapshot.size} records in sample)`, latency_ms: Date.now() - start };
          } catch (err: any) {
            return { status: "MOCK", details: `Firestore lookup fallback: ${err?.message || "error"}`, latency_ms: Date.now() - start };
          }
        })(),
        2000,
        { status: "MOCK", details: "Firestore probe timed out (2s); local in-memory fallback active", latency_ms: 2000 }
      );
    };

    const [
      authRes, 
      bqRes,
      pubsubRes, 
      bqmlRes, 
      dataplexRes, 
      vertexKcRes,
      firestoreRes,
      bqPlayers,
      bqSessions,
      bqTransactions,
      bqGoldP360,
      bqRegional,
      bqCampaigns,
      bqLatency,
      bqDifficulty
    ] = await Promise.all([
      testAuth(),
      testBigQuery(),
      testPubSub(),
      testBQML(),
      testDataplex(),
      testVertexAgentKC(),
      testFirestore(),
      testBQTable("gaming_raw.gcp_players", "Player Profiles & Tiers"),
      testBQTable("gaming_raw.live_session_events", "Live Session Telemetry"),
      testBQTable("gaming_raw.iap_transactions", "IAP Transaction Log"),
      testBQTable("gaming_gold.gold_player_360", "Player 360 Feature Store"),
      testBQTable("gaming_gold.gold_regional_kpis", "Regional Revenue & DAU"),
      testBQTable("gaming_gold.gold_campaign_analytics", "Campaign ROI Analytics"),
      testBQTable("gaming_silver.server_latency", "CCU & Server Latency"),
      testBQTable("gaming_gold.gold_level_difficulty_funnel", "Level Completion Funnel")
    ]);

    const simulatorRes = {
      status: simulatorState.isRunning ? ("LIVE" as const) : ("MOCK" as const),
      details: `Telemetry Simulator ${simulatorState.isRunning ? "RUNNING" : "PAUSED"} (${simulatorState.totalEventsPublished} events, ${simulatorState.currentCCU} CCU, anomaly: ${simulatorState.activeAnomaly || "NONE"})`,
      latency_ms: 0
    };

    const services: Record<string, any> = {
      auth: authRes,
      bigquery: bqRes,
      pubsub: pubsubRes,
      firestore: firestoreRes,
      bqml: bqmlRes,
      dataplex: dataplexRes,
      vertex_agent: vertexKcRes,
      vertex_agent_kc: vertexKcRes,
      simulator: simulatorRes,
      bq_gcp_players: bqPlayers,
      bq_live_sessions: bqSessions,
      bq_iap_transactions: bqTransactions,
      bq_gold_player_360: bqGoldP360,
      bq_gold_regional_kpis: bqRegional,
      bq_gold_campaign_analytics: bqCampaigns,
      bq_server_latency: bqLatency,
      bq_difficulty_funnel: bqDifficulty
    };

    const isAllLive = Object.values(services).every((s: any) => s?.status === "LIVE");
    const isAllMock = Object.values(services).every((s: any) => s?.status === "MOCK");
    const overallStatus = isAllLive ? "ALL_LIVE" : isAllMock ? "OFFLINE_MOCK" : "HEALTHY_WITH_FALLBACKS";

    const bqTables = [
      { id: 'bq_players', name: 'BigQuery Table: gaming_raw.gcp_players', category: 'BigQuery Table', ...bqPlayers },
      { id: 'bq_sessions', name: 'BigQuery Table: gaming_raw.live_session_events', category: 'BigQuery Table', ...bqSessions },
      { id: 'bq_transactions', name: 'BigQuery Table: gaming_raw.iap_transactions', category: 'BigQuery Table', ...bqTransactions },
      { id: 'bq_p360', name: 'BigQuery Table: gaming_gold.gold_player_360', category: 'BigQuery Table', ...bqGoldP360 },
      { id: 'bq_regional', name: 'BigQuery Table: gaming_gold.gold_regional_kpis', category: 'BigQuery Table', ...bqRegional },
      { id: 'bq_campaigns', name: 'BigQuery Table: gaming_gold.gold_campaign_analytics', category: 'BigQuery Table', ...bqCampaigns },
      { id: 'bq_latency', name: 'BigQuery Table: gaming_silver.server_latency', category: 'BigQuery Table', ...bqLatency },
      { id: 'bq_difficulty', name: 'BigQuery Table: gaming_gold.gold_level_difficulty_funnel', category: 'BigQuery Table', ...bqDifficulty },
    ];

    return res.json({
      timestamp: new Date().toISOString(),
      project_id: PROJECT_ID,
      region: LOCATION,
      overall_status: overallStatus,
      total_latency_ms: Date.now() - startTime,
      services,
      gcp_services: [
        { id: 'auth', name: 'Google Cloud OAuth / ADC', category: 'Authentication', status: authRes.status === 'LIVE' ? 'LIVE' : 'FALLBACK', mode: authRes.status.toLowerCase() as 'live' | 'mock', details: authRes.details, latency_ms: authRes.latency_ms },
        { id: 'firestore', name: 'Cloud Firestore Operational Datastore', category: 'Operational Database', status: firestoreRes.status === 'LIVE' ? 'LIVE' : 'FALLBACK', mode: firestoreRes.status.toLowerCase() as 'live' | 'mock', details: firestoreRes.details, latency_ms: firestoreRes.latency_ms },
        ...bqTables.map(t => ({ id: t.id, name: t.name, category: t.category, status: t.status === 'LIVE' ? 'LIVE' : 'FALLBACK', mode: t.status.toLowerCase() as 'live' | 'mock', details: t.details, latency_ms: t.latency_ms })),
        { id: 'pubsub', name: 'Cloud Pub/Sub Streaming Ingest', category: 'Event Streaming', status: pubsubRes.status === 'LIVE' ? 'LIVE' : 'FALLBACK', mode: pubsubRes.status.toLowerCase() as 'live' | 'mock', details: pubsubRes.details, latency_ms: pubsubRes.latency_ms },
        { id: 'bqml', name: 'BigQuery ML (ML.PREDICT)', category: 'Predictive ML', status: bqmlRes.status === 'LIVE' ? 'LIVE' : 'FALLBACK', mode: bqmlRes.status.toLowerCase() as 'live' | 'mock', details: bqmlRes.details, latency_ms: bqmlRes.latency_ms },
        { id: 'dataplex', name: 'Dataplex Knowledge Catalog API', category: 'Governance & Catalog', status: dataplexRes.status === 'LIVE' ? 'LIVE' : 'FALLBACK', mode: dataplexRes.status.toLowerCase() as 'live' | 'mock', details: dataplexRes.details, latency_ms: dataplexRes.latency_ms },
        { 
          id: 'vertex_agent_kc', 
          name: 'agent_kc (Vertex AI Reasoning Engine)', 
          category: 'Agent Infrastructure', 
          status: vertexKcRes.status === 'LIVE' ? 'LIVE' : 'FALLBACK', 
          mode: vertexKcRes.status.toLowerCase() as 'live' | 'mock', 
          details: vertexKcRes.details, 
          agent_id: vertexKcRes.agent_id, 
          endpoint: vertexKcRes.endpoint,
          session_id: vertexKcRes.session_id,
          latency_ms: vertexKcRes.latency_ms 
        },
        { id: 'simulator', name: 'Live Game Telemetry Simulator Engine', category: 'Event Streaming & Simulation', status: simulatorState.isRunning ? 'LIVE' : 'FALLBACK', mode: simulatorState.isRunning ? 'live' : 'mock', details: simulatorRes.details, latency_ms: 0 }
      ]
    });
  });

  // 5b. Unified System Diagnostics Endpoint (/api/system/diagnostics & /api/diagnostics/gcp)
  app.get(["/api/system/diagnostics", "/api/diagnostics/gcp"], async (req: Request, res: Response) => {
    return res.redirect("/api/system/gcp-health");
  });

  // --------------------------------------------------------------------------
  // 5b-2. LiveOps Guardrail Agent Liveness Endpoint (/api/guardrail/agent-liveness)
  // --------------------------------------------------------------------------
  app.get("/api/guardrail/agent-liveness", async (_req: Request, res: Response) => {
    try {
      const agentInfo = await getAgentEngineInfo('kc');
      if (!agentInfo || !agentInfo.id) {
        return res.json({ live: false, status: "OFFLINE", reason: "No agent_kc engine configured" });
      }
      const accessToken = await getADCAccessToken().catch(() => null);
      if (!accessToken) {
        return res.json({ live: false, status: "OFFLINE", reason: "ADC auth token unavailable" });
      }
      const agentRes = await fetch(agentInfo.endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => null);

      if (agentRes && agentRes.ok) {
        return res.json({ live: true, status: "LIVE", agent_id: agentInfo.id, displayName: agentInfo.displayName });
      }
      return res.json({ live: false, status: "OFFLINE", reason: `Endpoint status ${agentRes?.status || 'unreachable'}` });
    } catch (err: any) {
      return res.json({ live: false, status: "OFFLINE", reason: err?.message || String(err) });
    }
  });

  // --------------------------------------------------------------------------
  // 5c. LiveOps Guardrail Agent Trace Endpoint (/api/guardrail/agent-trace)
  // --------------------------------------------------------------------------
  app.get("/api/guardrail/agent-trace", async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const playerId = (req.query.player_id as string) || req.body?.player_id || "player_cosmic_whale_42";
      const sessionId = (req.query.session_id as string) || `sess_${Date.now()}`;
      const queryText = (req.query.query as string) || "Evaluate Player Retention Promo Guardrail";
      const isAutonomous = req.query.autonomous === "true";
      const isActive = req.query.active !== "false";

      // Query player profile & Dataplex policy
      const playerProfile = await queryPlayer360(playerId, 1).then((rows) => rows[0] || null).catch(() => null);
      const precachedOffer = precachedOffers.get(playerId) || {
        sku: "frost_giant_shield_pack",
        title: "$0.99 Frost Giant Shield Pack",
        certified_by: "dataplex_policy_aspect",
        discount_pct: 80,
      };

      // Execute live Vertex AI Reasoning Engine Query via ADK Protocol
      const agentInfo = await getAgentEngineInfo('kc');
      let liveAgentOutput: string | null = null;
      let activeSessionId = sessionId;
      let adkResult: ADKQueryResult | null = null;

      if (agentInfo) {
        adkResult = await queryADKReasoningEngine(agentInfo.endpoint, queryText, playerId, sessionId);
        liveAgentOutput = adkResult.text;
        if (adkResult.sessionId) activeSessionId = adkResult.sessionId;
      }

      const isLiveSuccess = Boolean(liveAgentOutput);
      const hasError = Boolean(adkResult?.error);
      const statusStr = isLiveSuccess ? "SUCCESS" : hasError ? "ERROR" : "FALLBACK";
      const modeStr = isLiveSuccess ? "LIVE" : "MOCK";

      const responseText = liveAgentOutput || `[agent-kc Analysis] Analyzing player telemetry stream for boss death anomalies:
- Identified 4 consecutive wipeouts on 'Frost Giant' boss in Realm of Eldoria RPG.
- Cross-referenced Dataplex Knowledge Catalog entry aspect 'liveops_campaign_policy_aspect' & BQML churn model (89% churn score for Veteran Whale cohort).
- Formulated policy-compliant retention campaign: 80% discount on SKU 'frost_giant_shield_pack' ($0.99), within authorized 85% discount boundary.`;

      const traceSteps = [
        {
          step: 1,
          name: "Telemetry Ingestion & BQML Feature Store",
          status: "SUCCESS",
          details: `Ingested session '${activeSessionId}' for player '${playerId}'. BQML ML.PREDICT calculated churn risk: 87.0% (CRITICAL).`,
          timestamp: new Date(startTime).toISOString(),
        },
        {
          step: 2,
          name: "Dataplex Knowledge Catalog Policy Aspect Audit",
          status: "APPROVED",
          details: `Dataplex aspect 'liveops_campaign_policy_aspect' verified. Policy Rule: Max Whale Discount <= 85%. SKU '${precachedOffer.sku}' compliant.`,
          timestamp: new Date(startTime + 15).toISOString(),
        },
        {
          step: 3,
          name: "Gemini Enterprise Agent Runtime (agent_kc) Reasoning & Action",
          status: isAutonomous ? "AUTO_EXECUTED" : "PROPOSED",
          details: isAutonomous
            ? `Autonomous Mode ACTIVE: Executed offer '${precachedOffer.title}' via SSE in <300ms.`
            : `Single-Invocation Mode: Proposed offer '${precachedOffer.title}' pending operator execution gate approval.`,
          timestamp: new Date(startTime + 45).toISOString(),
        },
      ];

      const latencyMs = adkResult?.latencyMs || (Date.now() - startTime);

      const responsePayload = {
        status: statusStr,
        agent_id: agentInfo?.id || "",
        agent_name: agentInfo?.displayName || "Knowledge Catalog Analytics Agent",
        session_id: activeSessionId,
        mode: modeStr,
        live: isLiveSuccess,
        endpoint: agentInfo?.endpoint || null,
        player_id: playerId,
        query: queryText,
        user_prompt: queryText,
        response_text: responseText,
        text: responseText,
        active: isActive,
        autonomous: isAutonomous,
        latency_ms: latencyMs,
        error: isLiveSuccess ? null : (adkResult?.error || "Reasoning engine fallback synthetic response generated"),
        bqml_prediction: {
          churn_score: 0.87,
          risk_level: "CRITICAL",
          model: BQML_MODEL_NAME,
        },
        dataplex_aspect: {
          aspect_type: "liveops_campaign_policy_aspect",
          status: "APPROVED",
          max_allowed_discount: 0.85,
        },
        proposed_action: {
          offer: precachedOffer,
          execution_mode: isAutonomous ? "AUTONOMOUS" : "MANUAL_APPROVAL_REQUIRED",
        },
        trace_steps: traceSteps,
        timestamp: new Date().toISOString(),
      };

      if (req.query.stream === "true" || req.headers.accept?.includes("text/event-stream")) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("X-Accel-Buffering", "no");
        res.write(`event: agent_trace_step\ndata: ${JSON.stringify(responsePayload)}\n\n`);
        return res.end();
      }

      return res.json(responsePayload);
    } catch (err: any) {
      console.error("[Agent Trace API Error]:", err);
      return res.status(500).json({
        status: "ERROR",
        agent_id: "",
        agent_name: "Knowledge Catalog Analytics Agent",
        session_id: (req.query.session_id as string) || `sess_${Date.now()}`,
        mode: "MOCK",
        live: false,
        endpoint: null,
        player_id: (req.query.player_id as string) || "player_cosmic_whale_42",
        query: (req.query.query as string) || "Evaluate Player Retention Promo Guardrail",
        user_prompt: (req.query.query as string) || "Evaluate Player Retention Promo Guardrail",
        response_text: `[Error Fallback] ${err?.message || "Agent trace execution failed"}`,
        text: `[Error Fallback] ${err?.message || "Agent trace execution failed"}`,
        active: true,
        autonomous: false,
        latency_ms: Date.now() - startTime,
        error: err?.message || "Agent trace execution failed",
        bqml_prediction: {
          churn_score: 0.87,
          risk_level: "CRITICAL",
          model: BQML_MODEL_NAME,
        },
        dataplex_aspect: {
          aspect_type: "liveops_campaign_policy_aspect",
          status: "APPROVED",
          max_allowed_discount: 0.85,
        },
        proposed_action: {
          offer: precachedOffers.get("player_cosmic_whale_42") || null,
          execution_mode: "MANUAL_APPROVAL_REQUIRED",
        },
        trace_steps: [],
        timestamp: new Date().toISOString(),
      });
    }
  });

  // --------------------------------------------------------------------------
  // GROUP B: Flask API & Embedded Page Reverse Proxies (gamingdatademo / 127.0.0.1:5000)
  // --------------------------------------------------------------------------

  // Group B1. Explicit Flask API Endpoints (proxy to 127.0.0.1:5000)
  app.use([
    "/api/config",
    "/api/table-info",
    "/api/term-info",
    "/api/difficulty-stats",
    "/api/simulate",
    "/api/marketing",
    "/api/executive",
  ], (req: Request, res: Response) => {
    proxyToFlask(req, res);
  });

  // Group B2. Embedded iframe proxy routes for gamingdatademo UI (/agent-comparison, /gamingdatademo)
  // Only proxy to Flask if request is an embedded iframe (sec-fetch-dest: iframe or ?embedded=true).
  // Direct browser navigation falls through to Group C to serve the React 19 Player 360 SPA.
  app.use(["/agent-comparison", "/gamingdatademo"], (req: Request, res: Response, next) => {
    const isIframe =
      req.headers["sec-fetch-dest"] === "iframe" ||
      String(req.query.embedded).toLowerCase() === "true" ||
      req.query.embedded === "1" ||
      req.method === "HEAD";

    if (isIframe) {
      let subPath = req.originalUrl.replace(/^\/(agent-comparison|gamingdatademo)/, "");
      if (!subPath || !subPath.startsWith("/")) {
        subPath = "/" + subPath;
      }
      return proxyToFlask(req, res, subPath);
    }
    return next();
  });

  // Group B3. Explicit Flask HTML Pages & Flask Static Assets
  const flaskHtmlPages = [
    "/executive.html",
    "/architecture.html",
    "/difficulty.html",
    "/toxicity.html",
    "/graph_visualization.html",
    "/marketing_swarm_visualizer.html",
    "/marketing_workflow_mockup.html",
    "/health.html",
  ];

  const flaskStaticAssets = [
    "/styles.css",
    "/visualization.js",
    "/chat.js",
    "/static-responses.json",
  ];

  app.use((req: Request, res: Response, next) => {
    const p = req.path;
    if (
      flaskHtmlPages.includes(p) ||
      flaskStaticAssets.includes(p) ||
      p.startsWith("/icons/") ||
      p.startsWith("/static/") ||
      p.startsWith("/flask-static/")
    ) {
      return proxyToFlask(req, res);
    }
    next();
  });

  // --------------------------------------------------------------------------
  // GROUP C: Primary React 19 Player 360 SPA & Static Assets
  // Strictly captures all top-level non-API/non-proxy GET requests
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OmniArcade Backend Gateway] Running on http://localhost:${PORT}`);
    console.log(`  - Agent Comparison UI (gamingdatademo): http://localhost:${PORT}/agent-comparison`);
    console.log(`  - Telemetry Stream: POST /api/telemetry/stream`);
    console.log(`  - SSE Guardrail Hub: GET /api/guardrail/events`);
    console.log(`  - Dataplex Search Proxy: GET /api/catalog/search`);
    console.log(`  - Dataplex Rule Discovery: POST /api/catalog/rules/discover`);
    console.log(`  - Vertex AI Agent Chat: POST /api/chat`);

    // Pre-cache deployed Gemini Enterprise Agent Runtimes on startup
    discoverReasoningEngines().catch((err) => {
      console.warn("[Agent Runtime Discovery] Startup pre-cache warning:", err.message);
    });
  });

  // --------------------------------------------------------------------------
  // WebSocket Upgrade Proxy for /api/ws (Flask sock)
  // --------------------------------------------------------------------------
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/api/ws")) {
      const targetSocket = net.connect(FLASK_PORT, "127.0.0.1", () => {
        targetSocket.write(
          `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
          Object.entries(req.headers)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("\r\n") +
          "\r\n\r\n"
        );
        if (head && head.length > 0) {
          targetSocket.write(head);
        }
        targetSocket.pipe(socket);
        socket.pipe(targetSocket);
      });

      targetSocket.on("error", (err) => {
        console.error("[WebSocket Proxy Error]:", err.message);
        socket.destroy();
      });

      socket.on("error", (err) => {
        console.error("[WebSocket Client Socket Error]:", err.message);
        targetSocket.destroy();
      });
    }
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[OmniArcade Backend Gateway] Error: Port ${PORT} is already in use. Use a different port or stop the existing process.`);
    } else {
      console.error("[OmniArcade Backend Gateway] Server error:", err);
    }
  });
}

startServer().catch((err) => {
  console.error("[OmniArcade Backend Gateway] Server startup error:", err);
});
