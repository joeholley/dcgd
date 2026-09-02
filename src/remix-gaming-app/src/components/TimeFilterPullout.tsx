import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Clock,
  X,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Zap,
  CheckCircle2,
  SlidersHorizontal,
  Layers,
  Sparkles
} from "lucide-react";
import {
  useTimeFilter,
  parseFromDatetimeLocal,
  formatToDatetimeLocal,
  TimeDurationPreset,
  DURATION_MS
} from "../context/TimeFilterContext";
import { cn } from "../lib/utils";

const DURATION_CHIPS: Array<{
  id: "1d" | "3d" | "7d" | "30d" | "90d" | "1y";
  label: string;
  sub: string;
}> = [
  { id: "1d", label: "1d", sub: "24 hours" },
  { id: "3d", label: "3d", sub: "72 hours" },
  { id: "7d", label: "7d", sub: "1 week" },
  { id: "30d", label: "30d", sub: "1 month" },
  { id: "90d", label: "90d", sub: "1 quarter" },
  { id: "1y", label: "1y", sub: "365 days" },
];

export function TimeFilterPullout() {
  const {
    startTime,
    endTime,
    preset,
    anchor,
    isFilterOpen,
    setStartTime,
    setEndTime,
    setAnchor,
    setNowAsEndTime,
    applyDurationChip,
    closeFilter,
    resetToDefault,
    durationInHours,
  } = useTimeFilter();

  const pulloutRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFilterOpen) {
        closeFilter();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFilterOpen, closeFilter]);

  const startDate = parseFromDatetimeLocal(startTime);
  const endDate = parseFromDatetimeLocal(endTime);

  const isEndNearNow = Math.abs(Date.now() - endDate.getTime()) < 3 * 60 * 1000;

  // Format nice strings
  const formattedStart = startDate.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedEnd = endDate.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const durationDays = Math.round((durationInHours / 24) * 10) / 10;

  // Quick preset: Beginning of Month for Start Time
  const handleStartOfMonth = () => {
    const d = new Date(startDate);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    setStartTime(formatToDatetimeLocal(d));
  };

  // Quick preset: Beginning of Year for Start Time
  const handleStartOfYear = () => {
    const d = new Date(startDate);
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    setStartTime(formatToDatetimeLocal(d));
  };

  return (
    <AnimatePresence>
      {isFilterOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeFilter}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50"
          />

          {/* Slide-out Drawer Panel */}
          <motion.div
            ref={pulloutRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[470px] bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 font-sans">
                    Telemetry Time Window
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Filter Medallion Lakehouse telemetry
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeFilter}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Close time filter (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 font-mono text-xs">
              {/* Range Calculation Strategy (Anchor Switcher) */}
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                    <Clock className="w-3 h-3 text-blue-400" />
                    Range Calculation Anchor
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300 font-bold uppercase">
                    {anchor === "start" ? "From Start Date →" : "← Ending at End Date"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setAnchor("start")}
                    className={cn(
                      "py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                      anchor === "start"
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    <span>Anchor: Start Date</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnchor("end")}
                    className={cn(
                      "py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                      anchor === "end"
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                    <span>Anchor: End Date</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 italic leading-relaxed">
                  {anchor === "start"
                    ? "Offsets will calculate forward: End Time = Start Time + selected duration."
                    : "Offsets will calculate backward: Start Time = End Time - selected duration."}
                </p>
              </div>

              {/* Date & Time Picker Controls */}
              <div className="space-y-4">
                {/* 1. Start Time Field */}
                <div
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-200",
                    anchor === "start"
                      ? "bg-blue-500/5 border-blue-500/40 shadow-sm shadow-blue-500/10"
                      : "bg-slate-950/60 border-slate-800"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="filter-start-time"
                      className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-sans"
                    >
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      Start Date & Time (Origin)
                    </label>
                    {anchor === "start" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 font-bold uppercase">
                        Active Anchor
                      </span>
                    )}
                  </div>

                  <input
                    id="filter-start-time"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    onFocus={() => setAnchor("start")}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                  />

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={handleStartOfMonth}
                      className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    >
                      Start of Month
                    </button>
                    <button
                      type="button"
                      onClick={handleStartOfYear}
                      className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    >
                      Start of Year
                    </button>
                  </div>
                </div>

                {/* Visual Connection Arrow */}
                <div className="flex items-center justify-center -my-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shadow-sm z-10">
                    {anchor === "start" ? (
                      <ArrowRight className="w-4 h-4 text-blue-400 animate-pulse" />
                    ) : (
                      <ArrowLeft className="w-4 h-4 text-blue-400 animate-pulse" />
                    )}
                  </div>
                </div>

                {/* 2. End Time Field with 'NOW' Button */}
                <div
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-200",
                    anchor === "end"
                      ? "bg-blue-500/5 border-blue-500/40 shadow-sm shadow-blue-500/10"
                      : "bg-slate-950/60 border-slate-800"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="filter-end-time"
                      className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-sans"
                    >
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      End Date & Time (Horizon)
                    </label>
                    {anchor === "end" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 font-bold uppercase">
                        Active Anchor
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="filter-end-time"
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      onFocus={() => setAnchor("end")}
                      className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    />

                    {/* Prominent NOW Button */}
                    <button
                      type="button"
                      onClick={setNowAsEndTime}
                      className={cn(
                        "px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm",
                        isEndNearNow
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/30"
                          : "bg-blue-600 hover:bg-blue-500 text-white"
                      )}
                      title="Set End Time to Current Time (Now)"
                    >
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <span>NOW</span>
                    </button>
                  </div>

                  {isEndNearNow && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span>End time matches live clock (Now)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Duration Shortcut Chips (1d, 3d, 7d, 30d, 90d, 1y) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                    Duration Shortcut Chips
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Click to apply offset from {anchor === "start" ? "Start" : "End"}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {DURATION_CHIPS.map((chip) => {
                    const isSelected = preset === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => applyDurationChip(chip.id)}
                        className={cn(
                          "py-2.5 px-2 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border text-center group",
                          isSelected
                            ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20 font-bold scale-[1.02]"
                            : "bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700"
                        )}
                      >
                        <span className="text-xs font-bold font-mono group-hover:text-white">
                          {chip.label}
                        </span>
                        <span className="text-[8px] text-slate-400 group-hover:text-slate-200 mt-0.5 opacity-80">
                          {chip.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Range Dynamic Explainer Banner */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>
                    {anchor === "start" ? (
                      <>
                        Calculating <strong className="text-white">+{preset}</strong> forward from{" "}
                        <span className="text-blue-300">{formattedStart}</span> →{" "}
                        <span className="text-emerald-300">{formattedEnd}</span>
                      </>
                    ) : (
                      <>
                        Calculating <strong className="text-white">-{preset}</strong> backward from{" "}
                        <span className="text-blue-300">{formattedEnd}</span> →{" "}
                        <span className="text-emerald-300">{formattedStart}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* 4. Telemetry Scope Summary Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Selected Telemetry Window
                  </span>
                  <span className="text-[10px] font-bold text-indigo-400">
                    {durationDays} Days ({durationInHours.toLocaleString()}h)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Start Window:</span>
                    <span className="text-white font-bold">{formattedStart}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">End Window:</span>
                    <span className="text-white font-bold">{formattedEnd}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2 text-[10px] text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Applies to BigQuery Medallion Lakehouse & AI Agents</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={resetToDefault}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset (30d)</span>
              </button>

              <button
                type="button"
                onClick={closeFilter}
                className="flex-1 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply Window</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
