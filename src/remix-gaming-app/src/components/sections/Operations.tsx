import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Gamepad2, 
  TrendingUp, 
  Calendar, 
  Clock,
  ArrowRight,
  RefreshCw,
  FileText,
  Database,
  Filter,
  PiggyBank,
  AlertTriangle,
  Smile,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { cn } from "../../lib/utils";
import { DataModeBadge } from "../DataModeBadge";
import { useDemoEvent } from "../../context/DemoEventContext";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from "recharts";

// 1. Placeholder Game Data
const GAME_METRICS = [
  { name: "Puzzle Quest Saga", downloads: 450000, revenue: 320000, crashes: 12, sentiment: 4.5, iapRate: 35 },
  { name: "Cosmic Raider RPG", downloads: 320000, revenue: 450000, crashes: 5, sentiment: 4.8, iapRate: 52 },
  { name: "Retro Speed Racer", downloads: 150000, revenue: 110000, crashes: 2, sentiment: 4.1, iapRate: 20 },
  { name: "Pixel Battle Royale", downloads: 650000, revenue: 580000, crashes: 18, sentiment: 4.3, iapRate: 41 },
];

const WEEKLY_ENGAGEMENT_TREND = [
  { day: "Mon", dau: 380, avgPlaytime: 35 },
  { day: "Tue", dau: 395, avgPlaytime: 38 },
  { day: "Wed", dau: 410, avgPlaytime: 40 },
  { day: "Thu", dau: 425, avgPlaytime: 42 },
  { day: "Fri", dau: 460, avgPlaytime: 48 },
  { day: "Sat", dau: 490, avgPlaytime: 55 },
  { day: "Sun", dau: 485, avgPlaytime: 52 },
];

const STORE_CONVERSION_FUNNEL = [
  { step: "Store Opened", players: 10000, rate: 100 },
  { step: "Viewed Item", players: 6500, rate: 65 },
  { step: "Added to Cart", players: 4200, rate: 42 },
  { step: "Purchased", players: 1600, rate: 16 },
];

const REVENUE_MIX_DATA = [
  { name: 'In-App Purchases (IAP)', value: 55, fill: '#3b82f6' },
  { name: 'In-Game Ads', value: 30, fill: '#ef4444' },
  { name: 'VIP Subscriptions', value: 15, fill: '#f59e0b' },
];

// 2. Play Segment Lists
const PLAYER_SEGMENTS = {
  "high-value": [
    { username: "CosmicWhale_42", faction: "Solar Alliance", ltv: 1240, matchesPlayed: 840, status: "Active", device: "iPad Pro" },
    { username: "LootGoblinsMax", faction: "Deep Space", ltv: 980, matchesPlayed: 710, status: "Active", device: "PC" },
    { username: "HyperPacer99", faction: "Asphalt Kings", ltv: 750, matchesPlayed: 450, status: "Active", device: "iOS" },
    { username: "TitanStriker", faction: "Solar Alliance", ltv: 680, matchesPlayed: 590, status: "Active", device: "Android" },
  ],
  "new": [
    { username: "SagaBeginner_1", faction: "Guild Green", ltv: 5, matchesPlayed: 2, status: "Tutorial Complete", device: "Android" },
    { username: "RacerNoob_x", faction: "Unassigned", ltv: 0, matchesPlayed: 1, status: "In Tutorial", device: "iOS" },
    { username: "CosmicNewbie", faction: "Guild Red", ltv: 15, matchesPlayed: 8, status: "Active Onboarding", device: "PC" },
  ],
  "churned": [
    { username: "GhostGamer_2001", faction: "Shadow Fleet", ltv: 150, matchesPlayed: 320, status: "Inactive 30d", device: "iOS" },
    { username: "PixelQuitter", faction: "Asphalt Kings", ltv: 10, matchesPlayed: 12, status: "Inactive 45d", device: "Android" },
    { username: "RpgSlumberer", faction: "Deep Space", ltv: 340, matchesPlayed: 210, status: "Inactive 60d", device: "PC" },
  ],
};

