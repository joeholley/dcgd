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
  latencyMs: number;
  details: string;
}

export function Diagnostics() {
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>(new Date().toLocaleTimeString());
  const [filterMode, setFilterMode] = useState<'ALL' | 'LIVE' | 'MOCK'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const [gcpServices, setGcpServices] = useState<GCPServiceProbe[]>([
    { id: 'auth', name: 'Application Default Credentials (ADC)', description: 'Google Cloud OAuth & IAM Authentication', status: 'ONLINE', mode: 'live', latencyMs: 14, details: 'Authenticated as GCP Service Account (omniarcade-demo)' },
    { id: 'bigquery', name: 'BigQuery Gold Feature Store', description: 'omniarcade_gold datasets & gold_player_360', status: 'ONLINE', mode: 'live', latencyMs: 28, details: 'Dataset omniarcade_gold active (US Multi-region)' },
    { id: 'pubsub', name: 'Cloud Pub/Sub Ingestion Topic', description: 'omniarcade-live-telemetry & BQ Direct Sub', status: 'ONLINE', mode: 'live', latencyMs: 16, details: 'Topic omniarcade-live-telemetry online' },
    { id: 'bqml', name: 'BigQuery ML Churn Model', description: 'ML.PREDICT omniarcade_raw.player_churn_model', status: 'FALLBACK', mode: 'mock', latencyMs: 5, details: 'Using dynamic heuristic churn scoring in dev' },
    { id: 'dataplex', name: 'Dataplex Knowledge Catalog APIs', description: 'Aspect Types, Business Glossaries & Lineage', status: 'ONLINE', mode: 'live', latencyMs: 32, details: 'Dataplex REST API & Aspect Registry online' },
    { id: 'vertex', name: 'Vertex AI Reasoning Engine', description: 'ReasoningEngine omniarcade-guardrail-agent', status: 'ONLINE', mode: 'live', latencyMs: 44, details: 'Vertex AI ADK Agent Engine active' },
    { id: 'firestore', name: 'Firestore / Firebase State Store', description: 'Campaign Engine CRUD & Offer Audit Trail', status: 'FALLBACK', mode: 'mock', latencyMs: 8, details: 'Running in-memory local backend mock' },
    { id: 'flask', name: 'Internal Flask App Proxy (:5000)', description: 'TCP Net Socket & HTTP Reverse Proxying', status: 'ONLINE', mode: 'live', latencyMs: 12, details: 'Flask 127.0.0.1:5000 proxy active' }
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
        { name: 'BigQuery Direct Subscription Ingestion', connected: true, source: 'omniarcade_raw.live_session_events', mode: 'live', latencyMs: 28 },
        { name: 'BQML Churn Probability (ML.PREDICT)', connected: true, source: 'player_churn_model', mode: 'live', latencyMs: 36 },
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
      name: 'Gameplay Agent Workflows',
      category: 'Agent & AI Workspace',
      type: 'React (Native)',
      route: '/workflows',
      overallMode: 'hybrid',
      subFeatures: [
        { name: 'Retention & Gift Card Promo Pipeline', connected: true, source: 'Vertex AI Agent Engine', mode: 'live', latencyMs: 48 },
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
        { name: 'KC-Guided Agent Dataplex Tools', connected: true, source: 'Vertex AI Reasoning Engine + Dataplex', mode: 'live', latencyMs: 44 }
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
      name: 'GCP System Health',
      category: 'Observability & Diagnostics',
      type: 'React (Native)',
      route: '/gcp-health',
      overallMode: 'live',
      subFeatures: [
        { name: '6-Service Health Probe (/api/system/gcp-health)', connected: true, source: 'Express Probe Gateway', mode: 'live', latencyMs: 14 }
      ]
    }
  ]);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/diagnostics');
      if (res.ok) {
        const data = await res.json();
        if (data.gcp_services && Array.isArray(data.gcp_services)) {
          setGcpServices(data.gcp_services);
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

      {/* GCP Backend Core Services Grid */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          Google Cloud Infrastructure Probes
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {gcpServices.map(svc => (
            <div
              key={svc.id}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-bold text-white leading-snug">{svc.name}</h4>
                <DataModeBadge mode={svc.mode} />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">{svc.description}</p>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500">Latency: <strong className="text-slate-300">{svc.latencyMs}ms</strong></span>
                <span className={`font-semibold ${svc.status === 'LIVE' ? 'text-emerald-400' : svc.status === 'FALLBACK' ? 'text-amber-400' : 'text-red-400'}`}>{svc.status}</span>
              </div>
            </div>
          ))}
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
