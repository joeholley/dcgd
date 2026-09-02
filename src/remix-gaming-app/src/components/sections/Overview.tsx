import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Country, LanguageSetting } from "./CampaignEngine";
import { DataModeBadge } from "../DataModeBadge";
import { usePublisher } from "../../context/PublisherContext";
import { 
  Database, 
  Cloud, 
  Share2, 
  ArrowRight, 
  Server, 
  FileText, 
  Zap, 
  BarChart3, 
  CheckCircle2, 
  LayoutDashboard,
  ShieldCheck,
  Stethoscope,
  Activity,
  History,
  TrendingUp,
  Radio,
  X,
  Megaphone,
  DollarSign,
  Building2,
  Globe2,
  CreditCard
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
    label: "Cloud Spanner", 
    industryTitle: "Global Player State & Graph", 
    definition: "Globally distributed transactional database for real-time play sessions, virtual currency wallets, inventory entitlements, and player social graphs.",
    includes: ["Global Session Concurrency (TrueTime)", "Real-Time Virtual Currency Wallets", "Spanner Graph Player Social Topology", "Spanner Change Streams CDC Ingestion"],
    metrics: ["<10ms Global Write Latency", "99.999% Zero-Downtime SLA", "Automated PII Privacy Masking"],
    color: "bg-emerald-500", 
    icon: Radio,
    search: "Spanner" 
  },
];

const OVERVIEW_TRANSLATIONS: Record<string, Record<Country, string>> = {
  "Intelligent Player Analytics for": {
    Japan: "ゲーム開発者のためのインテリジェント分析プラットフォーム -",
    Korea: "지능형 플레이어 분석 -",
    China: "智能玩家数据分析 -"
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
  const { publisherName } = usePublisher();
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);

  const [financialData, setFinancialData] = useState<{
    grossRevenue: number;
    netPayout: number;
    storefrontFees: number;
    chargebacks: number;
    settlementsCount: number;
    isLive: boolean;
  }>({
    grossRevenue: 7157765,
    netPayout: 4983435,
    storefrontFees: 2147329,
    chargebacks: 27000,
    settlementsCount: 120,
    isLive: false,
  });

  const [regionalSummary, setRegionalSummary] = useState<{
    totalPlayers: number;
    dau: number;
    regions: Array<{ region: string; revenue: number; players: number }>;
    isLive: boolean;
  }>({
    totalPlayers: 133949,
    dau: 1250000,
    regions: [
      { region: "NA", revenue: 2837033, players: 49095 },
      { region: "EMEA", revenue: 2500361, players: 41864 },
      { region: "APAC", revenue: 1820371, players: 29022 },
      { region: "LATAM", revenue: 642000, players: 13968 },
    ],
    isLive: false,
  });

  useEffect(() => {
    // Fetch live financial performance strictly up to current date (e.g. 90-day active window)
    fetch("/api/analytics/financial?limit=90")
      .then((res) => res.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const totals = res.data.reduce(
            (acc: any, row: any) => ({
              grossRevenue: acc.grossRevenue + (Number(row.gross_revenue_usd) || 0),
              netPayout: acc.netPayout + (Number(row.cleared_payout_usd || row.net_revenue_usd) || 0),
              storefrontFees: acc.storefrontFees + (Number(row.storefront_fees_usd) || 0),
              chargebacks: acc.chargebacks + (Number(row.chargeback_volume_usd) || 0),
              settlementsCount: acc.settlementsCount + (Number(row.total_transactions) || 1),
            }),
            { grossRevenue: 0, netPayout: 0, storefrontFees: 0, chargebacks: 0, settlementsCount: 0 }
          );
          setFinancialData({ ...totals, isLive: true });
        }
      })
      .catch(() => {});

    // Fetch active accounts from the last 90 days from games raw event data (deduplicated across games)
    fetch("/api/analytics/active-players-90d")
      .then((res) => res.json())
      .then((res) => {
        if (res.success && typeof res.total_active_players === "number") {
          setRegionalSummary((prev) => ({
            ...prev,
            totalPlayers: res.total_active_players,
            isLive: true,
            regions: Array.isArray(res.regional_active) && res.regional_active.length > 0
              ? res.regional_active.map((r: any) => ({
                  region: r.region,
                  revenue: prev.regions.find((p) => p.region === r.region)?.revenue || 0,
                  players: r.active_players,
                }))
              : prev.regions,
          }));
        }
      })
      .catch(() => {});

    // Fetch live regional KPIs from gold_regional_kpis
    fetch("/api/analytics/regional?limit=10")
      .then((res) => res.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setRegionalSummary((prev) => ({
            ...prev,
            dau: res.data.reduce((acc: number, r: any) => acc + (Number(r.dau) || 0), 0) || prev.dau,
            regions: prev.regions.map((pr) => {
              const matched = res.data.find((r: any) => r.region === pr.region);
              return {
                ...pr,
                revenue: matched ? Number(matched.total_revenue_dollars) || pr.revenue : pr.revenue,
              };
            }),
          }));
        }
      })
      .catch(() => {});
  }, []);

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
            {publisherName} Customer 360
          </div>
          <div className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold tracking-[0.1em] uppercase">
            Powered by Gemini Enterprise
          </div>
        </motion.div>
        
        <h2 className="text-5xl font-bold tracking-tight mb-6 text-slate-800 leading-tight">
          {t("Intelligent Player Analytics for")} <br />
          <span className="text-blue-600">{publisherName}.</span>
        </h2>
        <p className="text-xl text-slate-500 max-w-3xl leading-relaxed font-light mb-8">
          {t("Unifying AWS S3 cold logs, Snowflake player economic data, and AlloyDB live session concurrency into a singular cognitive interface for game developers and analytics directors.")}
        </p>

        {/* Live Executive Studio Financials & Lakehouse Metrics */}
        <div className="mb-12 p-8 rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-wide">Multi-Store Studio Financial Performance</h3>
                <p className="text-xs text-slate-400">Reconciled against payment gateway settlements in BigQuery Gold layer</p>
              </div>
            </div>
            <DataModeBadge 
              mode={financialData.isLive ? "live" : "mock"} 
              source={financialData.isLive ? "gold_studio_financial_performance" : "In-Memory Simulation"} 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider">Gross In-App Spend</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">
                ${financialData.grossRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-emerald-400 mt-1">From Apple, Google, & Web Stores</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider">Net Realized Cash</span>
                <CreditCard className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-bold text-cyan-300 tracking-tight">
                ${financialData.netPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-cyan-400 mt-1">Disbursed via Clearing Payouts</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider">Storefront Fees (30%)</span>
                <Building2 className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-amber-300 tracking-tight">
                -${financialData.storefrontFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-amber-400 mt-1">Platform Commission Deductions</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider">Active Accounts (90D)</span>
                <Globe2 className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-indigo-300 tracking-tight">
                {regionalSummary.totalPlayers.toLocaleString()}
              </p>
              <p className="text-[10px] text-indigo-300 mt-1">Deduplicated 90-Day Active Logins</p>
            </div>
          </div>
        </div>

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
                  <DataModeBadge mode="mock" />
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
                           <p className="text-[9px] text-slate-400 uppercase tracking-tighter mt-1">Managed via {publisherName} Core DNS</p>
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
            title: "API Observatory",
            desc: "Unified query latency, cross-cloud database federation ratios, and live transaction cost mapping.",
            icon: Activity,
            link: "Monitor API Pipelines",
            id: "observatory",
            color: "text-indigo-600",
            bg: "bg-indigo-50"
          },
          {
            title: "Operations Agents",
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
    </div>
  );
}


