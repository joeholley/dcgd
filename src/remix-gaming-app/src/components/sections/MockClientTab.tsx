import React, { useState, useEffect, useCallback } from "react";
import { 
  Gamepad2, 
  Flame, 
  LogOut, 
  ShoppingBag, 
  Crown, 
  UserCheck, 
  Sparkles, 
  Skull, 
  RotateCcw,
  CheckCircle2,
  Fish,
  Coins
} from "lucide-react";
import { cn } from "../../lib/utils";
import { 
  getSimulatorState, 
  updateSimulatorState, 
  onSimulatorStateUpdate, 
  sendSimulatorEvent, 
  onStreamLogUpdate, 
  PlayerCohortId, 
  RoutingMode 
} from "../../services/simulatorBridge";
import { SimulatorTelemetryLog } from "./SimulatorTelemetryLog";

interface CohortMeta {
  tier: PlayerCohortId;
  defaultPlayerId: string;
  defaultSpend: number;
  defaultLtv: number;
  defaultSku: string;
  badgeColor: string;
}

const COHORT_DEFAULTS: Record<PlayerCohortId, CohortMeta> = {
  Whale: {
    tier: "Whale",
    defaultPlayerId: "Player_0042",
    defaultSpend: 750,
    defaultLtv: 1250,
    defaultSku: "frost_giant_shield_pack",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  Dolphin: {
    tier: "Dolphin",
    defaultPlayerId: "Player_0188",
    defaultSpend: 120,
    defaultLtv: 350,
    defaultSku: "starter_battlepass_pack",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  },
  Minnow: {
    tier: "Minnow",
    defaultPlayerId: "Player_0512",
    defaultSpend: 15,
    defaultLtv: 35,
    defaultSku: "impulse_gem_bundle",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  },
  F2P: {
    tier: "F2P",
    defaultPlayerId: "Player_1024",
    defaultSpend: 0,
    defaultLtv: 0,
    defaultSku: "welcome_gems_crate",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
};

interface OfferPayload {
  id: string;
  title: string;
  price: string;
  discount?: string;
}

interface ExemplarState {
  playerId: string;
  tier: PlayerCohortId;
  totalSpend: number;
  estimatedLtv: number;
  bossHp: number;
  consecutiveDeaths: number;
  churnEvents: number;
  offersAccepted: Record<string, boolean>; // key: offer_name -> true/false
  activeOffer: OfferPayload | null;
}

const initialExemplarStates = (): Record<PlayerCohortId, ExemplarState> => ({
  Whale: {
    playerId: COHORT_DEFAULTS.Whale.defaultPlayerId,
    tier: "Whale",
    totalSpend: COHORT_DEFAULTS.Whale.defaultSpend,
    estimatedLtv: COHORT_DEFAULTS.Whale.defaultLtv,
    bossHp: 100,
    consecutiveDeaths: 0,
    churnEvents: 0,
    offersAccepted: {},
    activeOffer: null,
  },
  Dolphin: {
    playerId: COHORT_DEFAULTS.Dolphin.defaultPlayerId,
    tier: "Dolphin",
    totalSpend: COHORT_DEFAULTS.Dolphin.defaultSpend,
    estimatedLtv: COHORT_DEFAULTS.Dolphin.defaultLtv,
    bossHp: 100,
    consecutiveDeaths: 0,
    churnEvents: 0,
    offersAccepted: {},
    activeOffer: null,
  },
  Minnow: {
    playerId: COHORT_DEFAULTS.Minnow.defaultPlayerId,
    tier: "Minnow",
    totalSpend: COHORT_DEFAULTS.Minnow.defaultSpend,
    estimatedLtv: COHORT_DEFAULTS.Minnow.defaultLtv,
    bossHp: 100,
    consecutiveDeaths: 0,
    churnEvents: 0,
    offersAccepted: {},
    activeOffer: null,
  },
  F2P: {
    playerId: COHORT_DEFAULTS.F2P.defaultPlayerId,
    tier: "F2P",
    totalSpend: COHORT_DEFAULTS.F2P.defaultSpend,
    estimatedLtv: COHORT_DEFAULTS.F2P.defaultLtv,
    bossHp: 100,
    consecutiveDeaths: 0,
    churnEvents: 0,
    offersAccepted: {},
    activeOffer: null,
  },
});

interface MockClientTabProps {
  routingMode: RoutingMode;
}

export function MockClientTab({ routingMode }: MockClientTabProps) {
  const [simState, setSimState] = useState(() => getSimulatorState());
  const selectedTier = (["Whale", "Dolphin", "Minnow", "F2P"].includes(simState.selectedCohort) 
    ? simState.selectedCohort 
    : "Whale") as PlayerCohortId;

  // Isolated per-exemplar client state
  const [exemplars, setExemplars] = useState<Record<PlayerCohortId, ExemplarState>>(() => initialExemplarStates());

  // UI animation state
  const [isHitAnimating, setIsHitAnimating] = useState<boolean>(false);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Sync global simulator state changes
  useEffect(() => {
    const unsubState = onSimulatorStateUpdate((updatedState) => {
      setSimState({ ...updatedState });
    });
    return () => unsubState();
  }, []);

  // Fetch exemplars from BigQuery live GCP backend when routingMode === "LIVE"
  const fetchLiveExemplars = useCallback(async () => {
    if (routingMode !== "LIVE") return;

    try {
      const res = await fetch("/api/exemplars");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.exemplars) {
        setExemplars((prev) => {
          const next = { ...prev };
          (Object.keys(data.exemplars) as PlayerCohortId[]).forEach((tier) => {
            const liveEx = data.exemplars[tier];
            if (liveEx && next[tier]) {
              next[tier] = {
                ...next[tier],
                playerId: liveEx.player_id || next[tier].playerId,
                totalSpend: typeof liveEx.total_iap_spend === "number" ? liveEx.total_iap_spend : next[tier].totalSpend,
                estimatedLtv: typeof liveEx.estimated_ltv === "number" ? liveEx.estimated_ltv : next[tier].estimatedLtv,
              };
            }
          });
          return next;
        });
      }
    } catch (e) {
      console.warn("Failed to fetch live exemplars:", e);
    }
  }, [routingMode]);

  useEffect(() => {
    if (routingMode === "LIVE") {
      fetchLiveExemplars();
    } else {
      // Revert to mock exemplars info when switching back to MOCKED
      setExemplars((prev) => {
        const next = { ...prev };
        (Object.keys(COHORT_DEFAULTS) as PlayerCohortId[]).forEach((tier) => {
          const def = COHORT_DEFAULTS[tier];
          if (next[tier]) {
            next[tier] = {
              ...next[tier],
              playerId: def.defaultPlayerId,
              totalSpend: def.defaultSpend,
              estimatedLtv: def.defaultLtv,
            };
          }
        });
        return next;
      });
    }
  }, [routingMode, fetchLiveExemplars]);

  // Listen to stream logs for INCOMING retention offers from background agent/services
  useEffect(() => {
    const unsubLogs = onStreamLogUpdate((logs) => {
      const latestIncomingOffer = logs.slice().reverse().find((l) => l.direction === "INCOMING" && l.payload?.sku);
      if (latestIncomingOffer && latestIncomingOffer.payload) {
        const p = latestIncomingOffer.payload;
        const offerId = p.sku || "frost_giant_shield_pack";
        
        setExemplars((prev) => {
          const activeEx = prev[selectedTier];
          // Suppress displaying offer modal if offer is already accepted in offersAccepted
          if (activeEx.offersAccepted[offerId]) {
            return prev;
          }
          return {
            ...prev,
            [selectedTier]: {
              ...activeEx,
              activeOffer: {
                id: offerId,
                title: p.title || "Frost Giant Shield & Resurrect Crate",
                price: p.price || "$0.99",
                discount: p.discount || "80% OFF",
              },
            },
          };
        });
      }
    });
    return () => unsubLogs();
  }, [selectedTier]);

  const activeExemplar = exemplars[selectedTier];

  const handleCohortSelect = (tier: PlayerCohortId) => {
    updateSimulatorState({ selectedCohort: tier });
  };

  const handleResetExemplar = (tier: PlayerCohortId, e: React.MouseEvent) => {
    e.stopPropagation();
    setExemplars((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        bossHp: 100,
        consecutiveDeaths: 0,
        churnEvents: 0,
        offersAccepted: {},
        activeOffer: null,
      },
    }));
  };

  const handleTryAgain = async () => {
    setIsProcessingAction(true);
    setIsHitAnimating(true);

    // 1. Instantly refill boss HP to 100%
    // 2. Run hit animation
    // 3. Deduct non-lethal hit (30% - 60%), resulting in 40% - 70% remaining HP
    const damagePct = Math.floor(Math.random() * 31) + 30; // 30 to 60
    const nextBossHp = 100 - damagePct;
    const nextDeaths = activeExemplar.consecutiveDeaths + 1;

    const offerSku = COHORT_DEFAULTS[selectedTier].defaultSku;
    const isOfferAlreadyAccepted = !!activeExemplar.offersAccepted[offerSku];

    // Evaluate retention offer popup if deaths >= 3
    let nextActiveOffer = activeExemplar.activeOffer;
    if (nextDeaths >= 3 && !isOfferAlreadyAccepted && !activeExemplar.activeOffer) {
      nextActiveOffer = {
        id: offerSku,
        title:
          selectedTier === "Whale"
            ? "Frost Giant Shield & Resurrect Crate"
            : selectedTier === "Dolphin"
            ? "Starter Battlepass Catch-Up Crate"
            : selectedTier === "Minnow"
            ? "Impulse Gem Starter Bundle"
            : "Welcome Gems Starter Bundle",
        price: selectedTier === "Whale" ? "$0.99" : "$1.99",
        discount: "80% OFF",
      };
    }

    setExemplars((prev) => ({
      ...prev,
      [selectedTier]: {
        ...prev[selectedTier],
        bossHp: nextBossHp,
        consecutiveDeaths: nextDeaths,
        activeOffer: nextActiveOffer,
      },
    }));

    setTimeout(() => setIsHitAnimating(false), 500);

    await sendSimulatorEvent({
      type: "boss_fail",
      gameId: "cosmic_raider_rpg",
      userId: activeExemplar.playerId,
      payload: {
        cohortId: selectedTier,
        userId: activeExemplar.playerId,
        bossHealth: nextBossHp,
        consecutiveDeaths: nextDeaths,
        churnEvents: activeExemplar.churnEvents,
        offersAccepted: activeExemplar.offersAccepted,
      },
    });

    setIsProcessingAction(false);
  };

  const handleQuitMission = async () => {
    setIsProcessingAction(true);
    const nextQuits = activeExemplar.churnEvents + 1;

    setExemplars((prev) => ({
      ...prev,
      [selectedTier]: {
        ...prev[selectedTier],
        churnEvents: nextQuits,
      },
    }));

    await sendSimulatorEvent({
      type: "mission_quit",
      gameId: "cosmic_raider_rpg",
      userId: activeExemplar.playerId,
      payload: {
        cohortId: selectedTier,
        userId: activeExemplar.playerId,
        bossHealth: activeExemplar.bossHp,
        consecutiveDeaths: activeExemplar.consecutiveDeaths,
        churnEvents: nextQuits,
        offersAccepted: activeExemplar.offersAccepted,
      },
    });

    setIsProcessingAction(false);
  };

  const handleAcceptOffer = async () => {
    if (!activeExemplar.activeOffer) return;
    setIsProcessingAction(true);

    const acceptedOfferId = activeExemplar.activeOffer.id;
    const updatedOffersAccepted = {
      ...activeExemplar.offersAccepted,
      [acceptedOfferId]: true,
    };

    // Firebase RTDB JSON Schema format key representation:
    // "player_profile".${player_id}."offers_accepted".${offer_name} = true
    const firebaseSchemaPayload = {
      player_profile: {
        [activeExemplar.playerId]: {
          offers_accepted: {
            [acceptedOfferId]: true,
          },
        },
      },
    };

    setExemplars((prev) => ({
      ...prev,
      [selectedTier]: {
        ...prev[selectedTier],
        offersAccepted: updatedOffersAccepted,
        activeOffer: null, // Clear active offer modal popup
      },
    }));

    await sendSimulatorEvent({
      type: "offer_accepted",
      gameId: "cosmic_raider_rpg",
      userId: activeExemplar.playerId,
      payload: {
        cohortId: selectedTier,
        userId: activeExemplar.playerId,
        acceptedOfferId,
        offersAcceptedMap: updatedOffersAccepted,
        firebaseSchema: firebaseSchemaPayload,
      },
    });

    setIsProcessingAction(false);
  };

  return (
    <div className="space-y-6">
      {/* Cohort Selection Chips Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3 font-mono">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-white uppercase tracking-wider">Cohort Exemplars Selection</h3>
          </div>
          <span className="text-[10px] text-slate-400">
            Active Backend Mode: <strong className={routingMode === "LIVE" ? "text-blue-400" : "text-emerald-400"}>{routingMode}</strong>
          </span>
        </div>

        {/* Cohort Selection Chips Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(["Whale", "Dolphin", "Minnow", "F2P"] as const).map((tier) => {
            const ex = exemplars[tier];
            const isSelected = selectedTier === tier;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => handleCohortSelect(tier)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden",
                  isSelected
                    ? "bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10 text-white"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                )}
              >
                {/* Chip Header format: [ Whale: Player_0042 | Spend: $750 | LTV: $1,250 ] */}
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-white">
                    {tier === "Whale" && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    {tier === "Dolphin" && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                    {tier === "Minnow" && <Fish className="w-3.5 h-3.5 text-purple-400" />}
                    {tier === "F2P" && <Coins className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{tier}</span>
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                </div>

                {/* Structured Chip Label Display */}
                <div className="text-[11px] font-mono space-y-1 bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                  <div className="text-slate-200 font-semibold truncate">
                    ID: <span className="text-amber-300">{ex.playerId}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Spend: <strong className="text-emerald-400">${ex.totalSpend.toLocaleString()}</strong></span>
                    <span>LTV: <strong className="text-cyan-400">${ex.estimatedLtv.toLocaleString()}</strong></span>
                  </div>
                </div>

                {/* Counters & Reset Button */}
                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                  <span>Deaths: <strong className="text-amber-400">{ex.consecutiveDeaths}</strong> | Quits: <strong className="text-orange-400">{ex.churnEvents}</strong></span>

                  <button
                    type="button"
                    onClick={(e) => handleResetExemplar(tier, e)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer shrink-0"
                    title={`Reset ${tier} exemplar state`}
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
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
              Exemplar: <span className="text-amber-400">{activeExemplar.playerId}</span> ({activeExemplar.tier})
            </span>
          </div>

          {/* Boss Encounter Viewport */}
          <div
            className={cn(
              "bg-slate-950 rounded-2xl border border-slate-800/80 p-5 space-y-5 relative overflow-hidden font-mono shadow-inner transition-all duration-300",
              isHitAnimating && "border-red-500/80 ring-2 ring-red-500/30 scale-[0.99]"
            )}
          >
            {/* Hit Animation Flash Overlay */}
            {isHitAnimating && (
              <div className="absolute inset-0 bg-red-600/15 animate-ping pointer-events-none z-10" />
            )}

            {/* Boss Header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Skull className={cn("w-5 h-5 text-red-500", isHitAnimating ? "animate-bounce" : "animate-pulse")} />
                <span className="font-bold text-red-400 text-sm tracking-wide">Frost Giant Overlord (Lvl 85)</span>
              </div>
              <span className="text-xs text-slate-400 font-bold">HP: {activeExemplar.bossHp}%</span>
            </div>

            {/* Boss Health Bar */}
            <div className="w-full bg-slate-900 rounded-full h-3.5 border border-slate-800 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${activeExemplar.bossHp}%` }}
              />
            </div>

            {/* Gameplay Stats Panel */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Wipeouts / Deaths:</span>
                <span className="text-base font-bold text-amber-400">{activeExemplar.consecutiveDeaths} Consecutive Fails</span>
              </div>
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Exit Intent Count:</span>
                <span className="text-base font-bold text-orange-400">{activeExemplar.churnEvents} Mission Quits</span>
              </div>
            </div>

            {/* In-Game Retention Offer Pop-up Overlay (Suppressed if offersAccepted[offer_name] == true) */}
            {activeExemplar.activeOffer && !activeExemplar.offersAccepted[activeExemplar.activeOffer.id] && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-orange-950/80 border border-amber-500/50 shadow-2xl space-y-3 animate-fade-in relative z-20">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase">
                    SPECIAL RETENTION PROMO
                  </span>
                  <span className="text-xs text-amber-300 font-bold">{activeExemplar.activeOffer.price} ({activeExemplar.activeOffer.discount || "OFFER"})</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{activeExemplar.activeOffer.title}</h4>
                  <p className="text-[11px] text-slate-300">
                    Target SKU: <code className="text-amber-300">{activeExemplar.activeOffer.id}</code>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={handleAcceptOffer}
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
              {/* "Try Again" Button */}
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleTryAgain}
                className="p-3.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 active:scale-95"
              >
                <Flame className="w-4 h-4 text-red-400" />
                <span>Try Again</span>
              </button>

              {/* Quit Mission Button */}
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleQuitMission}
                className="p-3.5 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 active:scale-95"
              >
                <LogOut className="w-4 h-4 text-amber-400" />
                <span>Quit Mission</span>
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

