import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, 
  Bot, 
  Zap, 
  Database,
  CheckCircle2,
  Loader2,
  Circle,
  Search,
  Lock,
  Terminal
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "../../lib/utils";

const MOCK_REVENUE_DATA = [
  { name: "Puzzle Quest Saga", revenue: 142, target: 162 },
  { name: "Cosmic Raider RPG", revenue: 128, target: 125 },
  { name: "Retro Speed Racer", revenue: 98, target: 100 },
  { name: "Pixel Battle Royale", revenue: 85, target: 80 },
];

const MOCK_OCCUPANCY_DATA = [
  { facility: "US-East Lobby", occupancy: 92, staff: 85 },
  { facility: "EU-West Lobby", occupancy: 78, staff: 80 },
  { facility: "US-West Lobby", occupancy: 65, staff: 60 },
  { facility: "APAC Lobby", occupancy: 42, staff: 50 },
];

const MOCK_SURGEON_DATA = [
  { surgeon: "Exploit Watch", procedure: "Anti-cheat", cases: 42, alloy_sync: true },
  { surgeon: "Match Balancer", procedure: "Infrastructure", cases: 38, alloy_sync: true },
  { surgeon: "LTV Engine", procedure: "Promotions", cases: 15, alloy_sync: false },
];

export interface ChatStep {
  id: number;
  title: string;
  detail: string;
  status: "pending" | "in_progress" | "completed";
}

interface Message {
  role: "user" | "bot";
  content: string | React.ReactNode;
  suggestions?: string[];
  stepper?: ChatStep[];
}

