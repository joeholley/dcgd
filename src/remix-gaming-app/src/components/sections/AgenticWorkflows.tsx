import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Zap, 
  Gamepad2, 
  Users, 
  Activity, 
  ArrowRight, 
  CheckCircle2, 
  RotateCcw, 
  MessageSquare, 
  Search, 
  Database, 
  ShieldCheck, 
  BrainCircuit, 
  Bot,
  Coins,
  Gift,
  Barcode,
  Server,
  Network,
  Cpu,
  ShieldAlert,
  ArrowDown
} from "lucide-react";
import { cn } from "../../lib/utils";

interface WorkflowResult {
  thinking: string[];
  finding: string;
  impact: string;
  recommendation: string;
  nextSteps: string[];
}

interface PipelineNode {
  label: string;
  sub: string;
  status: "pending" | "active" | "completed";
  icon: any;
  cloud: string;
}

const getPipelineNodes = (wfId: string, currentStep: number, isFinished: boolean): PipelineNode[] => {
  if (wfId === "Automated Player Retention Promo") {
    return [
      { label: "AWS S3 Logs", sub: "Scan player telemetry", status: isFinished ? "completed" : (currentStep > 0 ? "completed" : (currentStep === 0 ? "active" : "pending")), icon: Database, cloud: "AWS" },
      { label: "AlloyDB Segment", sub: "Verify user profiles", status: isFinished ? "completed" : (currentStep > 1 ? "completed" : (currentStep === 1 ? "active" : "pending")), icon: Cpu, cloud: "GCP" },
      { label: "Snowflake ML", sub: "Calculate LTV drop-off", status: isFinished ? "completed" : (currentStep > 2 ? "completed" : (currentStep === 2 ? "active" : "pending")), icon: BrainCircuit, cloud: "Snowflake" },
      { label: "Google Ads API", sub: "Publish client lists", status: isFinished ? "completed" : (currentStep > 3 ? "completed" : (currentStep === 3 ? "active" : "pending")), icon: Zap, cloud: "Google Core" },
      { label: "In-Game System", sub: "Inject premium items", status: isFinished ? "completed" : "pending", icon: Gift, cloud: "Live Engine" }
    ];
  } else if (wfId === "Fraud & Cheat Detection Agent") {
    return [
      { label: "AlloyDB Flow", sub: "Scan transactions", status: isFinished ? "completed" : (currentStep > 0 ? "completed" : (currentStep === 0 ? "active" : "pending")), icon: Activity, cloud: "GCP" },
      { label: "AWS S3 History", sub: "Retrieve bot profiles", status: isFinished ? "completed" : (currentStep > 1 ? "completed" : (currentStep === 1 ? "active" : "pending")), icon: Database, cloud: "AWS" },
      { label: "Catalog Engine", sub: "Run Anomaly Models", status: isFinished ? "completed" : (currentStep > 2 ? "completed" : (currentStep === 2 ? "active" : "pending")), icon: Search, cloud: "GCP" },
      { label: "Security Shield", sub: "Freeze account indices", status: isFinished ? "completed" : (currentStep > 3 ? "completed" : (currentStep === 3 ? "active" : "pending")), icon: ShieldAlert, cloud: "Security Core" }
    ];
  } else {
    // Dynamic Matchmaking Balance
    return [
      { label: "Active Lobbies", sub: "Monitor peak concurrents", status: isFinished ? "completed" : (currentStep > 0 ? "completed" : (currentStep === 0 ? "active" : "pending")), icon: Users, cloud: "Live Server" },
      { label: "Snowflake DB", sub: "Fetch historic SLA loads", status: isFinished ? "completed" : (currentStep > 1 ? "completed" : (currentStep === 1 ? "active" : "pending")), icon: Database, cloud: "Snowflake" },
      { label: "Cloud Run Nodes", sub: "Scale engine servers", status: isFinished ? "completed" : (currentStep > 2 ? "completed" : (currentStep === 2 ? "active" : "pending")), icon: Server, cloud: "GCP" },
      { label: "Broker balancer", sub: "Re-calculate queue paths", status: isFinished ? "completed" : (currentStep > 3 ? "completed" : (currentStep === 3 ? "active" : "pending")), icon: Network, cloud: "Live Engine" }
    ];
  }
};

