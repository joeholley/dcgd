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
  Coins,
  Swords,
  Scaling
} from "lucide-react";
import gameBgImage from "../../assets/image_1783953739614717.png";
import { cn } from "../../lib/utils";
import { SessionIdBadge } from "../SessionIdBadge";
import { DataModeBadge } from "../DataModeBadge";
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
    defaultSku: "frost_giant_shield_pack",
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

export const calculateChurnProbability = (ex: { consecutiveDeaths: number; churnEvents: number }): number => {
  const deathWeight = ex.consecutiveDeaths * 0.30;
  const quitWeight = ex.churnEvents * 0.85;
  return Math.round(Math.min(0.99, Math.max(0.05, deathWeight + quitWeight)) * 100) / 100;
};

interface ExemplarState {
  playerId: string;
  tier: PlayerCohortId;
  totalSpend: number;
  estimatedLtv: number;
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
    consecutiveDeaths: 0,
    churnEvents: 0,
    offersAccepted: {},
    activeOffer: null,
  },
});

interface MockClientTabProps {
  routingMode: RoutingMode;
}

type EncounterState = "idle" | "boss_encountered" | "defeat";

export function MockClientTab({ routingMode }: MockClientTabProps) {
  const [simState, setSimState] = useState(() => getSimulatorState());
  const selectedTier = (["Whale", "Dolphin", "Minnow", "F2P"].includes(simState.selectedCohort) 
    ? simState.selectedCohort 
    : "Whale") as PlayerCohortId;

  // Isolated per-exemplar client state
  const [exemplars, setExemplars] = useState<Record<PlayerCohortId, ExemplarState>>(() => 
    initialExemplarStates()
  );

  // UI animation & interactive flow states
  const [isHitAnimating, setIsHitAnimating] = useState<boolean>(false);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [encounterState, setEncounterState] = useState<EncounterState>("idle");
  const [showQuitModal, setShowQuitModal] = useState<boolean>(false);

  // Resizable Mock Game Client Viewport State
  const [clientWidth, setClientWidth] = useState<number>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("dcgd_mock_client_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 220 && parsed <= 720) return parsed;
      }
    }
    return 400;
  });

  const [isResizing, setIsResizing] = useState<boolean>(false);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("dcgd_mock_client_width", clientWidth.toString());
    }
  }, [clientWidth]);

  const handleStartResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startW = clientWidth;

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const deltaX = moveEvt.clientX - startX;
      const newWidth = Math.max(240, Math.min(720, startW + deltaX));
      setClientWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [clientWidth]);

  const handleResetSize = () => {
    setClientWidth(400);
  };

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

  const getOfferForCohort = useCallback(
    (tier: PlayerCohortId, injectedPayload?: any): OfferPayload => {
      const promoState = simState.cohortPromos?.[tier];
      const isPromoActive = Boolean(promoState?.active || injectedPayload);

      const discountPct = isPromoActive
        ? (promoState?.discountPercentage ?? (typeof injectedPayload?.discount_percentage === "number" ? injectedPayload.discount_percentage : 25))
        : 0;

      const offerId =
        (isPromoActive && (promoState?.skuId || injectedPayload?.sku_id || injectedPayload?.sku)) ||
        COHORT_DEFAULTS[tier]?.defaultSku ||
        "frost_giant_shield_pack";

      const title =
        (isPromoActive && (promoState?.title || injectedPayload?.title)) ||
        "Frost Giant Shield & Resurrect Crate";

      let price = (isPromoActive && (promoState?.price || injectedPayload?.price)) || undefined;
      if (!price) {
        const basePrice = 4.99;
        const discountedPrice = Math.floor(basePrice * (1 - discountPct / 100) * 100) / 100;
        price = `$${discountedPrice.toFixed(2)}`;
      }

      return {
        id: offerId,
        title,
        price,
        discount: `${discountPct}% OFF`,
      };
    },
    [simState]
  );

  // Track received INCOMING offer injection events from live backend/operator actions
  const [injectedOfferReceivedMap, setInjectedOfferReceivedMap] = useState<Record<string, boolean>>({});

  // Listen to stream logs for INCOMING retention offer injection events from agent engine
  useEffect(() => {
    const unsubLogs = onStreamLogUpdate((logs) => {
      const injectedLog = logs.find(
        (l) =>
          l.direction === "INCOMING" &&
          (l.eventType === "in_game_retention_offer_injected" ||
            l.payload?.eventType === "in_game_retention_offer_injected" ||
            l.payload?.sku === "frost_giant_shield_pack" ||
            l.payload?.sku_id === "frost_giant_shield_pack")
      );

      if (injectedLog) {
        const offerId =
          injectedLog.payload?.sku_id ||
          injectedLog.payload?.sku ||
          simState.cohortPromos?.[selectedTier]?.skuId ||
          COHORT_DEFAULTS[selectedTier].defaultSku;
        setInjectedOfferReceivedMap((prev) => ({ ...prev, [offerId]: true, injected: true }));

        setExemplars((prev) => {
          const activeEx = prev[selectedTier];
          const churnProb = calculateChurnProbability(activeEx);
          const promoState = simState.cohortPromos?.[selectedTier];
          const threshold = promoState?.churnThreshold || 0.85;

          if (churnProb >= threshold && !activeEx.offersAccepted[offerId] && !activeEx.activeOffer) {
            return {
              ...prev,
              [selectedTier]: {
                ...activeEx,
                activeOffer: getOfferForCohort(selectedTier, injectedLog.payload),
              },
            };
          }
          return prev;
        });
      } else {
        setInjectedOfferReceivedMap({});
        setExemplars((prev) => {
          const next = { ...prev };
          (Object.keys(next) as PlayerCohortId[]).forEach((t) => {
            if (next[t].activeOffer) {
              next[t] = {
                ...next[t],
                activeOffer: getOfferForCohort(t),
              };
            }
          });
          return next;
        });
      }
    });
    return () => unsubLogs();
  }, [selectedTier, simState, getOfferForCohort]);

  const activeExemplar = exemplars[selectedTier];

  const handleCohortSelect = (tier: PlayerCohortId) => {
    updateSimulatorState({ selectedCohort: tier });
    setEncounterState("idle");
    setShowQuitModal(false);
  };

  const handleResetExemplar = (tier: PlayerCohortId, e: React.MouseEvent) => {
    e.stopPropagation();
    setExemplars((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        consecutiveDeaths: 0,
        churnEvents: 0,
        offersAccepted: {},
        activeOffer: null,
      },
    }));
    setEncounterState("idle");
    setShowQuitModal(false);
  };

  // Step 1: Click "Try Again" -> Displays "Boss Encountered!" & Fight Button, greys out Try Again button
  const handleTryAgain = () => {
    setEncounterState("boss_encountered");
  };

  // Step 2: Click "Fight" -> Displays "Defeat", increments consecutive fails counter, emits telemetry, re-enables Try Again button
  const handleFightBoss = async () => {
    setIsProcessingAction(true);
    setIsHitAnimating(true);

    const nextDeaths = activeExemplar.consecutiveDeaths + 1;
    const promoState = simState.cohortPromos?.[selectedTier];
    const offerSku = promoState?.skuId || COHORT_DEFAULTS[selectedTier].defaultSku;
    const isOfferAlreadyAccepted = !!activeExemplar.offersAccepted[offerSku];
    const updatedExemplar = { ...activeExemplar, consecutiveDeaths: nextDeaths };
    const churnProb = calculateChurnProbability(updatedExemplar);
    const isOfferInjected = Boolean(
      promoState?.active || injectedOfferReceivedMap["injected"] || injectedOfferReceivedMap[offerSku]
    );
    const threshold = promoState?.churnThreshold || 0.85;

    // Provide retention offer ONLY IF offer injected event has been received in log / promo active, churn probability >= threshold, and not yet accepted
    let nextActiveOffer = activeExemplar.activeOffer;
    if (isOfferInjected && churnProb >= threshold && !isOfferAlreadyAccepted && !activeExemplar.activeOffer) {
      nextActiveOffer = getOfferForCohort(selectedTier);
    }

    setExemplars((prev) => ({
      ...prev,
      [selectedTier]: {
        ...prev[selectedTier],
        consecutiveDeaths: nextDeaths,
        activeOffer: nextActiveOffer,
      },
    }));

    setEncounterState("defeat");

    setTimeout(() => setIsHitAnimating(false), 500);

    await sendSimulatorEvent({
      type: "boss_fail",
      gameId: "cosmic_raider_rpg",
      userId: activeExemplar.playerId,
      payload: {
        source: "mock_game_client",
        isMockClientAction: true,
        cohortId: selectedTier,
        userId: activeExemplar.playerId,
        consecutiveDeaths: nextDeaths,
        churnEvents: activeExemplar.churnEvents,
        offersAccepted: activeExemplar.offersAccepted,
      },
    });

    setIsProcessingAction(false);
  };

  // Quit Mission flow handlers:
  // Step 1: Click "Quit Mission" -> Greys out button and shows pop-up in center of game client
  const handleQuitMission = () => {
    setShowQuitModal(true);
  };

  // Step 2a: Click "Yes" in Pop-up -> Increment mission quits, enable quit mission button, dismiss pop-up
  const handleConfirmQuit = async () => {
    setIsProcessingAction(true);
    setShowQuitModal(false);

    const nextQuits = activeExemplar.churnEvents + 1;
    const promoState = simState.cohortPromos?.[selectedTier];
    const offerSku = promoState?.skuId || COHORT_DEFAULTS[selectedTier].defaultSku;
    const isOfferAlreadyAccepted = !!activeExemplar.offersAccepted[offerSku];
    const updatedExemplar = { ...activeExemplar, churnEvents: nextQuits };
    const churnProb = calculateChurnProbability(updatedExemplar);
    const isOfferInjected = Boolean(
      promoState?.active || injectedOfferReceivedMap["injected"] || injectedOfferReceivedMap[offerSku]
    );
    const threshold = promoState?.churnThreshold || 0.85;

    // Provide retention offer ONLY IF offer injected event has been received in log / promo active, churn probability >= threshold, and not yet accepted
    let nextActiveOffer = activeExemplar.activeOffer;
    if (isOfferInjected && churnProb >= threshold && !isOfferAlreadyAccepted && !activeExemplar.activeOffer) {
      nextActiveOffer = getOfferForCohort(selectedTier);
    }

    setExemplars((prev) => ({
      ...prev,
      [selectedTier]: {
        ...prev[selectedTier],
        churnEvents: nextQuits,
        activeOffer: nextActiveOffer,
      },
    }));

    await sendSimulatorEvent({
      type: "mission_quit",
      gameId: "cosmic_raider_rpg",
      userId: activeExemplar.playerId,
      payload: {
        source: "mock_game_client",
        isMockClientAction: true,
        cohortId: selectedTier,
        userId: activeExemplar.playerId,
        consecutiveDeaths: activeExemplar.consecutiveDeaths,
        churnEvents: nextQuits,
        offersAccepted: activeExemplar.offersAccepted,
      },
    });

    setIsProcessingAction(false);
  };

  // Step 2b: Click "No" in Pop-up -> Dismiss pop-up and re-enable quit mission button
  const handleCancelQuit = () => {
    setShowQuitModal(false);
  };

  const handleAcceptOffer = async () => {
    if (!activeExemplar.activeOffer) return;
    setIsProcessingAction(true);

    const acceptedOfferId = activeExemplar.activeOffer.id;
    const updatedOffersAccepted = {
      ...activeExemplar.offersAccepted,
      [acceptedOfferId]: true,
    };

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
        source: "mock_game_client",
        isMockClientAction: true,
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
            const promoState = simState.cohortPromos?.[tier];
            const isPromoActive = Boolean(promoState?.active);
            const currentChurnPct = (calculateChurnProbability(ex) * 100).toFixed(0);
            const threshPct = ((promoState?.churnThreshold || 0.85) * 100).toFixed(0);

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
                {/* Chip Header format with PROMO ACTIVE chip */}
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold flex items-center gap-1.5 text-white">
                      {tier === "Whale" && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                      {tier === "Dolphin" && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                      {tier === "Minnow" && <Fish className="w-3.5 h-3.5 text-purple-400" />}
                      {tier === "F2P" && <Coins className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{tier}</span>
                    </span>
                    {isPromoActive && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded border bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm shadow-emerald-500/30 animate-pulse tracking-wide font-mono uppercase">
                        PROMO ACTIVE
                      </span>
                    )}
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                </div>

                {/* Structured Chip Label Display with Churn Ratio Readout */}
                <div className="text-[11px] font-mono space-y-1 bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                  <div className="flex justify-between items-center text-slate-200 font-semibold truncate gap-1">
                    <span>ID: <span className="text-amber-300">{ex.playerId}</span></span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isPromoActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono">
                          {promoState.discountPercentage}% OFF
                        </span>
                      )}
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono",
                        isPromoActive
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : (calculateChurnProbability(ex) >= 0.85
                              ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse"
                              : "bg-slate-900 text-slate-400 border-slate-800")
                      )}>
                        {isPromoActive ? `${currentChurnPct}% / ${threshPct}%` : `Churn: ${currentChurnPct}%`}
                      </span>
                    </div>
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
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Left Column: Mock Game Client Viewport Card (Resizable) */}
        <div 
          className={cn(
            "bg-slate-950 border-2 border-slate-800 rounded-2xl p-3 shadow-2xl flex flex-col space-y-3 relative shrink-0 transition-[width] duration-75 mx-auto lg:mx-0",
            isResizing ? "border-amber-500/80 ring-2 ring-amber-500/30 shadow-amber-500/10" : ""
          )}
          style={{ width: `${clientWidth}px`, maxWidth: "100%" }}
        >
          {/* Card Header Label & Resizing Controls */}
          <div className="flex flex-col space-y-2 border-b border-slate-800/80 pb-2 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
                <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">Mock Game Client</h3>
              </div>

              {/* Dimensions readout & reset button */}
              <div className="flex items-center gap-1.5 text-[9px]">
                <span className="bg-slate-900 border border-slate-800 text-amber-400 px-2 py-0.5 rounded font-bold">
                  {clientWidth}px × {Math.round((clientWidth * 16) / 9)}px (9:16)
                </span>
                <button
                  type="button"
                  onClick={handleResetSize}
                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                  title="Reset viewport size to default (400px 9:16)"
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                </button>
              </div>
            </div>

            {/* Quick Size Presets */}
            <div className="flex items-center justify-between gap-1 text-[9px] pt-1">
              <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 px-1 text-[8px] uppercase">Width:</span>
                {[
                  { label: "S", width: 280 },
                  { label: "M", width: 340 },
                  { label: "L", width: 440 },
                  { label: "XL", width: 560 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setClientWidth(preset.width)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer",
                      clientWidth === preset.width
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Player Action Triggers */}
          <div className="space-y-1.5 font-mono text-[10px]">
            <span className="font-bold text-slate-400 uppercase block tracking-wider text-[9px]">
              Simulate Player Actions:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {/* "Try Again" Button */}
              <button
                type="button"
                disabled={isProcessingAction || encounterState === "boss_encountered"}
                onClick={handleTryAgain}
                className="py-2 px-2 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-200 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <Flame className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>Try Again</span>
              </button>

              {/* "Quit Mission" Button */}
              <button
                type="button"
                disabled={isProcessingAction || showQuitModal}
                onClick={handleQuitMission}
                className="py-2 px-2 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-200 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Quit Mission</span>
              </button>
            </div>
          </div>

          {/* Game Client Window (Locked 9:16 Aspect Ratio) */}
          <div
            className={cn(
              "relative w-full rounded-xl overflow-hidden border border-slate-800/80 shadow-2xl bg-cover bg-center bg-no-repeat flex flex-col justify-between p-3 font-mono select-none transition-all duration-200",
              isHitAnimating && "border-red-500/80 ring-2 ring-red-500/30 scale-[0.99]"
            )}
            style={{ 
              backgroundImage: `url(${gameBgImage})`,
              aspectRatio: "9/16",
              minHeight: "280px",
            }}
          >
            {/* Background darkening overlay for high contrast */}
            <div className="absolute inset-0 bg-slate-950/20 pointer-events-none" />

            {/* Hit Animation Flash Overlay */}
            {isHitAnimating && (
              <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none z-10" />
            )}

            {/* CENTER OVERLAY AREA: Boss Encountered, Fight Button, Defeat Message, and Quit Modal */}
            <div className="relative z-20 flex-1 flex flex-col items-center justify-center space-y-4 px-3 text-center">
              {/* 1. "Boss Encountered!" text & "Fight" button */}
              {encounterState === "boss_encountered" && (
                <div className="bg-slate-950/90 backdrop-blur-md border-2 border-red-500/80 p-5 rounded-2xl shadow-2xl space-y-4 animate-fade-in max-w-[85%] w-full">
                  <div className="flex items-center justify-center gap-2 text-red-400">
                    <Swords className="w-6 h-6 text-red-500 animate-bounce" />
                    <h3 className="text-base font-black tracking-wider uppercase text-white drop-shadow-md">
                      Boss Encountered!
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleFightBoss}
                    className="w-full py-3 px-6 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/40 hover:shadow-red-500/60 transition-all transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Flame className="w-5 h-5 text-amber-300 animate-pulse" />
                    <span>Fight</span>
                  </button>
                </div>
              )}

              {/* 2. "Defeat" Message */}
              {encounterState === "defeat" && (
                <div className="bg-slate-950/90 backdrop-blur-md border-2 border-red-600/80 p-5 rounded-2xl shadow-2xl space-y-2 animate-fade-in max-w-[85%] w-full">
                  <div className="flex items-center justify-center gap-2 text-red-500">
                    <Skull className="w-7 h-7 text-red-500 animate-pulse" />
                    <h3 className="text-xl font-black tracking-widest uppercase text-red-400 drop-shadow-lg">
                      Defeat
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Player defeated in encounter!
                  </p>
                </div>
              )}

              {/* 3. Quit Mission Pop-up Dialog */}
              {showQuitModal && (
                <div className="bg-slate-950/95 backdrop-blur-md border-2 border-amber-500/80 p-5 rounded-2xl shadow-2xl space-y-4 animate-fade-in max-w-[90%] w-full">
                  <div className="flex items-center justify-center gap-2 text-amber-400">
                    <LogOut className="w-5 h-5" />
                    <h4 className="font-bold text-white text-xs uppercase tracking-wide">
                      Are you sure you want to quit?
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleConfirmQuit}
                      className="py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelQuit}
                      className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer active:scale-95"
                    >
                      No
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* In-Game Retention Offer Pop-up Overlay (Suppressed if offer is accepted) */}
            {activeExemplar.activeOffer && !activeExemplar.offersAccepted[activeExemplar.activeOffer.id] && (
              <div className="relative z-30 mt-auto p-4 rounded-xl bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-orange-950/95 border border-amber-500/60 shadow-2xl space-y-3 animate-fade-in backdrop-blur-md">
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
                <div className="pt-2 border-t border-amber-500/30 flex items-center justify-between text-[9px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">Origin: <strong className="text-blue-400 font-sans">agent_kc</strong></span>
                  <SessionIdBadge sessionId={`sess_live_${activeExemplar.playerId}`} label="Session" />
                  <DataModeBadge mode="live" source="agent_kc Datastore Ingestion" />
                </div>
              </div>
            )}
          </div>

          {/* Interactive Drag-to-Resize Handle Indicator Pill at bottom-right corner */}
          <div
            onMouseDown={handleStartResize}
            className={cn(
              "absolute -bottom-2.5 -right-2.5 w-7 h-7 rounded-full bg-slate-900 border-2 flex items-center justify-center cursor-nwse-resize transition-all z-40 shadow-xl group",
              isResizing
                ? "border-amber-400 text-amber-300 bg-amber-950/90 ring-4 ring-amber-500/20 scale-110"
                : "border-slate-700 text-slate-400 hover:border-amber-500 hover:text-amber-300 hover:bg-slate-800"
            )}
            title="Click & drag to resize Mock Game Client viewport (width & height)"
          >
            <Scaling className="w-3.5 h-3.5 transform group-hover:scale-110 transition-transform" />
          </div>
        </div>

        {/* Right Column: Telemetry Log Feed (Fills remaining horizontal space) */}
        <div className="flex-1 min-w-0 w-full h-[580px]">
          <SimulatorTelemetryLog routingMode={routingMode} />
        </div>
      </div>
    </div>
  );
}

