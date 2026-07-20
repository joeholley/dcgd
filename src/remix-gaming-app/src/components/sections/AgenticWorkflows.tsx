import { SessionIdBadge, DataModeBadge } from "../DataModeBadge";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
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
  Gift,
  Server,
  Network,
  Cpu,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Info,
  ExternalLink
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useDemoEvent } from "../../context/DemoEventContext";
import { 
  getRoutingMode, 
  onRoutingModeChange, 
  RoutingMode, 
  broadcastIncomingAgentEvent,
  onSimulatorStateChange,
  getSimulatorStatePayload 
} from "../../services/simulatorBridge";

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

export interface AgentHistoryEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: string;
  agentName?: string;
  reasoningSteps?: string[];
  isStreaming?: boolean;
}

const INITIAL_KC_PROMPT = "Summarize what you can do in 250 words";
const INITIAL_KC_RESPONSE = "I am the Knowledge Catalog (KC) Guided Agent for OmniArcade. I dynamically discover, govern, and analyze live player telemetry across 150+ BigQuery tables without reliance on hardcoded schema prompts. By leveraging Knowledge Catalog metadata, entry aspect searches, data quality scores, and lineage graphs, I identify high-risk churn signals—such as repeated boss wipeouts among veteran whale cohorts—and construct policy-compliant retention campaigns. Every promotional recommendation enforces Knowledge Catalog guardrails, capping discounts within authorized boundaries while logging audit trails to BigQuery.";

const EXECUTE_RUN_DISPLAY_PROMPT = "Our system has determined that many players are dying on a boss and some are quitting the game. Identify and analyze the relevant gameplay event data and provide a recommendation?";

const EXECUTE_RUN_API_PROMPT = "Our system has determined that many players are failing on the: boss on tutorial stage 2 and some are quitting the game. Identify the relevant gameplay event data and recommend that we offer the frost_giant_shield_pack SKU at an 80% discount to users with predicted churn probability of 85% or higher";

function extractCleanTextPayload(input: any): string {
  if (!input) return "";
  if (typeof input !== "string") {
    return typeof input === "object" ? JSON.stringify(input) : String(input);
  }
  const trimmed = input.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      const parsed = JSON.parse(trimmed);
      const text =
        (typeof parsed.content?.parts?.[0]?.text === "string" ? parsed.content.parts[0].text : null) ||
        (Array.isArray(parsed.content?.parts) ? parsed.content.parts.map((p: any) => typeof p === "string" ? p : p?.text).filter(Boolean).join("\n") : null) ||
        (typeof parsed.parts?.[0]?.text === "string" ? parsed.parts[0].text : null) ||
        (typeof parsed.text === "string" ? parsed.text : null) ||
        (typeof parsed.output === "string" ? parsed.output : (parsed.output ? JSON.stringify(parsed.output) : null)) ||
        (typeof parsed.response === "string" ? parsed.response : (parsed.response ? JSON.stringify(parsed.response) : null));

      if (text && typeof text === "string") return text;
    } catch (e) {
      // Return original text if not JSON-wrapped
    }
  }
  return input;
}

export interface TargetCohortPayload {
  cohort_id: string;
  churn_threshold: number;
  discount_percentage?: number;
  offer_details?: string;
}

export interface DecisionPayload {
  intervention_type: string;
  sku_id: string;
  discount_percentage: number;
  target_cohorts: TargetCohortPayload[];
  reasoning: string;
}

function extractJsonObject(input: string): string | null {
  if (!input) return null;
  const startIdx = input.indexOf("{");
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < input.length; i++) {
    const char = input[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0) {
          return input.substring(startIdx, i + 1);
        }
      }
    }
  }
  return null;
}

export function parseDecisionPayload(input: string): DecisionPayload | null {
  if (!input) return null;
  const cleanInput = extractCleanTextPayload(input);

  let rawJson: string | null = null;

  const payloadHeaderIdx = cleanInput.indexOf("Decision Payload:");
  const textToSearch = payloadHeaderIdx !== -1 ? cleanInput.substring(payloadHeaderIdx) : cleanInput;

  const codeBlockMatch = textToSearch.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    rawJson = codeBlockMatch[1].trim();
  } else {
    rawJson = extractJsonObject(textToSearch);
  }

  if (!rawJson && payloadHeaderIdx !== -1) {
    rawJson = extractJsonObject(cleanInput);
  }

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      
      // Standardize cohort payload schema
      if (
        parsed.target_cohorts ||
        parsed.target_players ||
        parsed.valid_player_tiers ||
        parsed.sku_id ||
        parsed.sku ||
        parsed.intervention_type ||
        parsed.offer_reason ||
        parsed.reasoning
      ) {
        let cohortsList: TargetCohortPayload[] = [];

        if (Array.isArray(parsed.target_cohorts)) {
          cohortsList = parsed.target_cohorts.map((tc: any) => ({
            cohort_id: typeof tc.cohort_id === "string" ? tc.cohort_id : (typeof tc.payer_tier === "string" ? tc.payer_tier : (typeof tc.tier === "string" ? tc.tier : "Minnow")),
            churn_threshold: typeof tc.churn_threshold === "number" ? tc.churn_threshold : (typeof tc.churn_probability === "number" ? tc.churn_probability : 0.85),
            discount_percentage: typeof tc.discount_percentage === "number" ? tc.discount_percentage : undefined,
            offer_details: typeof tc.offer_details === "string" ? tc.offer_details : (typeof tc.details === "string" ? tc.details : (tc.offer_details ? JSON.stringify(tc.offer_details) : "")),
          }));
        } else if (Array.isArray(parsed.target_players)) {
          // Backward compatibility map for legacy target_players format
          const map = new Map<string, number>();
          parsed.target_players.forEach((tp: any) => {
            const tier = typeof tp.payer_tier === "string" ? tp.payer_tier : (typeof tp.tier === "string" ? tp.tier : "Minnow");
            const churn = typeof tp.churn_probability === "number" ? tp.churn_probability : 0.85;
            if (!map.has(tier) || churn < map.get(tier)!) {
              map.set(tier, churn);
            }
          });
          map.forEach((churn, tier) => {
            cohortsList.push({
              cohort_id: tier,
              churn_threshold: churn,
              discount_percentage: typeof parsed.discount_percentage === "number" ? parsed.discount_percentage : 25,
              offer_details: `Compliant discount of ${parsed.discount_percentage || 25}% applied to ${tier} cohort.`,
            });
          });
        } else if (Array.isArray(parsed.valid_player_tiers)) {
          const discount = typeof parsed.discount_percentage === "number" ? parsed.discount_percentage : 25;
          parsed.valid_player_tiers.forEach((tierObj: any) => {
            const tier = typeof tierObj === "string" ? tierObj : (typeof tierObj.cohort_id === "string" ? tierObj.cohort_id : (typeof tierObj.tier === "string" ? tierObj.tier : "Minnow"));
            const churn = typeof tierObj.churn_threshold === "number" ? tierObj.churn_threshold : 0.85;
            cohortsList.push({
              cohort_id: tier,
              churn_threshold: churn,
              discount_percentage: discount,
              offer_details: `Compliant discount of ${discount}% applied to ${tier} cohort.`,
            });
          });
        }

        const skuId = typeof parsed.sku_id === "string" ? parsed.sku_id : (typeof parsed.sku === "string" ? parsed.sku : "frost_giant_shield_pack");
        const discountPercentage = typeof parsed.discount_percentage === "number" ? parsed.discount_percentage : (typeof parsed.discount === "number" ? parsed.discount : 25);
        
        let reasoningStr = "Targeting cohorts with high churn probability based on boss wipeouts.";
        if (typeof parsed.reasoning === "string" && parsed.reasoning.trim()) {
          reasoningStr = parsed.reasoning;
        } else if (typeof parsed.offer_reason === "string" && parsed.offer_reason.trim()) {
          reasoningStr = parsed.offer_reason;
        } else if (typeof parsed.offer_details === "string" && parsed.offer_details.trim()) {
          reasoningStr = parsed.offer_details;
        } else if (parsed.reasoning && typeof parsed.reasoning === "object") {
          reasoningStr = JSON.stringify(parsed.reasoning);
        } else if (parsed.offer_reason && typeof parsed.offer_reason === "object") {
          reasoningStr = JSON.stringify(parsed.offer_reason);
        }

        return {
          intervention_type: typeof parsed.intervention_type === "string" ? parsed.intervention_type : "proactive_churn_offer",
          sku_id: skuId,
          discount_percentage: discountPercentage,
          target_cohorts: cohortsList,
          reasoning: reasoningStr,
        };
      }

      // Single player / cohort legacy schema fallback
      if (parsed.offer_payload || parsed.churn_score) {
        const skuId = typeof parsed.offer_payload?.sku === "string" ? parsed.offer_payload.sku : (typeof parsed.sku_id === "string" ? parsed.sku_id : "frost_giant_shield_pack");
        let reasoningStr = `Targeting cohort ${parsed.payer_tier || 'Minnow'} with high churn risk.`;
        if (typeof parsed.reasoning === "string" && parsed.reasoning.trim()) {
          reasoningStr = parsed.reasoning;
        } else if (typeof parsed.offer_reason === "string" && parsed.offer_reason.trim()) {
          reasoningStr = parsed.offer_reason;
        } else if (parsed.reasoning && typeof parsed.reasoning === "object") {
          reasoningStr = JSON.stringify(parsed.reasoning);
        }

        return {
          intervention_type: "proactive_churn_offer",
          sku_id: skuId,
          discount_percentage: typeof parsed.discount_percentage === "number" ? parsed.discount_percentage : 25,
          target_cohorts: [
            {
              cohort_id: typeof parsed.payer_tier === "string" ? parsed.payer_tier : "Minnow",
              churn_threshold: typeof parsed.churn_score === "number" ? parsed.churn_score : 0.87,
              discount_percentage: 25,
              offer_details: typeof parsed.offer_payload?.title === "string" ? parsed.offer_payload.title : "Compliant discount applied.",
            }
          ],
          reasoning: reasoningStr,
        };
      }
    } catch (e) {
      console.warn("Failed to parse JSON decision payload from response:", e);
    }
  }

  return null;
}

