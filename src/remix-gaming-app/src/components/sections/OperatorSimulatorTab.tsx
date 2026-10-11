import React, { useState, useEffect } from "react";
import { 
  Sliders, 
  CheckCircle2, 
  Activity, 
  Zap, 
  ShieldAlert, 
  Radio, 
  Server,
  RefreshCw,
  Users
} from "lucide-react";
import { cn } from "../../lib/utils";
import { 
  getSimulatorState, 
  updateSimulatorState, 
  onSimulatorStateUpdate, 
  sendSimulatorEvent, 
  AnomalyType, 
  RoutingMode,
  onSimulatorStateChange,
  broadcastSimulatorState,
  refreshPlayerSampleCache
} from "../../services/simulatorBridge";
import { DiurnalSineWaveGraph } from "./DiurnalSineWaveGraph";
import { SimulatorTelemetryLog } from "./SimulatorTelemetryLog";

interface OperatorSimulatorTabProps {
  routingMode: RoutingMode;
}

export function OperatorSimulatorTab({ routingMode }: OperatorSimulatorTabProps) {
  const [simState, setSimState] = useState(() => getSimulatorState());
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [isRefreshingPlayers, setIsRefreshingPlayers] = useState<boolean>(false);
  const [playerSampleStatus, setPlayerSampleStatus] = useState<string>("50 Random Players Active (All Cohorts)");

  useEffect(() => {
    const unsub = onSimulatorStateUpdate((newState) => {
      setSimState({ ...newState });
    });
    const unsubState = onSimulatorStateChange((state) => {
      setIsSimulating(state.isRunning);
    });
    return () => {
      unsub();
      unsubState();
    };
  }, []);

  // Global 1 Hz background telemetry loop is handled centrally by simulatorBridge.ts

  const handleCCUChange = (val: number) => {
    const clamped = Math.max(0, Math.min(1000000, val));
    updateSimulatorState({ peakCCU: clamped });
  };

  const handleAnomalySelect = async (anomaly: AnomalyType) => {
    updateSimulatorState({ activeAnomaly: anomaly });
    if (routingMode === "LIVE") {
      try {
        await fetch("/api/simulator/inject-anomaly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anomaly_type: anomaly }),
        });
      } catch (err) {
        console.warn("Anomaly injection update error:", err);
      }
    }
  };

  const handleRefreshPlayers = async () => {
    setIsRefreshingPlayers(true);
    try {
      const res = await refreshPlayerSampleCache();
      const timeStr = new Date(res.refreshed_at || Date.now()).toLocaleTimeString();
      setPlayerSampleStatus(`Refreshed ${res.count || 50} Players via RAND() @ ${timeStr}`);
    } catch (err) {
      setPlayerSampleStatus(`Refreshed 50 Players (Fallback Shuffle) @ ${new Date().toLocaleTimeString()}`);
    } finally {
      setIsRefreshingPlayers(false);
    }
  };

  const handleTimezoneToggle = (region: "apac" | "emea" | "na") => {
    updateSimulatorState({
      activeTimezones: {
        ...simState.activeTimezones,
        [region]: !simState.activeTimezones[region],
      },
    });
  };

  const ANOMALY_OPTIONS: Array<{ id: AnomalyType; label: string; desc: string; disabled?: boolean }> = [
    { id: "none", label: "Normal Play (No Anomaly)", desc: "Baseline player progression & steady CloudEvents v1.0 telemetry" },
    { id: "high_churn_boss_deaths", label: "💀 High-Churn Boss Wipeout", desc: "Emits high-death match_ended events across all 50 random players" },
    { id: "ddos_latency_spike", label: "🌐 DDoS Attack & Latency Spike [WIP]", desc: "Volumetric network attack causing 400ms+ ping spikes & packet loss", disabled: true },
    { id: "toxic_chat", label: "☣️ Toxic Chat Contagion [WIP]", desc: "SIR contagion outbreak & GIRA moderation alert triggers", disabled: true },
    { id: "fraudulent_chargeback_wave", label: "💳 Fraudulent Chargeback Wave [WIP]", desc: "Friendly fraud & account takeover dispute cascade", disabled: true },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Operator Controls & Diurnal Sine Wave Graph */}
      <div className="lg:col-span-6 space-y-6">
        {/* Controls Header & Peak CCU Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="font-bold text-white text-sm">Operator Concurrency & Anomaly Controls</h2>
                <p className="text-[11px] text-slate-400">CloudEvents v1.0 Lakehouse Stream • simulator_webapp_demo_raw_events</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefreshPlayers}
                disabled={isRefreshingPlayers}
                title="Pull a fresh random 50-player sample across all cohorts from player_dna via ORDER BY RAND() LIMIT 50"
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold font-mono transition-all border flex items-center gap-1.5 cursor-pointer",
                  isRefreshingPlayers
                    ? "bg-indigo-950/60 text-indigo-300 border-indigo-700/50 opacity-75"
                    : "bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30 hover:text-white"
                )}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isRefreshingPlayers && "animate-spin")} />
                <span>Refresh 50-Player Sample (RAND())</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const nextIsRunning = !isSimulating;
                  setIsSimulating(nextIsRunning);
                  broadcastSimulatorState({
                    isRunning: nextIsRunning,
                    frequencyHz: 2,
                    targetCCU: simState.peakCCU,
                    activeAnomaly: simState.activeAnomaly === "none" ? null : simState.activeAnomaly,
                  });
                  if (routingMode === "LIVE") {
                    const endpoint = nextIsRunning ? "/api/simulator/start" : "/api/simulator/stop";
                    try {
                      await fetch(endpoint, { method: "POST" });
                    } catch (err) {
                      console.warn("Simulator toggle error:", err);
                    }
                  }
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-bold uppercase font-mono tracking-wider transition-all border flex items-center gap-2 cursor-pointer",
                  isSimulating
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                    : "bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200"
                )}
              >
                <span className={cn("w-2.5 h-2.5 rounded-full", isSimulating ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
                <span>Publisher: {isSimulating ? "1 Hz ACTIVE" : "PAUSED"}</span>
              </button>
            </div>
          </div>

          {/* 50-Player Random Sample Status Bar */}
          <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 rounded-xl px-3.5 py-2 text-[11px] font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              Active Player Sample Pool:
            </span>
            <span className="text-indigo-300 font-semibold">{playerSampleStatus}</span>
          </div>

          {/* Synchronized CCU Inputs (Numeric Field + Range Slider) */}
          <div className="space-y-3 font-mono">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-400" />
                Simulated Global PCCU:
              </label>

              {/* Numeric Input Field */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step={10000}
                  value={simState.peakCCU}
                  onChange={(e) => handleCCUChange(parseInt(e.target.value, 10) || 0)}
                  className="w-28 bg-slate-950 border border-slate-700 text-blue-400 font-bold text-xs px-2.5 py-1 rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-slate-400 text-xs font-bold">CCU</span>
              </div>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min="0"
              max="1000000"
              step="10000"
              value={simState.peakCCU}
              onChange={(e) => handleCCUChange(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500 bg-slate-800 rounded-lg h-2.5 cursor-pointer"
            />
          </div>

          {/* Mutually Exclusive LiveOps Anomaly Selector */}
          <div className="space-y-3 pt-2">
            <label className="text-slate-300 text-xs font-semibold font-mono block">
              Mutually Exclusive LiveOps Anomaly Injection Pattern:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
              {ANOMALY_OPTIONS.map((anomaly) => {
                const isSelected = simState.activeAnomaly === anomaly.id;
                const isDisabled = !!anomaly.disabled;
                return (
                  <button
                    key={anomaly.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && handleAnomalySelect(anomaly.id)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all flex flex-col justify-between space-y-1.5",
                      isDisabled
                        ? "bg-slate-950/40 border-slate-800/60 text-slate-500 cursor-not-allowed opacity-60"
                        : isSelected
                        ? "bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-600/20 cursor-pointer"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 cursor-pointer"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        {anomaly.label}
                      </span>
                      {isDisabled ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[9px] font-bold uppercase tracking-wider shrink-0">
                          WIP
                        </span>
                      ) : (
                        isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">{anomaly.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Diurnal Sine Wave Graph Visualization */}
        <DiurnalSineWaveGraph
          peakCCU={simState.peakCCU}
          activeTimezones={simState.activeTimezones}
          onTimezoneToggle={handleTimezoneToggle}
        />
      </div>

      {/* Right Column: GCP Cloud Communications Log */}
      <div className="lg:col-span-6 h-[720px]">
        <SimulatorTelemetryLog routingMode={routingMode} />
      </div>
    </div>
  );
}