export function HospitalAdmin({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: "bot", 
      content: (
        <div className="space-y-4">
          <p className="font-bold text-slate-800 text-lg tracking-tight font-sans">PineCore AI Assistant Activated.</p>
          <p className="text-slate-500 font-light leading-relaxed text-xs">
            I am connected to Dataplex Knowledge Catalog, BQML prediction engines, and BigQuery Gold tables via Application Default Credentials (ADC). How can I assist?
          </p>
        </div>
      ),
      suggestions: ["Dataplex Policy Verification", "Revenue Variance Analysis", "Lobby Occupancy", "GDPR Health Check"]
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeSteps, setActiveSteps] = useState<ChatStep[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen, activeSteps]);

  const handleSend = async (customMsg?: string) => {
    const userMsg = customMsg || input;
    if (!userMsg.trim()) return;

    setInput("");
    setMessages(prev => [...prev.map(m => ({ ...m, suggestions: [] })), { role: "user", content: userMsg }]);
    setIsTyping(true);

    // Initialize Multi-Step Stepper Progress
    const initialSteps: ChatStep[] = [
      { id: 1, title: "Dataplex Schema Search", detail: "Searching Dataplex Knowledge Catalog entries...", status: "in_progress" },
      { id: 2, title: "Aspect Tag Verification", detail: "Verifying liveops_campaign_policy_aspect compliance...", status: "pending" },
      { id: 3, title: "BigQuery SQL Execution", detail: "Executing gold_player_360 query via ADC...", status: "pending" },
    ];
    setActiveSteps(initialSteps);

    // Step 1 -> Step 2 transition after 350ms
    setTimeout(() => {
      setActiveSteps([
        { id: 1, title: "Dataplex Schema Search", detail: "Dataplex search completed (found 3 matches).", status: "completed" },
        { id: 2, title: "Aspect Tag Verification", detail: "Verifying liveops_campaign_policy_aspect compliance...", status: "in_progress" },
        { id: 3, title: "BigQuery SQL Execution", detail: "Executing gold_player_360 query via ADC...", status: "pending" },
      ]);
    }, 400);

    // Step 2 -> Step 3 transition after 750ms
    setTimeout(() => {
      setActiveSteps([
        { id: 1, title: "Dataplex Schema Search", detail: "Dataplex search completed (found 3 matches).", status: "completed" },
        { id: 2, title: "Aspect Tag Verification", detail: "Policy aspect verified (APPROVED max 85% discount).", status: "completed" },
        { id: 3, title: "BigQuery SQL Execution", detail: "Executing gold_player_360 query via ADC...", status: "in_progress" },
      ]);
    }, 800);

    // Final completion & bot response after 1200ms
    setTimeout(async () => {
      const finalSteps: ChatStep[] = [
        { id: 1, title: "Dataplex Schema Search", detail: "Dataplex search completed (found 3 matches).", status: "completed" },
        { id: 2, title: "Aspect Tag Verification", detail: "Policy aspect verified (APPROVED max 85% discount).", status: "completed" },
        { id: 3, title: "BigQuery SQL Execution", detail: "BigQuery query execution completed in 18ms.", status: "completed" },
      ];
      setActiveSteps(null);

      let botResponse: Message;
      const lowerMsg = userMsg.toLowerCase();

      if (lowerMsg.includes("dataplex") || lowerMsg.includes("policy") || lowerMsg.includes("verification")) {
        botResponse = {
          role: "bot",
          stepper: finalSteps,
          content: (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">Dataplex Policy Verification Report</h4>
              <p className="text-xs text-slate-500 font-light leading-relaxed">
                Verified aspect tag <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">liveops_campaign_policy_aspect</code> on target table <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">omniarcade_gold.gold_player_360</code>:
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 font-mono text-[11px]">
                <div className="flex justify-between text-slate-600"><span>Target Tier:</span> <span className="font-bold text-blue-600">Whale ($500+ LTV)</span></div>
                <div className="flex justify-between text-slate-600"><span>Max Discount:</span> <span className="font-bold text-amber-600">85% Max Allowed</span></div>
                <div className="flex justify-between text-slate-600"><span>Certified SKU:</span> <span className="font-bold text-emerald-600">frost_giant_shield_pack</span></div>
                <div className="flex justify-between text-slate-600"><span>Policy Decision:</span> <span className="font-bold text-emerald-600">APPROVED</span></div>
              </div>
            </div>
          ),
          suggestions: ["Revenue Analysis", "Lobby Concurrency", "GDPR Health Check"]
        };
      } else if (lowerMsg.includes("revenue") || lowerMsg.includes("performance") || lowerMsg.includes("variance")) {
        botResponse = {
          role: "bot",
          stepper: finalSteps,
          content: (
            <div className="space-y-4">
               <h4 className="font-bold text-slate-800 text-sm">Title Revenue Variance Analysis</h4>
               <p className="text-xs text-slate-500 font-light leading-relaxed">
                 Director, I have verified BigQuery Gold analytical features against live transaction streams:
               </p>
               <div className="h-44 bg-white p-3 rounded-2xl border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_REVENUE_DATA} margin={{ bottom: 15 }}>
                    <XAxis 
                      dataKey="name" 
                      stroke="#94a3b8" 
                      fontSize={8} 
                      interval={0}
                      angle={-10}
                      textAnchor="end"
                      height={35}
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <YAxis stroke="#94a3b8" fontSize={8} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Actual Gross ($K)" />
                  </BarChart>
                </ResponsiveContainer>
               </div>
            </div>
          ),
          suggestions: ["Dataplex Policy Verification", "Lobby Concurrency"]
        };
      } else if (lowerMsg.includes("lobby") || lowerMsg.includes("occupancy") || lowerMsg.includes("concurrency")) {
        botResponse = {
          role: "bot",
          stepper: finalSteps,
          content: (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">Active Regional Lobby Concurrency</h4>
              <p className="text-xs text-slate-500 font-light">US-East Lobby and EU-West Lobby are currently holding peak player loads (&gt;80%).</p>
              <div className="h-40 bg-white p-3 rounded-2xl border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_OCCUPANCY_DATA} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="facility" type="category" stroke="#94a3b8" fontSize={8} axisLine={false} tickLine={false} width={80} />
                    <Bar dataKey="occupancy" fill="#10b981" radius={[0, 4, 4, 0]} name="Lobby Occupancy %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ),
          suggestions: ["Dataplex Policy Verification", "GDPR Health Check"]
        };
      } else {
        botResponse = {
          role: "bot",
          stepper: finalSteps,
          content: (
            <div className="space-y-3">
              <p className="text-xs text-slate-700 font-bold">PineCore AI Query Execution Completed.</p>
              <p className="text-xs text-slate-500 leading-relaxed font-light">
                Queried Dataplex Knowledge Catalog and executed BigQuery analytical queries using Application Default Credentials (ADC).
              </p>
            </div>
          ),
          suggestions: ["Dataplex Policy Verification", "Revenue Variance Analysis", "Lobby Concurrency"]
        };
      }

      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <>
      {/* Floating Trigger */}
      <motion.button
        layoutId="assistant-button"
        id="dns-assistant-bubble"
        onClick={onToggle}
        className={cn(
          "fixed bottom-8 right-8 w-16 h-16 rounded-full bg-slate-900 text-white shadow-2xl flex items-center justify-center z-[100] hover:scale-110 transition-transform active:scale-95 border-4 border-white cursor-pointer",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <Bot className="w-8 h-8" />
      </motion.button>

      {/* Floating Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            className="fixed bottom-8 right-8 w-[460px] max-w-[calc(100vw-4rem)] h-[720px] max-h-[calc(100vh-8rem)] bg-white rounded-[2.5rem] shadow-[0_32px_120px_-10px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col overflow-hidden z-[101]"
          >
            {/* Assistant Header */}
            <div className="px-8 py-6 border-b border-slate-50 bg-white flex items-center justify-between shrink-0">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Bot className="w-5 h-5" />
                 </div>
                 <div>
                   <h3 className="text-sm font-bold text-slate-800">PineCore AI Chatbot</h3>
                   <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Dataplex & ADC Synced</span>
                   </div>
                 </div>
               </div>
               <button 
                 onClick={onToggle}
                 className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 cursor-pointer"
               >
                 <Zap className="w-5 h-5" />
               </button>
            </div>

            {/* Assistant Content */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-8 space-y-6 bg-slate-50/10"
            >
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`p-4 rounded-2xl max-w-[92%] text-sm space-y-3 ${
                    msg.role === "user" 
                      ? "bg-slate-950 text-white rounded-tr-none" 
                      : "bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm"
                  }`}>
                    {/* Multi-Step UI Stepper inside Bot Responses */}
                    {msg.role === "bot" && msg.stepper && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5 font-mono text-[11px] mb-2">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-blue-500" /> Multi-Step Workflow Progress
                        </div>
                        <div className="space-y-2">
                          {msg.stepper.map((step) => (
                            <div key={step.id} className="flex items-start gap-2">
                              {step.status === "completed" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              ) : step.status === "in_progress" ? (
                                <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0 mt-0.5" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <span className={cn(
                                  "font-bold block text-[11px]",
                                  step.status === "completed" ? "text-slate-800" :
                                  step.status === "in_progress" ? "text-blue-600" : "text-slate-400"
                                )}>
                                  Step {step.id}: {step.title}
                                </span>
                                <span className="text-[10px] text-slate-500 font-light block">{step.detail}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.content}

                    {msg.role === "bot" && msg.suggestions && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-100">
                        {msg.suggestions.map(s => (
                          <button 
                            key={s}
                            onClick={() => handleSend(s)}
                            className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all cursor-pointer"
                          >
                           {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Active Real-Time Progress Stepper Overlay during execution */}
              {isTyping && activeSteps && (
                <div className="flex justify-start">
                  <div className="p-4 bg-white border border-blue-200 rounded-2xl shadow-md w-full max-w-[92%] space-y-3">
                    <div className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      Executing Governance Workflow...
                    </div>
                    <div className="space-y-2.5 font-mono text-[11px]">
                      {activeSteps.map((step) => (
                        <div key={step.id} className="flex items-start gap-2.5">
                          {step.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          ) : step.status === "in_progress" ? (
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className={cn(
                              "font-bold block text-[11px]",
                              step.status === "completed" ? "text-slate-800" :
                              step.status === "in_progress" ? "text-blue-600 font-bold" : "text-slate-400"
                            )}>
                              Step {step.id}: {step.title}
                            </span>
                            <span className="text-[10px] text-slate-500 font-light block">{step.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Assistant Input */}
            <div className="p-6 border-t border-slate-50 bg-white">
               <div className="relative flex items-center gap-3">
                  <input 
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()}
                    placeholder="Ask PineCore AI (Dataplex / BigQuery)..."
                    className="flex-1 bg-slate-50 border-none rounded-xl px-5 py-4 text-xs font-medium outline-none focus:ring-2 ring-blue-500/10 transition-all"
                  />
                  <button 
                    onClick={() => handleSend()}
                    className="p-4 bg-slate-950 text-white rounded-xl shadow-lg hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
