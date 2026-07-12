import React, { useState, useEffect } from "react";
import { 
  Gamepad2, 
  Sliders, 
  Radio, 
  Server, 
  Activity, 
  Globe,
  Crown 
} from "lucide-react";
import { cn } from "../../lib/utils";
import { 
  getRoutingMode, 
  setRoutingMode, 
  onRoutingModeChange, 
  getSimulatorState, 
  onSimulatorStateUpdate, 
  RoutingMode, 
  SimulatorPersistentState 
} from "../../services/simulatorBridge";
import { MockClientTab } from "./MockClientTab";
import { OperatorSimulatorTab } from "./OperatorSimulatorTab";
import { SimulatorDiagnostics } from "./SimulatorDiagnostics";

/**
 * OmniArcade Telemetry Simulator Interface
 * Main 2-tab architecture refactored for OmniArcade Player 360 Platform:
 * Tab 1: Mock Client View (Player HUD + Cohort Selector + Telemetry Log with GCP links)
 * Tab 2: Operations View (Synchronized CCU controls + 24-hr Diurnal Sine Wave Graph + Mutually Exclusive Anomaly Selector)
 */
export function SimulatorInterface() {
  const [routingMode, setRoutingModeState] = useState<RoutingMode>(getRoutingMode());
  const [activeTab, setActiveTab] = useState<"client" | "operations" | "diagnostics">("client");
  const [simState, setSimState] = useState<SimulatorPersistentState>(() => getSimulatorState());

  useEffect(() => {
    const unsubMode = onRoutingModeChange((newMode) => {
      setRoutingModeState(newMode);
    });

    const unsubState = onSimulatorStateUpdate((newState) => {
      setSimState({ ...newState });
    });

    return () => {
      unsubMode();
      unsubState();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Main Header Bar */}
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
            <p className="text-[11px] text-slate-400">Multi-Window Game Client & Cloud Telemetry Control Hub</p>
          </div>
        </div>

        {/* User-Controlled LIVE / MOCKED Data Routing Mode Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-full border border-slate-800 shadow-inner font-mono text-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase px-2">Data Routing:</span>
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
                  ? "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/30"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200"
              )}
            >
              MOCKED (In-Memory)
            </button>
          </div>
        </div>
      </header>

      {/* Primary Navigation Tab Switcher */}
      <div className="bg-slate-900/70 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between shrink-0 font-mono text-xs">
        <div className="flex items-center gap-2">
          {/* Tab 1: Mock Client View */}
          <button
            type="button"
            onClick={() => setActiveTab("client")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer border",
              activeTab === "client"
                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200 bg-slate-950 border-slate-800"
            )}
          >
            <Gamepad2 className="w-4 h-4 text-orange-400" />
            <span>Tab 1: Mock Client View</span>
          </button>

          {/* Tab 2: Operations View */}
          <button
            type="button"
            onClick={() => setActiveTab("operations")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer border",
              activeTab === "operations"
                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200 bg-slate-950 border-slate-800"
            )}
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Tab 2: Operations View</span>
          </button>

          {/* Auxiliary Cloud Resource Diagnostics Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("diagnostics")}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer border text-[11px]",
              activeTab === "diagnostics"
                ? "bg-slate-800 text-white border-slate-700 shadow-sm"
                : "text-slate-500 hover:text-slate-300 bg-transparent border-transparent"
            )}
          >
            <Server className="w-3.5 h-3.5 text-blue-400" />
            <span>Cloud Resource Diagnostics</span>
          </button>
        </div>

        {/* Persistent Summary Metadata Bar */}
        <div className="flex items-center gap-4 text-slate-400 text-xs">
          <span className="flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            Cohort: <strong className="text-slate-200">{simState.selectedCohort}</strong>
          </span>
          <span className="flex items-center gap-1.5 border-l border-slate-800 pl-4">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            Target: <strong className="text-slate-200">{simState.peakCCU.toLocaleString()} CCU</strong>
          </span>
          <span className="flex items-center gap-1.5 border-l border-slate-800 pl-4">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            Rate: <strong className="text-slate-200">1 Hz (Hardcoded)</strong>
          </span>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "client" && <MockClientTab routingMode={routingMode} />}
        {activeTab === "operations" && <OperatorSimulatorTab routingMode={routingMode} />}
        {activeTab === "diagnostics" && <SimulatorDiagnostics routingMode={routingMode} />}
      </div>
    </div>
  );
}