export function Operations() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("24h");
  const [activeTab, setActiveTab] = useState<"performance" | "segmentation" | "monetization">("performance");
  const [activeSegment, setActiveSegment] = useState<"high-value" | "new" | "churned">("high-value");
  const [dataSeed, setDataSeed] = useState(0);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setDataSeed(prev => prev + 1);
    }, 1200);
  }, []);

  // Scorecard Specs
  const scorecards = [
    { label: "Daily Active Users (DAU)", val: `${(450 + (dataSeed % 10)).toLocaleString()}K`, change: "+15%", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Player Retention (Day 7)", val: `${62 + (dataSeed % 3)}%`, change: "+2%", icon: Gamepad2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Avg Session Length", val: `${42 + (dataSeed % 4)}m`, change: "+5%", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "New Installs", val: (1120 + dataSeed).toLocaleString(), change: "+8%", icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  const { triggerDifficultySolver } = useDemoEvent();

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Game Analytics Overview</h2>
            <DataModeBadge mode="mock" source="In-Memory Dev Mock / Static Telemetry" details="Simulated DAU, CCU, and level completion telemetry" />
          </div>
          <p className="text-slate-500 font-light mt-1 text-sm italic">Jingle Games Customer 360 • Live Telemetry Streams</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setTimeRange(prev => prev === "24h" ? "7d" : "24h")}
            className={cn(
              "px-4 py-2 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold cursor-pointer",
              timeRange === "24h" ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-slate-200 text-slate-600"
            )}
          >
            <Calendar className="w-4 h-4" /> {timeRange === "24h" ? "Last 24 Hours" : "Past 7 Days"}
          </button>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-6 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-blue-700 shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Syncing..." : "Refresh Metrics"}
          </button>
        </div>
      </header>

      {/* Level 2 Completion Bottleneck Callout Banner */}
      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Level 2 Completion Bottleneck Detected
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 font-mono text-[10px]">12% Pass Rate</span>
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Player drop-off spike on Frost Giant Citadel (Level 2). Average resets: 3.4 / player. Current move limit (15) insufficient for 82% of players.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => triggerDifficultySolver({ levelId: 2, failureRate: 0.88, currentMoves: 15, recommendedMoves: 22 })}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4" /> Launch Difficulty Balancer Solver ↗
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-8">
        {[
          { id: "performance", label: "Game Performance & Quality", icon: Gamepad2 },
          { id: "segmentation", label: "Player Cohorts & Segments", icon: Filter },
          { id: "monetization", label: "Monetization Insights", icon: PiggyBank },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "pb-4 px-2 text-sm font-semibold tracking-tight border-b-2 transition-all flex items-center gap-2 cursor-pointer",
              activeTab === tab.id 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Primary Content View */}
      <div className="space-y-8">
        
        {/* Scorecards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {scorecards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm"
            >
              <div className={`p-3 rounded-xl ${s.bg} w-fit mb-4`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{s.label}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-800">{s.val}</span>
                <span className="text-[10px] font-bold text-emerald-500">
                  {s.change}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tab 1: Game Performance & Quality */}
        {activeTab === "performance" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Engagement Trend (DAU & Avg Playtime) */}
              <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Weekly Player Engagement Trend</h3>
                    <p className="text-xs text-slate-400 font-light mt-0.5">Correlation between scaling DAU and play duration</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-semibold uppercase">AlloyDB Live feed</span>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={WEEKLY_ENGAGEMENT_TREND}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="dau" stroke="#3b82f6" name="DAU (Thousands)" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="avgPlaytime" stroke="#10b981" name="Avg Playtime (Mins)" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Title breakdown (Downloads and Crash Reports) */}
              <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Title Breakdown: Installs & Stability</h3>
                    <p className="text-xs text-slate-400 font-light mt-0.5">Historical downloads mapped against server-side crash reports</p>
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={GAME_METRICS} margin={{ bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={9} 
                        interval={0}
                        angle={-10}
                        textAnchor="end"
                        height={40}
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="downloads" fill="#3b82f6" radius={[4, 4, 0, 0]} name="New Installs" />
                      <Bar dataKey="crashes" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Crashes (Telemetry)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Quality Table and Sentiment */}
            <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Internal Game Performance & Sentiment Matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 pb-3">
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Title</th>
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unique Downloads</th>
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Revenue Estimations</th>
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Crash Rate / hr</th>
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Player Sentiment (1-5)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {GAME_METRICS.map((g) => (
                      <tr key={g.name} className="hover:bg-slate-50/50">
                        <td className="py-4 font-bold text-slate-800">{g.name}</td>
                        <td className="py-4 text-slate-600">{g.downloads.toLocaleString()}</td>
                        <td className="py-4 font-mono font-semibold text-emerald-600">${g.revenue.toLocaleString()}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              g.crashes > 10 ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                            )} />
                            <span className="font-mono text-slate-700">{g.crashes} failures</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-1.5 text-amber-500">
                            <Smile className="w-4 h-4" />
                            <span className="font-bold text-slate-800">{g.sentiment}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Player Segmentation */}
        {activeTab === "segmentation" && (
          <div className="space-y-8">
            <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Active Retention Segments</h3>
                  <p className="text-xs text-slate-400 font-light mt-0.5">Filter the player base to trigger target engagement programs</p>
                </div>
                
                {/* Segment Filter Buttons */}
                <div className="flex bg-slate-50 p-1.5 rounded-2xl gap-2 border border-slate-100">
                  {[
                    { id: "high-value", label: "High-Value Players (Whales)" },
                    { id: "new", label: "Onboarding (New Players)" },
                    { id: "churned", label: "Churn Risk (Inactive)" },
                  ].map((seg) => (
                    <button
                      key={seg.id}
                      onClick={() => setActiveSegment(seg.id as any)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        activeSegment === seg.id 
                          ? "bg-slate-900 text-white shadow-sm" 
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      {seg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Segment List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 pb-3">
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Username</th>
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered Guild / Faction</th>
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lifetime Value (LTV)</th>
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Matches Played</th>
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Device Family</th>
                      <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Segment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {PLAYER_SEGMENTS[activeSegment].map((player) => (
                      <tr key={player.username} className="hover:bg-slate-50/50">
                        <td className="py-4 font-mono font-bold text-blue-600">{player.username}</td>
                        <td className="py-4 text-slate-600">{player.faction}</td>
                        <td className="py-4 font-mono font-semibold text-emerald-600">${player.ltv}</td>
                        <td className="py-4 font-mono">{player.matchesPlayed} games</td>
                        <td className="py-4 text-slate-500">{player.device}</td>
                        <td className="py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider",
                            activeSegment === "high-value" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                            activeSegment === "new" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                            "bg-rose-50 text-rose-600 border border-rose-100"
                          )}>
                            {player.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-8 bg-slate-930 text-slate-450 border border-slate-800 rounded-[2.5rem] bg-slate-900 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-600/10 to-transparent pointer-events-none" />
               <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white font-bold">
                      <Sparkles className="w-5 h-5 text-blue-400" />
                      <h4>Direct Target Offer Injection Enabled</h4>
                    </div>
                    <p className="text-slate-400 font-light leading-relaxed max-w-xl text-xs">
                      Send custom push campaigns, premium chest codes, or special items directly into the client folders of this segment. Syncs via Google Intelligent Cohort service.
                    </p>
                 </div>
                 <button className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-bold text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer">
                   Trigger Segment Campaign
                 </button>
               </div>
            </div>
          </div>
        )}

        {/* Tab 3: Monetization Insights */}
        {activeTab === "monetization" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Core Monetization stats */}
              <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Strategic Revenue Mix</h3>
                <div className="h-56 relative flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={REVENUE_MIX_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {REVENUE_MIX_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-xs font-bold text-slate-400 uppercase">Quarter LTV</span>
                     <span className="text-2xl font-bold text-slate-800">$1.4M</span>
                  </div>
                </div>
                <div className="mt-4 space-y-2 shrink-0">
                  {REVENUE_MIX_DATA.map(t => (
                    <div key={t.name} className="flex justify-between items-center text-xs">
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.fill }} />
                         <span className="text-slate-500">{t.name}</span>
                       </div>
                       <span className="font-bold text-slate-700">{t.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conversion Funnel */}
              <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm lg:col-span-2">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">In-Game Store Conversion Funnel</h3>
                    <p className="text-xs text-slate-400 font-light mt-0.5">Drop-off mapping across the mobile store purchase flow</p>
                  </div>
                </div>
                <div className="space-y-5">
                  {STORE_CONVERSION_FUNNEL.map((step) => (
                    <div key={step.step} className="group">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-sm font-bold text-slate-800">{step.step}</span>
                        <div className="font-mono text-xs flex gap-3 text-slate-500">
                          <span>{step.players.toLocaleString()} Sessions</span>
                          <span className="font-bold text-blue-600">{step.rate}%</span>
                        </div>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${step.rate}%` }}
                          className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                   <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                   <p className="text-xs text-amber-800 leading-relaxed font-medium">
                     <span className="font-bold">Conversion Alert:</span> A 14% drop-off from "Viewed Item" to "Added to Cart" matches a known inventory load lag in Cosmic Raider RPG patch 1.8. Matches logged to AlloyDB cluster.
                   </p>
                </div>
              </div>
            </div>

            {/* Strategic KPI Bento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-800">
               <div className="p-8 rounded-3xl border border-slate-100 bg-white shadow-sm space-y-4">
                  <h4 className="font-bold">Average Revenue Per User (ARPU)</h4>
                  <p className="text-3xl font-mono font-bold text-slate-800">$4.12 <span className="text-xs text-emerald-500 font-sans tracking-normal ml-2">+4.5% YoY</span></p>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">
                    Aggregated by connecting Snowflake real-time cohorts. ARPU has increased sequentially due to the introduction of season passes and limited-edition cosmetic drops in Jingle titles.
                  </p>
               </div>
               
               <div className="p-8 rounded-3xl border border-slate-100 bg-white shadow-sm space-y-4">
                  <h4 className="font-bold">Average Premium Wallet Size</h4>
                  <p className="text-3xl font-mono font-bold text-slate-800">1,480 Diamonds <span className="text-xs text-indigo-500 font-sans tracking-normal ml-2">Stable</span></p>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">
                    Direct transactional check linked directly with AlloyDB transactional engine. Dynamic balance check confirms in-game currency circulation ratios are sound, bypassing systemic hyper-inflation.
                  </p>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