const DEFAULT_RETENTION_FALLBACK_RESPONSE = `[agent-kc Analysis] Analyzing player telemetry stream for boss death anomalies:
- Identified excessive consecutive wipeouts on 'Frost Giant' boss in Realm of Eldoria RPG.
- Cross-referenced Knowledge Catalog entry aspect 'liveops_campaign_policy_aspect' & BQML churn model.

Decision Payload:

\`\`\`json
{
  "intervention_type": "proactive_churn_offer",
  "sku_id": "frost_giant_shield_pack",
  "discount_percentage": 25.0,
  "target_cohorts": [
    {
      "cohort_id": "Minnow",
      "churn_threshold": 0.85,
      "discount_percentage": 25.0,
      "offer_details": "Compliant discount of 25% applied, as requested 80% exceeds Minnow tier cap (25%)."
    },
    {
      "cohort_id": "F2P",
      "churn_threshold": 0.85,
      "discount_percentage": 25.0,
      "offer_details": "Compliant discount of 25% applied, as requested 80% exceeds F2P tier cap (25%)."
    },
    {
      "cohort_id": "Dolphin",
      "churn_threshold": 0.85,
      "discount_percentage": 50.0,
      "offer_details": "Compliant discount of 50% applied, as requested 80% exceeds F2P tier cap (25%)."
    },
    {
      "cohort_id": "Whale",
      "churn_threshold": 0.85,
      "discount_percentage": 80.0,
      "offer_details": "Compliant discount of 80% applied."
    }
  ],
  "reasoning": "Targeting Minnow and F2P cohorts with high churn probability (>=85%) who encountered difficulty with the Frost Giant Boss. Discount adjusted to comply with tier policy caps (max 25%)."
}
\`\`\``;

const getPipelineNodes = (
  wfId: string, 
  currentStep: number, 
  isFinished: boolean,
  routingMode: RoutingMode
): PipelineNode[] => {
  if (wfId === "Automated Player Retention Promo") {
    if (routingMode === "LIVE") {
      return [
        { label: "Simulator Client", sub: "Live telemetry stream", status: isFinished ? "completed" : (currentStep > 0 ? "completed" : (currentStep === 0 ? "active" : "pending")), icon: Gamepad2, cloud: "Game Client" },
        { label: "Pub/Sub Topic", sub: "gaming-live-telemetry", status: isFinished ? "completed" : (currentStep > 1 ? "completed" : (currentStep === 1 ? "active" : "pending")), icon: Server, cloud: "Cloud Ingestion" },
        { label: "BigQuery Data Warehouse", sub: "gold_player_360 table (agent-kc active)", status: isFinished ? "completed" : (currentStep > 2 ? "completed" : (currentStep === 2 ? "active" : "pending")), icon: Database, cloud: "Cloud Storage" },
        { label: "BQML & Knowledge Catalog", sub: "Churn model & policy aspect", status: isFinished ? "completed" : (currentStep > 3 ? "completed" : (currentStep === 3 ? "active" : "pending")), icon: BrainCircuit, cloud: "Cloud ML & Gov" },
        { label: "Gemini Enterprise", sub: "Agent offer decision", status: isFinished ? "completed" : "pending", icon: Bot, cloud: "Agent Platform" }
      ];
    } else {
      return [
        { label: "Simulator Client", sub: "Mock RPG telemetry stream", status: isFinished ? "completed" : (currentStep > 0 ? "completed" : (currentStep === 0 ? "active" : "pending")), icon: Gamepad2, cloud: "Mock Client" },
        { label: "Pub/Sub Topic", sub: "In-memory event channel", status: isFinished ? "completed" : (currentStep > 1 ? "completed" : (currentStep === 1 ? "active" : "pending")), icon: Network, cloud: "Client Memory" },
        { label: "BigQuery Data Warehouse", sub: "gold_player_360 table (agent-kc active)", status: isFinished ? "completed" : (currentStep > 2 ? "completed" : (currentStep === 2 ? "active" : "pending")), icon: Database, cloud: "Mock Storage" },
        { label: "Knowledge Catalog Mock", sub: "Schema aspect audit (85% max)", status: isFinished ? "completed" : (currentStep > 3 ? "completed" : (currentStep === 3 ? "active" : "pending")), icon: ShieldCheck, cloud: "Mock Gov" },
        { label: "Mock LLM Trace", sub: "Canned prompt playback", status: isFinished ? "completed" : "pending", icon: Bot, cloud: "Mock LLM" }
      ];
    }
  } else if (wfId === "Fraud & Cheat Detection Agent") {
    return [
      { label: "AlloyDB Flow", sub: "Scan transactions", status: isFinished ? "completed" : (currentStep > 0 ? "completed" : (currentStep === 0 ? "active" : "pending")), icon: Activity, cloud: "Cloud" },
      { label: "AWS S3 History", sub: "Retrieve bot profiles", status: isFinished ? "completed" : (currentStep > 1 ? "completed" : (currentStep === 1 ? "active" : "pending")), icon: Database, cloud: "AWS" },
      { label: "Catalog Engine", sub: "Run Anomaly Models", status: isFinished ? "completed" : (currentStep > 2 ? "completed" : (currentStep === 2 ? "active" : "pending")), icon: Search, cloud: "Cloud" },
      { label: "Security Shield", sub: "Freeze account indices", status: isFinished ? "completed" : (currentStep > 3 ? "completed" : (currentStep === 3 ? "active" : "pending")), icon: ShieldAlert, cloud: "Security Core" }
    ];
  } else {
    return [
      { label: "Active Lobbies", sub: "Monitor peak concurrents", status: isFinished ? "completed" : (currentStep > 0 ? "completed" : (currentStep === 0 ? "active" : "pending")), icon: Users, cloud: "Live Server" },
      { label: "Snowflake DB", sub: "Fetch historic SLA loads", status: isFinished ? "completed" : (currentStep > 1 ? "completed" : (currentStep === 1 ? "active" : "pending")), icon: Database, cloud: "Snowflake" },
      { label: "Cloud Run Nodes", sub: "Scale engine servers", status: isFinished ? "completed" : (currentStep > 2 ? "completed" : (currentStep === 2 ? "active" : "pending")), icon: Server, cloud: "Cloud" },
      { label: "Broker balancer", sub: "Re-calculate queue paths", status: isFinished ? "completed" : (currentStep > 3 ? "completed" : (currentStep === 3 ? "active" : "pending")), icon: Network, cloud: "Live Engine" }
    ];
  }
};

