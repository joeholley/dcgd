import React, { useState } from 'react';
import { Database, ShieldCheck, Cpu, AlertTriangle, Info } from 'lucide-react';

export type DataMode = 'live' | 'mock' | 'hybrid';

interface DataModeBadgeProps {
  mode: DataMode;
  source?: string;
  details?: string;
  className?: string;
}

export function DataModeBadge({ mode, source, details, className = '' }: DataModeBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const config = {
    live: {
      label: 'LIVE (GCP)',
      bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400 animate-pulse',
      icon: ShieldCheck,
      desc: 'Connected to active Google Cloud infrastructure',
    },
    mock: {
      label: 'MOCK (Dev)',
      bg: 'bg-amber-500/10 hover:bg-amber-500/20',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
      icon: AlertTriangle,
      desc: 'Running in-memory dev fallback or synthetic dataset',
    },
    hybrid: {
      label: 'HYBRID',
      bg: 'bg-purple-500/10 hover:bg-purple-500/20',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      dot: 'bg-purple-400',
      icon: Cpu,
      desc: 'Partial GCP backend connection with dev fallbacks',
    },
  }[mode];

  const Icon = config.icon;

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-medium transition-all cursor-pointer ${config.bg} ${config.border} ${config.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <Icon className="w-3 h-3" />
        <span>{config.label}</span>
        <Info className="w-3 h-3 opacity-60 hover:opacity-100 ml-0.5" />
      </button>

      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 text-left text-xs font-sans text-slate-200">
          <div className="flex items-center gap-2 mb-1.5 font-semibold text-white border-b border-slate-800 pb-1.5">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Data Mode Details</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">{config.desc}</p>
          {source && (
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-300">
              <span className="text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Source:</span>
              <span className="text-blue-300 break-all">{source}</span>
            </div>
          )}
          {details && (
            <p className="mt-1.5 text-[11px] text-slate-400 italic">{details}</p>
          )}
        </div>
      )}
    </div>
  );
}
