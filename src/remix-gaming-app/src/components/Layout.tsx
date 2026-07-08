import { motion } from "motion/react";
import { 
  Network, 
  LayoutDashboard, 
  Search, 
  Zap, 
  Layers,
  Activity,
  User,
  Bot,
  Megaphone,
  ShieldCheck,
  CloudCheck
} from "lucide-react";
import { Section } from "../App";
import { cn } from "../lib/utils";
import { Country, LanguageSetting } from "./sections/CampaignEngine";
import { isUsingFirebaseMock } from "../services/firebase";


const LAYOUT_TRANSLATIONS: Record<string, Record<Country, string>> = {
  "Gaming Overview": {
    Japan: "ゲーム全体概要",
    Korea: "게임 개요",
    China: "游戏整体概览"
  },
  "Game Performance": {
    Japan: "ゲームパフォーマンス",
    Korea: "게임 성과 분석",
    China: "游戏运行表现"
  },
  "Gameplay Agents": {
    Japan: "自動ゲームエージェント",
    Korea: "게임 플레이 에이전트",
    China: "自动化游戏代理"
  },
  "LiveOps Guardrail": {
    Japan: "リアルタイム・ガードレール",
    Korea: "라이브옵스 가드레일",
    China: "实时 LiveOps 护栏"
  },
  "Campaign Engine": {
    Japan: "キャンペーン・エンジン",
    Korea: "캠페인 엔진",
    China: "营销活动引擎"
  },
  "Telemetry Catalog": {
    Japan: "テレメトリ・カタログ",
    Korea: "텔레메트리 카탈로그",
    China: "遥测指标目录"
  },
  "API Observatory": {
    Japan: "APIモニタリング",
    Korea: "API 모니터링",
    China: "API 观测台"
  },
  "Navigation": {
    Japan: "ナビゲーション",
    Korea: "네비게이션",
    China: "导航菜单"
  },
  "Unit Econ": {
    Japan: "ユニットエコノミクス",
    Korea: "유닛 경제",
    China: "单元经济学"
  },
  "Jingle Games Admin Console": {
    Japan: "Jingle Games 管理コンソール",
    Korea: "Jingle Games 관리 콘솔",
    China: "Jingle Games 管理控制台"
  },
  "Player 360 Platform": {
    Japan: "プレイヤー360プラットフォーム",
    Korea: "플레이어 360 플랫폼",
    China: "玩家360一体化平台"
  }
};

interface LayoutProps {
  children: React.ReactNode;
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  country: Country;
  setCountry: (country: Country) => void;
  languageSetting: LanguageSetting;
  setLanguageSetting: (setting: LanguageSetting) => void;
}

