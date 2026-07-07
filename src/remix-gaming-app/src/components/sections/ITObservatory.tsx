import { motion } from "motion/react";
import { Activity, ShieldCheck, Map, Terminal } from "lucide-react";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const MOCK_QUERY_LOGS = [
  { time: "14:20:01", query: "join(alloydb_sessions, snowflake_ltv)", latency: 120, cost: 0.0004 },
  { time: "14:20:05", query: "search(telemetry_knowledge_catalog)", latency: 45, cost: 0.0001 },
  { time: "14:20:12", query: "federate(aws_s3_playlogs, iceberg_cohorts)", latency: 210, cost: 0.0008 },
  { time: "14:20:18", query: "summarize(gemini_player_churn)", latency: 850, cost: 0.0012 },
  { time: "14:20:25", query: "viz(looker_economy_dashboard)", latency: 320, cost: 0.0003 },
];

const MOCK_TRAFFIC_DATA = [
  { name: '00:00', val: 410 }, { name: '04:00', val: 320 }, { name: '08:00', val: 840 },
  { name: '12:00', val: 1250 }, { name: '16:00', val: 920 }, { name: '20:00', val: 510 },
];

export function ITObservatory() {
  return (
    <div className="p-8 h-full flex flex-col text-slate-900">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-800 tracking-tight font-sans">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            Agentic Gaming Data Observatory
          </h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-xs text-slate-500 font-medium italic">Unified Game Economics & Cross-Cloud Observability Pipeline</p>
            <div className="flex items-center gap-2 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Cross-Cloud Cache Active</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
           <div className="p-5 px-8 card-sleek text-center bg-white shadow-sm border border-slate-100 rounded-2xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Avg Query Cost</div>
              <div className="text-2xl font-mono text-emerald-600 font-bold">$0.00042</div>
           </div>
           <div className="p-5 px-8 card-sleek text-center bg-white shadow-sm border border-slate-100 rounded-2xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Active Gaming API Nodes</div>
              <div className="text-2xl font-mono text-blue-600 font-bold">12</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 p-8 card-sleek bg-white border border-slate-200 rounded-3xl">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" /> Live API Query Traffic Load
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_TRAFFIC_DATA}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#cbd5e1" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#cbd5e1" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}
                />
                <Area type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 card-sleek bg-white border border-slate-200 rounded-3xl">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
            <Map className="w-4 h-4 text-blue-500" /> Federated Engine Mix
          </h3>
          <div className="space-y-6">
            {[
              { label: "Google Cloud AlloyDB (Live)", val: 82, color: "bg-blue-600" },
              { label: "Snowflake (Monetization)", val: 12, color: "bg-sky-400" },
              { label: "AWS S3 (Archived Telemetry)", val: 6, color: "bg-orange-500" },
            ].map(source => (
              <div key={source.label}>
                <div className="flex justify-between text-[10px] font-bold mb-2 uppercase">
                  <span className="text-slate-500">{source.label}</span>
                  <span className="text-slate-900 font-mono tracking-tighter">{source.val}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${source.val}%` }}
                    className={`h-full ${source.color} shadow-sm`} 
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">Deployment SPIFFE Identity</p>
                <p className="text-[9px] text-slate-400 font-mono mt-1 leading-tight break-all">spiffe://jingle/operations/dev-executor</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 card-sleek bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.02)]">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-500" /> Real-time Query Execution Log
        </h3>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-100">
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time Space</th>
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operation</th>
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linked Sources</th>
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Delay</th>
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Unit Econ Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_QUERY_LOGS.map((log, i) => (
                <tr key={i} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-5 text-xs font-mono text-slate-400">{log.time}</td>
                  <td className="py-5 text-sm font-bold text-slate-800">{log.query}</td>
                  <td className="py-5">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      {log.query.includes("aws_s3") && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                      {log.query.includes("snowflake") && <div className="w-1.5 h-1.5 rounded-full bg-sky-300" />}
                    </div>
                  </td>
                  <td className="py-5 text-xs font-medium text-slate-600">{log.latency}ms</td>
                  <td className="py-5 text-xs font-mono font-bold text-emerald-600 text-right">${log.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