function AgenticPipelineDiagram({ wfId, currentStep, isFinished }: { wfId: string; currentStep: number; isFinished: boolean }) {
  const nodes = getPipelineNodes(wfId, currentStep, isFinished);
  
  return (
    <div className="p-6 bg-slate-950 border border-slate-800 rounded-[2rem] space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <span className="text-[10px] font-bold text-blue-400 font-sans tracking-widest flex items-center gap-1.5">
          <Network className="w-3.5 h-3.5 text-blue-500 animate-pulse" /> Live Agentic Actions Map
        </span>
        <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/10 text-indigo-300 font-mono">
          {isFinished ? "TRACE SECURED" : "ORCHESTRATING..."}
        </span>
      </div>

      <div className="relative pl-6 space-y-4">
        {/* Continuous Pipeline vertical line */}
        <div className="absolute left-[13px] top-3 bottom-3 w-0.5 bg-slate-800 border-l border-dashed border-slate-700" />
        
        {nodes.map((node, idx) => {
          const isActive = node.status === "active";
          const isCompleted = node.status === "completed";
          
          return (
            <div key={idx} className="relative flex items-start gap-3.5 group">
              {/* Stepper Node Bubble */}
              <div className="relative z-10">
                <motion.div 
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-all border shrink-0 text-xs",
                    isActive 
                      ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/45" 
                      : isCompleted 
                        ? "bg-slate-950 border-emerald-500/40 text-emerald-400" 
                        : "bg-slate-950 border-slate-800 text-slate-500"
                  )}
                  animate={isActive ? { scale: [1, 1.12, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <node.icon className="w-3.5 h-3.5" />
                </motion.div>
                
                {isActive && (
                  <span className="absolute -inset-1 rounded-full border border-blue-500/35 animate-ping pointer-events-none" />
                )}
              </div>

              {/* Node Descriptive text block */}
              <div className="flex-1 min-w-0 bg-slate-900/40 border border-white/5 rounded-2xl p-3 hover:bg-slate-900/80 transition-all">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <h4 className={cn(
                    "text-xs font-bold truncate",
                    isActive ? "text-blue-400" : isCompleted ? "text-slate-200" : "text-slate-500"
                  )}>
                    {node.label}
                  </h4>
                  <span className="text-[8px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded uppercase">
                    {node.cloud}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal font-light truncate">
                  {node.sub}
                </p>
                
                {isCompleted && (
                  <div className="mt-1 flex items-center gap-1 text-[8px] font-mono text-emerald-400/80">
                     <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Sync verified 200 OK
                  </div>
                )}
                {isActive && (
                  <div className="mt-1 flex items-center gap-1 text-[8px] font-mono text-blue-400">
                     <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" /> Evaluating cohort data...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InGameGiftCard({ game, amount, hash }: { game: string; amount: number; hash: string }) {
  const [claimed, setClaimed] = useState(false);
  return (
    <motion.div 
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2rem] border border-indigo-500/30 p-6 text-white shadow-xl max-w-sm mx-auto"
    >
      {/* Glossy overlay effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_50%)] pointer-events-none" />
      
      {/* Card Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="text-[9px] font-mono tracking-widest text-indigo-300 font-bold uppercase">{game}</span>
        </div>
        <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-mono">
          SECURE PAYOUT
        </div>
      </div>

      {/* Hero Visual content */}
      <div className="py-4 flex flex-col items-center justify-center text-center relative">
        <div className="relative mb-3">
          <motion.div 
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-3 bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full blur opacity-25"
          />
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-550 flex items-center justify-center shadow-lg shadow-orange-500/25 relative z-10">
            <Coins className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <h3 className="text-lg font-black font-sans tracking-wide mb-1 text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-300 to-amber-200">
          +{amount} GOLD COINS
        </h3>
        <p className="text-[10px] text-slate-450 max-w-[210px] font-light leading-relaxed">
          Premium Obsidian bonus crate parameters optimized via snowflake ML models.
        </p>
      </div>

      {/* Barcode & claim button */}
      <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-[8px] font-mono text-slate-400">
          <span>TX HASH: {hash}</span>
          <span className="font-bold text-amber-400">EPIC CHEST</span>
        </div>
        
        {/* Pseudo-Barcode simulation */}
        <div className="bg-white/5 py-1.5 px-3 rounded-xl flex items-center justify-center gap-[1.5px] opacity-75">
          {[2, 1, 3, 2, 1, 3, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 2, 1].map((w, idx) => (
            <div key={idx} className="h-6 bg-slate-200" style={{ width: `${w}px` }} />
          ))}
        </div>

        <button 
          onClick={() => setClaimed(true)}
          className={cn(
            "w-full py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer",
            claimed 
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 active:scale-95"
          )}
        >
          {claimed ? "CLAIMED IN-GAME" : "CLAIM REWARD SANDBOX PREVIEW"}
        </button>
      </div>
    </motion.div>
  );
}

export function AgenticWorkflows() {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<Record<string, WorkflowResult>>({});
  const [approvedActions, setApprovedActions] = useState<Record<string, boolean>>({});
  const [followUpResponse, setFollowUpResponse] = useState<string | null>(null);

  const workflowData: Record<string, WorkflowResult> = {
    "Automated Player Retention Promo": {
      thinking: [
        "Scanning AWS S3 daily gameplay logs for 'Inactive' player signals...",
        "Cross-referencing AlloyDB user segments and concurrent trends for Cosmic Raider...",
        "Calculating churn probability variance using Snowflake historical play times...",
        "Preparing optimized promo chest reward pack via Federated Query..."
      ],
      finding: "Critical level decline detected for 'Cosmic Raider' veteran cohort (recent -32% play drop).",
      impact: "Potential $85K user lifetime value (LTV) churn exposure over current season.",
      recommendation: "Incentivize cohort with a 150 gold coin gift pack and trigger customized mobile push alert.",
      nextSteps: ["Send In-Game Gift", "Auto-Notify Team", "Update Segment Tag"]
    },
    "Fraud & Cheat Detection Agent": {
      thinking: [
        "Ingesting AlloyDB player transactions for previous 12 hours...",
        "Joining with AWS S3 historical botting reports (2-year profile window)...",
        "Applying Telemetry Catalog 'Anomaly_Scoring' logic...",
        "Filtering for instant currency injections with missing client verification..."
      ],
      finding: "Gold injection exploit detected on Retro Speed Racer from player block US-East.",
      impact: "Virtual economy inflation index rose by 3.8% in target region lobby.",
      recommendation: "Temporarily restrict economy profile from trade and forward logging trace to review team.",
      nextSteps: ["Restrict Economy Profile", "Flag Account", "Reroute Alert Logs"]
    },
    "Dynamic Matchmaking Balance": {
      thinking: [
        "Monitoring real-time match lobbies via AlloyDB concurrent streams...",
        "Comparing against 52-week peak session trends in Snowflake...",
        "Analyzing server-to-player ratios for EU-West regions...",
        "Predicting 4-hour queue delays based on streamer active lobby logs..."
      ],
      finding: "Lobby queue times exceeded target SLA threshold (>15s) in region South.",
      impact: "Drop-out rate during match creation rose by 8.5% over peak.",
      recommendation: "Deploy supplementary matchmaking cluster and float 3 server zones.",
      nextSteps: ["Deploy Server Block", "Re-route Matches", "Re-calculate Weights"]
    }
  };

  const followUpDetails: Record<string, { text: string; type: "message" | "schedule" }> = {
    "Send In-Game Gift": { 
      text: "TRANSACTION INJECTED: Gift bundle containing 150 gold coins and a Legendary Skin crate pushed to 415 veteran targets. Verification hash: #JG-TX-9982. Telemetry shows immediate 44% click-to-claim rates.", 
      type: "message" 
    },
    "Auto-Notify Team": { 
      text: "DEVELOPER NOTICE: Live-ops team notified on Discord/Slack channel. A retention audit log has been appended to the current Jingle Games sprint dashboard.", 
      type: "message" 
    },
    "Update Segment Tag": { 
      text: "PLAYER META DATA UPDATED: Segment tags shifted to 'Target_Retention_Vets' inside AlloyDB index schema. Subscriptions monitor recalculated.", 
      type: "message" 
    },
    "Restrict Economy Profile": { 
      text: "SECURITY DIRECTIVE: Trade profile limited instantly on Retro Speed Racer for suspected accounts. P2P transfers frozen. Sandbox query activated. Audit logs piped to compliance database.", 
      type: "message" 
    },
    "Flag Account": { 
      text: "SECURITY ALERT: Player profiles marked with 'Suspicious_Economy_Activity'. Looker security suite updated.", 
      type: "message" 
    },
    "Reroute Alert Logs": { 
      text: "LOG PIPELINE UPDATED: Real-time telemetry logs filtered for suspicious injections. S3 storage target shifted to high-alert bucket.", 
      type: "message" 
    },
    "Deploy Server Block": { 
      text: "INFRASTRUCTURE OPTIMIZATION: Provisioned 4 new server containers on Google Cloud Run. Average matchmaking power boosted. Current system status: Green.", 
      type: "message" 
    },
    "Re-route Matches": { 
      text: "MATCHMAKING ROUTING: Player traffic from region South re-routed to new server block. Match countdown average returned to 8s latency.", 
      type: "message" 
    },
    "Re-calculate Weights": { 
      text: "QUEUE BALANCER: Looker query complete. Recalculated player level tolerances to expand matchmaking queues symmetrically during off-peak hours.", 
      type: "message" 
    }
  };

  const handleFollowUp = (step: string) => {
    const detail = followUpDetails[step];
    if (detail) {
      setFollowUpResponse(detail.text);
    } else {
      setFollowUpResponse(`Protocol executed: ${step}. Transaction logged in Jingle Games API Server.`);
    }
  };

  const handleExecute = (id: string) => {
    setExecutingId(id);
    setCurrentStep(0);
    setFollowUpResponse(null);
    setResults(prev => {
      const newResults = { ...prev };
      delete newResults[id];
      return newResults;
    });
  };

  useEffect(() => {
    if (executingId && currentStep < 4) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    } else if (executingId && currentStep === 4) {
      setResults(prev => ({
        ...prev,
        [executingId]: workflowData[executingId]
      }));
      setExecutingId(null);
    }
  }, [executingId, currentStep]);

  const workflows = [
    {
      id: "Automated Player Retention Promo",
      title: "Player Retention Promo Agent",
      desc: "Monitors play logs and distributes tailored dynamic reward crates.",
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      id: "Fraud & Cheat Detection Agent",
      title: "Cheat & Anomaly Detection Agent",
      desc: "Scans active transactions to restrict suspicious database actions.",
      icon: ShieldCheck,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      id: "Dynamic Matchmaking Balance",
      title: "Matchmaking Queue Balancer Agent",
      desc: "Scales server capacities and queue bounds based on game triggers.",
      icon: Activity,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    }
  ];

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10">
      <header>
        <div className="flex items-center gap-3 mb-2">
           <BrainCircuit className="w-8 h-8 text-blue-600" />
           <h2 className="text-3xl font-bold text-slate-800 tracking-tight font-sans">Player Operations AI Agent Hub</h2>
        </div>
        <p className="text-slate-500 font-light text-sm italic">Observing Cross-Cloud Action traces: AWS S3 + Snowflake + AlloyDB</p>
      </header>

      <div className="space-y-8">
        {workflows.map((wf, i) => (
          <motion.div
            key={wf.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "bg-white rounded-[2rem] border transition-all duration-500 overflow-hidden",
              results[wf.id] ? "border-blue-100 shadow-xl shadow-blue-900/5" : "border-slate-100 shadow-sm"
            )}
          >
            {/* Header Row */}
            <div className="p-8 flex flex-col md:flex-row items-center gap-8 bg-white">
              <div className={`p-5 rounded-3xl ${wf.bg} shrink-0`}>
                <wf.icon className={`w-8 h-8 ${wf.color}`} />
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-slate-800 leading-tight">{wf.title}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Autonomous Mode
                  </span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed font-light">{wf.desc}</p>
              </div>

              <div className="shrink-0">
                {!results[wf.id] && !executingId && (
                  <button 
                    onClick={() => handleExecute(wf.id)}
                    className="px-8 py-4 rounded-2xl bg-slate-900 text-white flex items-center gap-3 font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-black/10 cursor-pointer"
                  >
                    Activate Agent <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {executingId === wf.id && (
                  <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-blue-50 border border-blue-100">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Agent Reasoning...</span>
                  </div>
                )}
                {results[wf.id] && (
                   <button 
                     onClick={() => handleExecute(wf.id)}
                     className="p-4 rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                   >
                     <RotateCcw className="w-5 h-5" />
                   </button>
                )}
              </div>
            </div>

            {/* Thinking / Results Area */}
            <AnimatePresence mode="wait">
              {(executingId === wf.id || results[wf.id]) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-50 bg-[#F8FAFC]"
                >
                  <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Left: Thinking Trace */}
                    <div className="lg:col-span-5 space-y-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trace Diagnostics</span>
                      </div>
                      
                      <div className="space-y-3">
                        {workflowData[wf.id].thinking.map((step, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ 
                              opacity: (executingId === wf.id ? (idx < currentStep ? 1 : 0.3) : 1),
                              x: 0 
                            }}
                            className={cn(
                              "flex items-center gap-3 text-[11px] font-mono",
                              executingId === wf.id && idx === currentStep ? "text-blue-600 font-bold" : "text-slate-500"
                            )}
                          >
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              executingId === wf.id && idx === currentStep ? "bg-blue-600 animate-pulse" : 
                              (executingId === wf.id && idx < currentStep) || results[wf.id] ? "bg-emerald-400" : "bg-slate-200"
                            )} />
                            {step}
                          </motion.div>
                        ))}
                      </div>

                      {results[wf.id] && (
                        <div className="mt-8 pt-8 border-t border-slate-200/50">
                           <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                              <Database className="w-3.5 h-3.5" /> Federated Data Layers
                           </div>
                           <div className="flex gap-2 mb-6">
                              {["AWS S3", "Snowflake", "AlloyDB"].map(s => (
                                <span key={s} className="px-2 py-1 rounded bg-white border border-slate-200 text-[9px] font-bold text-slate-600">{s} Linked</span>
                              ))}
                           </div>
                        </div>
                      )}

                      {/* Interactive Visual Agentic Map */}
                      <div className="mt-6 pt-4 border-t border-slate-200/50">
                        <AgenticPipelineDiagram 
                          wfId={wf.id} 
                          currentStep={currentStep} 
                          isFinished={!!results[wf.id]} 
                        />
                      </div>
                    </div>

                    {/* Right: Structured Output */}
                    <div className="lg:col-span-7">
                      <AnimatePresence>
                        {results[wf.id] && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-3xl border border-blue-100 p-8 shadow-lg shadow-blue-900/5 h-full flex flex-col"
                          >
                            <div className="flex justify-between items-start mb-6">
                               <div className="space-y-1">
                                  <h4 className="text-lg font-bold text-slate-800">Operational Proposal</h4>
                                  <p className="text-xs text-slate-400">Generated at {new Date().toLocaleTimeString()}</p>
                               </div>
                               <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-tighter">
                                  <Zap className="w-3 h-3" /> Execute Priority: High
                                </div>
                            </div>

                            <div className="grid gap-6 flex-1 mb-8">
                               <div className="space-y-2">
                                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Active Discovery</span>
                                  <p className="text-sm font-bold text-slate-700 leading-snug">{results[wf.id].finding}</p>
                               </div>
                               <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100">
                                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Business Impact Analysis</span>
                                  <p className="text-sm text-slate-800 mt-1">{results[wf.id].impact}</p>
                               </div>
                               <div className="space-y-2">
                                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Recommended Action</span>
                                  <p className="text-sm text-slate-600 leading-relaxed font-light italic">"{results[wf.id].recommendation}"</p>
                               </div>
                            </div>

                            <div className="space-y-4">
                               <div className="flex items-center gap-2 mb-2">
                                  <Bot className="w-4 h-4 text-emerald-550" />
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Developer Approval Gate</span>
                                </div>
                               
                               {!approvedActions[wf.id] ? (
                                 <div className="flex gap-3">
                                   <button 
                                     onClick={() => setApprovedActions(prev => ({ ...prev, [wf.id]: true }))}
                                     className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                   >
                                     <CheckCircle2 className="w-4 h-4" /> Approve & Inject Script
                                   </button>
                                   <button className="px-6 py-4 rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all cursor-pointer">
                                      <MessageSquare className="w-5 h-5" />
                                   </button>
                                 </div>
                               ) : (
                                 <motion.div 
                                   initial={{ scale: 0.95, opacity: 0 }}
                                   animate={{ scale: 1, opacity: 1 }}
                                   className="space-y-6"
                                 >
                                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                                       <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                       <span className="text-sm font-bold text-emerald-800">Trigger confirmed. Direct API update completed.</span>
                                    </div>
                                    
                                    <div className="space-y-3">
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Follow-up Routines</p>
                                       <div className="flex flex-wrap gap-2">
                                         {results[wf.id].nextSteps.map(step => (
                                           <button 
                                             key={step} 
                                             onClick={() => handleFollowUp(step)}
                                             className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all cursor-pointer"
                                           >
                                             {step} →
                                           </button>
                                         ))}
                                       </div>
                                       
                                       <AnimatePresence>
                                         {followUpResponse && (
                                           <motion.div 
                                             initial={{ opacity: 0, y: 10 }}
                                             animate={{ opacity: 1, y: 0 }}
                                             exit={{ opacity: 0, scale: 0.95 }}
                                             className="mt-6 space-y-4"
                                           >
                                             {followUpResponse.includes("150 gold") && (
                                               <div className="mb-4">
                                                 <InGameGiftCard 
                                                   game="Cosmic Raider RPG" 
                                                   amount={150} 
                                                   hash="#JG-TX-9982" 
                                                 />
                                               </div>
                                             )}

                                             <div className="p-5 rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                   <Bot className="w-12 h-12" />
                                                </div>
                                                <div className="flex items-start gap-4 h-full relative z-10">
                                                   <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                                      <Zap className="w-4 h-4" />
                                                   </div>
                                                   <p className="text-[11px] font-medium leading-relaxed italic opacity-95">
                                                      {followUpResponse}
                                                   </p>
                                                </div>
                                             </div>
                                           </motion.div>
                                         )}
                                       </AnimatePresence>
                                    </div>
                                 </motion.div>
                               )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
