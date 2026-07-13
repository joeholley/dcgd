import React, { useState, useEffect, useRef } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Radio, 
  Filter, 
  Play, 
  Pause,
  ArrowUpToLine
} from "lucide-react";
import { cn } from "../../lib/utils";
import { 
  StreamLogEntry, 
  getStreamLogs, 
  clearStreamLogs, 
  onStreamLogUpdate, 
  buildGcpConsolePubSubUrl, 
  getStreamLoggingPaused,
  setStreamLoggingPaused,
  RoutingMode 
} from "../../services/simulatorBridge";

interface SimulatorTelemetryLogProps {
  routingMode?: RoutingMode;
}

export function SimulatorTelemetryLog({ routingMode = "LIVE" }: SimulatorTelemetryLogProps) {
  const [logs, setLogs] = useState<StreamLogEntry[]>(() => getStreamLogs());
  const [isPaused, setIsPaused] = useState<boolean>(() => getStreamLoggingPaused());
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [filter, setFilter] = useState<"ALL" | "OUTGOING" | "INCOMING">("ALL");
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = onStreamLogUpdate((updatedLogs) => {
      setLogs([...updatedLogs]);
    });
    return () => unsub();
  }, []);

  // Auto-scroll to top (latest entry) when autoScroll is enabled
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleStreamPause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    setStreamLoggingPaused(nextPaused);
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === "OUTGOING") return log.direction === "OUTGOING";
    if (filter === "INCOMING") return log.direction === "INCOMING";
    return true;
  });

  const formatTime = (ts: number): string => {
    const date = new Date(ts);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const ms = String(date.getMilliseconds()).padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${ms}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-xl font-mono">
      {/* Header bar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <h3 className="font-bold text-white text-xs tracking-wide">Behind-the-Scenes Telemetry Log</h3>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
            {logs.length} events
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Stream Logging Halt/Resume Toggle */}
          <button
            type="button"
            onClick={handleToggleStreamPause}
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border",
              !isPaused
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                : "bg-amber-500/20 text-amber-400 border-amber-500/40"
            )}
          >
            {!isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
            <span>Stream Logging: {!isPaused ? "ON" : "OFF (Paused)"}</span>
          </button>

          {/* Auto-Scroll Toggle and Trash Clear */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAutoScroll(!autoScroll)}
              className={cn(
                "p-1.5 px-2 rounded-lg border text-xs transition-all cursor-pointer flex items-center gap-1",
                autoScroll
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
                  : "bg-slate-900 text-slate-500 hover:text-slate-300 border-slate-800"
              )}
              title={autoScroll ? "Auto-Scroll: Enabled (Jumps to latest log entry)" : "Auto-Scroll: Disabled"}
            >
              <ArrowUpToLine className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold hidden sm:inline">Auto-Scroll</span>
            </button>

            <button
              type="button"
              onClick={() => clearStreamLogs()}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all border border-slate-800 cursor-pointer"
              title="Clear Log Stream"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3 text-slate-500" />
          <span className="text-slate-400 text-[10px]">Filter:</span>
          {(["ALL", "OUTGOING", "INCOMING"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilter(mode)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border",
                filter === mode
                  ? "bg-blue-600/30 border-blue-500 text-blue-300"
                  : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-slate-500">
          Mode: <strong className={routingMode === "MOCKED" ? "text-orange-400" : "text-blue-400"}>{routingMode}</strong>
        </span>
      </div>

      {/* Log Feed Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[500px]">
        {filteredLogs.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-xs text-center space-y-2">
            <Radio className="w-6 h-6 opacity-30 animate-pulse" />
            <p>No telemetry log entries captured yet.</p>
            <p className="text-[10px] text-slate-600">Trigger game actions or simulator emission to populate log stream.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isOutgoing = log.direction === "OUTGOING";
            const isExpanded = !!expandedLogIds[log.id];
            const consoleUrl = log.gcpConsoleUrl || buildGcpConsolePubSubUrl(log.pubsubTopic || "omniarcade-live-telemetry");
            const entryMode = log.backend_mode || routingMode;
            const isInMemory = entryMode === "MOCKED" || log.transport.includes("In-Memory");

            return (
              <div
                key={log.id}
                className={cn(
                  "p-3 rounded-xl border transition-all text-xs space-y-2",
                  isOutgoing
                    ? "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                    : "bg-purple-950/20 border-purple-800/40 hover:border-purple-700/60"
                )}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {/* Status Mark: Green ✓ / Red ✗ */}
                    {log.success ? (
                      <span title="Success"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /></span>
                    ) : (
                      <span title="Failure"><XCircle className="w-4 h-4 text-rose-500 shrink-0" /></span>
                    )}

                    {/* Timestamp */}
                    <span className="text-slate-400 text-[11px] font-mono">{formatTime(log.timestamp)}</span>

                    {/* Direction & Mode Badge */}
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                        isOutgoing
                          ? isInMemory
                            ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                            : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                          : "bg-purple-500/10 text-purple-300 border-purple-500/30"
                      )}
                    >
                      {isOutgoing
                        ? isInMemory
                          ? "Outgoing -> BroadcastChannel"
                          : "[LIVE] OUTGOING -> Cloud Pub/Sub"
                        : `[${entryMode}] INCOMING <- Agent Event`}
                    </span>

                    <span className="text-white font-bold text-[11px]">{log.eventType}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      {log.transport}
                    </span>

                    {/* Clickable GCP Console Link (Hidden if event was captured in MOCKED mode) */}
                    {entryMode === "LIVE" && (
                      <a
                        href={consoleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 text-[10px] font-bold flex items-center gap-1 transition-all"
                        title="Open Cloud Pub/Sub Topic in Google Cloud Console"
                      >
                        <span>Open in GCP Console</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {/* Expand JSON Button */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(log.id)}
                      className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expandable JSON Message Payload */}
                {isExpanded && (
                  <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[10px] overflow-x-auto">
                    <div className="flex justify-between items-center text-slate-500 border-b border-slate-800 pb-1 mb-2">
                      <span>Message Payload Snapshot</span>
                      {log.pubsubTopic && <span>Topic: {log.pubsubTopic}</span>}
                    </div>
                    {log.errorMessage && (
                      <p className="text-rose-400 font-bold mb-1">[Error] {log.errorMessage}</p>
                    )}
                    <pre className="text-emerald-300 font-mono leading-relaxed whitespace-pre-wrap">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

