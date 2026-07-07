import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Database, 
  ArrowRight, 
  ShieldCheck, 
  FileText, 
  Globe, 
  Lock,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
  Code2,
  Table,
  CheckCircle2,
  Sliders,
  Terminal,
  Zap
} from "lucide-react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db, isUsingFirebaseMock } from "../../services/firebase";
import { cn } from "../../lib/utils";

interface Asset {
  id: string;
  title: string;
  url: string;
  category: string;
  updatedAt: string;
  source?: string;
  description?: string;
}

interface DiscoveredRule {
  rule_id: string;
  input_text: string;
  dataplex_aspect_type: string;
  generated_aspect_schema: {
    name: string;
    fields: {
      player_tier: string;
      max_discount_pct: number;
      target_sku: string;
      guardrail_boundary_status: string;
    };
  };
  generated_bigquery_policy_sql: string;
  status: string;
  created_at: string;
}

export function KnowledgeCatalog({ initialSearch = "" }: { initialSearch?: string }) {
  const [activeTab, setActiveTab] = useState<"search" | "sandbox">("search");
  const [search, setSearch] = useState(initialSearch);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Automatic Rule Discovery Sandbox State
  const [plainRuleText, setPlainRuleText] = useState("Whales in Japan get max 80% discount on Frost Giant Shield Pack");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredRules, setDiscoveredRules] = useState<DiscoveredRule[]>([
    {
      rule_id: "rule_discovered_default_01",
      input_text: "Whales in Japan get max 80% discount on Frost Giant Shield Pack",
      dataplex_aspect_type: "liveops_campaign_policy_aspect",
      generated_aspect_schema: {
        name: "projects/omniarcade-demo/locations/us-central1/aspectTypes/liveops_campaign_policy_aspect",
        fields: {
          player_tier: "Whale",
          max_discount_pct: 80,
          target_sku: "frost_giant_shield_pack",
          guardrail_boundary_status: "ACTIVE_VERIFIED",
        },
      },
      generated_bigquery_policy_sql: `CREATE OR REPLACE ROW ACCESS POLICY liveops_churn_guardrail_policy\nON \`omniarcade-demo.omniarcade_gold.gold_player_360\`\nGRANT TO ("group:liveops-managers@google.com")\nFILTER USING (spend_tier = 'Whale' AND churn_risk_score >= 0.50);`,
      status: "DISCOVERED_AND_COMPILED",
      created_at: new Date().toISOString(),
    }
  ]);

  useEffect(() => {
    async function fetchAssets() {
      if (isUsingFirebaseMock) {
        setAssets([
          { id: 'gdpr-privacy', title: 'European GDPR Player Privacy Sandbox Directive', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Compliance', updatedAt: '2026-05-18T12:00:00Z', source: 'Corporate Governance', description: 'Mandatory standard for player PII masking across direct Jingle play files and active multiplayer lobbies.' },
          { id: 'ops-scorecard', title: 'Q2 Game Operations Network Performance Scorecard', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Operations', updatedAt: '2026-05-18T10:00:00Z', source: 'AlloyDB', description: 'Real-time performance latency, active server tick ratios, and matchmaking queue performance derived from live server pools.' },
          { id: 'revenue-strategy', title: 'Snowflake Strategic In-Game Monetization Strategy', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Finance', updatedAt: '2026-05-19T08:00:00Z', source: 'Snowflake', description: 'LTV cohort growth targets, store category parameters, and in-app purchase price elasticities.' },
          { id: 's3-telemetry', title: 'AWS S3 Play Telemetry Archives & Audits', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Logistics', updatedAt: '2026-05-17T15:00:00Z', source: 'AWS S3', description: 'Legacy historical play logs, old build game resources, and cold storage matchmaking records.' },
          { id: 'looker-dashboards', title: 'Semantic Looker Cohort Model Definitions', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Governance', updatedAt: '2026-05-18T09:00:00Z', source: 'Looker', description: 'Standard metric dimensions (DAU, ARPU, LTV) definitions and schema mappings for Jingle executive reporting.' }
        ]);
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, "reports"), orderBy("updatedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetched: Asset[] = [];
        querySnapshot.forEach((doc) => {
          fetched.push({ id: doc.id, ...doc.data() } as Asset);
        });
        
        if (fetched.length === 0) {
          setAssets([
            { id: 'gdpr-privacy', title: 'European GDPR Player Privacy Sandbox Directive', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Compliance', updatedAt: '2026-05-18T12:00:00Z', source: 'Corporate Governance', description: 'Mandatory standard for player PII masking across direct Jingle play files and active multiplayer lobbies.' },
            { id: 'ops-scorecard', title: 'Q2 Game Operations Network Performance Scorecard', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Operations', updatedAt: '2026-05-18T10:00:00Z', source: 'AlloyDB', description: 'Real-time performance latency, active server tick ratios, and matchmaking queue performance derived from live server pools.' },
            { id: 'revenue-strategy', title: 'Snowflake Strategic In-Game Monetization Strategy', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Finance', updatedAt: '2026-05-19T08:00:00Z', source: 'Snowflake', description: 'LTV cohort growth targets, store category parameters, and in-app purchase price elasticities.' },
            { id: 's3-telemetry', title: 'AWS S3 Play Telemetry Archives & Audits', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Logistics', updatedAt: '2026-05-17T15:00:00Z', source: 'AWS S3', description: 'Legacy historical play logs, old build game resources, and cold storage matchmaking records.' },
            { id: 'looker-dashboards', title: 'Semantic Looker Cohort Model Definitions', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Governance', updatedAt: '2026-05-18T09:00:00Z', source: 'Looker', description: 'Standard metric dimensions (DAU, ARPU, LTV) definitions and schema mappings for Jingle executive reporting.' }
          ]);
        } else {
          setAssets(fetched);
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
        setAssets([
          { id: 'gdpr-privacy', title: 'European GDPR Player Privacy Sandbox Directive', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Compliance', updatedAt: '2026-05-18T12:00:00Z', source: 'Corporate Governance', description: 'Mandatory standard for player PII masking across direct Jingle play files and active multiplayer lobbies.' },
          { id: 'ops-scorecard', title: 'Q2 Game Operations Network Performance Scorecard', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Operations', updatedAt: '2026-05-18T10:00:00Z', source: 'AlloyDB', description: 'Real-time performance latency, active server tick ratios, and matchmaking queue performance derived from live server pools.' },
          { id: 'revenue-strategy', title: 'Snowflake Strategic In-Game Monetization Strategy', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Finance', updatedAt: '2026-05-19T08:00:00Z', source: 'Snowflake', description: 'LTV cohort growth targets, store category parameters, and in-app purchase price elasticities.' },
          { id: 's3-telemetry', title: 'AWS S3 Play Telemetry Archives & Audits', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Logistics', updatedAt: '2026-05-17T15:00:00Z', source: 'AWS S3', description: 'Legacy historical play logs, old build game resources, and cold storage matchmaking records.' },
          { id: 'looker-dashboards', title: 'Semantic Looker Cohort Model Definitions', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', category: 'Governance', updatedAt: '2026-05-18T09:00:00Z', source: 'Looker', description: 'Standard metric dimensions (DAU, ARPU, LTV) definitions and schema mappings for Jingle executive reporting.' }
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchAssets();
  }, []);
  
  const queryText = search.toLowerCase();
  const filteredAssets = assets.filter(a => 
    a.title.toLowerCase().includes(queryText) || 
    a.category.toLowerCase().includes(queryText) ||
    a.source?.toLowerCase().includes(queryText) ||
    a.description?.toLowerCase().includes(queryText)
  );

  const suggestions = [
    "GDPR Privacy",
    "Monetization Strategy",
    "Performance Scorecard",
    "S3 Telemetry",
    "Model Definitions"
  ];

  const ruleExamples = [
    "Whales in Japan get max 80% discount on Frost Giant Shield Pack",
    "Dolphin tier players get max 50% discount on Starter Pack Gold",
    "Restricted churn guardrail policy for APAC regional players",
  ];

  // Call /api/catalog/rules/discover to generate BigQuery policy rules without writing SQL
  const handleDiscoverRule = async () => {
    if (!plainRuleText.trim()) return;
    setIsDiscovering(true);

    try {
      const res = await fetch("/api/catalog/rules/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_text: plainRuleText }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.rule) {
          setDiscoveredRules(prev => [data.rule, ...prev]);
        }
      }
    } catch (err) {
      console.warn("Rule discovery API error, creating local compilation fallback:", err);
      const isWhale = plainRuleText.toLowerCase().includes("whale");
      const is80 = plainRuleText.includes("80%");

      const fallbackRule: DiscoveredRule = {
        rule_id: `rule_discovered_${Date.now()}`,
        input_text: plainRuleText,
        dataplex_aspect_type: "liveops_campaign_policy_aspect",
        generated_aspect_schema: {
          name: "projects/omniarcade-demo/locations/us-central1/aspectTypes/liveops_campaign_policy_aspect",
          fields: {
            player_tier: isWhale ? "Whale" : "All",
            max_discount_pct: is80 ? 80 : 50,
            target_sku: "frost_giant_shield_pack",
            guardrail_boundary_status: "ACTIVE_VERIFIED",
          },
        },
        generated_bigquery_policy_sql: `CREATE OR REPLACE ROW ACCESS POLICY liveops_churn_guardrail_policy\nON \`omniarcade-demo.omniarcade_gold.gold_player_360\`\nGRANT TO ("group:liveops-managers@google.com")\nFILTER USING (spend_tier = '${isWhale ? "Whale" : "All"}' AND churn_risk_score >= 0.50);`,
        status: "DISCOVERED_AND_COMPILED",
        created_at: new Date().toISOString(),
      };
      setDiscoveredRules(prev => [fallbackRule, ...prev]);
    } finally {
      setIsDiscovering(false);
    }
  };

  if (selectedAsset) {
    return (
      <div className="flex-1 bg-white p-12 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => setSelectedAsset(null)}
            className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest mb-10 hover:gap-4 transition-all cursor-pointer"
          >
            <ArrowRight className="rotate-180 w-4 h-4" /> Back to Search Results
          </button>
          
          <div className="space-y-12 pb-20">
            <header className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold uppercase tracking-widest">{selectedAsset.category}</span>
                <span className="text-xs text-slate-400 font-medium">Jingle Games DNS • {selectedAsset.source || "Validated"}</span>
              </div>
              <h1 className="text-4xl font-bold text-slate-800 tracking-tight">{selectedAsset.title}</h1>
              <p className="text-xl text-slate-500 font-light leading-relaxed">
                {selectedAsset.description || "This game governance asset provides directive guidance for Jingle Games operations."}
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-slate-100">
               <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Steward</p>
                  <p className="text-sm font-bold text-slate-700">Analytics AI</p>
               </div>
               <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Last Update</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {new Date(selectedAsset.updatedAt).toLocaleDateString()}
                  </div>
               </div>
               <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Integrity Status</p>
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    GDPR Compliant
                  </div>
               </div>
            </div>

            <div className="space-y-8">
               <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Institutional Overview</h3>
                  <button className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest cursor-pointer">
                    Request Edit Access <ArrowRight className="w-3 h-3" />
                  </button>
               </div>
               
               <div className="aspect-[16/10] bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-center overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="w-24 h-24 bg-white rounded-full shadow-2xl flex items-center justify-center mb-8 mx-auto">
                       <FileText className="w-10 h-10 text-blue-600" />
                    </div>
                    <h4 className="text-2xl font-bold text-slate-800 mb-4">Official PDF Preview Restricted</h4>
                    <p className="text-slate-500 max-w-sm mx-auto font-light leading-relaxed mb-10">
                      As per Jingle Games Player PII Masking Policy, full document viewing is logged. Click below to generate an authorized PDF download.
                    </p>
                    <button 
                      onClick={() => window.open('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '_blank')}
                      className="group relative px-10 py-5 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] shadow-2xl shadow-black/10 hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 mx-auto cursor-pointer"
                    >
                      Generate Authorized PDF <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white flex flex-col font-sans">
      {/* Top Header & Tab Navigation Bar */}
      <div className="bg-slate-900 text-white p-6 border-b border-slate-800 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-400 block mb-1">
              Dataplex Knowledge Catalog
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Governance & Automatic Rule Discovery
            </h1>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-2xl border border-slate-700">
            <button
              onClick={() => setActiveTab("search")}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === "search"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Search className="w-4 h-4" /> Search Assets
            </button>
            <button
              onClick={() => setActiveTab("sandbox")}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === "sandbox"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Sparkles className="w-4 h-4 text-amber-300" /> Automatic Rule Discovery
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: Search Telemetry Assets */}
      {activeTab === "search" && (
        <div className="flex-1 flex flex-col">
          <div className={cn(
            "transition-all duration-700 ease-in-out flex flex-col items-center justify-center p-8",
            search ? "pt-12 pb-8 border-b border-slate-50" : "flex-1"
          )}>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl space-y-8"
            >
              {!search && (
                <div className="text-center space-y-4">
                  <div className="flex justify-center gap-3 mb-6">
                    <Globe className="w-10 h-10 text-blue-600 animate-pulse" />
                    <Database className="w-10 h-10 text-indigo-600" />
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-slate-900 font-sans">
                    Telemetry Knowledge Catalog
                  </h1>
                  <p className="text-slate-500 font-light max-w-md mx-auto">
                    Explore the Jingle Games Digital Nervous System. Search across AWS telemetry, Snowflake monetization, and Dataplex aspect entries.
                  </p>
                </div>
              )}

              <div className="relative group">
                <div className={cn(
                  "absolute inset-0 bg-blue-500/10 blur-2xl rounded-3xl transition-opacity duration-500",
                  isFocused ? "opacity-100" : "opacity-0"
                )} />
                <div className="relative flex items-center bg-white border-2 border-slate-100 rounded-3xl shadow-xl shadow-black/5 hover:border-blue-200 transition-all focus-within:border-blue-500 overflow-hidden">
                  <Search className="w-6 h-6 ml-6 text-slate-400" />
                  <input 
                    type="text"
                    value={search}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search assets, policies, or Dataplex aspects..."
                    className="w-full py-6 px-4 text-lg outline-none placeholder:text-slate-300 font-medium"
                  />
                  <div className="flex items-center gap-2 pr-4">
                    {search && (
                      <button 
                        onClick={() => setSearch("")}
                        className="px-3 py-1 bg-slate-100 rounded-xl text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-blue-600 transition-all cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {!search && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {suggestions.map(s => (
                      <button 
                        key={s}
                        onClick={() => setSearch(s)}
                        className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-center gap-8 pt-8 opacity-40">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">GDPR Secure</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">COPPA Guarded</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Results Section */}
          {search && (
            <div className="flex-1 bg-slate-50/50 p-8 md:p-12 overflow-y-auto">
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {loading ? "Syncing Jingle Knowledge..." : `Found ${filteredAssets.length} matching definitions`}
                  </span>
                  <button 
                    onClick={() => setSearch("")}
                    className="text-[10px] font-bold text-slate-400 hover:text-blue-600 flex items-center gap-2 uppercase tracking-widest cursor-pointer"
                  >
                    <ArrowRight className="rotate-180 w-3 h-3" /> Back to Catalog
                  </button>
                </div>

                <div className="space-y-6">
                  {loading ? (
                    <div className="flex justify-center p-20">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <AnimatePresence>
                      {filteredAssets.length > 0 ? (
                        filteredAssets.map((asset, i) => (
                          <motion.div
                            key={asset.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => setSelectedAsset(asset)}
                            className="group p-8 bg-white border border-slate-100 rounded-3xl hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-500/5 transition-all cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-6">
                              <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter",
                                    asset.category === "Compliance" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                    asset.category === "Operations" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                    "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                  )}>
                                    {asset.category}
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {asset.source || "Jingle Games Verified"}
                                  </span>
                                </div>
                                
                                <div>
                                  <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">
                                    {asset.title}
                                  </h3>
                                  <p className="text-sm text-slate-500 font-light leading-relaxed">
                                    {asset.description || "Managed telemetry asset synchronized with the Jingle Games governance database."}
                                  </p>
                                </div>
                              </div>

                              <div className="hidden lg:block w-48 shrink-0 space-y-4 border-l border-slate-50 pl-6">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Last Sync</span>
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <Clock className="w-3 h-3" />
                                    {new Date(asset.updatedAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="w-full mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest group-hover:bg-blue-600 transition-all">
                                  Open Asset <ChevronRight className="w-3 h-3" />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                          <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                          <h3 className="text-lg font-bold text-slate-800">No matching assets found</h3>
                          <p className="text-sm text-slate-400 max-w-xs mx-auto mt-2">Try searching for GDPR, Monetization, or Performance.</p>
                        </div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Automatic Rule Discovery Sandbox */}
      {activeTab === "sandbox" && (
        <div className="flex-1 bg-slate-50/50 p-6 md:p-10 overflow-y-auto space-y-8">
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* Plain Text Rule Input Card */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl shadow-slate-200/50 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Executive Policy Rule Input</h2>
                    <p className="text-xs text-slate-500 font-light">
                      Type or paste natural language business rules. Dataplex & Vertex AI generate BigQuery policies automatically.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold uppercase">
                  No SQL Required
                </span>
              </div>

              {/* Textarea Input */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Plain-Text Governance Policy Rule:
                </label>
                <textarea
                  value={plainRuleText}
                  onChange={e => setPlainRuleText(e.target.value)}
                  rows={3}
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
                  placeholder="e.g. Whales in Japan get max 80% discount on Frost Giant Shield Pack"
                />

                {/* Example Quick Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Examples:</span>
                  {ruleExamples.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setPlainRuleText(ex)}
                      className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                    >
                      "{ex.substring(0, 45)}..."
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleDiscoverRule}
                  disabled={isDiscovering || !plainRuleText.trim()}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 flex items-center gap-3 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDiscovering ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Discovering & Compiling Policy...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" /> Discover & Generate Policy Table
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Generated BigQuery Policy Rules Table */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl shadow-slate-200/50 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <Table className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">Generated BigQuery Policy Rules Table</h3>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  Total Discovered Policies: {discoveredRules.length}
                </span>
              </div>

              {/* Table Render */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-50/80">
                      <th className="py-3 px-4 rounded-tl-xl">Rule ID</th>
                      <th className="py-3 px-4">Input Text Rule</th>
                      <th className="py-3 px-4">Dataplex Aspect</th>
                      <th className="py-3 px-4">Player Tier</th>
                      <th className="py-3 px-4">Max Discount</th>
                      <th className="py-3 px-4">Target SKU</th>
                      <th className="py-3 px-4 rounded-tr-xl">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {discoveredRules.map((rule) => (
                      <tr key={rule.rule_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-blue-600">{rule.rule_id}</td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-700 max-w-xs truncate">
                          "{rule.input_text}"
                        </td>
                        <td className="py-3 px-4 text-slate-600">{rule.dataplex_aspect_type}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-bold">
                            {rule.generated_aspect_schema.fields.player_tier}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-amber-600">
                          {rule.generated_aspect_schema.fields.max_discount_pct}%
                        </td>
                        <td className="py-3 px-4 text-purple-600 font-bold">
                          {rule.generated_aspect_schema.fields.target_sku}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold text-[9px] flex items-center gap-1 w-max">
                            <CheckCircle2 className="w-3 h-3" /> VERIFIED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Generated BigQuery Policy SQL Code Block */}
            {discoveredRules.length > 0 && (
              <div className="bg-slate-900 text-slate-100 rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Generated BigQuery Row Access Policy SQL (Compiled)
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                    BigQuery RLS Active
                  </span>
                </div>

                <pre className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed">
                  <code>{discoveredRules[0].generated_bigquery_policy_sql}</code>
                </pre>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
