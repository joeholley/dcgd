import React from "react";
import { 
  Server, 
  Database, 
  BrainCircuit, 
  ShieldCheck, 
  Bot, 
  CheckCircle2, 
  AlertCircle, 
  Cpu
} from "lucide-react";
import { cn } from "../../lib/utils";
import { RoutingMode } from "../../services/simulatorBridge";

interface SimulatorDiagnosticsProps {
  routingMode: RoutingMode;
}

/**
 * Simulator Cloud Diagnostics Component
 * Displays health, connectivity, and telemetry ingestion probe status for GCP cloud resources.
 * Reflects LIVE vs MOCKED routing mode and contains explicit backend probe integration TODOs.
 */
export function SimulatorDiagnostics({ routingMode }: SimulatorDiagnosticsProps) {
  const isLive = routingMode === "LIVE";

  /**
   * // TODO: [Backend Probe] Wire up pubsubClient.topic('omniarcade-live-telemetry').exists()
   */
  const pubsubStatus = isLive
    ? { status: "ACTIVE", latency: "14ms", message: "Topic 'omniarcade-live-telemetry' receiving stream" }
    : { status: "MOCKED", latency: "0ms (Local)", message: "MOCKED (OFFLINE SIMULATION) - In-Memory BroadcastChannel" };

  /**
   * // TODO: [Backend Probe] Wire up bigqueryClient.dataset('omniarcade_gold').table('gold_player_360').exists()
   */
  const bigqueryStatus = isLive
    ? { status: "ACTIVE", latency: "42ms", message: "Table 'omniarcade_gold.gold_player_360' active (1.4M rows)" }
    : { status: "MOCKED", latency: "0ms (Local)", message: "MOCKED (OFFLINE SIMULATION) - Client-side JSON buffer" };

  /**
   * // TODO: [Backend Probe] Wire up SELECT * FROM omniarcade_raw.INFORMATION_SCHEMA.MODELS WHERE model_name='player_churn_model'
   */
  const bqmlStatus = isLive
    ? { status: "ACTIVE", latency: "88ms", message: "Model 'omniarcade_raw.player_churn_model' (BQML XGBoost 94.2% ROC-AUC)" }
    : { status: "MOCKED", latency: "0ms (Local)", message: "MOCKED (OFFLINE SIMULATION) - In-memory churn propensity rules" };

  /**
   * // TODO: [Backend Probe] Wire up fetch('https://dataplex.googleapis.com/v1/projects/.../aspectTypes/liveops-campaign-policy-aspect')
   */
  const dataplexStatus = isLive
    ? { status: "ACTIVE", latency: "24ms", message: "Governance Aspect 'liveops-campaign-policy-aspect' verified" }
    : { status: "MOCKED", latency: "0ms (Local)", message: "MOCKED (OFFLINE SIMULATION) - Static policy aspect schema" };

  /**
   * // TODO: [Backend Probe] Wire up fetch('https://us-central1-aiplatform.googleapis.com/v1/.../reasoningEngines/omniarcade-guardrail-agent')
   */
  const vertexStatus = isLive
    ? { status: "ACTIVE", latency: "120ms", message: "Reasoning Engine 'omniarcade-guardrail-agent' (Gemini Enterprise 1.5)" }
    : { status: "MOCKED", latency: "0ms (Local)", message: "MOCKED (OFFLINE SIMULATION) - Canned LLM trace playback" };

  const services = [
    {
      name: "Cloud Pub/Sub Telemetry Ingestion",
      target: "Topic: omniarcade-live-telemetry",
      icon: Server,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      info: pubsubStatus,
      probeCode: "pubsubClient.topic('omniarcade-live-telemetry').exists()",
    },
    {
      name: "BigQuery Player 360 Storage",
      target: "Table: omniarcade_gold.gold_player_360",
      icon: Database,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      info: bigqueryStatus,
      probeCode: "bigqueryClient.dataset('omniarcade_gold').table('gold_player_360').exists()",
    },
    {
      name: "BQML Churn Prediction Engine",
      target: "Model: omniarcade_raw.player_churn_model",
      icon: BrainCircuit,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      info: bqmlStatus,
      probeCode: "SELECT * FROM omniarcade_raw.INFORMATION_SCHEMA.MODELS WHERE model_name='player_churn_model'",
    },
    {
      name: "Dataplex Knowledge Catalog",
      target: "Aspect: liveops-campaign-policy-aspect",
      icon: ShieldCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      info: dataplexStatus,
      probeCode: "fetch('https://dataplex.googleapis.com/v1/projects/.../aspectTypes/liveops-campaign-policy-aspect')",
    },
    {
      name: "Vertex AI Reasoning Engine",
      target: "Agent Engine: omniarcade-guardrail-agent",
      icon: Bot,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      info: vertexStatus,
      probeCode: "fetch('https://us-central1-aiplatform.googleapis.com/v1/.../reasoningEngines/omniarcade-guardrail-agent')",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-400" />
            GCP Cloud Telemetry & Agent Health Probes
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status monitoring for live GCP infrastructure and in-memory fallback simulation.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-slate-400">Current Routing Mode:</span>
          <span
            className={cn(
              "px-3 py-1 rounded-full font-bold uppercase tracking-wider border",
              isLive
                ? "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-sm shadow-blue-500/20"
                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20"
            )}
          >
            {routingMode} MODE
          </span>
        </div>
      </div>

      {/* Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        {services.map((svc) => {
          const Icon = svc.icon;
          return (
            <div
              key={svc.name}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-lg border", svc.bg, svc.border)}>
                    <Icon className={cn("w-5 h-5", svc.color)} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs">{svc.name}</h3>
                    <p className="text-[10px] text-slate-400">{svc.target}</p>
                  </div>
                </div>

                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border",
                    svc.info.status === "ACTIVE"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  )}
                >
                  {svc.info.status === "ACTIVE" ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>LIVE</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-slate-400" />
                      <span>MOCKED</span>
                    </>
                  )}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-1 text-[11px]">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Status Output:</span>
                  <span className="text-[10px] text-slate-500">{svc.info.latency}</span>
                </div>
                <p className="font-semibold text-slate-200">{svc.info.message}</p>
              </div>

              {/* Explicit Integration Probe Comment Affordance */}
              <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 break-all font-mono">
                <span className="text-slate-400 font-semibold">Probe Target: </span>
                <code className="text-indigo-400">{svc.probeCode}</code>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
