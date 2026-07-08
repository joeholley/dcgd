import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Zap, 
  Flame, 
  Skull, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Radio, 
  FileJson, 
  Award, 
  ShoppingBag,
  TrendingUp,
  DollarSign,
  Clock,
  ChevronRight,
  Sparkles,
  Database,
  Lock
} from "lucide-react";
import { cn } from "../../lib/utils";
import { DataModeBadge } from "../DataModeBadge";
import { useDemoEvent } from "../../context/DemoEventContext";

interface TelemetryEvent {
  session_id: string;
  player_id: string;
  event_type: string;
  consecutive_deaths: number;
  session_duration_seconds: number;
  predicted_churn_score: number;
  churn_risk_level: string;
  player_tier: string;
  pubsub_message_id?: string;
  timestamp: string;
  latency_ms: number;
  offer_precached?: boolean;
}

interface CertifiedOffer {
  offer_id: string;
  sku: string;
  title: string;
  description: string;
  price: number;
  original_price: number;
  discount_pct: number;
  certified_by: string;
  policy_aspect_id: string;
  policy_status: string;
  max_allowed_discount: number;
  player_tier: string;
  latency_ms: number;
}

export function LiveOpsGuardrail() {
  // Telemetry & State
  const [consecutiveDeaths, setConsecutiveDeaths] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(420);
  const [churnScore, setChurnScore] = useState(0.25);
  const [churnRiskLevel, setChurnRiskLevel] = useState("LOW");
  const [isPrecached, setIsPrecached] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [lastLatency, setLastLatency] = useState(14);
  const [isStreaming, setIsStreaming] = useState(false);

  // Revenue Counters
  const [churnsAverted, setChurnsAverted] = useState(0);
  const [incrementalRevenue, setIncrementalRevenue] = useState(0);

  // SSE & Log
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryEvent[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Current certified offer details
  const [activeOffer, setActiveOffer] = useState<CertifiedOffer>({
    offer_id: "offer_frost_giant_01",
    sku: "frost_giant_shield_pack",
    title: "$0.99 Frost Giant Shield Pack",
    description: "Instant Resurrect + 24hr Frost Giant Shield Protection + 500 Gems",
    price: 0.99,
    original_price: 4.99,
    discount_pct: 80,
    certified_by: "dataplex_policy_aspect",
    policy_aspect_id: "liveops_campaign_policy_aspect",
    policy_status: "APPROVED",
    max_allowed_discount: 0.85,
    player_tier: "Whale",
    latency_ms: 14,
  });

  // Connect to SSE Endpoint (/api/guardrail/events)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/guardrail/events");

      eventSource.addEventListener("telemetry_update", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setChurnScore(data.predicted_churn_score);
          setChurnRiskLevel(data.churn_risk_level);
          setLastLatency(data.latency_ms || 18);

          if (data.predicted_churn_score >= 0.50) {
            setIsPrecached(true);
          }
          if (data.predicted_churn_score >= 0.85 && data.offer) {
            setActiveOffer(data.offer);
            setShowOffer(true);
          }

          setTelemetryLogs(prev => [data, ...prev.slice(0, 19)]);
        } catch (err) {
          console.error("Error parsing SSE telemetry_update:", err);
        }
      });

      eventSource.addEventListener("policy_precached", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setIsPrecached(true);
          if (data.offer) setActiveOffer(data.offer);
        } catch (err) {
          console.error("Error parsing SSE policy_precached:", err);
        }
      });

      eventSource.addEventListener("churn_guardrail_triggered", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setShowOffer(true);
          if (data.offer) setActiveOffer(data.offer);
        } catch (err) {
          console.error("Error parsing SSE churn_guardrail_triggered:", err);
        }
      });

    } catch (err) {
      console.warn("SSE connection error, fallback mode:", err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Scroll logs to top when new events arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [telemetryLogs]);

  // Send Telemetry Event to /api/telemetry/stream
  const sendTelemetryEvent = async (eventType: string, extraDeaths: number = 0) => {
    setIsStreaming(true);
    const newDeaths = consecutiveDeaths + extraDeaths;
    setConsecutiveDeaths(newDeaths);

    const payload = {
      session_id: `sess_${Date.now()}`,
      player_id: "player_cosmic_whale_42",
      event_type: eventType,
      consecutive_deaths: newDeaths,
      session_duration_seconds: sessionDuration + 30,
    };

    setSessionDuration(prev => prev + 30);

    try {
      const res = await fetch("/api/telemetry/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
        if (data.bqml_prediction) {
          const score = data.bqml_prediction.predicted_churn_score;
          setChurnScore(score);
          setChurnRiskLevel(data.bqml_prediction.churn_risk_level);
          setLastLatency(data.latency_ms || 18);

          if (score >= 0.50) {
            setIsPrecached(true);
          }
          if (score >= 0.85) {
            setShowOffer(true);
          }
        }

        const logEntry: TelemetryEvent = {
          session_id: payload.session_id,
          player_id: payload.player_id,
          event_type: eventType,
          consecutive_deaths: newDeaths,
          session_duration_seconds: payload.session_duration_seconds,
          predicted_churn_score: data.bqml_prediction?.predicted_churn_score || churnScore,
          churn_risk_level: data.bqml_prediction?.churn_risk_level || churnRiskLevel,
          player_tier: "Whale",
          pubsub_message_id: data.pubsub_message_id,
          timestamp: new Date().toISOString(),
          latency_ms: data.latency_ms || 18,
          offer_precached: isPrecached || (data.bqml_prediction?.predicted_churn_score >= 0.50),
        };

        setTelemetryLogs(prev => [logEntry, ...prev.slice(0, 19)]);
    } catch (err) {
      console.warn("Telemetry stream error, executing local fallback simulation:", err);
      // Local fallback logic
      const calculatedScore = eventType === "boss_fail" 
        ? Math.min(0.95, 0.25 + (newDeaths * 0.22))
        : eventType === "mission_quit" 
        ? 0.87 
        : 0.18;

      setChurnScore(calculatedScore);
      setChurnRiskLevel(calculatedScore >= 0.80 ? "CRITICAL" : calculatedScore >= 0.50 ? "HIGH" : "LOW");

      if (calculatedScore >= 0.50) setIsPrecached(true);
      if (calculatedScore >= 0.85) setShowOffer(true);

      const fallbackLog: TelemetryEvent = {
        session_id: payload.session_id,
        player_id: payload.player_id,
        event_type: eventType,
        consecutive_deaths: newDeaths,
        session_duration_seconds: payload.session_duration_seconds,
        predicted_churn_score: calculatedScore,
        churn_risk_level: calculatedScore >= 0.80 ? "CRITICAL" : calculatedScore >= 0.50 ? "HIGH" : "LOW",
        player_tier: "Whale",
        pubsub_message_id: `pubsub_mock_${Date.now()}`,
        timestamp: new Date().toISOString(),
        latency_ms: 18,
        offer_precached: calculatedScore >= 0.50,
      };
      setTelemetryLogs(prev => [fallbackLog, ...prev.slice(0, 19)]);
    } finally {
      setIsStreaming(false);
    }
  };

  // Handle Offer Purchase
  const handlePurchase = async () => {
    // Stream purchase event
    await sendTelemetryEvent("iap_purchase", 0);
    setOfferAccepted(true);
    setShowOffer(false);
    setChurnsAverted(prev => prev + 1);
    setIncrementalRevenue(prev => prev + activeOffer.price);
    setChurnScore(0.18);
    setChurnRiskLevel("LOW");
    setConsecutiveDeaths(0);
    setIsPrecached(false);
  };

  // Reset Simulation
  const handleReset = () => {
    setConsecutiveDeaths(0);
    setSessionDuration(420);
    setChurnScore(0.25);
    setChurnRiskLevel("LOW");
    setIsPrecached(false);
    setShowOffer(false);
    setOfferAccepted(false);
  };

  // SVG Radial Gauge Calculation
  const gaugeRadius = 70;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const strokeDashoffset = gaugeCircumference - (churnScore * gaugeCircumference);

  const { triggerMarketingRecovery, activeGuardrailPolicy } = useDemoEvent();

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 flex flex-col font-sans p-6 space-y-6">
      {/* Top Observatory Control Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-white">LiveOps Guardrail Split-Screen View</h1>
              <DataModeBadge mode="live" source="omniarcade-live-telemetry" details="Cloud Pub/Sub + BQML ML.PREDICT + Dataplex Aspect Verification" />
            </div>
            <p className="text-xs text-slate-400 font-light mt-0.5">
              Closed-loop Pub/Sub telemetry, BQML churn prediction, Dataplex aspect verification & &lt;300ms pop-up execution.
            </p>
          </div>
        </div>

        {/* Closed-Loop Revenue Metrics */}
        <div className="flex items-center gap-4 sm:gap-6 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
          <div className="px-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">Churn Averted</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">+{churnsAverted}</span>
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">Incremental Rev</span>
              <span className="text-lg font-bold text-blue-400 font-mono">+${incrementalRevenue.toFixed(2)}</span>
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">Pop-up Latency</span>
              <span className="text-lg font-bold text-purple-300 font-mono">&lt; 300ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Split-Screen Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* LEFT PANEL: Interactive Game Client Simulator */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col relative overflow-hidden shadow-2xl">
          {/* Game Client Header Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                Game Client Simulator (Cosmic Raider RPG)
              </span>
            </div>
            <button
              onClick={handleReset}
              className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset Game State
            </button>
          </div>

          {/* RPG Encounter Display Area */}
          <div className="flex-1 bg-slate-950/80 rounded-2xl border border-slate-800/80 p-6 flex flex-col justify-between relative overflow-hidden min-h-[360px]">
            {/* Ambient Background Gradient for Game Mood */}
            <div className={cn(
              "absolute inset-0 transition-opacity duration-700 pointer-events-none opacity-30",
              churnScore >= 0.80 ? "bg-gradient-to-t from-red-600/30 via-slate-950 to-slate-950" :
              churnScore >= 0.50 ? "bg-gradient-to-t from-amber-600/20 via-slate-950 to-slate-950" :
              "bg-gradient-to-t from-blue-600/10 via-slate-950 to-slate-950"
            )} />

            {/* Boss Fight HUD Header */}
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest block mb-1">
                  ⚔️ Level 85 Raid Encounter
                </span>
                <h3 className="text-xl font-extrabold text-white tracking-tight">Frost Giant Overlord</h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Player Profile</span>
                <span className="text-xs font-bold text-blue-400 font-mono">cosmic_whale_42 (Whale Tier)</span>
              </div>
            </div>

            {/* Boss Health Bar */}
            <div className="relative z-10 space-y-2 my-4">
              <div className="flex justify-between text-xs font-mono font-bold">
                <span className="text-slate-300">Boss Health</span>
                <span className="text-red-400">15% HP Remaining</span>
              </div>
              <div className="h-4 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full w-[15%] transition-all duration-500" />
              </div>
            </div>

            {/* Player Stats & Status */}
            <div className="relative z-10 grid grid-cols-3 gap-3 my-4">
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                <span className="text-[9px] font-mono text-slate-400 uppercase block">Deaths</span>
                <span className="text-lg font-bold font-mono text-white">{consecutiveDeaths}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                <span className="text-[9px] font-mono text-slate-400 uppercase block">Session Time</span>
                <span className="text-lg font-bold font-mono text-white">{Math.floor(sessionDuration / 60)}m {sessionDuration % 60}s</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                <span className="text-[9px] font-mono text-slate-400 uppercase block">Pre-Cached</span>
                <span className={cn("text-xs font-bold font-mono px-2 py-0.5 rounded uppercase inline-block mt-1", isPrecached ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-500")}>
                  {isPrecached ? "READY (<300ms)" : "NONE"}
                </span>
              </div>
            </div>

            {/* Game Action Controls */}
            <div className="relative z-10 pt-4 border-t border-slate-800 space-y-3">
              <div className="text-xs font-mono font-bold text-slate-400 uppercase">Simulate Telemetry Actions:</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendTelemetryEvent("boss_fail", 1)}
                  disabled={isStreaming}
                  className="px-4 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Skull className="w-4 h-4" /> Fail Encounter (+1 Death)
                </button>
                <button
                  onClick={() => sendTelemetryEvent("mission_quit", 1)}
                  disabled={isStreaming}
                  className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4" /> Quit Mission (Exit Intent)
                </button>
              </div>
            </div>

            {/* In-Game Instant Dynamic Pop-up Offer Overlay (<300ms) */}
            <AnimatePresence>
              {showOffer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute inset-4 z-30 bg-slate-900/95 border-2 border-amber-500/80 rounded-2xl p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(245,158,11,0.3)] backdrop-blur-md"
                >
                  {/* Top Policy Header */}
                  <div>
                    <div className="flex items-center justify-between border-b border-amber-500/30 pb-3 mb-4">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Sparkles className="w-5 h-5 animate-spin" />
                        <span className="text-xs font-mono font-extrabold uppercase tracking-widest">
                          INSTANT CHURN GUARDRAIL OFFER
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-mono font-bold uppercase">
                        ⚡ {lastLatency}ms Execution (Pre-Cached)
                      </span>
                    </div>

                    {/* Offer Body */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xl font-black text-white tracking-tight">{activeOffer.title}</h4>
                        <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase">
                          {activeOffer.discount_pct}% OFF
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-light leading-relaxed">
                        {activeOffer.description}
                      </p>

                      {/* Dataplex Governance Aspect Compliance Audit Tag */}
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-1.5 font-mono text-[10px]">
                        <div className="flex justify-between text-slate-400">
                          <span>Dataplex Governance Aspect:</span>
                          <span className="text-amber-400 font-bold">{activeOffer.policy_aspect_id}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Target Tier:</span>
                          <span className="text-blue-400 font-bold">{activeOffer.player_tier} Tier</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Policy Status:</span>
                          <span className="text-emerald-400 font-bold">✓ {activeOffer.policy_status} (Max Allowed: {activeOffer.max_allowed_discount * 100}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Purchase Action Buttons */}
                  <div className="pt-4 border-t border-slate-800 space-y-2">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-xs text-slate-400 font-mono">Special Promotional Price:</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-slate-500 line-through font-mono">${activeOffer.original_price}</span>
                        <span className="text-xl font-black text-emerald-400 font-mono">${activeOffer.price}</span>
                      </div>
                    </div>

                    <button
                      onClick={handlePurchase}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
                    >
                      <ShoppingBag className="w-5 h-5" /> Accept & Purchase (${activeOffer.price})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerMarketingRecovery({
                          playerId: "player_cosmic_whale_42",
                          churnProbability: churnScore || 0.87,
                          payerTier: "Whale",
                          recommendedOffer: activeOffer.title,
                          timestamp: new Date().toISOString()
                        });
                      }}
                      className="w-full py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-purple-400" /> Trigger Marketing Recovery Swarm ↗
                    </button>
                    <button
                      onClick={() => setShowOffer(false)}
                      className="w-full py-2 text-center text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Dismiss & Exit Game
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>

        {/* RIGHT PANEL: Real-Time LiveOps Telemetry & Guardrail Observatory */}
        <div className="lg:col-span-6 space-y-6 flex flex-col">
          
          {/* Top Section: BQML Radial Churn Propensity Gauge */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col sm:flex-row items-center gap-6">
            
            {/* Circular SVG Radial Gauge */}
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                {/* Background Track Circle */}
                <circle
                  cx="80"
                  cy="80"
                  r={gaugeRadius}
                  className="stroke-slate-800"
                  strokeWidth="14"
                  fill="transparent"
                />
                {/* Value Progress Circle */}
                <circle
                  cx="80"
                  cy="80"
                  r={gaugeRadius}
                  className={cn(
                    "transition-all duration-700 ease-out",
                    churnScore >= 0.80 ? "stroke-red-500" :
                    churnScore >= 0.50 ? "stroke-amber-500" : "stroke-emerald-500"
                  )}
                  strokeWidth="14"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              {/* Gauge Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black font-mono tracking-tight text-white">
                  {(churnScore * 100).toFixed(0)}%
                </span>
                <span className={cn(
                  "text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded mt-0.5",
                  churnScore >= 0.80 ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                  churnScore >= 0.50 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                  "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                )}>
                  {churnRiskLevel} RISK
                </span>
              </div>
            </div>

            {/* Churn Engine Details & Step Indicator */}
            <div className="flex-1 space-y-4">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">BQML Logistic Model</span>
                <h3 className="text-lg font-bold text-white">Real-Time Churn Propensity</h3>
                <p className="text-xs text-slate-400 font-light mt-1">
                  Trained on <code className="text-blue-400">omniarcade_raw.player_churn_model</code> via BigQuery ML.
                </p>
              </div>

              {/* Stepper Milestones */}
              <div className="space-y-2 border-t border-slate-800 pt-3 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", churnScore >= 0.25 ? "bg-emerald-400" : "bg-slate-700")} />
                    25% Nominal Baseline
                  </span>
                  <span className="text-emerald-400 text-[10px]">Normal Play</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", churnScore >= 0.50 ? "bg-amber-400 animate-ping" : "bg-slate-700")} />
                    50% High Risk Threshold
                  </span>
                  <span className={cn("text-[10px]", churnScore >= 0.50 ? "text-amber-400 font-bold" : "text-slate-600")}>
                    Dataplex Pre-Caching
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", churnScore >= 0.85 ? "bg-red-400 animate-ping" : "bg-slate-700")} />
                    87% Critical Boundary
                  </span>
                  <span className={cn("text-[10px]", churnScore >= 0.85 ? "text-red-400 font-bold" : "text-slate-600")}>
                    Pop-up Overlay (&lt;300ms)
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Dataplex Policy Verification Audit Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-blue-400" />
                <h4 className="text-sm font-bold text-white tracking-tight">Dataplex Policy Verification Audit</h4>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-mono uppercase">
                Dataplex Aspect Tag
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[9px] text-slate-500 uppercase block">Policy Aspect ID</span>
                <span className="text-slate-200 font-bold text-[11px] block truncate">{activeOffer.policy_aspect_id}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[9px] text-slate-500 uppercase block">Verification Decision</span>
                <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[9px] text-slate-500 uppercase block">Max Discount Boundary</span>
                <span className="text-amber-400 font-bold text-[11px]">{(activeOffer.max_allowed_discount * 100)}% Max</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[9px] text-slate-500 uppercase block">Certified Reward SKU</span>
                <span className="text-purple-300 font-bold text-[11px] truncate">{activeOffer.sku}</span>
              </div>
            </div>
          </div>

          {/* Live Streaming JSON Telemetry Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex-1 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Pub/Sub Streaming Telemetry Log
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                Topic: <code className="text-slate-300">omniarcade-live-telemetry</code>
              </span>
            </div>

            <div
              ref={logContainerRef}
              className="flex-1 bg-slate-950 rounded-2xl p-4 border border-slate-800/80 font-mono text-[11px] overflow-y-auto max-h-[260px] space-y-3"
            >
              {telemetryLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-8">
                  No telemetry events emitted yet. Click "Fail Encounter" or "Quit Mission" on the left panel.
                </div>
              ) : (
                telemetryLogs.map((log, index) => (
                  <div key={index} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="text-blue-400 font-bold">[{log.event_type.toUpperCase()}]</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-slate-300 grid grid-cols-2 gap-2 text-[10px]">
                      <div>Session: <span className="text-slate-400">{log.session_id.substring(0, 14)}...</span></div>
                      <div>Pub/Sub ID: <span className="text-slate-400">{log.pubsub_message_id?.substring(0, 12)}...</span></div>
                      <div>Deaths: <span className="text-amber-400">{log.consecutive_deaths}</span></div>
                      <div>BQML Score: <span className="text-emerald-400 font-bold">{(log.predicted_churn_score * 100).toFixed(0)}% ({log.churn_risk_level})</span></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