function AgenticPipelineDiagram({ 
  wfId, 
  currentStep, 
  isFinished, 
  routingMode,
  isSimulatorRunning,
  isExecuting
}: { 
  wfId: string; 
  currentStep: number; 
  isFinished: boolean;
  routingMode: RoutingMode;
  isSimulatorRunning: boolean;
  isExecuting?: boolean;
}) {
  const nodes = getPipelineNodes(wfId, currentStep, isFinished, routingMode);
  const isRetentionAgent = wfId === "Automated Player Retention Promo";
  
  return (
    <div className="p-6 bg-slate-950 border border-slate-800 rounded-[2rem] space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <span className="text-[10px] font-bold text-blue-400 font-sans tracking-widest flex items-center gap-1.5 uppercase">
          <Network className={cn("w-3.5 h-3.5 text-blue-500", isRetentionAgent && isSimulatorRunning && "animate-pulse")} /> Data Cloud Telemetry Flow
        </span>
        <span className={cn(
          "text-[9px] px-2 py-0.5 rounded border font-mono font-bold uppercase",
          isRetentionAgent
            ? (isSimulatorRunning
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                : "bg-slate-900 text-slate-400 border-slate-700")
            : (isFinished ? "bg-blue-500/10 text-indigo-300 border-blue-500/20" : "bg-slate-900 text-slate-400 border-slate-800")
        )}>
          {isRetentionAgent
            ? (isSimulatorRunning ? "STREAMING ACTIVE" : "SIMULATOR OFF (BQ ACTIVE)")
            : (isFinished ? "TRACE SECURED" : "ORCHESTRATING...")}
        </span>
      </div>

      <div className="relative pl-6 space-y-4">
        <div className={cn(
          "absolute left-[13px] top-3 bottom-3 w-0.5 border-l border-dashed transition-colors duration-500",
          isRetentionAgent && isExecuting
            ? "border-cyan-400/80 shadow-[0_0_8px_rgba(34,211,238,0.5)]"
            : isRetentionAgent && isSimulatorRunning
            ? "border-emerald-400/60"
            : "border-slate-700"
        )} />
        
        {/* Dynamic Telemetry Streaming Animation overlay between Simulator Client -> Pub/Sub Topic -> BQ */}
        {isRetentionAgent && isSimulatorRunning && (
          <div className="absolute left-[11px] top-4 h-[110px] w-1.5 overflow-hidden pointer-events-none z-0">
            <motion.div
              className="w-1.5 h-8 bg-gradient-to-b from-transparent via-emerald-400 to-transparent rounded-full shadow-[0_0_10px_#34d399]"
              animate={{ y: ["-100%", "300%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
          </div>
        )}

        {/* Dynamic Agent Pipeline Execution Streaming Animation overlay between Node 2 (BigQuery), Node 3 (BQML & Knowledge Catalog), and Node 4 (Gemini Enterprise) */}
        {isRetentionAgent && isExecuting && (
          <div className="absolute left-[11px] top-[98px] h-[96px] w-1.5 overflow-hidden pointer-events-none z-10">
            {/* Upward query stream beam from Gemini Enterprise up to BQML & BigQuery */}
            <motion.div
              className="w-1.5 h-8 bg-gradient-to-t from-transparent via-cyan-400 to-transparent rounded-full shadow-[0_0_12px_#38bdf8]"
              animate={{ y: ["300%", "-100%"] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            />
            {/* Downward decision stream pulse from Gemini/Knowledge Catalog back to BigQuery */}
            <motion.div
              className="w-1.5 h-6 bg-gradient-to-b from-transparent via-blue-400 to-transparent rounded-full shadow-[0_0_10px_#60a5fa]"
              animate={{ y: ["-100%", "300%"] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut", delay: 0.4 }}
            />
            {/* High-tech energy particle dot along the execution path */}
            <motion.div
              className="absolute left-[1px] w-1 h-1 bg-cyan-300 rounded-full shadow-[0_0_8px_#22d3ee]"
              animate={{ 
                y: [0, 96, 0],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{ repeat: Infinity, duration: 2.0, ease: "easeInOut" }}
            />
          </div>
        )}

        {nodes.map((node, idx) => {
          const isActive = node.status === "active";
          const isCompleted = node.status === "completed";
          const NodeIcon = node.icon;
          
          let nodeStyling = "";

          if (isRetentionAgent) {
            if (idx === 0 || idx === 1) {
              if (isSimulatorRunning) {
                nodeStyling = "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-md shadow-emerald-500/30 animate-pulse";
              } else {
                nodeStyling = "bg-slate-900/60 text-slate-600 border-slate-800 opacity-60";
              }
            } else if (idx === 2) {
              nodeStyling = "bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-md shadow-blue-500/20";
            } else {
              nodeStyling = isActive 
                ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30" 
                : isCompleted 
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                : "bg-slate-900 text-slate-600 border-slate-800";
            }
          } else {
            nodeStyling = isActive 
              ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30" 
              : isCompleted 
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
              : "bg-slate-900 text-slate-600 border-slate-800";
          }

          return (
            <div key={idx} className="relative flex items-start gap-3.5 group">
              <div className="relative z-10">
                <motion.div 
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-all border shrink-0 text-xs",
                    nodeStyling
                  )}
                >
                  {isCompleted && !isRetentionAgent ? <CheckCircle2 className="w-4 h-4" /> : <NodeIcon className="w-3.5 h-3.5" />}
                </motion.div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-bold truncate",
                    isRetentionAgent
                      ? (idx === 2 ? "text-blue-300" : (isSimulatorRunning ? "text-emerald-300" : (idx <= 1 ? "text-slate-500" : (isActive ? "text-blue-400" : isCompleted ? "text-white" : "text-slate-500"))))
                      : (isActive ? "text-blue-400" : isCompleted ? "text-white" : "text-slate-500")
                  )}>
                    {node.label}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                    {node.cloud}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate">{node.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InGameGiftCard({ game, amount, hash }: { game: string; amount: number; hash: string }) {
  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-blue-500/10 border border-orange-500/20 flex items-center justify-between font-mono">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-orange-500 text-slate-950 font-bold">
          <Gift className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">In-Game Reward Active</span>
          <h5 className="font-bold text-white text-xs">{amount} Gold Coins Crate ({game})</h5>
        </div>
      </div>
      <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">{hash}</span>
    </div>
  );
}

export function AgenticWorkflows() {
  const { setActiveSection } = useDemoEvent();
  const [routingMode, setRoutingModeState] = useState<RoutingMode>(getRoutingMode());
  const [isSimulatorRunning, setIsSimulatorRunning] = useState<boolean>(() => getSimulatorStatePayload().isRunning);

  useEffect(() => {
    const unsubMode = onRoutingModeChange((newMode) => {
      setRoutingModeState(newMode);
    });
    const unsubSim = onSimulatorStateChange((state) => {
      setIsSimulatorRunning(state.isRunning);
    });
    return () => {
      unsubMode();
      unsubSim();
    };
  }, []);

  const [executingId, setExecutingId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [results, setResults] = useState<Record<string, WorkflowResult>>({});
  const [approvedActions, setApprovedActions] = useState<Record<string, boolean>>({});
  const [rejectedActions, setRejectedActions] = useState<Record<string, boolean>>({});
  const [traceError, setTraceError] = useState<Record<string, string | null>>({});
  const [activeSessionIds, setActiveSessionIds] = useState<Record<string, string | null>>({
    "Automated Player Retention Promo": "sess_kc_8f92a104",
    "Fraud & Cheat Detection Agent": "sess_cheat_3a19b882",
    "Dynamic Matchmaking Balance": "sess_mm_7c41e905",
  });
  const [followUpResponse, setFollowUpResponse] = useState<Record<string, string | null>>({});
  const traceContainerRef = useRef<HTMLDivElement | null>(null);

  // Feature flag to cleanly hide Active Follow-up Sub-Card (C4 requirement)
  const SHOW_FOLLOW_UP_ROUTINES = false;

  // Expanded card state per agent (keyed by agent ID) - R1: Retention agent starts collapsed
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    "Automated Player Retention Promo": false,
  });

  // Agent Control Group state: Active & Autonomous toggles per agent
  const [agentActive, setAgentActive] = useState<Record<string, boolean>>({
    "Automated Player Retention Promo": true,
    "Fraud & Cheat Detection Agent": false,
    "Dynamic Matchmaking Balance": true,
  });

  // R1: Autonomous starts disabled (Single-Invocation mode)
  const [agentAutonomous, setAgentAutonomous] = useState<Record<string, boolean>>({
    "Automated Player Retention Promo": false,
    "Fraud & Cheat Detection Agent": false,
    "Dynamic Matchmaking Balance": false,
  });

  const [isProbing, setIsProbing] = useState<boolean>(true);
  const [isAgentLive, setIsAgentLive] = useState<boolean>(false);

  // R2: Agent response history session state pre-loaded with initial 250-word capability summary
  const [agentHistory, setAgentHistory] = useState<Record<string, AgentHistoryEntry[]>>({
    "Automated Player Retention Promo": [
      {
        id: "init-prompt-kc",
        role: "user",
        text: INITIAL_KC_PROMPT,
        timestamp: "10:00 AM",
      },
      {
        id: "init-response-kc",
        role: "agent",
        agentName: "agent-kc",
        text: "[Checking agent_kc liveness status...]",
        isStreaming: true,
        timestamp: "10:00 AM",
      },
    ],
  });

  // Liveness check on page mount
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const performLivenessProbe = async () => {
      try {
        const livenessRes = await fetch("/api/guardrail/agent-liveness", { signal: controller.signal }).catch(() => null);
        let liveConfirmed = false;
        if (livenessRes && livenessRes.ok) {
          const livenessData = await livenessRes.json();
          if (livenessData.live === true) {
            liveConfirmed = true;
          }
        }

        if (liveConfirmed) {
          const traceUrl = `/api/guardrail/agent-trace?query=${encodeURIComponent(INITIAL_KC_PROMPT)}`;
          const traceRes = await fetch(traceUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (traceRes.ok) {
            const traceData = await traceRes.json();
            if (traceData.session_id) {
              setActiveSessionIds((prev) => ({
                ...prev,
                "Automated Player Retention Promo": traceData.session_id,
              }));
            }
            if (traceData.response_text && !traceData.response_text.startsWith("[agent-kc Analysis]")) {
              const cleanText = extractCleanTextPayload(traceData.response_text);
              if (isMounted) {
                setIsAgentLive(true);
                setIsProbing(false);
                setAgentHistory((prev) => ({
                  ...prev,
                  "Automated Player Retention Promo": [
                    {
                      id: "init-prompt-kc",
                      role: "user",
                      text: INITIAL_KC_PROMPT,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                    {
                      id: "init-response-kc",
                      role: "agent",
                      agentName: "agent-kc",
                      text: cleanText,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ],
                }));
                return;
              }
            }
          }
        }

        clearTimeout(timeoutId);
        if (isMounted) {
          setIsAgentLive(false);
          setIsProbing(false);
          setAgentHistory((prev) => ({
            ...prev,
            "Automated Player Retention Promo": [
              {
                id: "init-prompt-kc",
                role: "user",
                text: INITIAL_KC_PROMPT,
                timestamp: "10:00 AM",
              },
              {
                id: "init-response-kc",
                role: "agent",
                agentName: "agent-kc",
                text: INITIAL_KC_RESPONSE,
                timestamp: "10:00 AM",
              },
            ],
          }));
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (isMounted) {
          setIsAgentLive(false);
          setIsProbing(false);
          setAgentHistory((prev) => ({
            ...prev,
            "Automated Player Retention Promo": [
              {
                id: "init-prompt-kc",
                role: "user",
                text: INITIAL_KC_PROMPT,
                timestamp: "10:00 AM",
              },
              {
                id: "init-response-kc",
                role: "agent",
                agentName: "agent-kc",
                text: INITIAL_KC_RESPONSE,
                timestamp: "10:00 AM",
              },
            ],
          }));
        }
      }
    };

    performLivenessProbe();

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  const [parsedDecision, setParsedDecision] = useState<DecisionPayload | null>(null);

  // Auto-parse decision payload from the latest agent response history entry
  useEffect(() => {
    const historyList = agentHistory["Automated Player Retention Promo"] || [];
    const lastAgentMsg = [...historyList].reverse().find(e => e.role === "agent" && e.id !== "init-response-kc");
    if (lastAgentMsg && lastAgentMsg.text) {
      const parsed = parseDecisionPayload(lastAgentMsg.text);
      if (parsed) {
        setParsedDecision(parsed);
      }
    }
  }, [agentHistory]);

  const resetWfState = (wfId: string) => {
    setApprovedActions((prev) => {
      const next = { ...prev };
      delete next[wfId];
      return next;
    });
    setRejectedActions((prev) => {
      const next = { ...prev };
      delete next[wfId];
      return next;
    });
    setResults((prev) => {
      const next = { ...prev };
      delete next[wfId];
      return next;
    });
    setFollowUpResponse((prev) => ({ ...prev, [wfId]: null }));
  };

  // Coupling logic handlers
  const handleToggleActive = (id: string) => {
    resetWfState(id);
    setAgentActive((prev) => {
      const nextActive = !prev[id];
      // If turning Active OFF, force Autonomous OFF
      if (!nextActive) {
        setAgentAutonomous((autoPrev) => ({ ...autoPrev, [id]: false }));
      }
      return { ...prev, [id]: nextActive };
    });
  };

  const handleToggleAutonomous = (wfId: string) => {
    resetWfState(wfId);
    setAgentAutonomous((prev) => {
      const nextAutonomous = !prev[wfId];
      // If turning Autonomous ON, force Active ON
      if (nextAutonomous) {
        setAgentActive((actPrev) => ({ ...actPrev, [wfId]: true }));
      }
      return { ...prev, [wfId]: nextAutonomous };
    });
  };

  const toggleExpand = (wfId: string) => {
    setExpandedCards((prev) => ({ ...prev, [wfId]: !prev[wfId] }));
  };

  const workflowData: Record<string, WorkflowResult> = {
    "Automated Player Retention Promo": {
      thinking: [
        "[1/4] Constructing Gemini Enterprise prompt buffer with player telemetry stream...",
        "[2/4] Querying Knowledge Catalog for governance aspect 'liveops_campaign_policy_aspect'...",
        "[3/4] Evaluating BQML churn prediction model ('gaming_player_churn_model' -> 89% score)...",
        "[4/4] Policy verified: Max discount limit 85% honored. Issuing certified offer SKU 'frost_giant_shield_pack'."
      ],
      finding: "Critical level decline detected for 'Realm of Eldoria RPG' veteran whale cohort after 4 consecutive Frost Giant wipeouts.",
      impact: "Potential $85K user lifetime value (LTV) churn exposure over current season.",
      recommendation: "Inject dynamic $0.99 Frost Giant Shield & Resurrect Crate (80% discount). Policy Aspect ID: liveops_campaign_policy_aspect.",
      nextSteps: ["Send In-Game Gift", "Auto-Notify Team", "Update Segment Tag"]
    },
    "Fraud & Cheat Detection Agent": {
      thinking: [
        "[1/4] Scanning AlloyDB transaction logs for rapid currency duplication...",
        "[2/4] Fetching historical IP range profiles from AWS S3...",
        "[3/4] Running Anomaly Detection Model in Gemini Enterprise...",
        "[4/4] Anomaly detected: Suspicious item duplication loop confirmed."
      ],
      finding: "Rapid gold coin inflation spike in Region JP Server #4.",
      impact: "In-game economy devaluation risk of $120K.",
      recommendation: "Temporarily freeze trading index for flagged accounts and trigger incident report.",
      nextSteps: ["Freeze Trading", "Notify Security", "Export Log Audit"]
    },
    "Dynamic Matchmaking Balance": {
      thinking: [
        "[1/4] Monitoring active lobby queue times across NA-East...",
        "[2/4] Reading SLA thresholds from Snowflake DB...",
        "[3/4] Evaluating Cloud Run instance scaling bounds...",
        "[4/4] Scaling decision: Provision 4 additional regional server nodes."
      ],
      finding: "Queue wait time exceeded 45s SLA in NA-East matchmaking pool.",
      impact: "Player satisfaction drop and short-term session abandonment.",
      recommendation: "Auto-scale Cloud Run compute nodes to lower queue wait times under 15s.",
      nextSteps: ["Scale Cloud Run", "Adjust Queue Bounds", "Send SLA Metric"]
    }
  };

  const handleExecute = (id: string) => {
    setExecutingId(id);
    setCurrentStep(0);
    setFollowUpResponse((prev) => ({ ...prev, [id]: null }));
    setResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setExpandedCards((prev) => ({ ...prev, [id]: true }));

    if (id === "Automated Player Retention Promo") {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setAgentHistory((prev) => {
        const existing = prev[id] || [];
        return {
          ...prev,
          [id]: [
            ...existing,
            {
              id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              role: "user",
              text: EXECUTE_RUN_DISPLAY_PROMPT,
              timestamp: timeStr,
            },
            {
              id: `agt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              role: "agent",
              agentName: "agent-kc",
              text: "[Evaluating player telemetry & Knowledge Catalog guardrail aspect policy...]",
              timestamp: timeStr,
              isStreaming: true,
              reasoningSteps: workflowData[id].thinking,
            }
          ]
        };
      });
    }

    const isRetentionAgent = id === "Automated Player Retention Promo";
    const useLiveCall = isRetentionAgent ? (isAgentLive && routingMode === "LIVE") : (routingMode === "LIVE");

    if (useLiveCall) {
      const existingSessionId = activeSessionIds[id];
      const validSessionId = (existingSessionId && !existingSessionId.startsWith("jg-session") && !existingSessionId.startsWith("sess_")) ? existingSessionId : undefined;
      const traceUrl = `/api/guardrail/agent-trace?${validSessionId ? `session_id=${encodeURIComponent(validSessionId)}&` : ""}query=${encodeURIComponent(EXECUTE_RUN_API_PROMPT)}&active=${agentActive[id]}&autonomous=${agentAutonomous[id]}`;
      fetch(traceUrl)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.error || !data.live) {
            throw new Error(data.error || "Agent Platform fallback response generated");
          }
          setTraceError((prev) => ({ ...prev, [id]: null }));
          if (data.session_id) {
            setActiveSessionIds((prev) => ({ ...prev, [id]: data.session_id }));
          }
          if (id === "Automated Player Retention Promo" && data.response_text) {
            const cleanText = extractCleanTextPayload(data.response_text);
            setAgentHistory((prev) => {
              const list = (prev[id] || []).map((entry) =>
                entry.isStreaming === true
                  ? { ...entry, text: cleanText, isStreaming: false }
                  : entry
              );
              return { ...prev, [id]: list };
            });
          }
          setResults((prev) => ({
            ...prev,
            [id]: workflowData[id]
          }));
          setCurrentStep(3);
          setExecutingId(null);
        })
        .catch((err) => {
          setTraceError((prev) => ({
            ...prev,
            [id]: 'Agent Trace endpoint failed (HTTP 404: ). Displaying fallback trace with warning....',
          }));
          if (id === "Automated Player Retention Promo") {
            const fallbackText = DEFAULT_RETENTION_FALLBACK_RESPONSE;

            setAgentHistory((prev) => {
              const list = (prev[id] || []).map((entry) =>
                entry.isStreaming === true
                  ? { ...entry, text: fallbackText, isStreaming: false }
                  : entry
              );
              return { ...prev, [id]: list };
            });
          }
          setResults((prev) => ({
            ...prev,
            [id]: workflowData[id]
          }));
          setCurrentStep(3);
          setExecutingId(null);
        });
    } else {
      setTraceError((prev) => ({ ...prev, [id]: null }));
      if (id === "Automated Player Retention Promo") {
        setTimeout(() => {
          setTraceError((prev) => ({
            ...prev,
            [id]: 'Agent Trace endpoint failed (HTTP 404: ). Displaying fallback trace with warning....',
          }));
          const fallbackText = DEFAULT_RETENTION_FALLBACK_RESPONSE;
          setAgentHistory((prev) => {
            const list = (prev[id] || []).map((entry) =>
              entry.isStreaming === true
                ? { ...entry, text: fallbackText, isStreaming: false }
                : entry
            );
            return { ...prev, [id]: list };
          });
          setResults((prev) => ({
            ...prev,
            [id]: workflowData[id]
          }));
          setCurrentStep(3);
          setExecutingId(null);
        }, 5000);
      }
    }
  };

  useEffect(() => {
    if (executingId) {
      const stepInterval = executingId === "Automated Player Retention Promo" && (!isAgentLive || routingMode !== "LIVE") ? 1200 : 700;
      const timer = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= 3) {
            clearInterval(timer);
            return prev;
          }
          return prev + 1;
        });
      }, stepInterval);
      return () => clearInterval(timer);
    }
  }, [executingId, isAgentLive, routingMode]);

  useEffect(() => {
    if (executingId && currentStep >= 3 && executingId !== "Automated Player Retention Promo") {
      setResults((prev) => ({
        ...prev,
        [executingId]: workflowData[executingId]
      }));
      setExecutingId(null);
    }
    if (traceContainerRef.current) {
      traceContainerRef.current.scrollTop = 0;
    }
  }, [executingId, currentStep]);

  const handleFollowUp = (id: string, step: string) => {
    let msg = "";
    if (step.includes("In-Game Gift")) {
      msg = "Direct in-game crate dispatched via LiveEngine API. 150 gold & Frost Giant Shield added.";
    } else if (step.includes("Notify")) {
      msg = "Automated Slack alert sent to #liveops-alerts with Knowledge Catalog aspect verification report.";
    } else {
      msg = `Execution completed for '${step}'. Audit logged in BigQuery gold_player_360 table.`;
    }
    setFollowUpResponse((prev) => ({ ...prev, [id]: msg }));
  };

  const workflows = [
    {
      id: "Automated Player Retention Promo",
      title: "Player Retention Promo Agent",
      desc: "Monitors play logs, evaluates BQML churn scores, and distributes certified dynamic reward crates under Knowledge Catalog policy guardrails.",
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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BrainCircuit className="w-8 h-8 text-blue-600" />
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight font-sans">
              Player Operations AI Agent Hub
            </h2>
          </div>
          <p className="text-slate-500 font-light text-sm italic">
            Autonomous Policy Guardrails & Multi-Cloud Action Traces: BigQuery + BQML + Knowledge Catalog + Gemini Enterprise
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 px-3.5 py-2 rounded-2xl border border-slate-800 text-xs font-mono">
          <span className="text-slate-400 font-bold uppercase">Routing Mode:</span>
          <span
            className={cn(
              "px-2 py-0.5 rounded font-bold uppercase",
              routingMode === "LIVE" ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
            )}
          >
            {routingMode}
          </span>
        </div>
      </header>

      <div className="space-y-8">
        {workflows.map((wf, i) => {
          const isRetentionAgent = wf.id === "Automated Player Retention Promo";
          const isExpanded = !!expandedCards[wf.id];
          const isActive = !!agentActive[wf.id];
          const isAutonomous = !!agentAutonomous[wf.id];

          return (
            <motion.div
              key={wf.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "bg-white rounded-[2rem] border transition-all duration-500",
                results[wf.id] ? "border-blue-100 shadow-xl shadow-blue-900/5" : "border-slate-100 shadow-sm"
              )}
            >
              {/* Header Row with Left-Aligned Expand Arrow & Unified Agent Control Group */}
              <div className="p-8 flex flex-col md:flex-row items-start md:items-center gap-6 bg-white">
                {/* Left-Aligned Expand/Collapse Arrow Button */}
                <button
                  type="button"
                  onClick={() => toggleExpand(wf.id)}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer shrink-0"
                  title={isExpanded ? "Collapse agent workspace" : "Expand agent workspace"}
                >
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>

                <div className={`p-4 rounded-3xl ${wf.bg} shrink-0`}>
                  <wf.icon className={`w-7 h-7 ${wf.color}`} />
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-slate-800 leading-tight">{wf.title}</h3>
                    {isAutonomous ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700 uppercase tracking-widest">
                        Autonomous Guardrail Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        Single-Invocation Mode
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-light">{wf.desc}</p>
                </div>

                {/* Unified Agent Control Group (Top-Right Pill Container) */}
                <div className="shrink-0 flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-full px-4 py-2 font-mono text-xs shadow-inner">
                  {/* Active Switch */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Active:</span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(wf.id)}
                      className={cn(
                        "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center",
                        isActive ? "bg-blue-600 justify-end" : "bg-slate-700 justify-start"
                      )}
                    >
                      <motion.div className="w-4 h-4 rounded-full bg-white shadow-md font-mono" layout />
                    </button>
                  </div>

                  <div className="h-4 w-[1px] bg-slate-800" />

                  {/* Autonomous Switch */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Autonomous:</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAutonomous(wf.id)}
                      className={cn(
                        "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center",
                        isAutonomous ? "bg-emerald-600 justify-end" : "bg-slate-700 justify-start"
                      )}
                    >
                      <motion.div className="w-4 h-4 rounded-full bg-white shadow-md font-mono" layout />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Agent Workspace */}
              <AnimatePresence mode="wait">
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-100 bg-[#F8FAFC]"
                  >
                    <div className="p-8 space-y-8">
                      {/* Top Row: Operational Proposal Card (LEFT) & Approval Gate / Status Chip (RIGHT) */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT: Operational Proposal Card */}
                        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                          <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                            <div>
                              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block font-mono">
                                Operational Proposal Details
                              </span>
                              <h4 className="text-base font-bold text-slate-800 leading-snug">
                                {!results[wf.id]
                                  ? (isRetentionAgent
                                      ? "No active operational proposal evaluated yet. Click 'Execute Single Run' to analyze player telemetry."
                                      : "No active evaluation")
                                  : (isRetentionAgent
                                      ? (parsedDecision && parsedDecision.target_cohorts.length > 0
                                          ? `Target Cohorts: Realm of Eldoria RPG - ${parsedDecision.target_cohorts.map(c => c.cohort_id).join(", ")} Cohorts`
                                          : "Target Cohort: Realm of Eldoria RPG - Minnow & F2P Cohorts")
                                      : workflowData[wf.id].finding)}
                              </h4>
                            </div>
                            {results[wf.id] && (
                              <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-bold uppercase font-mono shrink-0">
                                P1 - $85K Exposure
                              </span>
                            )}
                          </div>

                          {results[wf.id] ? (
                            <div className="space-y-3 font-mono text-xs">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Certified Reward SKU:</span>
                                  <span className="font-bold text-slate-700">{parsedDecision?.sku_id || "frost_giant_shield_pack"}</span>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Knowledge Catalog Aspect ID:</span>
                                  <span className="font-bold text-slate-700">liveops_campaign_policy_aspect</span>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Max Discount Boundary:</span>
                                  <span className="font-bold text-emerald-600">
                                    {parsedDecision ? `${parsedDecision.discount_percentage}% Compliant Cap` : "25% (Policy Limit Cap)"}
                                  </span>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Predicted Churn Threshold:</span>
                                  <span className="font-bold text-red-600">
                                    {parsedDecision && parsedDecision.target_cohorts.length > 0
                                      ? `${(Math.min(...parsedDecision.target_cohorts.map(c => c.churn_threshold)) * 100).toFixed(0)}% Minimum Threshold (${parsedDecision.target_cohorts.length} Cohorts)`
                                      : "85% (HIGH RISK)"}
                                  </span>
                                </div>
                              </div>

                              {parsedDecision && (
                                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-slate-700">
                                  <span className="font-bold text-blue-900 block mb-1">Targeted Cohorts & Policy Rationale:</span>
                                  <p className="text-[10px] text-slate-600 italic mb-2">{typeof parsedDecision.reasoning === "string" ? parsedDecision.reasoning : JSON.stringify(parsedDecision.reasoning)}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {parsedDecision.target_cohorts.map((tc, idx) => (
                                      <span key={idx} className="px-2 py-0.5 rounded bg-white border border-blue-200 text-[9px] text-slate-800">
                                        <strong className="text-blue-700">{typeof tc.cohort_id === "string" ? tc.cohort_id : String(tc.cohort_id)} Cohort</strong>: {((tc.churn_threshold || 0.85) * 100).toFixed(0)}% churn threshold — {typeof tc.offer_details === "string" ? tc.offer_details : JSON.stringify(tc.offer_details || "Compliant discount")}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 font-mono italic">
                              Waiting for single run telemetry analysis trigger...
                            </div>
                          )}
                        </div>

                        {/* RIGHT: Execution & Approval Gate */}
                        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono mb-2">
                              Execution & Approval Gate
                            </span>

                            {!results[wf.id] ? (
                              <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs font-mono text-slate-500">
                                No offer currently active or pending approval.
                              </div>
                            ) : isAutonomous ? (
                              /* Autonomous Mode: Status Chip with Rich Hover Tooltip */
                              <div className="relative group p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                  <div>
                                    <span className="text-xs font-bold text-emerald-900 block">APPROVED BY AGENT</span>
                                      <span className="text-[10px] text-emerald-700 font-mono">Knowledge Catalog Policy Audit Verified</span>
                                  </div>
                                </div>
                                <Info className="w-4 h-4 text-emerald-600 cursor-pointer" />

                                {/* Hover Tooltip detailing policy decision rationale */}
                                <div className="absolute top-full left-0 right-0 mt-2 p-4 rounded-xl bg-slate-900 text-white font-mono text-[11px] shadow-2xl opacity-0 group-hover:opacity-100 transition-all z-30 border border-slate-700 space-y-1">
                                    <p className="font-bold text-emerald-400">[KNOWLEDGE CATALOG POLICY COMPLIANCE VERIFIED]</p>
                                  <p>- Aspect Check: `liveops_campaign_policy_aspect` PASSED</p>
                                  <p>- Max Discount Boundary ({parsedDecision ? `${parsedDecision.discount_percentage}%` : "25%"}) limit honored</p>
                                  <p>- BQML Minimum Churn Score: {parsedDecision && parsedDecision.target_cohorts.length > 0 ? Math.min(...parsedDecision.target_cohorts.map(c => c.churn_threshold)) : "0.85"}</p>
                                  <p>- Target Segments: {parsedDecision && parsedDecision.target_cohorts.length > 0 ? parsedDecision.target_cohorts.map(c => c.cohort_id).join(", ") : "Minnow, F2P"}</p>
                                </div>
                              </div>
                            ) : (
                              /* Single-Invocation Mode: Interactive Approval Gate */
                              <div className="space-y-3">
                                <p className="text-xs text-slate-600 leading-relaxed font-light">
                                  Manual approval required prior to injecting offer script into game telemetry stream.
                                </p>
                                {rejectedActions[wf.id] ? (
                                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-2 text-xs font-bold text-rose-800 font-mono">
                                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                                    <span>Proposal Rejected & Dismissed.</span>
                                  </div>
                                ) : !approvedActions[wf.id] ? (
                                  <div className="grid grid-cols-2 gap-2 font-mono">
                                    <button 
                                      onClick={() => {
                                        setApprovedActions(prev => ({ ...prev, [wf.id]: true }));
                                        setRejectedActions(prev => ({ ...prev, [wf.id]: false }));

                                        const targetTiers = isRetentionAgent && parsedDecision && parsedDecision.target_cohorts.length > 0
                                          ? parsedDecision.target_cohorts.map(c => c.cohort_id)
                                          : ["Minnow", "F2P"];

                                        const minChurn = isRetentionAgent && parsedDecision && parsedDecision.target_cohorts.length > 0
                                          ? Math.min(...parsedDecision.target_cohorts.map(c => c.churn_threshold))
                                          : 0.85;

                                        broadcastIncomingAgentEvent({
                                          eventType: "in_game_retention_offer_injected",
                                          payload: {
                                            agentId: wf.id,
                                            intervention_type: parsedDecision?.intervention_type || "proactive_churn_offer",
                                            target_cohorts: targetTiers,
                                            sku_id: parsedDecision?.sku_id || "frost_giant_shield_pack",
                                            discount_percentage: parsedDecision?.discount_percentage ?? 25.0,
                                            churn_threshold: minChurn,
                                            target_cohort_details: parsedDecision?.target_cohorts || [],
                                            reasoning: parsedDecision?.reasoning || "",
                                            title: "Frost Giant Shield & Resurrect Crate",
                                            price: "$0.99",
                                            dataplexAspectVerified: true,
                                            timestamp: Date.now()
                                          }
                                        });
                                      }}
                                      className="py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
                                    >
                                      <CheckCircle2 className="w-4 h-4" /> Approve & Inject
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setRejectedActions(prev => ({ ...prev, [wf.id]: true }));
                                        setApprovedActions(prev => ({ ...prev, [wf.id]: false }));
                                      }}
                                      className="py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <ShieldAlert className="w-4 h-4 text-rose-600" /> Reject / Dismiss
                                    </button>
                                  </div>
                                ) : (
                                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-xs font-bold text-emerald-800 font-mono">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>Script Injected. Retention offer active.</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                            {!results[wf.id] && !executingId && (
                              <button 
                                type="button"
                                disabled={isRetentionAgent && isProbing}
                                onClick={() => handleExecute(wf.id)}
                                className={cn(
                                  "w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all shadow-sm font-mono",
                                  isRetentionAgent && isProbing
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-70 border border-slate-300 pointer-events-none"
                                    : "bg-slate-900 text-white hover:bg-blue-700 cursor-pointer"
                                )}
                              >
                                {isRetentionAgent && isProbing ? (
                                  <>
                                    <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                    <span>Checking Agent Status...</span>
                                  </>
                                ) : isRetentionAgent && !isAgentLive ? (
                                  <>
                                    <span>execute single run (mock)</span>
                                    <ArrowRight className="w-4 h-4" />
                                  </>
                                ) : (
                                  <>
                                    <span>execute single run</span>
                                    <ArrowRight className="w-4 h-4" />
                                  </>
                                )}
                              </button>
                            )}
                            {executingId === wf.id && (
                              <div className="w-full py-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest font-mono">
                                  Evaluating Telemetry...
                                </span>
                              </div>
                            )}
                            {results[wf.id] && (
                              <button 
                                type="button"
                                disabled={isRetentionAgent && isProbing}
                                onClick={() => handleExecute(wf.id)}
                                className={cn(
                                  "w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 font-mono",
                                  isRetentionAgent && isProbing
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                                    : "bg-slate-100 text-slate-600 hover:text-blue-600 cursor-pointer"
                                )}
                              >
                                <RotateCcw className="w-4 h-4" />
                                <span>
                                  {isRetentionAgent && !isAgentLive ? "query agent again (mock)" : "query agent again"}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Agent response history (LEFT) & Data Cloud Telemetry Flow (RIGHT) */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Agent response history connected to agent-kc (Enlarged C1) */}
                        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-md space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                              <Bot className="w-4 h-4 text-blue-600" />
                              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest font-mono">
                                Agent response history
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {activeSessionIds[wf.id] && (
                                <SessionIdBadge sessionId={activeSessionIds[wf.id]} />
                              )}
                              <DataModeBadge mode={routingMode === "LIVE" ? "live" : "mock"} source="agent_kc (Gemini Enterprise Agent Platform)" />

                              <button
                                type="button"
                                onClick={() => setActiveSection({ id: "catalog", search: "agent-kc" })}
                                className="text-[9px] px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-mono font-bold border border-blue-200/50 transition-colors cursor-pointer flex items-center gap-1 group"
                                title="View chat session history & Knowledge Catalog entries for agent-kc"
                              >
                                <span>agent-kc</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                              </button>
                            </div>
                          </div>

                          {traceError[wf.id] && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 font-mono text-[11px] flex items-center gap-2 mb-3">
                              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>{traceError[wf.id]}</span>
                            </div>
                          )}

                          <div ref={traceContainerRef} className="space-y-4 font-mono max-h-[480px] min-h-[320px] overflow-y-auto pr-1 text-xs">
                            {(agentHistory[wf.id] && agentHistory[wf.id].length > 0) ? (
                              [...agentHistory[wf.id]].reverse().map((entry) => (
                                <div key={entry.id} className="space-y-2">
                                  {entry.role === "user" ? (
                                    <div className="bg-slate-100 border border-slate-200/60 p-3 rounded-2xl text-slate-800 space-y-1">
                                      <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase">
                                        <span>User Query</span>
                                        <span>{entry.timestamp}</span>
                                      </div>
                                      <p className="font-sans font-medium text-xs leading-relaxed">{entry.text}</p>
                                    </div>
                                  ) : (
                                    <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-2xl text-slate-800 space-y-2">
                                      <div className="flex justify-between items-center text-[9px] text-blue-600 font-bold uppercase">
                                        <span className="flex items-center gap-1.5 font-bold">
                                          <Bot className="w-3.5 h-3.5" /> {entry.agentName || "agent-kc"}
                                        </span>
                                        <span>{entry.timestamp}</span>
                                      </div>
                                      <div className="font-sans text-xs text-slate-700 leading-relaxed markdown-content">
                                        <ReactMarkdown
                                          components={{
                                            p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                                            ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-2 text-slate-700">{children}</ul>,
                                            ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-2 text-slate-700">{children}</ol>,
                                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                            strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                                            em: ({ children }) => <em className="italic text-slate-800">{children}</em>,
                                              pre: ({ children }) => <pre className="bg-slate-900 text-slate-100 font-mono text-[11px] p-3 rounded-xl overflow-x-auto my-2 border border-slate-800 leading-relaxed">{children}</pre>,
                                              code: ({ inline, children }: any) => inline ? <code className="bg-slate-200/70 text-slate-900 font-mono text-[11px] px-1.5 py-0.5 rounded border border-slate-300/60">{children}</code> : <code className="font-mono text-[11px] text-emerald-400 leading-relaxed">{children}</code>,
                                            blockquote: ({ children }) => <blockquote className="border-l-2 border-blue-400 pl-3 py-1 my-2 text-slate-600 bg-blue-50/50 rounded-r">{children}</blockquote>
                                          }}
                                        >
                                          {extractCleanTextPayload(entry.text)}
                                        </ReactMarkdown>
                                      </div>
                                      {/* C2: Hide mock reasoning steps when agent-kc is reached; show ONLY when traceError is present or routingMode !== LIVE */}
                                      {entry.reasoningSteps && entry.reasoningSteps.length > 0 && (Boolean(traceError[wf.id]) || routingMode !== "LIVE") && (
                                        <div className="pt-2 border-t border-blue-100/60 space-y-1 text-[11px]">
                                          {entry.reasoningSteps.map((step, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-slate-500">
                                              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", executingId === wf.id && idx === currentStep ? "bg-blue-600 animate-pulse" : "bg-emerald-500")} />
                                              <span>{step}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              workflowData[wf.id].thinking.map((step, idx) => (
                                <motion.div 
                                  key={idx}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ 
                                    opacity: (executingId === wf.id ? (idx < currentStep ? 1 : 0.3) : 1),
                                    x: 0 
                                  }}
                                  className={cn(
                                    "flex items-center gap-3 text-[11px]",
                                    executingId === wf.id && idx === currentStep ? "text-blue-600 font-bold" : "text-slate-500"
                                  )}
                                >
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                    executingId === wf.id && idx === currentStep ? "bg-blue-600 animate-pulse" : 
                                    (executingId === wf.id && idx < currentStep) || results[wf.id] ? "bg-emerald-400" : "bg-slate-200"
                                  )} />
                                  {step}
                                </motion.div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Data Cloud Telemetry Flow Diagram */}
                        <div className="lg:col-span-5">
                          <AgenticPipelineDiagram 
                            wfId={wf.id} 
                            currentStep={currentStep} 
                            isFinished={!!results[wf.id]} 
                            routingMode={routingMode}
                            isSimulatorRunning={isSimulatorRunning}
                            isExecuting={executingId === wf.id}
                          />
                        </div>
                      </div>

                      {/* Active Follow-up Routines when result is active (C4 Hidden Wrapper) */}
                      {SHOW_FOLLOW_UP_ROUTINES && results[wf.id] && (
                        <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-sm space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                              Active Follow-up Routines
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {results[wf.id].nextSteps.map(step => (
                              <button 
                                key={step} 
                                onClick={() => handleFollowUp(wf.id, step)}
                                className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-all cursor-pointer font-mono"
                              >
                                {step} →
                              </button>
                            ))}
                          </div>

                          <AnimatePresence>
                            {followUpResponse[wf.id] && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="mt-4 space-y-3"
                              >
                                {followUpResponse[wf.id]?.includes("150 gold") && (
                                  <InGameGiftCard 
                                    game="Realm of Eldoria RPG" 
                                    amount={150} 
                                    hash="#JG-TX-9982" 
                                  />
                                )}
                                <div className="p-4 rounded-2xl bg-blue-600 text-white text-xs font-mono shadow-md flex items-center gap-3">
                                  <Zap className="w-4 h-4 shrink-0" />
                                  <p>{followUpResponse[wf.id]}</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
