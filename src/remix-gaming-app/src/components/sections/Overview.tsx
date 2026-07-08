import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Country, LanguageSetting } from "./CampaignEngine";
import { DataModeBadge } from "../DataModeBadge";
import { 
  Database, 
  Cloud, 
  Share2, 
  ArrowRight, 
  Server, 
  FileText, 
  Zap, 
  BarChart3, 
  Bot, 
  CheckCircle2, 
  BrainCircuit,
  LayoutDashboard,
  ShieldCheck,
  Stethoscope,
  Activity,
  History,
  TrendingUp,
  Radio,
  X,
  Megaphone
} from "lucide-react";

interface Connector {
  label: string;
  industryTitle: string;
  definition: string;
  includes: string[];
  metrics: string[];
  color: string;
  icon: any;
  search: string;
}

const CONNECTORS: Connector[] = [
  { 
    label: "AWS S3", 
    industryTitle: "Player Telemetry Archive", 
    definition: "An immutable cold-storage layer for raw player session trails, legacy title records, and game server logs.",
    includes: ["Legacy Daily Telemetry Logs", "Old Game Build Binaries (2018-2025)", "Archived Server Tick Logs", "Historic Match Session Traces"],
    metrics: ["1.2 PB Managed Gameplay Data", "99.999% Read Availability", "Sub-second SQL Federation"],
    color: "bg-orange-500", 
    icon: History,
    search: "AWS S3" 
  },
  { 
    label: "Snowflake", 
    industryTitle: "Monetization & LTV Analytics", 
    definition: "Aggregated player lifetime value models, cohort purchase history, and ad-yield monetization forecasting.",
    includes: ["Lifetime Value (LTV) Forecasts", "Monthly Active User (MAU) Trends", "In-App Store Conversion Mixes", "In-Game Ad Revenue Yields"],
    metrics: ["Real-time ARPU Updates", "Cohort Spending Variance", "Ad Placement Performance"],
    color: "bg-blue-500", 
    icon: TrendingUp,
    search: "Snowflake" 
  },
  { 
    label: "AlloyDB", 
    industryTitle: "Live Gameplay Telemetry", 
    definition: "High-performance transactional engine for real-time play sessions, instant purchases, and matchmaking loads.",
    includes: ["Active Match Lobby Concurrency", "Live Session Ping Monitoring", "Real-Time Microtransaction Logs", "Active Virtual Server Allocation"],
    metrics: ["<10ms Transaction Latency", "99.99% Database Nodes Uptime", "GDPR-Compliant Player Privacy Masking"],
    color: "bg-emerald-500", 
    icon: Radio,
    search: "AlloyDB" 
  },
];

const OVERVIEW_TRANSLATIONS: Record<string, Record<Country, string>> = {
  "Intelligent Player Analytics for": {
    Japan: "ゲーム開発者のためのインテリジェント分析プラットフォーム -",
    Korea: "지능형 플레이어 분석 -",
    China: "智能玩家数据分析 -"
  },
  "Jingle Games.": {
    Japan: "Jingle Games",
    Korea: "Jingle Games",
    China: "Jingle Games"
  },
  "Unifying AWS S3 cold logs, Snowflake player economic data, and AlloyDB live session concurrency into a singular cognitive interface for game developers and analytics directors.": {
    Japan: "AWS S3コールドログ、Snowflakeプレイヤーエコノミクスデータ、AlloyDBライブセッション同時実行数を統合し、ゲーム開発者や分析担当役員向けの単一のインテリジェント・インターフェースを提供します。",
    Korea: "AWS S3 콜드 로그, Snowflake 금융 모델 데이터, AlloyDB 실시간 동시성 데이터풀을 통합시켜 게임 크리에이터 및 디렉터를 위한 인지형 인터페이스로 가공합니다.",
    China: "将 AWS S3 归档日志、Snowflake 玩家付费分析数据和 AlloyDB 实时对局并发数据有机融合，为游戏制作人和分析主管提供统一的认知分析舱。"
  },
  "Player Telemetry Archive": {
    Japan: "プレイヤーテレメトリ・アーカイブ",
    Korea: "플레이어 텔레메트리 보관소",
    China: "玩家遥测历史归档"
  },
  "Monetization & LTV Analytics": {
    Japan: "マネタイズ＆LTVアナリティクス",
    Korea: "수익화 및 LTV 정밀 모델",
    China: "商业化变现与 LTV 分析"
  },
  "Live Gameplay Telemetry": {
    Japan: "ライブゲームプレイ・テレメトリ",
    Korea: "실시간 라이브 플레이 정보",
    China: "对局实时遥测数据"
  },
  "Data fetched from": {
    Japan: "からのインポートデータ：",
    Korea: "에서 가져온 데이터: ",
    China: "数据导入于："
  },
  "governance layer.": {
    Japan: "ガバナンスレイヤー。",
    Korea: "거버넌스 레이어 구성됨.",
    China: "治理服务层。"
  }
};

