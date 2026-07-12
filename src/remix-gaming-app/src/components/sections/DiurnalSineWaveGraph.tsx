import React, { useState, useEffect, useMemo, useRef } from "react";
import { Clock, Globe } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ActiveTimezones {
  apac: boolean;
  emea: boolean;
  na: boolean;
}

interface DiurnalSineWaveGraphProps {
  peakCCU: number;
  activeTimezones: ActiveTimezones;
  onTimezoneToggle: (region: keyof ActiveTimezones) => void;
}

interface RegionConfig {
  id: keyof ActiveTimezones;
  name: string;
  city: string;
  timeZone: string;
  color: string;
  bgBadge: string;
  borderBadge: string;
  weight: number;
  peakHourUtc: number;
}

const REGIONS: RegionConfig[] = [
  {
    id: "na",
    name: "North America (NA)",
    city: "New York",
    timeZone: "America/New_York",
    color: "#f59e0b", // Amber
    bgBadge: "bg-amber-500/10 text-amber-300",
    borderBadge: "border-amber-500/30",
    weight: 0.45,
    peakHourUtc: 23,
  },
  {
    id: "emea",
    name: "EMEA",
    city: "London",
    timeZone: "Europe/London",
    color: "#06b6d4", // Cyan
    bgBadge: "bg-cyan-500/10 text-cyan-300",
    borderBadge: "border-cyan-500/30",
    weight: 0.35,
    peakHourUtc: 19,
  },
  {
    id: "apac",
    name: "APAC",
    city: "Tokyo",
    timeZone: "Asia/Tokyo",
    color: "#ec4899", // Neon Pink
    bgBadge: "bg-pink-500/10 text-pink-300",
    borderBadge: "border-pink-500/30",
    weight: 0.20,
    peakHourUtc: 12,
  },
];

