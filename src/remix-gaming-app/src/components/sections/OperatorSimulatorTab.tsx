import React, { useState, useEffect } from "react";
import { 
  Sliders, 
  CheckCircle2, 
  Activity, 
  Zap, 
  ShieldAlert, 
  Radio, 
  Server 
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
  broadcastSimulatorState
} from "../../services/simulatorBridge";
import { DiurnalSineWaveGraph } from "./DiurnalSineWaveGraph";
import { SimulatorTelemetryLog } from "./SimulatorTelemetryLog";

interface OperatorSimulatorTabProps {
  routingMode: RoutingMode;
}

export function OperatorSimulatorTab({ routingMode }: OperatorSimulatorTabProps) {
  const [simState, setSimState] = useState(() => getSimulatorState());
  const [isSimulating, setIsSimulating] = useState<boolean>(true);

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

  // Hardcoded 1 Hz (1000ms) background telemetry publishing loop
  useEffect(() => {
    if (!isSimulating) return;
    const intervalMs = 1000; // Hardcoded 1 Hz rate

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      sendSimulatorEvent({
        type: "ccu_telemetry_ping",
        gameId: "cosmic_raider_rpg",
        userId: "system-ccu-stream",
        payload: {
          currentCCU: Math.round(simState.peakCCU * (0.95 + Math.random() * 0.1)),
          activeAnomaly: simState.activeAnomaly,
          activeTimezones: simState.activeTimezones,
          timestamp: Date.now(),
        },
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isSimulating, simState.peakCCU, simState.activeAnomaly, simState.activeTimezones]);

  const handleCCUChange = (val: number) => {
    const clamped = Math.max(0, Math.min(1000000, val));
    updateSimulatorState({ peakCCU: clamped });
  };

  const handleAnomalySelect = (anomaly: AnomalyType) => {
    updateSimulatorState({ activeAnomaly: anomaly });
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
    { id: "none", label: "Normal Play (No Anomaly)", desc: "Baseline player progression & steady telemetry" },
    { id: "high_churn_boss_deaths", label: "💀 High-Churn Boss Death", desc: "Repeated Frost Giant wipeouts & churn risk" },
    { id: "level_2_bottleneck", label: "⚡ Level 2 Bottleneck", desc: "Excessive move exhaustion & difficulty drop", disabled: true },
    { id: "toxic_chat", label: "☣️ Toxic Chat Outbreak", desc: "High-frequency chat flags & GIRA alert trigger", disabled: true },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Operator Controls & Diurnal Sine Wave Graph */}
      <div className="lg:col-span-6 space-y-6">
        {/* Controls Header & Peak CCU Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="font-bold text-white text-sm">Operator Concurrency & Anomaly Controls</h2>
                <p className="text-[11px] text-slate-400">Hardcoded 1 Hz Stream Ingestion Loop</p>
              </div>
            </div>

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
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />}
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