export function Overview({ 
  onSectionChange,
  country = "Japan",
  languageSetting = "en"
}: { 
  onSectionChange: (section: any) => void;
  country?: Country;
  languageSetting?: LanguageSetting;
}) {
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);

  const t = (text: string): string => {
    if (languageSetting === "en" || !text) return text;
    if (OVERVIEW_TRANSLATIONS[text] && OVERVIEW_TRANSLATIONS[text][country]) {
      return OVERVIEW_TRANSLATIONS[text][country];
    }
    return text;
  };

  return (
    <div className="p-12 max-w-6xl mx-auto text-slate-900">
      <div className="mb-16">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 mb-6"
        >
          <div className="px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-bold tracking-[0.1em] uppercase">
            Jingle Games Customer 360
          </div>
          <div className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold tracking-[0.1em] uppercase">
            Powered by Gemini Enterprise
          </div>
        </motion.div>
        
        <h2 className="text-5xl font-bold tracking-tight mb-6 text-slate-800 leading-tight">
          {t("Intelligent Player Analytics for")} <br />
          <span className="text-blue-600">{t("Jingle Games.")}</span>
        </h2>
        <p className="text-xl text-slate-500 max-w-3xl leading-relaxed font-light mb-10">
          {t("Unifying AWS S3 cold logs, Snowflake player economic data, and AlloyDB live session concurrency into a singular cognitive interface for game developers and analytics directors.")}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {CONNECTORS.map((conn) => (
            <motion.div 
              key={conn.label} 
              layoutId={conn.label}
              onClick={() => setSelectedConnector(conn)}
              className="relative overflow-hidden group p-8 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className={`${conn.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform`}>
                <conn.icon className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{conn.label}</span>
                  <DataModeBadge mode={conn.label.includes("AlloyDB") ? "hybrid" : "mock"} />
                </div>
                <h4 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{t(conn.industryTitle)}</h4>
                <p className="text-xs text-slate-400 font-light line-clamp-2">
                  {t("Data fetched from")} {conn.label} {t("governance layer.")}
                </p>
              </div>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-4 h-4 text-blue-400" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedConnector && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSelectedConnector(null)}
          >
            <motion.div 
              layoutId={selectedConnector.label}
              className="w-full max-w-2xl bg-white rounded-[3rem] overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className={`p-10 ${selectedConnector.color} text-white relative`}>
                <button 
                  onClick={() => setSelectedConnector(null)}
                  className="absolute top-8 right-8 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-2xl bg-white/20">
                    <selectedConnector.icon className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{selectedConnector.label} Integration</span>
                      <DataModeBadge mode={selectedConnector.label.includes("AlloyDB") ? "hybrid" : "mock"} />
                    </div>
                    <h3 className="text-3xl font-bold">{selectedConnector.industryTitle}</h3>
                  </div>
                </div>
                <p className="text-white/80 font-light leading-relaxed max-w-lg mb-4 text-sm uppercase tracking-wider">
                  Industry Definition
                </p>
                <p className="text-xl font-light leading-relaxed italic">
                  "{selectedConnector.definition}"
                </p>
              </div>

              <div className="p-10 grid grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div>
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">What it Includes</h5>
                    <ul className="space-y-3">
                      {selectedConnector.includes.map(item => (
                        <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="space-y-6">
                   <div>
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Core Metrics</h5>
                    <div className="space-y-4">
                      {selectedConnector.metrics.map(metric => (
                        <div key={metric} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                           <p className="text-xs font-bold text-slate-800">{metric}</p>
                           <p className="text-[9px] text-slate-400 uppercase tracking-tighter mt-1">Managed via Jingle Core DNS</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Secure Federated Session • 256-bit AES</p>
                <button 
                  onClick={() => onSectionChange({ id: "catalog", search: selectedConnector.search })}
                  className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-blue-600 transition-all flex items-center gap-2"
                >
                  Search Archives <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
        {[
          {
            title: "Game Performance",
            desc: "Real-time installations, daily active cohorts, store purchases, and crash metrics from AlloyDB telemetry.",
            icon: LayoutDashboard,
            link: "View Performance Dashboard",
            id: "operations",
            color: "text-blue-600",
            bg: "bg-blue-50"
          },
          {
            title: "Campaign Engine",
            desc: "Roll out highly personalized push notifications, manage ad budgets dynamically, and sync targeted Google Ads audiences.",
            icon: Megaphone,
            link: "Launch Campaign Engine",
            id: "campaigns",
            color: "text-rose-600",
            bg: "bg-rose-50"
          },
          {
            title: "Data Observatory",
            desc: "Unified query latency, cross-cloud database federation ratios, and live transaction cost mapping.",
            icon: Activity,
            link: "Monitor Game Pipelines",
            id: "observatory",
            color: "text-indigo-600",
            bg: "bg-indigo-50"
          },
          {
            title: "Active Play Agents",
            desc: "Autonomous player segment promotion campaigns, anomaly economy checkers, and match tuning.",
            icon: Zap,
            link: "Review Agent Traces",
            id: "workflows",
            color: "text-amber-600",
            bg: "bg-amber-50"
          }
        ].map((feat, i) => (
          <motion.div
            key={feat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSectionChange(feat.id)}
            className="p-8 card-sleek bg-white hover:border-blue-200 border border-slate-100 rounded-[2rem] shadow-sm transition-all cursor-pointer group flex flex-col h-full"
          >
            <div className={`p-4 rounded-2xl ${feat.bg} w-fit mb-6`}>
              <feat.icon className={`w-6 h-6 ${feat.color}`} />
            </div>
            <h3 className="text-lg font-bold mb-3 text-slate-800">{feat.title}</h3>
            <p className="text-xs text-slate-500 mb-8 leading-relaxed font-light flex-1">{feat.desc}</p>
            <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest group-hover:gap-4 transition-all mt-auto">
              {feat.link} <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-12 rounded-[3.5rem] bg-slate-900 overflow-hidden relative text-white">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/20 to-transparent pointer-events-none" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-8">
                 <BrainCircuit className="w-8 h-8 text-blue-400" />
                 <span className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-60">Architecture Spotlight</span>
              </div>
              <h3 className="text-3xl font-bold mb-6">Unified Cross-Cloud Lakehouse</h3>
              <p className="text-slate-400 leading-relaxed font-light mb-10">
                Instead of moving data, we bring the compute to the data. Our federation layer allows sub-second analysis of gaming datasets across AWS S3 and Snowflake while maintaining zero-delay syncs with live database clusters.
              </p>
              <div className="grid grid-cols-2 gap-6">
                 <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                    <span className="text-3xl font-bold text-white block mb-1">98ms</span>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Avg Query Latency</span>
                 </div>
                 <div 
                   onClick={() => onSectionChange({ id: "catalog", search: "GDPR" })}
                   className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-400/50 cursor-pointer transition-all group"
                 >
                    <span className="text-3xl font-bold text-white block mb-1 group-hover:text-blue-400 transition-colors">100%</span>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">GDPR Player Privacy Compliance</span>
                 </div>
              </div>
           </div>
           
           <div className="h-full flex items-center justify-center">
              <div className="relative">
                 <div className="w-64 h-64 rounded-full border border-blue-500/30 animate-spin-slow" style={{ animationDuration: '20s' }} />
                 <div className="absolute inset-0 w-64 h-64 rounded-full border border-indigo-400/20 animate-spin-reverse" style={{ animationDuration: '15s' }} />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-3xl bg-blue-600 shadow-2xl shadow-blue-500/40 flex items-center justify-center transform rotate-12 transition-transform hover:rotate-0">
                       <Bot className="w-12 h-12 text-white" />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}


