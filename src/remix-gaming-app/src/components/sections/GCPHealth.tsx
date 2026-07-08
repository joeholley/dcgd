import { DataModeBadge } from "../DataModeBadge";
import { useState, useEffect } from "react";
import { 
  CloudCheck, 
  Activity, 
  RefreshCw, 
  Database, 
  Radio, 
  BrainCircuit, 
  Key, 
  Compass, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  Clock,
  Server
} from "lucide-react";

interface ServiceHealth {
  status: "LIVE" | "MOCK";
  details: string;
  latency_ms: number;
}

interface GCPHealthResponse {
  timestamp: string;
  project_id: string;
  region: string;
  overall_status: "ALL_LIVE" | "HEALTHY_WITH_FALLBACKS" | "OFFLINE_MOCK";
  total_latency_ms: number;
  services: {
    auth: ServiceHealth;
    bigquery: ServiceHealth;
    pubsub: ServiceHealth;
    bqml: ServiceHealth;
    dataplex: ServiceHealth;
    vertex_agent: ServiceHealth;
  };
}

export function GCPHealth() {
  const [healthData, setHealthData] = useState<GCPHealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  const fetchHealth = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/system/gcp-health", { signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: GCPHealthResponse = await res.json();
      setHealthData(data);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Failed to query GCP system health endpoint");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal);
    return () => {
      controller.abort();
    };
  }, []);

  const serviceConfigs = [
    {
      key: "auth" as const,
      name: "Google Auth / ADC",
      description: "Application Default Credentials & OAuth2 token provider",
      icon: Key,
    },
    {
      key: "bigquery" as const,
      name: "BigQuery Gold Tables",
      description: "Analytical lakehouse feature tables (omniarcade_gold)",
      icon: Database,
    },
    {
      key: "pubsub" as const,
      name: "Cloud Pub/Sub Telemetry",
      description: "Real-time session event stream (omniarcade-live-telemetry)",
      icon: Radio,
    },
    {
      key: "bqml" as const,
      name: "BQML Churn Prediction",
      description: "In-warehouse ML.PREDICT logistic regression model",
      icon: BrainCircuit,
    },
    {
      key: "dataplex" as const,
      name: "Dataplex Knowledge Catalog",
      description: "Cross-cloud data governance, aspect tags, & glossary",
      icon: Compass,
    },
    {
      key: "vertex_agent" as const,
      name: "Vertex AI Agent Engine",
      description: "ADK reasoning engines & MCP tool orchestration",
      icon: Server,
    },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-3"><h1 className="text-2xl font-bold tracking-tight">GCP Connection & Health Status</h1><DataModeBadge 
              mode={
                healthData?.overall_status === 'ALL_LIVE' ? 'live' : 
                healthData?.overall_status === 'HEALTHY_WITH_FALLBACKS' ? 'hybrid' : 'mock'
              } 
              source="GCP Diagnostic Probes" 
            /></div>
          </div>
          <p className="text-slate-400 text-sm pl-13">
            Real-time diagnostic monitor evaluating Google Cloud resource connectivity and quiet fallback status.
          </p>
        </div>

        <button
          onClick={() => fetchHealth()}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg shadow-blue-600/20 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Re-Testing..." : "Re-Test Connection"}</span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Health Status Overview */}
      {healthData && (
        <div className="space-y-8">
          {/* Status Summary Banner */}
          <div className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            healthData.overall_status === "ALL_LIVE"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : healthData.overall_status === "HEALTHY_WITH_FALLBACKS"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
              : "bg-purple-500/10 border-purple-500/30 text-purple-300"
          }`}>
            <div className="flex items-center gap-4">
              {healthData.overall_status === "ALL_LIVE" ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
              )}
              <div>
                <h2 className="text-lg font-bold">
                  {healthData.overall_status === "ALL_LIVE" && "All GCP Services Connected & Live"}
                  {healthData.overall_status === "HEALTHY_WITH_FALLBACKS" && "Operational with Quiet Fallbacks Active"}
                  {healthData.overall_status === "OFFLINE_MOCK" && "Offline / Mock Mode Active"}
                </h2>
                <p className="text-xs opacity-90 mt-0.5">
                  Project: <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono">{healthData.project_id}</code> | Region: <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono">{healthData.region}</code> | Evaluation Latency: {healthData.total_latency_ms}ms
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/10 self-start md:self-auto">
              <Clock className="w-3.5 h-3.5" />
              <span>Tested at {new Date(healthData.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Service Health Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceConfigs.map((config) => {
              const serviceHealth = healthData.services?.[config.key];
              const isLive = serviceHealth?.status === "LIVE";
              const Icon = config.icon;

              return (
                <div
                  key={config.key}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 transition-all duration-200"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-100">{config.name}</h3>
                          <p className="text-[11px] text-slate-400">{config.description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Status</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                            isLive
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          }`}
                        >
                          {isLive ? "LIVE" : "MOCK FALLBACK"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Probe Latency</span>
                        <span className="font-mono text-slate-300 text-[11px]">
                          {serviceHealth?.latency_ms ?? 0} ms
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50 font-mono text-[11px] leading-relaxed">
                      {serviceHealth?.details || "No diagnostic info available"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Raw JSON Toggle */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Raw Health Payload</span>
              </div>
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                {showRawJson ? "Hide Payload" : "Show Payload"}
              </button>
            </div>

            {showRawJson && (
              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                {JSON.stringify(healthData, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
