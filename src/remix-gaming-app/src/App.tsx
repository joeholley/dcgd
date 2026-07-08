import { useState } from "react";
import { Layout } from "./components/Layout";
import { Overview } from "./components/sections/Overview";
import { GamingAssistant } from "./components/sections/GamingAssistant";
import { KnowledgeCatalog } from "./components/sections/KnowledgeCatalog";
import { ITObservatory } from "./components/sections/ITObservatory";
import { AgenticWorkflows } from "./components/sections/AgenticWorkflows";
import { Operations } from "./components/sections/Operations";
import { CampaignEngine, Country, LanguageSetting } from "./components/sections/CampaignEngine";
import { LiveOpsGuardrail } from "./components/sections/LiveOpsGuardrail";
import { GCPHealth } from "./components/sections/GCPHealth";
import { Diagnostics } from "./components/sections/Diagnostics";
import { FlaskSection } from "./components/sections/FlaskSection";
import { DemoEventProvider } from "./context/DemoEventContext";

export type Section = 
  | "overview" 
  | "operations" 
  | "executive-portfolio"
  | "catalog" 
  | "guardrail" 
  | "campaigns" 
  | "difficulty-balancer"
  | "marketing-swarm"
  | "workflows" 
  | "agent-comparison"
  | "lineage-graph"
  | "observatory" 
  | "toxicity"
  | "gcp-health" 
  | "diagnostics";

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [initialCatalogSearch, setInitialCatalogSearch] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Global Localization States shared across application layout
  const [country, setCountry] = useState<Country>("Japan");
  const [languageSetting, setLanguageSetting] = useState<LanguageSetting>("en");

  const handleSectionChange = (target: Section | { id: Section; search?: string }) => {
    if (typeof target === "string") {
      setActiveSection(target);
      if (target !== "catalog") setInitialCatalogSearch("");
    } else {
      setActiveSection(target.id);
      if (target.id === "catalog" && target.search) {
        setInitialCatalogSearch(target.search);
      }
    }
  };

  return (
    <DemoEventProvider activeSection={activeSection} setActiveSection={handleSectionChange}>
      <div className="relative h-screen bg-[#F8FAFC] overflow-hidden">
        <Layout 
          activeSection={activeSection} 
          onSectionChange={handleSectionChange}
          country={country}
          setCountry={setCountry}
          languageSetting={languageSetting}
          setLanguageSetting={setLanguageSetting}
        >
          {/* Executive & Analytics */}
          {activeSection === "overview" && (
            <Overview 
              onSectionChange={handleSectionChange} 
              country={country}
              languageSetting={languageSetting}
            />
          )}
          {activeSection === "operations" && <Operations />}
          {activeSection === "executive-portfolio" && (
            <FlaskSection 
              title="Executive Portfolio & KPIs"
              subtitle="C-Suite Executive Dashboard & Player Lifetime Value Analytics"
              path="/executive.html"
              dataMode="hybrid"
              dataBank="omniarcade_gold.gold_player_360"
              description="Executive view of high-value players (whales/dolphins), churn risks, and regional ARPU/DAU."
            />
          )}
          {activeSection === "catalog" && <KnowledgeCatalog initialSearch={initialCatalogSearch} />}

          {/* LiveOps & Automation */}
          {activeSection === "guardrail" && <LiveOpsGuardrail />}
          {activeSection === "campaigns" && (
            <CampaignEngine 
              country={country}
              setCountry={setCountry}
              languageSetting={languageSetting}
              setLanguageSetting={setLanguageSetting}
            />
          )}
          {activeSection === "difficulty-balancer" && (
            <FlaskSection 
              title="Game Difficulty Balancer"
              subtitle="Level Bottleneck Analysis & Match-3 Move Optimization Solver"
              path="/difficulty.html"
              dataMode="mock"
              dataBank="Internal Dev Simulation (Flask :5000)"
              description="Analyzes Level 2 completion drop-offs and calculates recommended extra moves to optimize player retention."
            />
          )}
          {activeSection === "marketing-swarm" && (
            <FlaskSection 
              title="Marketing Recovery Agent Swarm"
              subtitle="Autonomous Multi-Agent Cluster for At-Risk Player Recovery"
              path="/marketing_swarm_visualizer.html"
              dataMode="mock"
              dataBank="Internal Dev Simulation (Flask :5000)"
              description="Visualizes autonomous agent collaboration to target high-churn whales with custom promotional offers."
            />
          )}

          {/* Agent & AI Workspace */}
          {activeSection === "workflows" && <AgenticWorkflows />}
          {activeSection === "agent-comparison" && (
            <FlaskSection 
              title="Agent Comparison Workspace"
              subtitle="KC-Guided vs Non-KC AI Gameplay Agent Trajectory Comparison"
              path="/agent-comparison"
              dataMode="hybrid"
              dataBank="Vertex AI Reasoning Engine + Dev Trace Stream"
              description="Side-by-side execution trace comparing Dataplex Knowledge Catalog guided agents against raw LLM agents."
            />
          )}
          {activeSection === "lineage-graph" && (
            <FlaskSection 
              title="Cross-Cloud Data Lineage"
              subtitle="Dataplex End-to-End Data Lineage & Asset Governance Graph"
              path="/graph_visualization.html"
              dataMode="hybrid"
              dataBank="Dataplex Lineage API + Dev Fallback"
              description="Interactive graph showing raw telemetry ingestion to gold analytical tables and BQML churn prediction model."
            />
          )}

          {/* Observability & Diagnostics */}
          {activeSection === "observatory" && <ITObservatory />}
          {activeSection === "toxicity" && (
            <FlaskSection 
              title="Trust & Safety Observatory"
              subtitle="Toxic Chat Detection, Anti-Cheat, & GIRA Incident Assessment"
              path="/toxicity.html"
              dataMode="mock"
              dataBank="Internal Toxicity Incident Simulator (Flask :5000)"
              description="Real-time toxic chat moderation stream, player ban execution, and automated safety incident reporting."
            />
          )}
          {activeSection === "gcp-health" && <GCPHealth />}
          {activeSection === "diagnostics" && <Diagnostics />}
        </Layout>

        {/* Persistent PineCore AI Assistant */}
        <GamingAssistant isOpen={assistantOpen} onToggle={() => setAssistantOpen(!assistantOpen)} />
      </div>
    </DemoEventProvider>
  );
}
