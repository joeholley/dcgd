import React, { createContext, useContext, useState, useMemo } from 'react';

export type TimeDurationPreset = "1d" | "3d" | "7d" | "30d" | "90d" | "1y" | "custom";
export type TimeAnchor = "start" | "end";

export const DURATION_MS: Record<"1d" | "3d" | "7d" | "30d" | "90d" | "1y", number> = {
  "1d": 1 * 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
};

export function formatToDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseFromDatetimeLocal(s: string): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export interface TimeFilterContextType {
  startTime: string;
  endTime: string;
  preset: TimeDurationPreset;
  anchor: TimeAnchor;
  isFilterOpen: boolean;
  setStartTime: (time: string, adjustOffset?: boolean) => void;
  setEndTime: (time: string, adjustOffset?: boolean) => void;
  setPreset: (preset: TimeDurationPreset) => void;
  setAnchor: (anchor: TimeAnchor) => void;
  setNowAsEndTime: () => void;
  applyDurationChip: (chip: "1d" | "3d" | "7d" | "30d" | "90d" | "1y") => void;
  setIsFilterOpen: (open: boolean) => void;
  openFilter: () => void;
  closeFilter: () => void;
  toggleFilter: () => void;
  resetToDefault: () => void;
  formattedRangeLabel: string;
  durationInHours: number;
}

const TimeFilterContext = createContext<TimeFilterContextType | undefined>(undefined);

export function TimeFilterProvider({ children }: { children: React.ReactNode }) {
  // Initialize with 30-day window ending at current time
  const [endTime, setEndTimeState] = useState<string>(() => formatToDatetimeLocal(new Date()));
  const [startTime, setStartTimeState] = useState<string>(() => {
    const d = new Date();
    d.setTime(d.getTime() - DURATION_MS["30d"]);
    return formatToDatetimeLocal(d);
  });
  const [preset, setPreset] = useState<TimeDurationPreset>("30d");
  const [anchor, setAnchor] = useState<TimeAnchor>("end");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Set start time with automatic duration recalculation if chip is active
  const setStartTime = (newStart: string, adjustOffset: boolean = true) => {
    setStartTimeState(newStart);
    setAnchor("start");
    if (adjustOffset && preset !== "custom" && DURATION_MS[preset as keyof typeof DURATION_MS]) {
      const sDate = parseFromDatetimeLocal(newStart);
      const eDate = new Date(sDate.getTime() + DURATION_MS[preset as keyof typeof DURATION_MS]);
      setEndTimeState(formatToDatetimeLocal(eDate));
    } else if (!adjustOffset) {
      setPreset("custom");
    }
  };

  // Set end time with automatic duration recalculation if chip is active
  const setEndTime = (newEnd: string, adjustOffset: boolean = true) => {
    setEndTimeState(newEnd);
    setAnchor("end");
    if (adjustOffset && preset !== "custom" && DURATION_MS[preset as keyof typeof DURATION_MS]) {
      const eDate = parseFromDatetimeLocal(newEnd);
      const sDate = new Date(eDate.getTime() - DURATION_MS[preset as keyof typeof DURATION_MS]);
      setStartTimeState(formatToDatetimeLocal(sDate));
    } else if (!adjustOffset) {
      setPreset("custom");
    }
  };

  // Select 'Now' as end time
  const setNowAsEndTime = () => {
    const now = new Date();
    const nowStr = formatToDatetimeLocal(now);
    setEndTimeState(nowStr);
    setAnchor("end");
    if (preset !== "custom" && DURATION_MS[preset as keyof typeof DURATION_MS]) {
      const sDate = new Date(now.getTime() - DURATION_MS[preset as keyof typeof DURATION_MS]);
      setStartTimeState(formatToDatetimeLocal(sDate));
    }
  };

  // Click on a duration chip (1d, 3d, 7d, 30d, 90d, 1y)
  const applyDurationChip = (chip: "1d" | "3d" | "7d" | "30d" | "90d" | "1y") => {
    const duration = DURATION_MS[chip];
    setPreset(chip);

    if (anchor === "start") {
      // Calculate Forward: End = Start + Duration
      const sDate = parseFromDatetimeLocal(startTime);
      const eDate = new Date(sDate.getTime() + duration);
      setEndTimeState(formatToDatetimeLocal(eDate));
    } else {
      // Calculate Backward: Start = End - Duration
      const eDate = parseFromDatetimeLocal(endTime);
      const sDate = new Date(eDate.getTime() - duration);
      setStartTimeState(formatToDatetimeLocal(sDate));
    }
  };

  const resetToDefault = () => {
    const now = new Date();
    const nowStr = formatToDatetimeLocal(now);
    const sDate = new Date(now.getTime() - DURATION_MS["30d"]);
    setEndTimeState(nowStr);
    setStartTimeState(formatToDatetimeLocal(sDate));
    setPreset("30d");
    setAnchor("end");
  };

  // Computed friendly label for header trigger button
  const formattedRangeLabel = useMemo(() => {
    if (preset !== "custom") {
      const isEndNearNow = Math.abs(Date.now() - parseFromDatetimeLocal(endTime).getTime()) < 5 * 60 * 1000;
      if (anchor === "end" && isEndNearNow) {
        return `Last ${preset}`;
      }
      if (anchor === "start") {
        const sDate = parseFromDatetimeLocal(startTime);
        return `${preset} from ${sDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}`;
      }
      return `${preset} window`;
    }

    const sDate = parseFromDatetimeLocal(startTime);
    const eDate = parseFromDatetimeLocal(endTime);
    const sStr = sDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const eStr = eDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${sStr} – ${eStr}`;
  }, [startTime, endTime, preset, anchor]);

  const durationInHours = useMemo(() => {
    const sDate = parseFromDatetimeLocal(startTime);
    const eDate = parseFromDatetimeLocal(endTime);
    const diffMs = Math.max(0, eDate.getTime() - sDate.getTime());
    return Math.round(diffMs / (1000 * 60 * 60));
  }, [startTime, endTime]);

  return (
    <TimeFilterContext.Provider
      value={{
        startTime,
        endTime,
        preset,
        anchor,
        isFilterOpen,
        setStartTime,
        setEndTime,
        setPreset,
        setAnchor,
        setNowAsEndTime,
        applyDurationChip,
        setIsFilterOpen,
        openFilter: () => setIsFilterOpen(true),
        closeFilter: () => setIsFilterOpen(false),
        toggleFilter: () => setIsFilterOpen((prev) => !prev),
        resetToDefault,
        formattedRangeLabel,
        durationInHours,
      }}
    >
      {children}
    </TimeFilterContext.Provider>
  );
}

export function useTimeFilter() {
  const context = useContext(TimeFilterContext);
  if (!context) {
    throw new Error("useTimeFilter must be used within a TimeFilterProvider");
  }
  return context;
}
