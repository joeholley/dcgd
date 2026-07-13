import React, { useState, useEffect } from "react";
import { 
  Gamepad2, 
  Flame, 
  LogOut, 
  ShoppingBag, 
  Crown, 
  UserCheck, 
  Sparkles, 
  Skull, 
  ShieldAlert, 
  CheckCircle2,
  RotateCcw
} from "lucide-react";
import { cn } from "../../lib/utils";
import { 
  getSimulatorState, 
  updateSimulatorState, 
  onSimulatorStateUpdate, 
  sendSimulatorEvent, 
  onStreamLogUpdate, 
  resetCohortStats,
  updateCohortStats,
  PlayerCohortId, 
  RoutingMode 
} from "../../services/simulatorBridge";
import { SimulatorTelemetryLog } from "./SimulatorTelemetryLog";

interface CohortMeta {
  id: PlayerCohortId;
  title: string;
  userId: string;
  ltvDisplay: string;
  defaultSku: string;
  badgeColor: string;
}

const COHORT_PROFILES: Record<PlayerCohortId, CohortMeta> = {
  veteran_whale: {
    id: "veteran_whale",
    title: "High Value Whale Cohort",
    userId: "usr-whale-9982",
    ltvDisplay: "$85,000",
    defaultSku: "frost_giant_shield_pack",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  casual_grinder: {
    id: "casual_grinder",
    title: "Mid-Tier Casual Grinder",
    userId: "usr-casual-4412",
    ltvDisplay: "$1,200",
    defaultSku: "starter_battlepass_pack",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  },
  new_f2p_onboarding: {
    id: "new_f2p_onboarding",
    title: "New F2P Onboarding Player",
    userId: "usr-f2p-1092",
    ltvDisplay: "$0",
    defaultSku: "welcome_gems_crate",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
};

interface MockClientTabProps {
  routingMode: RoutingMode;
}

export function MockClientTab({ routingMode }: MockClientTabProps) {
  const [simState, setSimState] = useState(() => getSimulatorState());
  const activeCohort = COHORT_PROFILES[simState.selectedCohort] || COHORT_PROFILES.veteran_whale;

  // Cohort stats for active cohort
  const activeCohortStats = simState.cohortStats?.[activeCohort.id] || { playerDeaths: 0, quitAttempts: 0 };

  // Mock game client inner states
  const [bossHealth, setBossHealth] = useState<number>(65);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [activeOffer, setActiveOffer] = useState<{
    id: string;
    title: string;
    price: string;
    discount?: string;
  } | null>(null);

  useEffect(() => {
    const unsubState = onSimulatorStateUpdate((updatedState) => {
      setSimState({ ...updatedState });
    });
    return () => unsubState();
  }, []);

  // Listen to stream logs to discover INCOMING retention offers sent by agent
  useEffect(() => {
    const unsubLogs = onStreamLogUpdate((logs) => {
      const latestIncomingOffer = logs.slice().reverse().find((l) => l.direction === "INCOMING" && l.payload?.sku);
      if (latestIncomingOffer && latestIncomingOffer.payload) {
        const p = latestIncomingOffer.payload;
        setActiveOffer({
          id: p.sku || "frost_giant_shield_pack",
          title: p.title || "Frost Giant Shield & Resurrect Crate",
          price: p.price || "$0.99",
          discount: p.discount || "80% OFF",
        });
      }
    });
    return () => unsubLogs();
  }, []);

  const handleCohortSelect = (cohortId: PlayerCohortId) => {
    updateSimulatorState({ selectedCohort: cohortId });
  };

  const handleAction = async (actionType: "boss_fail" | "mission_quit" | "offer_accepted") => {
    setIsProcessingAction(true);

    let nextBossHealth = bossHealth;
    let nextPlayerDeaths = activeCohortStats.playerDeaths;
    let nextQuitAttempts = activeCohortStats.quitAttempts;

    if (actionType === "boss_fail") {
      nextPlayerDeaths = activeCohortStats.playerDeaths + 1;
      nextBossHealth = Math.max(10, bossHealth - 15);
      setBossHealth(nextBossHealth);
      updateCohortStats(activeCohort.id, { playerDeaths: nextPlayerDeaths });

      // Auto-trigger retention promo after 3 deaths if no offer exists
      if (nextPlayerDeaths >= 3 && !activeOffer) {
        setActiveOffer({
          id: activeCohort.defaultSku,
          title:
            activeCohort.id === "veteran_whale"
              ? "Frost Giant Shield & Resurrect Crate"
              : activeCohort.id === "casual_grinder"
              ? "Starter Battlepass Catch-Up Crate"
              : "Welcome Gems Starter Bundle",
          price: activeCohort.id === "veteran_whale" ? "$0.99" : "$1.99",
          discount: "80% OFF",
        });
      }
    } else if (actionType === "mission_quit") {
      nextQuitAttempts = activeCohortStats.quitAttempts + 1;
      updateCohortStats(activeCohort.id, { quitAttempts: nextQuitAttempts });
    } else if (actionType === "offer_accepted") {
      setActiveOffer(null);
    }

    await sendSimulatorEvent({
      type: actionType,
      gameId: "cosmic_raider_rpg",
      userId: activeCohort.userId,
      payload: {
        cohortId: activeCohort.id,
        userId: activeCohort.userId,
        bossHealth: nextBossHealth,
        playerDeaths: nextPlayerDeaths,
        quitAttempts: nextQuitAttempts,
        targetSku: activeCohort.defaultSku,
        activeAnomaly: simState.activeAnomaly,
      },
    });

    setIsProcessingAction(false);
  };

  return (
    <div className="space-y-6">
      {/* Mock Player Cohort Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between font-mono text-xs border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-white uppercase tracking-wider">Active Player Cohort Selection</h3>
          </div>
          <span className="text-[10px] text-slate-400">
            Selected Cohort: <strong className="text-amber-300">{activeCohort.title}</strong> ({activeCohort.userId})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.values(COHORT_PROFILES) as CohortMeta[]).map((cohort) => {
            const isSelected = simState.selectedCohort === cohort.id;
            const stats = simState.cohortStats?.[cohort.id] || { playerDeaths: 0, quitAttempts: 0 };
            return (
              <button
                key={cohort.id}
                type="button"
                onClick={() => handleCohortSelect(cohort.id)}
                className={cn(
                  "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2",
                  isSelected
                    ? "bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10 text-white"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold flex items-center gap-1.5">
                    {cohort.id === "veteran_whale" && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    {cohort.id === "casual_grinder" && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                    {cohort.id === "new_f2p_onboarding" && <UserCheck className="w-3.5 h-3.5 text-emerald-400" />}
                    {cohort.title}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                </div>

                <div className="flex justify-between items-center font-mono text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <div className="flex flex-col gap-0.5">
                    <span>LTV: <strong className="text-emerald-400">{cohort.ltvDisplay}</strong></span>
                    <span className="text-[10px] text-slate-400">
                      Deaths: <strong className="text-amber-400">{stats.playerDeaths}</strong> | Quits: <strong className="text-orange-400">{stats.quitAttempts}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetCohortStats(cohort.id);
                    }}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                    title={`Reset ${cohort.title} counters to 0`}
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>Reset</span>
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid: Game Client Viewport (Left) & Telemetry Log (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Mock Game Client Viewport (Smartphone Frame Aesthetic) */}
        <div className="lg:col-span-5 bg-slate-950 border-4 border-slate-800 rounded-[2.5rem] p-6 shadow-2xl flex flex-col justify-between space-y-5 relative">
          {/* Smartphone Top Notch & Label */}
          <div className="flex flex-col items-center border-b border-slate-800/80 pb-3">
            <div className="w-24 h-3 bg-slate-900 rounded-b-xl border-x border-b border-slate-700/50 flex items-center justify-center mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mr-2 border border-slate-700" />
              <div className="w-8 h-1 rounded-full bg-slate-800" />
            </div>
            <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest bg-slate-900 px-3 py-0.5 rounded-full border border-slate-800">
              Mock Game Client
            </div>
          </div>

          {/* Game Title & Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base tracking-wide font-sans">Realm of Eldoria RPG</h2>
                <p className="text-[11px] font-mono text-slate-400">Tutorial Level 8 of 10</p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-300">
              Player: <span className="text-amber-400">{activeCohort.userId}</span>
            </span>
          </div>

          {/* Boss Encounter Viewport */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800/80 p-5 space-y-5 relative overflow-hidden font-mono shadow-inner">
            {/* Boss Header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Skull className="w-5 h-5 text-red-500 animate-pulse" />
                <span className="font-bold text-red-400 text-sm tracking-wide">Frost Giant Overlord (Lvl 85)</span>
              </div>
              <span className="text-xs text-slate-400 font-bold">HP: {bossHealth}%</span>
            </div>

            {/* Boss Health Bar */}
            <div className="w-full bg-slate-900 rounded-full h-3.5 border border-slate-800 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${bossHealth}%` }}
              />
            </div>

            {/* Gameplay Stats Panel */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Wipeouts / Deaths:</span>
                <span className="text-base font-bold text-amber-400">{activeCohortStats.playerDeaths} Consecutive Fails</span>
              </div>
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Exit Intent Count:</span>
                <span className="text-base font-bold text-orange-400">{activeCohortStats.quitAttempts} Mission Quits</span>
              </div>
            </div>

            {/* In-Game Retention Offer Pop-up Overlay */}
            {activeOffer && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-orange-950/80 border border-amber-500/50 shadow-2xl space-y-3 animate-fade-in relative z-20">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase">
                    SPECIAL RETENTION PROMO
                  </span>
                  <span className="text-xs text-amber-300 font-bold">{activeOffer.price} ({activeOffer.discount || "OFFER"})</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{activeOffer.title}</h4>
                  <p className="text-[11px] text-slate-300">Target SKU: <code className="text-amber-300">{activeOffer.id}</code></p>
                </div>
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => handleAction("offer_accepted")}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>[Accept & Purchase Offer]</span>
                </button>
              </div>
            )}
          </div>

          {/* Interactive Player Action Triggers */}
          <div className="space-y-3 font-mono">
            <span className="text-xs font-bold text-slate-300 uppercase block tracking-wider">Trigger Interactive Player Actions:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => handleAction("boss_fail")}
                className="p-3.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <Flame className="w-4 h-4 text-red-400" />
                <span>[Fail Encounter (+1 Death)]</span>
              </button>

              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => handleAction("mission_quit")}
                className="p-3.5 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <LogOut className="w-4 h-4 text-amber-400" />
                <span>[Quit Mission (Exit Intent)]</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry Log Feed */}
        <div className="lg:col-span-7 h-[600px]">
          <SimulatorTelemetryLog routingMode={routingMode} />
        </div>
      </div>
    </div>
  );
}

