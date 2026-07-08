import { useDemoEvent } from "../../context/DemoEventContext";
import React, { useState, useEffect } from 'react';
import { DataModeBadge, DataMode } from '../DataModeBadge';
import { ExternalLink, RefreshCw, AlertTriangle, Cpu, CheckCircle } from 'lucide-react';

interface FlaskSectionProps {
  title: string;
  subtitle: string;
  path: string;
  dataMode?: DataMode;
  dataBank?: string;
  description?: string;
}

export function FlaskSection({
  title,
  subtitle,
  path,
  dataMode = 'mock',
  dataBank = 'gamingdatademo (Python Flask :5000)',
  description
}: FlaskSectionProps) {
  const { latestDifficultyAnomaly, latestChurnEvent } = useDemoEvent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    // Perform an explicit HTTP probe to detect 502/404 proxy responses from Flask backend
    fetch(path, { method: 'HEAD' })
      .then(res => {
        if (!active) return;
        if (!res.ok && res.status >= 500) {
          setError(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [path, key]);

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Integrated Section Header */}
      <div className="px-8 py-5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between shrink-0 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              {title}
            </h2>
            <DataModeBadge mode={dataMode} source={dataBank} details={`Internal reverse proxy to ${path}`} />
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Proxy: {path}</span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer border border-slate-700"
            title="Reload View"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <a
            href={path}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all cursor-pointer shadow-sm shadow-blue-500/20"
          >
            <span>Pop Out</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {path.includes("/difficulty.html") && latestDifficultyAnomaly && (
        <div className="px-8 py-3 bg-amber-500/10 border-b border-amber-500/30 text-xs font-mono text-amber-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>
              <strong>Level {latestDifficultyAnomaly.levelId} Completion Bottleneck Payload Loaded:</strong> Failure Rate {(latestDifficultyAnomaly.failureRate * 100).toFixed(0)}% | Moves: {latestDifficultyAnomaly.currentMoves} → Recommended: {latestDifficultyAnomaly.recommendedMoves}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] uppercase">Cross-Section Event</span>
        </div>
      )}

      {path.includes("/marketing_swarm_visualizer.html") && latestChurnEvent && (
        <div className="px-8 py-3 bg-purple-500/10 border-b border-purple-500/30 text-xs font-mono text-purple-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>
              <strong>LiveOps Churn Alert Payload Loaded:</strong> Player <code>{latestChurnEvent.playerId}</code> (Score: {(latestChurnEvent.churnProbability * 100).toFixed(0)}%, Tier: {latestChurnEvent.payerTier}, SKU: {latestChurnEvent.recommendedOffer})
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px] uppercase">Swarm Recovery Payload</span>
        </div>
      )}

      {description && (
        <div className="px-8 py-2.5 bg-slate-900/40 border-b border-slate-800/40 text-xs text-slate-400 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>{description}</span>
        </div>
      )}

      {/* Frame Container */}
      <div className="flex-1 w-full h-full relative bg-slate-950">
        {loading && !error && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-300 font-mono">Connecting to Flask Service ({path})...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-slate-950 z-20 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Internal Flask Service Unreachable</h3>
            <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
              Could not load <code>{path}</code> from 127.0.0.1:5000. Please ensure the Python Flask backend service is running.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        <iframe
          key={key}
          src={path}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          className="w-full h-full border-none shadow-inner"
          title={title}
        />
      </div>
    </div>
  );
}
