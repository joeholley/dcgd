import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Gamepad2, 
  Flame, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Server, 
  Zap, 
  Skull, 
  LogOut, 
  ShoppingBag,
  Sliders,
  Radio
} from "lucide-react";
import { cn } from "../../lib/utils";
import { 
  getRoutingMode, 
  setRoutingMode, 
  onRoutingModeChange, 
  sendSimulatorEvent, 
  RoutingMode 
} from "../../services/simulatorBridge";
import { SimulatorDiagnostics } from "./SimulatorDiagnostics";

/**
 * Standalone Game Telemetry Simulator Interface
 * Provides fine-grained telemetry generation controls, a mock RPG game client,
 * user-controlled LIVE / MOCKED telemetry routing, and GCP Cloud Diagnostics.
 */
export function SimulatorInterface() {
  const [routingMode, setRoutingModeState] = useState<RoutingMode>(getRoutingMode());
  const [activeTab, setActiveTab] = useState<"client" | "diagnostics">("client");

  // Simulator controls state
  const [frequencyHz, setFrequencyHz] = useState<number>(2);
  const [targetCCU, setTargetCCU] = useState<number>(14280);
  const [activeAnomaly, setActiveAnomaly] = useState<string | null>("high_churn_boss_deaths");
  const [isSimulating, setIsSimulating] = useState<boolean>(true);

  // Game client state
  const [bossHealth, setBossHealth] = useState<number>(65);
  const [playerDeaths, setPlayerDeaths] = useState<number>(4);
  const [quitAttempts, setQuitAttempts] = useState<number>(2);
  const [lastActionStatus, setLastActionStatus] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [activeOffer, setActiveOffer] = useState<{ id: string; title: string; price: string } | null>(null);

  useEffect(() => {
    return onRoutingModeChange((newMode) => {
      setRoutingModeState(newMode);
    });
  }, []);

  // Background telemetry emission timer when isSimulating is ACTIVE
  useEffect(() => {
    if (!isSimulating) return;
    const intervalMs = Math.round(1000 / Math.max(0.5, frequencyHz));
    const timer = setInterval(() => {
      sendSimulatorEvent({
        type: "ccu_telemetry_ping font-mono",
        gameId: "cosmic_raider_rpg",
        userId: "system-ccu-stream",
        payload: {
          currentCCU: Math.round(targetCCU * (0.95 + Math.random() * 0.1)),
          activeAnomaly,
          timestamp: Date.now(),
        },
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isSimulating, frequencyHz, targetCCU, activeAnomaly]);

  const handleAction = async (actionType: "boss_fail" | "mission_quit" | "offer_accepted") => {
    setIsProcessingAction(true);
    setLastActionStatus(`Dispatching ${actionType} event...`);

    let nextBossHealth = bossHealth;
    let nextPlayerDeaths = playerDeaths;
    let nextQuitAttempts = quitAttempts;

    if (actionType === "boss_fail") {
      nextPlayerDeaths = playerDeaths + 1;
      nextBossHealth = Math.max(10, bossHealth - 15);
      setPlayerDeaths(nextPlayerDeaths);
      setBossHealth(nextBossHealth);
      if (nextPlayerDeaths >= 3) {
        setActiveOffer({
          id: "frost_giant_shield_pack",
          title: "Frost Giant Shield & Resurrect Crate",
          price: "$0.99 (80% OFF)",
        });
      }
    } else if (actionType === "mission_quit") {
      nextQuitAttempts = quitAttempts + 1;
      setQuitAttempts(nextQuitAttempts);
    } else if (actionType === "offer_accepted") {
      setActiveOffer(null);
    }

    /**
     * // TODO: [Backend Integration - Telemetry Stream] Wire up real-time gRPC / WebSockets stream to Cloud Pub/Sub topic 'omniarcade-live-telemetry'
     */
    const result = await sendSimulatorEvent({
      type: actionType,
      gameId: "cosmic_raider_rpg",
      userId: "usr-whale-9982",
      payload: {
        bossHealth: nextBossHealth,
        playerDeaths: nextPlayerDeaths,
        quitAttempts: nextQuitAttempts,
        activeAnomaly,
      },
    });

    setIsProcessingAction(false);
    if (result.success) {
      setLastActionStatus(
        `[${result.mode} MODE] Event published successfully. (PubSub ID: ${result.data?.pubsubMessageId || "live-pubsub-7782"})`
      );
    } else {
      setLastActionStatus(`[${result.mode} MODE] Event dispatch warning: ${result.data?.error || "Unknown error"}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white font-mono shadow-md shadow-indigo-600/30">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              OmniArcade Telemetry Simulator
              <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                v2.4-Standalone
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Multi-Window Game Client & Cloud Telemetry Emission Control</p>
          </div>
        </div>

        {/* User-Controlled LIVE / MOCKED Routing Mode Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-full border border-slate-800 shadow-inner font-mono text-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase px-2">Data Flow Mode:</span>
            <button
              type="button"
              onClick={() => setRoutingMode("LIVE")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase transition-all cursor-pointer border",
                routingMode === "LIVE"
                  ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200"
              )}
            >
              LIVE (GCP Backend)
            </button>
            <button
              type="button"
              onClick={() => setRoutingMode("MOCKED")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase transition-all cursor-pointer border",
                routingMode === "MOCKED"
                  ? "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200"
              )}
            >
              MOCKED (In-Memory)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSimulating(!isSimulating)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-bold uppercase font-mono tracking-wider transition-all border flex items-center gap-2 cursor-pointer",
              isSimulating
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
            )}
          >
            <span className={cn("w-2.5 h-2.5 rounded-full", isSimulating ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
            <span>Simulator: {isSimulating ? "ACTIVE" : "PAUSED"}</span>
          </button>
        </div>
      </header>

      {/* Main Tab Controls */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-2 flex items-center justify-between shrink-0 font-mono text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("client")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer border",
              activeTab === "client"
                ? "bg-slate-800 text-white border-slate-700 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border-transparent"
            )}
          >
            <Gamepad2 className="w-4 h-4 text-orange-400" />
            <span>Mock RPG Game Client (Cosmic Raider)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("diagnostics")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer border",
              activeTab === "diagnostics"
                ? "bg-slate-800 text-white border-slate-700 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border-transparent"
            )}
          >
            <Server className="w-4 h-4 text-blue-400" />
            <span>Cloud Resource Diagnostics</span>
          </button>
        </div>

        <div className="flex items-center gap-4 text-slate-400 text-xs">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <strong className="text-slate-200">{targetCCU.toLocaleString()}</strong> CCU Target
          </span>
          <span className="flex items-center gap-1.5 border-l border-slate-800 pl-4">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <strong className="text-slate-200">{frequencyHz} Hz</strong> Emission Rate
          </span>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "diagnostics" ? (
          <SimulatorDiagnostics routingMode={routingMode} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
            {/* Left Column: Finer Simulator Control Panel */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <h2 className="font-bold text-white text-sm">Fine-Grained Telemetry Controls</h2>
                </div>
                <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20">
                  REALTIME GENERATOR
                </span>
              </div>

              {/* Emission Frequency Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <label className="text-slate-300 font-semibold">Publishing Frequency (Hz):</label>
                  <span className="text-indigo-400 font-bold">{frequencyHz} Hz ({Math.round(1000 / frequencyHz)}ms interval)</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={frequencyHz}
                  onChange={(e) => setFrequencyHz(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                />
              </div>

              {/* Target CCU Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <label className="text-slate-300 font-semibold">Simulated CCU Multiplier:</label>
                  <span className="text-blue-400 font-bold">{targetCCU.toLocaleString()} CCU</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="50000"
                  step="1000"
                  value={targetCCU}
                  onChange={(e) => setTargetCCU(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                />
              </div>

              {/* Anomaly Injection Selector */}
              <div className="space-y-2">
                <label className="text-slate-300 text-xs font-semibold font-mono block">Injected Anomaly Pattern:</label>
                <div className="grid grid-cols-1 gap-2 font-mono text-xs">
                  {[
                    { id: "none", label: "Normal Play (No Anomaly)", desc: "Baseline player progression" },
                    { id: "high_churn_boss_deaths", label: "💀 High-Churn Boss Death", desc: "Repeated Frost Giant wipeouts" },
                    { id: "level_2_bottleneck", label: "⚡ Level 2 Bottleneck", desc: "Excessive move exhaustion" },
                    { id: "toxic_chat", label: "☣️ Toxic Chat Outbreak", desc: "High-frequency harassment flag" },
                  ].map((anomaly) => (
                    <button
                      key={anomaly.id}
                      type="button"
                      onClick={() => setActiveAnomaly(anomaly.id)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between",
                        activeAnomaly === anomaly.id
                          ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-600/10"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      )}
                    >
                      <div>
                        <p className="font-bold text-xs">{anomaly.label}</p>
                        <p className="text-[10px] text-slate-500">{anomaly.desc}</p>
                      </div>
                      {activeAnomaly === anomaly.id && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Output Box */}
              {lastActionStatus && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Telemetry Output Log:</span>
                  </div>
                  <p className="break-all text-slate-400">{lastActionStatus}</p>
                </div>
              )}
            </div>

            {/* Right Column: Mock Game Client (Cosmic Raider RPG) */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-orange-400" />
                  <div>
                    <h2 className="font-bold text-white text-sm">Mock Game Client (Cosmic Raider RPG)</h2>
                    <p className="text-[11px] text-slate-400">Raid Encounter: Frost Giant Overlord (Lvl 85)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20">
                    PLAYER COHORT: VETERAN WHALE
                  </span>
                </div>
              </div>

              {/* Game HUD Panel */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-5 space-y-4 font-mono relative overflow-hidden">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Skull className="w-5 h-5 text-red-400" />
                    <span className="font-bold text-red-300 text-sm">Frost Giant Overlord</span>
                  </div>
                  <span className="text-xs text-slate-400">Boss HP: {bossHealth}%</span>
                </div>

                {/* Boss Health Bar */}
                <div className="w-full bg-slate-900 rounded-full h-3 border border-slate-800 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-600 to-orange-500 h-full transition-all duration-300"
                    style={{ width: `${bossHealth}%` }}
                  />
                </div>

                {/* Player HUD Metrics */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Wipeouts / Deaths:</span>
                    <span className="text-lg font-bold text-amber-400">{playerDeaths} Consecutive Fails</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Exit Intent Count:</span>
                    <span className="text-lg font-bold text-orange-400">{quitAttempts} Mission Quits</span>
                  </div>
                </div>

                {/* Dynamic Offer Pop-up Overlay (In-Game Injected Offer) */}
                {activeOffer && (
                  <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-orange-950/60 border border-amber-500/40 shadow-lg relative animate-fade-in space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase">
                        SPECIAL RETENTION PROMO
                      </span>
                      <span className="text-xs text-amber-300 font-bold">{activeOffer.price}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{activeOffer.title}</h4>
                      <p className="text-xs text-slate-300">Dataplex Policy Approved SKU (`frost_giant_shield_pack`)</p>
                    </div>
                    <button
                      type="button"
                      disabled={isProcessingAction}
                      onClick={() => handleAction("offer_accepted")}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>[Accept & Purchase Offer]</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons for Telemetry Simulation */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-slate-300 font-mono uppercase">Trigger Interactive Player Actions:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                  <button
                    type="button"
                    disabled={isProcessingAction}
                    onClick={() => handleAction("boss_fail")}
                    className="p-3 bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 text-red-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <Flame className="w-4 h-4 text-red-400" />
                    <span>[Fail Encounter (+1 Death)]</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessingAction}
                    onClick={() => handleAction("mission_quit")}
                    className="p-3 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 text-amber-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4 text-amber-400" />
                    <span>[Quit Mission (Exit Intent)]</span>
                  </button>
                </div>
              </div>

              {/* Footer info */}
              <div className="mt-auto pt-4 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex items-center justify-between">
                <span>Routing target: {routingMode === "LIVE" ? "GCP /api/telemetry/stream" : "In-Memory BroadcastChannel"}</span>
                <span>Session: JG-SIM-8821</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
