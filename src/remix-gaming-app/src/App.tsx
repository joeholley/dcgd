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

export type Section = "overview" | "operations" | "workflows" | "catalog" | "observatory" | "campaigns" | "guardrail" | "gcp-health";

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
    <div className="relative h-screen bg-[#F8FAFC] overflow-hidden">
      <Layout 
        activeSection={activeSection} 
        onSectionChange={handleSectionChange}
        country={country}
        setCountry={setCountry}
        languageSetting={languageSetting}
        setLanguageSetting={setLanguageSetting}
      >
        {activeSection === "overview" && (
          <Overview 
            onSectionChange={handleSectionChange} 
            country={country}
            languageSetting={languageSetting}
          />
        )}
        {activeSection === "operations" && <Operations />}
        {activeSection === "workflows" && <AgenticWorkflows />}
        {activeSection === "guardrail" && <LiveOpsGuardrail />}
        {activeSection === "catalog" && <KnowledgeCatalog initialSearch={initialCatalogSearch} />}
        {activeSection === "observatory" && <ITObservatory />}
        {activeSection === "gcp-health" && <GCPHealth />}
        {activeSection === "campaigns" && (
          <CampaignEngine 
            country={country}
            setCountry={setCountry}
            languageSetting={languageSetting}
            setLanguageSetting={setLanguageSetting}
          />
        )}
      </Layout>

      {/* Persistent PineCore AI Assistant */}
      <GamingAssistant isOpen={assistantOpen} onToggle={() => setAssistantOpen(!assistantOpen)} />
    </div>
  );
}