export function Layout({ 
  children, 
  activeSection, 
  onSectionChange,
  country,
  setCountry,
  languageSetting,
  setLanguageSetting
}: LayoutProps) {
  const t = (text: string): string => {
    if (languageSetting === "en" || !text) return text;
    if (LAYOUT_TRANSLATIONS[text] && LAYOUT_TRANSLATIONS[text][country]) {
      return LAYOUT_TRANSLATIONS[text][country];
    }
    return text;
  };

  const navCategories = [
    {
      title: "Executive & Analytics",
      items: [
        { id: "overview" as Section, label: "Gaming Overview", icon: Network },
        { id: "operations" as Section, label: "Game Performance", icon: LayoutDashboard },
        { id: "executive-portfolio" as Section, label: "Executive Portfolio (Flask)", icon: Layers },
        { id: "catalog" as Section, label: "Telemetry Catalog", icon: Search },
      ],
    },
    {
      title: "LiveOps & Automation",
      items: [
        { id: "guardrail" as Section, label: "LiveOps Guardrail", icon: ShieldCheck },
        { id: "campaigns" as Section, label: "Campaign Engine", icon: Megaphone },
        { id: "difficulty-balancer" as Section, label: "Difficulty Balancer (Flask)", icon: Zap },
        { id: "marketing-swarm" as Section, label: "Marketing Swarm (Flask)", icon: Bot },
      ],
    },
    {
      title: "Agent & AI Workspace",
      items: [
        { id: "workflows" as Section, label: "Gameplay Agents", icon: Zap },
        { id: "agent-comparison" as Section, label: "Agent Comparison (Flask)", icon: Bot },
        { id: "lineage-graph" as Section, label: "Data Lineage Graph (Flask)", icon: Network },
      ],
    },
    {
      title: "Observability & Diagnostics",
      items: [
        { id: "observatory" as Section, label: "API Observatory", icon: Activity },
        { id: "toxicity" as Section, label: "Trust & Safety (Flask)", icon: ShieldCheck },
        { id: "gcp-health" as Section, label: "GCP System Health", icon: CloudCheck },
        { id: "diagnostics" as Section, label: "System Diagnostics", icon: Activity },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <nav className="h-16 bg-slate-900 flex items-center justify-between px-8 border-b border-white/10 shrink-0 text-white gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white font-mono">J</div>
          <h1 className="text-sm sm:text-lg font-semibold tracking-tight">
            Jingle Games <span className="font-light opacity-80 hidden md:inline">{t("Player 360 Platform")}</span>
          </h1>
        </div>

        {/* Global Regional Localization Controllers - VERY Prominent & Accessible on all tabs */}
        <div className="flex items-center gap-3 sm:gap-5 px-3 sm:px-4 bg-slate-800/60 rounded-full py-1.5 border border-white/5 shadow-inner">
          {/* Target Country Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">Region:</span>
            <select
              id="header-country-selector"
              value={country}
              onChange={e => setCountry(e.target.value as Country)}
              className="bg-slate-950 border border-slate-700/60 text-xs font-semibold text-slate-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Japan">🇯🇵 Japan</option>
              <option value="Korea">🇰🇷 Korea</option>
              <option value="China">🇨🇳 China</option>
            </select>
          </div>

          {/* Localization Toggle Selector */}
          <div className="flex items-center gap-1.5 sm:gap-2 border-l border-white/10 pl-3 sm:pl-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">Language:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLanguageSetting("en")}
                className={cn(
                  "px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded text-[10px] font-bold tracking-wider cursor-pointer border transition-all duration-200",
                  languageSetting === "en" 
                    ? "bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/20" 
                    : "bg-slate-950 border-slate-750 text-slate-400 hover:text-slate-200"
                )}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguageSetting("local")}
                className={cn(
                  "px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded text-[10px] font-bold tracking-wider cursor-pointer border transition-all duration-200 uppercase",
                  languageSetting === "local" 
                    ? "bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/20" 
                    : "bg-slate-950 border-slate-750 text-slate-400 hover:text-slate-200"
                )}
              >
                {country === "Japan" ? "JA" : country === "Korea" ? "KO" : "ZH"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-white/90 text-sm font-medium shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs opacity-70 hidden lg:inline">{t("Jingle Games Admin Console")}</span>
            <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>
      </nav>

      {isUsingFirebaseMock && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs px-8 py-2 flex items-center justify-between font-mono shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span>
              <strong>Firebase Notice:</strong> Running with a local in-memory backend mock in place of Firebase. (To connect to a live Firebase instance, supply <code>firebase-applet-config.json</code>).
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 space-y-6">
            {navCategories.map((cat) => (
              <div key={cat.title}>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 px-3">{t(cat.title)}</p>
                <nav className="space-y-0.5">
                  {cat.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSectionChange(item.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-1.5 rounded transition-all duration-200 group text-xs font-medium text-left",
                          isActive 
                            ? "bg-slate-800 text-white border border-slate-700 shadow-sm font-semibold" 
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                        )}
                      >
                        <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")} />
                        <span className="truncate">{t(item.label)}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          <div className="mt-auto p-4 space-y-4">
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 font-mono">
              <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">{t("Unit Econ")}</p>
              <div className="flex justify-between items-end">
                <span className="text-lg font-light text-white">$0.0004</span>
                <span className="text-[9px] text-slate-500 uppercase">avg/q</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-[#F8FAFC]">
          <motion.div
             initial={{ opacity: 0, scale: 0.98 }}
             animate={{ opacity: 1, scale: 1 }}
             key={activeSection}
             className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
