import { useState, useEffect } from "react";
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
  CloudCheck,
  ExternalLink
} from "lucide-react";
import { Section } from "../App";
import { cn } from "../lib/utils";
import { Country, LanguageSetting } from "./sections/CampaignEngine";
import { isUsingFirebaseMock } from "../services/firebase";
import { getRoutingMode, setRoutingMode, onRoutingModeChange, onSimulatorStateChange, broadcastSimulatorState, RoutingMode } from "../services/simulatorBridge";

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
  "Campaign Engine": {
    Japan: "キャンペーン・エンジン",
    Korea: "캠페인 엔진",
    China: "营销活动引擎"
  },
  "Telemetry Catalog": {
    Japan: "テレメトリ・カタログ",
    Korea: "텔레메트리 カタログ",
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
  // Routing mode state (LIVE vs MOCKED)
  const [routingMode, setRoutingModeState] = useState<RoutingMode>(getRoutingMode());

  // Live Game Telemetry Simulator Control State & Handlers
  const [simulator, setSimulator] = useState<{
    isRunning: boolean;
    currentCCU: number;
    activeAnomaly: string | null;
    totalEventsPublished: number;
  }>({
    isRunning: false,
    currentCCU: 14280,
    activeAnomaly: null,
    totalEventsPublished: 0,
  });

  useEffect(() => {
    const unsubMode = onRoutingModeChange((newMode) => {
      setRoutingModeState(newMode);
    });

    const unsubState = onSimulatorStateChange((state) => {
      setSimulator((prev) => {
        if (
          prev.isRunning === state.isRunning &&
          prev.currentCCU === state.targetCCU &&
          prev.activeAnomaly === state.activeAnomaly
        ) {
          return prev;
        }
        return {
          ...prev,
          isRunning: state.isRunning,
          currentCCU: state.targetCCU,
          activeAnomaly: state.activeAnomaly,
        };
      });
    });

    return () => {
      unsubMode();
      unsubState();
    };
  }, []);

  const fetchSimulatorStatus = async () => {
    if (getRoutingMode() !== "LIVE") return;
    try {
      const res = await fetch("/api/simulator/status");
      if (res.ok) {
        const data = await res.json();
        setSimulator((prev) => {
          const isRunning = !!data.is_running;
          const currentCCU = data.current_ccu || 14280;
          const activeAnomaly = data.active_anomaly || null;
          const totalEventsPublished = data.total_events_published || 0;

          if (
            prev.isRunning === isRunning &&
            prev.currentCCU === currentCCU &&
            prev.activeAnomaly === activeAnomaly &&
            prev.totalEventsPublished === totalEventsPublished
          ) {
            return prev;
          }

          // Broadcast status change to simulator tab to keep UI controls in sync
          broadcastSimulatorState({
            isRunning,
            frequencyHz: data.event_rate_hz || 2,
            targetCCU: currentCCU,
            activeAnomaly,
          });

          return {
            isRunning,
            currentCCU,
            activeAnomaly,
            totalEventsPublished,
          };
        });
      }
    } catch (err) {
      console.warn("Simulator status fetch error:", err);
    }
  };

  useEffect(() => {
    fetchSimulatorStatus();
    const interval = setInterval(fetchSimulatorStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSimulator = async () => {
    const nextIsRunning = !simulator.isRunning;

    // Update local state immediately
    setSimulator((prev) => ({ ...prev, isRunning: nextIsRunning }));

    // Broadcast to other tabs
    broadcastSimulatorState({
      isRunning: nextIsRunning,
      frequencyHz: 2,
      targetCCU: simulator.currentCCU,
      activeAnomaly: simulator.activeAnomaly,
    });

    if (getRoutingMode() === "LIVE") {
      const endpoint = nextIsRunning ? "/api/simulator/start" : "/api/simulator/stop";
      try {
        const res = await fetch(endpoint, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setSimulator((prev) => ({
            ...prev,
            isRunning: !!data.is_running,
            currentCCU: data.current_ccu || prev.currentCCU,
            activeAnomaly: data.active_anomaly !== undefined ? data.active_anomaly : prev.activeAnomaly,
          }));
        }
      } catch (err) {
        console.warn("Simulator toggle error:", err);
      }
    }
  };

  const handleInjectAnomaly = async (type: string) => {
    const nextAnomaly = type === "none" ? null : type;

    // Update local state immediately
    setSimulator((prev) => ({ ...prev, activeAnomaly: nextAnomaly }));

    // Broadcast to other tabs
    broadcastSimulatorState({
      isRunning: simulator.isRunning,
      frequencyHz: 2,
      targetCCU: simulator.currentCCU,
      activeAnomaly: nextAnomaly,
    });

    if (getRoutingMode() === "LIVE") {
      try {
        const res = await fetch("/api/simulator/inject-anomaly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anomaly_type: nextAnomaly }),
        });
        if (res.ok) {
          const data = await res.json();
          setSimulator((prev) => ({
            ...prev,
            activeAnomaly: data.active_anomaly || null,
          }));
        }
      } catch (err) {
        console.warn("Simulator anomaly injection error:", err);
      }
    }
  };

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

        {/* Live Game Telemetry Simulator Control Bar */}
        <div className="flex items-center gap-3 px-3.5 py-1.5 bg-slate-800/80 rounded-full border border-slate-700/60 shadow-inner font-mono text-xs shrink-0">
          {/* User-Controlled LIVE vs MOCKED Routing Mode Toggle */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-full border border-slate-700">
            <button
              type="button"
              onClick={() => setRoutingMode("LIVE")}
              className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase transition-all cursor-pointer",
                routingMode === "LIVE"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              LIVE (GCP)
            </button>
            <button
              type="button"
              onClick={() => setRoutingMode("MOCKED")}
              className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase transition-all cursor-pointer",
                routingMode === "MOCKED"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              MOCKED
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleSimulator}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer border",
              simulator.isRunning
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                : "bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", simulator.isRunning ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
            <span>Simulator: {simulator.isRunning ? "ON" : "OFF"}</span>
          </button>

          <div className="flex items-center gap-1 text-slate-200 font-semibold text-[11px]">
            <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>{simulator.currentCCU.toLocaleString()} CCU</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-700/80 pl-2.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase hidden sm:inline">Anomaly:</span>
            <select
              id="header-anomaly-selector"
              value={simulator.activeAnomaly || "none"}
              onChange={(e) => handleInjectAnomaly(e.target.value)}
              className="bg-slate-950 border border-slate-700/60 text-[10px] font-semibold text-amber-300 px-2 py-0.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="none">Normal (No Anomaly)</option>
              <option value="level_2_bottleneck">⚡ Level 2 Bottleneck</option>
              <option value="high_churn_boss_deaths">💀 High-Churn Boss Death</option>
              <option value="toxic_chat">☣️ Toxic Chat Outbreak</option>
            </select>
          </div>

          {/* Leaving Page Box: External Link to Standalone Simulator */}
          <button
            type="button"
            onClick={() => window.open("/simulator", "_blank")}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-950 border border-slate-700 hover:border-slate-500 text-blue-400 hover:text-blue-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-sm ml-1"
            title="Open Standalone Game Simulator Interface in new window"
          >
            <span>Simulator UI</span>
            <ExternalLink className="w-3 h-3" />
          </button>
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
