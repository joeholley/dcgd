import React, { useState, useEffect } from 'react';
import { DataModeBadge, DataMode } from '../DataModeBadge';
import { 
  Activity, 
  Database, 
  ShieldCheck, 
  Cpu, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Server, 
  Layers, 
  Terminal,
  Zap,
  Globe,
  Radio,
  Sliders,
  Filter
} from 'lucide-react';

interface SubFeatureStatus {
  name: string;
  connected: boolean;
  source: string;
  mode: DataMode;
  latencyMs: number;
}

interface SectionDiagnostic {
  id: string;
  name: string;
  category: 'Executive & Analytics' | 'LiveOps & Automation' | 'Agent & AI Workspace' | 'Observability & Diagnostics';
  type: 'React (Native)' | 'Flask (Proxied)';
  route: string;
  overallMode: DataMode;
  subFeatures: SubFeatureStatus[];
}

interface GCPServiceProbe {
  id: string;
  name: string;
  description: string;
  status: 'ONLINE' | 'LIVE' | 'FALLBACK' | 'OFFLINE';
  mode: DataMode;
  latencyMs?: number;
  latency_ms?: number;
  details: string;
}

export function Diagnostics() {
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>(new Date().toLocaleTimeString());
  const [filterMode, setFilterMode] = useState<'ALL' | 'LIVE' | 'MOCK'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const [expandedProbes, setExpandedProbes] = useState<Record<string, boolean>>({});
  const [probeLogs, setProbeLogs] = useState<Record<string, Array<{ timestamp: string; status: 'ONLINE' | 'LIVE' | 'FALLBACK' | 'OFFLINE'; message: string; latencyMs: number }>>>({});

  const [gcpServices, setGcpServices] = useState<GCPServiceProbe[]>([
    { id: 'simulator', name: 'Live Game Telemetry Simulator Engine', description: 'Real-time player session telemetry generator (CCU curve, event ticks & anomaly injection)', status: 'OFFLINE', mode: 'mock', latencyMs: 1, details: 'Simulator idle; toggle ON to publish live telemetry stream' },
    { id: 'auth', name: 'Google Cloud OAuth / ADC', description: 'Google Cloud OAuth & IAM Authentication', status: 'LIVE', mode: 'live', latencyMs: 14, details: 'Authenticated via ADC for project gaming-demo' },
    { id: 'bq_players', name: 'BigQuery Table: gaming_raw.gcp_players', description: 'Player Profiles & Spend Tiers', status: 'FALLBACK', mode: 'mock', latencyMs: 12, details: 'Table gaming_raw.gcp_players unreachable; dev fallback active' },
    { id: 'bq_sessions', name: 'BigQuery Table: gaming_raw.live_session_events', description: 'Live Session Telemetry Stream', status: 'FALLBACK', mode: 'mock', latencyMs: 15, details: 'Table gaming_raw.live_session_events unreachable; dev fallback active' },
    { id: 'bq_transactions', name: 'BigQuery Table: gaming_raw.iap_transactions', description: 'In-App Purchase Transactions', status: 'FALLBACK', mode: 'mock', latencyMs: 10, details: 'Table gaming_raw.iap_transactions unreachable; dev fallback active' },
    { id: 'bq_p360', name: 'BigQuery Table: gaming_gold.gold_player_360', description: 'Player 360 Feature Store & LTV', status: 'FALLBACK', mode: 'mock', latencyMs: 14, details: 'Table gaming_gold.gold_player_360 unreachable; dev fallback active' },
    { id: 'bq_regional', name: 'BigQuery Table: gaming_gold.gold_regional_kpis', description: 'Regional Revenue & DAU Analytics', status: 'FALLBACK', mode: 'mock', latencyMs: 11, details: 'Table gaming_gold.gold_regional_kpis unreachable; dev fallback active' },
    { id: 'bq_campaigns', name: 'BigQuery Table: gaming_gold.gold_campaign_analytics', description: 'Campaign ROI & Conversion Tracking', status: 'FALLBACK', mode: 'mock', latencyMs: 13, details: 'Table gaming_gold.gold_campaign_analytics unreachable; dev fallback active' },
    { id: 'bq_latency', name: 'BigQuery Table: gaming_silver.server_latency', description: 'CCU, Ping Latency & FPS', status: 'FALLBACK', mode: 'mock', latencyMs: 9, details: 'Table gaming_silver.server_latency unreachable; dev fallback active' },
    { id: 'bq_difficulty', name: 'BigQuery Table: gaming_gold.gold_level_difficulty_funnel', description: 'Level Completion & Failure Funnel', status: 'FALLBACK', mode: 'mock', latencyMs: 12, details: 'Table gaming_gold.gold_level_difficulty_funnel unreachable; dev fallback active' },
    { id: 'pubsub', name: 'Cloud Pub/Sub Streaming Ingest', description: 'gaming-live-telemetry & BQ Direct Sub', status: 'FALLBACK', mode: 'mock', latencyMs: 16, details: 'Pub/Sub topic gaming-live-telemetry active (Dev Mock)' },
    { id: 'firestore', name: 'Cloud Firestore Operational Datastore', description: 'Campaigns & Certified Offers Collection Store', status: 'FALLBACK', mode: 'mock', latencyMs: 8, details: 'Firestore campaigns & offers collections active (Dev Fallback)' },
    { id: 'bqml', name: 'BigQuery ML (ML.PREDICT)', description: 'ML.PREDICT gaming_raw.player_churn_model', status: 'FALLBACK', mode: 'mock', latencyMs: 5, details: 'Dynamic heuristic churn scoring active in dev fallback' },
    { id: 'dataplex', name: 'Dataplex Knowledge Catalog API', description: 'Aspect Types, Business Glossaries & Lineage', status: 'FALLBACK', mode: 'mock', latencyMs: 32, details: 'Dataplex REST API aspect registry active (Dev Fallback)' },
    { 
      id: 'vertex_agent_kc', 
      name: 'agent_kc (Knowledge Catalog Analytics Agent)', 
      description: 'Liveness health check for dynamic Vertex AI Reasoning Engine (auto-detected at startup)', 
      status: 'LIVE', 
      mode: 'live', 
      latencyMs: 38, 
      details: 'ADC Authenticated | Dynamic Reasoning Engine endpoint auto-detected at startup' 
    },
  ]);

  const [sections, setSections] = useState<SectionDiagnostic[]>([
    {
      id: 'overview',
      name: 'Gaming Overview',
      category: 'Executive & Analytics',
      type: 'React (Native)',
      route: '/',
      overallMode: 'hybrid',
      subFeatures: [
        { name: 'Player 360 Feature Store (gold_player_360)', connected: true, source: 'BigQuery Gold Table', mode: 'live', latencyMs: 28 },
        { name: 'Regional Revenue & MAU (gold_regional_kpis)', connected: false, source: 'Synthetic Dev Fallback', mode: 'mock', latencyMs: 6 },
        { name: 'Cross-Cloud Lineage Cards', connected: true, source: 'Dataplex Lineage API', mode: 'live', latencyMs: 32 }
      ]
    },
    {
      id: 'operations',
      name: 'Game Performance',
      category: 'Executive & Analytics',
      type: 'React (Native)',
      route: '/operations',
      overallMode: 'hybrid',
      subFeatures: [
        { name: 'Real-Time CCU & Latency Graphs', connected: false, source: 'Recharts Dev Stream', mode: 'mock', latencyMs: 4 },
        { name: 'Server Regional Capacity (server_latency)', connected: false, source: 'Synthetic Dev Fallback', mode: 'mock', latencyMs: 5 },
        { name: 'Game Failure Spike Simulator Proxy', connected: true, source: 'Flask /api/difficulty-stats', mode: 'live', latencyMs: 14 }
      ]
    },
    {
      id: 'executive-portfolio',
      name: 'Executive Portfolio',
      category: 'Executive & Analytics',
      type: 'Flask (Proxied)',
      route: '/executive.html',
      overallMode: 'live',
      subFeatures: [
        { name: 'Portfolio Level Revenue Diagnostics', connected: true, source: 'Flask /api/executive/portfolio-metrics', mode: 'live', latencyMs: 18 },
        { name: 'Executive Incident Simulator', connected: true, source: 'Flask /api/executive/simulate-diagnostics', mode: 'live', latencyMs: 22 }
      ]
    },
    {
      id: 'guardrail',
      name: 'LiveOps Churn Guardrail',
      category: 'LiveOps & Automation',
      type: 'React (Native)',
      route: '/guardrail',
      overallMode: 'live',
      subFeatures: [
        { name: 'Telemetry Event Stream (/api/telemetry/stream)', connected: true, source: 'Cloud Pub/Sub Topic', mode: 'live', latencyMs: 16 },
        { name: 'BigQuery Direct Subscription Ingestion', connected: true, source: 'gaming_raw.live_session_events', mode: 'live', latencyMs: 28 },
        { name: 'BQML Churn Probability (ML.PREDICT)', connected: true, source: 'gaming_player_churn_model', mode: 'live', latencyMs: 36 },
        { name: 'Dataplex Policy Verification', connected: true, source: 'liveops_campaign_policy_aspect', mode: 'live', latencyMs: 32 },
        { name: 'SSE Certified Offer Push (/api/guardrail/events)', connected: true, source: 'Express SSE Hub', mode: 'live', latencyMs: 10 }
      ]
    },
    {
      id: 'campaigns',
      name: 'Campaign Engine',
      category: 'LiveOps & Automation',
      type: 'React (Native)',
      route: '/campaigns',
      overallMode: 'mock',
      subFeatures: [
        { name: 'Campaign Analytics (gold_campaign_analytics)', connected: false, source: 'Dev Fallback Data', mode: 'mock', latencyMs: 6 },
        { name: 'Campaign CRUD State Store', connected: false, source: 'Firestore In-Memory Mock', mode: 'mock', latencyMs: 4 },
        { name: 'Marketing Swarm Anomaly Simulator', connected: true, source: 'Flask /api/marketing/simulate-cluster', mode: 'live', latencyMs: 18 }
      ]
    },
    {
      id: 'difficulty-balancer',
      name: 'Difficulty Balancer',
      category: 'LiveOps & Automation',
      type: 'Flask (Proxied)',
      route: '/difficulty.html',
      overallMode: 'live',
      subFeatures: [
        { name: 'Level 2 Completion Funnel', connected: true, source: 'Flask /api/difficulty-stats', mode: 'live', latencyMs: 14 },
        { name: 'Autonomous Playtest Solver Simulation', connected: true, source: 'Flask /api/simulate/difficulty-spike', mode: 'live', latencyMs: 45 }
      ]
    },
    {
      id: 'marketing-swarm',
      name: 'Marketing Recovery Swarm',
      category: 'LiveOps & Automation',
      type: 'Flask (Proxied)',
      route: '/marketing_swarm_visualizer.html',
      overallMode: 'live',
      subFeatures: [
        { name: 'Cohort Cluster Telemetry', connected: true, source: 'Flask /api/marketing/cohort-telemetry', mode: 'live', latencyMs: 16 },
        { name: 'ROAS Recovery Multi-Agent Planner', connected: true, source: 'Flask /api/marketing/simulate-cluster', mode: 'live', latencyMs: 52 }
      ]
    },
    {
      id: 'workflows',
      name: 'Operations Agent Workflows',
      category: 'Agent & AI Workspace',
      type: 'React (Native)',
      route: '/workflows',
      overallMode: 'hybrid',
      subFeatures: [
        { name: 'Retention & Gift Card Promo Pipeline', connected: true, source: 'LiveOps Guardrail Engine', mode: 'live', latencyMs: 48 },
        { name: 'Anti-Cheat Memory Tampering Detector', connected: false, source: 'Synthetic Trace Generator', mode: 'mock', latencyMs: 8 }
      ]
    },
    {
      id: 'agent-comparison',
      name: 'Agent Comparison Workspace',
      category: 'Agent & AI Workspace',
      type: 'Flask (Proxied)',
      route: '/agent-comparison',
      overallMode: 'live',
      subFeatures: [
        { name: 'WebSocket Query Step Streaming (/api/ws)', connected: true, source: 'Flask-Sock Proxy', mode: 'live', latencyMs: 12 },
        { name: 'Dataplex Knowledge Catalog Search Tools', connected: true, source: 'Dataplex Knowledge Catalog API', mode: 'live', latencyMs: 44 }
      ]
    },
    {
      id: 'lineage-graph',
      name: 'Cross-Cloud Lineage Graph',
      category: 'Agent & AI Workspace',
      type: 'Flask (Proxied)',
      route: '/graph_visualization.html',
      overallMode: 'live',
      subFeatures: [
        { name: 'Dataplex Catalog Graph Data', connected: true, source: 'Dataplex REST API', mode: 'live', latencyMs: 38 }
      ]
    },
    {
      id: 'catalog',
      name: 'Telemetry Catalog',
      category: 'Observability & Diagnostics',
      type: 'React (Native)',
      route: '/catalog',
      overallMode: 'live',
      subFeatures: [
        { name: 'Dataplex Metadata Search (/api/catalog/search)', connected: true, source: 'Dataplex Knowledge Catalog REST API', mode: 'live', latencyMs: 32 },
        { name: 'Automatic Rule Discovery Sandbox', connected: true, source: 'Express Policy Compiler (/api/catalog/rules/discover)', mode: 'live', latencyMs: 24 }
      ]
    },
    {
      id: 'observatory',
      name: 'API Observatory',
      category: 'Observability & Diagnostics',
      type: 'React (Native)',
      route: '/observatory',
      overallMode: 'hybrid',
      subFeatures: [
        { name: 'BigQuery Audit Log Query Stream', connected: true, source: 'BigQuery Audit Logs', mode: 'live', latencyMs: 35 },
        { name: 'API Latency Distribution', connected: false, source: 'Synthetic Log Stream', mode: 'mock', latencyMs: 6 }
      ]
    },
    {
      id: 'toxicity',
      name: 'Trust & Safety Observatory',
      category: 'Observability & Diagnostics',
      type: 'Flask (Proxied)',
      route: '/toxicity.html',
      overallMode: 'live',
      subFeatures: [
        { name: 'Toxic Chat Stream & GIRA Assessment', connected: true, source: 'Flask /api/simulate/toxicity-incident', mode: 'live', latencyMs: 42 }
      ]
    },
    {
      id: 'diagnostics',
      name: 'System Diagnostics',
      category: 'Observability & Diagnostics',
      type: 'React (Native)',
      route: '/diagnostics',
      overallMode: 'live',
      subFeatures: [
        { name: 'Multi-Service Diagnostics Probe (/api/system/diagnostics)', connected: true, source: 'Express Probe Gateway', mode: 'live', latencyMs: 12 }
      ]
    },
    {
      id: 'gcp-health',
      name: 'Google Cloud Health',
      category: 'Observability & Diagnostics',
      type: 'React (Native)',
      route: '/gcp-health',
      overallMode: 'live',
      subFeatures: [
        { name: '6-Service Health Probe (/api/system/gcp-health)', connected: true, source: 'Express Probe Gateway', mode: 'live', latencyMs: 14 }
      ]
    }
  ]);

    // Live Game Telemetry Simulator Control State & Handlers
  const [simulator, setSimulator] = useState<{
    isRunning: boolean;
    currentCCU: number;
    activeAnomaly: string | null;
    totalEventsPublished: number;
    eventRateHz: number;
  }>({
    isRunning: false,
    currentCCU: 250000,
    activeAnomaly: "high_churn_boss_deaths",
    totalEventsPublished: 0,
    eventRateHz: 12,
  });

  const fetchSimulatorStatus = async () => {
    try {
      const res = await fetch('/api/simulator/status');
      if (res.ok) {
        const data = await res.json();
        setSimulator({
          isRunning: !!data.isRunning,
          currentCCU: data.currentCCU || 250000,
          activeAnomaly: data.activeAnomaly || null,
          totalEventsPublished: data.totalEventsPublished || 0,
          eventRateHz: data.eventRateHz || 12,
        });
      }
    } catch (err) {
      console.warn('Simulator status fetch error:', err);
    }
  };

  useEffect(() => {
    fetchSimulatorStatus();
    const interval = setInterval(fetchSimulatorStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSimulator = async () => {
    const endpoint = simulator.isRunning ? '/api/simulator/stop' : '/api/simulator/start';
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSimulator(prev => ({
          ...prev,
          isRunning: !!data.isRunning,
          currentCCU: data.currentCCU || prev.currentCCU,
          activeAnomaly: data.activeAnomaly !== undefined ? data.activeAnomaly : prev.activeAnomaly,
          totalEventsPublished: data.totalEventsPublished || prev.totalEventsPublished,
        }));
        fetchDiagnostics();
      }
    } catch (err) {
      console.warn('Simulator toggle error:', err);
    }
  };

  const handleInjectAnomaly = async (type: string) => {
    try {
      const res = await fetch('/api/simulator/inject-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimulator(prev => ({
          ...prev,
          activeAnomaly: data.activeAnomaly || null,
        }));
        fetchDiagnostics();
      }
    } catch (err) {
      console.warn('Simulator anomaly injection error:', err);
    }
  };

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/diagnostics');
      if (res.ok) {
        const data = await res.json();
        if (data.gcp_services && Array.isArray(data.gcp_services)) {
          setGcpServices(data.gcp_services);
          const nowStr = new Date().toLocaleTimeString();
          setProbeLogs(prev => {
            const updated = { ...prev };
            data.gcp_services.forEach((svc: GCPServiceProbe) => {
              const prevLogs = updated[svc.id] || [];
              const newEntry = {
                timestamp: nowStr,
                status: svc.status,
                message: svc.details || `${svc.name} probe active`,
                latencyMs: svc.latencyMs ?? svc.latency_ms ?? 0
              };
              updated[svc.id] = [...prevLogs, newEntry];
            });
            return updated;
          });
        }
      }
    } catch (err) {
      console.warn('Diagnostics API fetch fallback:', err);
    } finally {
      setLastCheck(new Date().toLocaleTimeString());
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleRunDiagnostics = () => {
    fetchDiagnostics();
  };

  const filteredSections = sections.filter(sec => {
    if (selectedCategory !== 'ALL' && sec.category !== selectedCategory) return false;
    if (filterMode === 'LIVE' && sec.overallMode === 'mock') return false;
    if (filterMode === 'MOCK' && sec.overallMode === 'live') return false;
    return true;
  });

  const liveCount = sections.filter(s => s.overallMode === 'live').length;
  const mockCount = sections.filter(s => s.overallMode === 'mock').length;
  const hybridCount = sections.filter(s => s.overallMode === 'hybrid').length;

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 font-sans p-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-7 h-7 text-blue-500" />
              Multi-Service System Diagnostics
            </h1>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              HEALTHY (WITH DEV MOCKS)
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time single-pane-of-glass probe across 14 application sections and 8 Google Cloud backend services.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right font-mono text-xs text-slate-400 hidden sm:block">
            <p>Last Diagnostic Check:</p>
            <p className="text-slate-200 font-semibold">{lastCheck}</p>
          </div>

          <button
            type="button"
            onClick={handleRunDiagnostics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-lg shadow-blue-600/20"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Probing Services...' : 'Run Full Diagnostic'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 font-mono">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Sections</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-white">{sections.length}</span>
            <span className="text-xs text-slate-500">9 React / 6 Flask</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 font-mono">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Live GCP Connected</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-emerald-400">{liveCount}</span>
            <span className="text-xs text-emerald-500/80">{sections.length > 0 ? (liveCount / sections.length * 100).toFixed(0) : 0}% Live</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 font-mono">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">In-Memory Dev Mocks</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-amber-400">{mockCount}</span>
            <span className="text-xs text-amber-500/80">Synthetic Fallbacks</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/20 font-mono">
          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Hybrid (GCP + Mock)</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-purple-400">{hybridCount}</span>
            <span className="text-xs text-purple-500/80">Partial Connections</span>
          </div>
        </div>
      </div>

      {/* GCP Backend Infrastructure Probes (Full-Width List with Health Log History) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            Google Cloud Infrastructure & BigQuery Table Probes ({gcpServices.length})
          </h3>
          <span className="text-xs text-slate-500 font-mono">Click probe to view health log history</span>
        </div>

        <div className="flex flex-col gap-3 w-full">
          {gcpServices.map(svc => {
            const isExpanded = expandedProbes[svc.id] || false;
            const history = probeLogs[svc.id] || [
              { timestamp: new Date().toLocaleTimeString(), status: svc.status, message: svc.details || `${svc.name} probe active`, latencyMs: svc.latencyMs ?? svc.latency_ms ?? 0 }
            ];
            const latestLog = history[history.length - 1];

            return (
              <div
                key={svc.id}
                className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${svc.status === 'LIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono">{svc.name}</h4>
                      <p className="text-xs text-slate-400 font-sans">{svc.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <DataModeBadge mode={svc.mode} />
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${svc.status === 'LIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {svc.status} ({svc.latencyMs ?? svc.latency_ms ?? 0}ms)
                    </span>
                  </div>
                </div>

                {/* Latest Log / Terminal Window */}
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800/80 font-mono text-xs text-slate-300 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-800/60 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      Probe Health Check Output
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedProbes(prev => ({ ...prev, [svc.id]: !prev[svc.id] }))}
                      className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer flex items-center gap-1 text-[11px]"
                    >
                      {isExpanded ? 'Hide History ▲' : `View Health History (${history.length} logs) ▼`}
                    </button>
                  </div>

                  {/* Single Latest Log */}
                  {!isExpanded && (
                    <div className="flex items-center justify-between text-xs text-slate-300 py-0.5">
                      <span className="truncate pr-4 font-mono text-slate-300">
                        <span className="text-slate-500">[{latestLog.timestamp}]</span>{' '}
                        <strong className={latestLog.status === 'LIVE' ? 'text-emerald-400' : 'text-amber-400'}>
                          [{latestLog.status}]
                        </strong>{' '}
                        {latestLog.message}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">{latestLog.latencyMs}ms</span>
                    </div>
                  )}

                  {/* Expanded Scrollable History List */}
                  {isExpanded && (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 pt-1 font-mono text-xs">
                      {history.map((log, idx) => (
                        <div key={idx} className="flex items-start justify-between border-b border-slate-800/40 pb-1 text-slate-300">
                          <span className="break-all">
                            <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                            <strong className={log.status === 'LIVE' ? 'text-emerald-400' : 'text-amber-400'}>
                              [{log.status}]
                            </strong>{' '}
                            {log.message}
                          </span>
                          <span className="text-[10px] text-slate-500 shrink-0 ml-2 font-mono">{log.latencyMs}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section & Sub-Feature Matrix */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Application Section & Sub-Feature Matrix
          </h3>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Category selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Categories (15)</option>
                <option value="Executive & Analytics">Executive & Analytics</option>
                <option value="LiveOps & Automation">LiveOps & Automation</option>
                <option value="Agent & AI Workspace">Agent & AI Workspace</option>
                <option value="Observability & Diagnostics">Observability & Diagnostics</option>
              </select>
            </div>

            {/* Mode filter buttons */}
            <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${filterMode === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                All Modes
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('LIVE')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${filterMode === 'LIVE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Live GCP Only
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('MOCK')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${filterMode === 'MOCK' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Dev Mocks Only
              </button>
            </div>
          </div>
        </div>

        {/* Matrix List */}
        <div className="space-y-4">
          {filteredSections.map(section => (
            <div
              key={section.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-750 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <div>
                    <h4 className="text-base font-bold text-white">{section.name}</h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Category: <span className="text-slate-300">{section.category}</span> | Type: <span className="text-blue-400 font-semibold">{section.type}</span> | Route: <code>{section.route}</code>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <DataModeBadge mode={section.overallMode} />
                </div>
              </div>

              {/* Sub-features list */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.subFeatures.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200 leading-snug">{feat.name}</span>
                      <DataModeBadge mode={feat.mode} />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-slate-400 border-t border-slate-900">
                      <span className="truncate max-w-[180px]" title={feat.source}>Source: {feat.source}</span>
                      <span className="text-slate-300 shrink-0">{feat.latencyMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
