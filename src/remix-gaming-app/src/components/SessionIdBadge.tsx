import React, { useState } from 'react';
import { Copy, Check, Hash } from 'lucide-react';

interface SessionIdBadgeProps {
  sessionId?: string | null;
  className?: string;
  label?: string;
}

export function SessionIdBadge({ sessionId, className = '', label }: SessionIdBadgeProps) {
  const [copied, setCopied] = useState(false);

  if (!sessionId) {
    return null;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(sessionId);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = sessionId;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy session ID:', err);
    }
  };

  const displayId = sessionId.length > 28 ? `${sessionId.slice(0, 14)}...${sessionId.slice(-8)}` : sessionId;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Click to copy Session ID: ${sessionId}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 font-mono text-[11px] transition-all cursor-pointer ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      <Hash className="w-3 h-3 text-blue-400" />
      {label && <span className="text-slate-400 font-sans text-[10px]">{label}:</span>}
      <span className="truncate max-w-[200px]">{displayId}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400 ml-0.5 shrink-0" />
      ) : (
        <Copy className="w-3 h-3 text-slate-400 hover:text-slate-200 ml-0.5 shrink-0 opacity-70" />
      )}
    </button>
  );
}

export default SessionIdBadge;