export function DiurnalSineWaveGraph({
  peakCCU,
  activeTimezones,
  onTimezoneToggle,
}: DiurnalSineWaveGraphProps) {
  // Live city clock states
  const [cityTimes, setCityTimes] = useState<Record<string, string>>({});
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Update live city clocks every second
  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      const newTimes: Record<string, string> = {};
      REGIONS.forEach((r) => {
        try {
          newTimes[r.id] = new Intl.DateTimeFormat("en-US", {
            timeZone: r.timeZone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(now);
        } catch (e) {
          newTimes[r.id] = "--:--:--";
        }
      });
      setCityTimes(newTimes);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute 24 hour curve data points
  const pointsCount = 48; // half-hour increments
  const data = useMemo(() => {
    const points = [];
    const now = new Date();
    const currentUtcHour = now.getUTCHours() + now.getUTCMinutes() / 60;

    for (let i = 0; i <= pointsCount; i++) {
      const hour = (i / pointsCount) * 24; // 0 to 24

      let totalVal = 0;
      const regionalVals: Record<keyof ActiveTimezones, number> = {
        apac: 0,
        emea: 0,
        na: 0,
      };

      REGIONS.forEach((r) => {
        if (activeTimezones[r.id]) {
          // Diurnal formula: sin((pi * (hour - (peakHour - 6))) / 12) ^ 2
          const phi = r.peakHourUtc - 6;
          const val = Math.max(0, Math.sin((Math.PI * (hour - phi)) / 12)) ** 2;
          const ccu = val * r.weight * peakCCU;
          regionalVals[r.id] = Math.round(ccu);
          totalVal += ccu;
        }
      });

      points.push({
        hour,
        formattedHour: `${String(Math.floor(hour)).padStart(2, "0")}:${Math.floor((hour % 1) * 60)
          .toString()
          .padStart(2, "0")} UTC`,
        totalCCU: Math.round(totalVal),
        regionalCCU: regionalVals,
      });
    }
    return { points, currentUtcHour };
  }, [peakCCU, activeTimezones]);

  // Dimensions for SVG
  const width = 600;
  const height = 220;
  const paddingX = 40;
  const paddingY = 25;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  // Max value for y scaling
  const maxY = Math.max(1000, peakCCU * 1.05);

  const getX = (hour: number) => paddingX + (hour / 24) * graphWidth;
  const getY = (ccu: number) => height - paddingY - (ccu / maxY) * graphHeight;

  // Create SVG path string helper
  const createPathString = (getter: (pt: (typeof data.points)[0]) => number) => {
    return data.points
      .map((pt, idx) => {
        const x = getX(pt.hour);
        const y = getY(getter(pt));
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const aggregatePath = createPathString((pt) => pt.totalCCU);

  const currentMarkerX = getX(data.currentUtcHour);

  // Mouse move handler for hover tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const scaledX = (mouseX / rect.width) * width;
    const clampedX = Math.max(paddingX, Math.min(width - paddingX, scaledX));
    const hourHovered = ((clampedX - paddingX) / graphWidth) * 24;
    const index = Math.round((hourHovered / 24) * pointsCount);
    setHoverIndex(Math.max(0, Math.min(pointsCount, index)));
  };

  const hoveredPoint = hoverIndex !== null ? data.points[hoverIndex] : null;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner font-mono">
      {/* Header & Regional Timezone Chips */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          <h3 className="font-bold text-white text-xs tracking-wider uppercase">
            Interactive 24-Hr Diurnal Concurrency Model
          </h3>
        </div>

        {/* Timezone Toggle Chips with Live City Clocks */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {REGIONS.map((r) => {
            const isActive = activeTimezones[r.id];
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onTimezoneToggle(r.id)}
                className={cn(
                  "px-3 py-1 rounded-xl border flex items-center gap-2 transition-all cursor-pointer",
                  isActive
                    ? `${r.bgBadge} ${r.borderBadge} font-bold shadow-sm`
                    : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isActive ? r.color : "#475569" }}
                />
                <span>{r.name} ({r.city})</span>
                <span className="flex items-center gap-1 opacity-80 text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  <Clock className="w-3 h-3" />
                  {cityTimes[r.id] || "--:--"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG Graph Viewport */}
      <div className="relative w-full overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Background Grid Lines */}
          {[0, 6, 12, 18, 24].map((h) => (
            <line
              key={`grid-x-${h}`}
              x1={getX(h)}
              y1={paddingY}
              x2={getX(h)}
              y2={height - paddingY}
              stroke="#1e293b"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          ))}

          {[0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY].map((val, i) => (
            <g key={`grid-y-${i}`}>
              <line
                x1={paddingX}
                y1={getY(val)}
                x2={width - paddingX}
                y2={getY(val)}
                stroke="#1e293b"
                strokeWidth="1"
              />
              <text
                x={paddingX - 6}
                y={getY(val) + 3}
                fill="#64748b"
                fontSize="9"
                textAnchor="end"
                fontFamily="monospace"
              >
                {Math.round(val).toLocaleString()}
              </text>
            </g>
          ))}

          {/* X Axis Hours */}
          {[0, 4, 8, 12, 16, 20, 24].map((h) => (
            <text
              key={`label-h-${h}`}
              x={getX(h)}
              y={height - 6}
              fill="#64748b"
              fontSize="9"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {String(h).padStart(2, "0")}:00
            </text>
          ))}

          {/* Regional Lines */}
          {REGIONS.map((r) => {
            if (!activeTimezones[r.id]) return null;
            const pathStr = createPathString((pt) => pt.regionalCCU[r.id]);
            return (
              <path
                key={`path-${r.id}`}
                d={pathStr}
                fill="none"
                stroke={r.color}
                strokeWidth="1.5"
                strokeDasharray="4 2"
                opacity="0.85"
              />
            );
          })}

          {/* Aggregate Total White Curve */}
          <path
            d={aggregatePath}
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
          />

          {/* Current UTC Marker (Vertical dashed line) */}
          <line
            x1={currentMarkerX}
            y1={paddingY}
            x2={currentMarkerX}
            y2={height - paddingY}
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <circle cx={currentMarkerX} cy={getY(data.points[Math.round((data.currentUtcHour / 24) * pointsCount)]?.totalCCU || 0)} r="4" fill="#38bdf8" />

          {/* Mouse Hover Indicator Line & Dot */}
          {hoveredPoint && (
            <g>
              <line
                x1={getX(hoveredPoint.hour)}
                y1={paddingY}
                x2={getX(hoveredPoint.hour)}
                y2={height - paddingY}
                stroke="#ec4899"
                strokeWidth="1"
              />
              <circle
                cx={getX(hoveredPoint.hour)}
                cy={getY(hoveredPoint.totalCCU)}
                r="5"
                fill="#ffffff"
                stroke="#ec4899"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Hover Readout Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl text-[11px] space-y-1.5 backdrop-blur z-20 pointer-events-none">
            <div className="flex justify-between items-center text-slate-400 font-bold border-b border-slate-800 pb-1 gap-4">
              <span>Hour Mark: <strong className="text-white">{hoveredPoint.formattedHour}</strong></span>
              <span className="text-emerald-400">Total: {hoveredPoint.totalCCU.toLocaleString()} CCU</span>
            </div>

            <div className="space-y-0.5 text-[10px]">
              {REGIONS.map((r) => (
                <div key={r.id} className="flex justify-between items-center gap-4">
                  <span className="flex items-center gap-1.5" style={{ color: r.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                    {r.name}:
                  </span>
                  <span className="font-bold text-slate-200">
                    {activeTimezones[r.id]
                      ? `${hoveredPoint.regionalCCU[r.id].toLocaleString()} CCU`
                      : "DISABLED"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
