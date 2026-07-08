import React, { createContext, useContext, useState } from 'react';
import { Section } from '../App';

export interface ChurnEventData {
  playerId: string;
  churnProbability: number;
  payerTier: string;
  recommendedOffer: string;
  timestamp: string;
}

export interface DifficultyAnomalyData {
  levelId: number;
  failureRate: number;
  currentMoves: number;
  recommendedMoves: number;
}

interface DemoEventContextType {
  activeSection: Section;
  setActiveSection: (section: Section | { id: Section; search?: string }) => void;
  
  // Cross-section state
  latestChurnEvent: ChurnEventData | null;
  latestDifficultyAnomaly: DifficultyAnomalyData | null;
  activeGuardrailPolicy: string | null;

  // Cross-section triggers
  triggerMarketingRecovery: (data: ChurnEventData) => void;
  triggerDifficultySolver: (data: DifficultyAnomalyData) => void;
  applyPolicyToGuardrail: (policySql: string) => void;
}

const DemoEventContext = createContext<DemoEventContextType | undefined>(undefined);

export function DemoEventProvider({
  children,
  activeSection,
  setActiveSection,
}: {
  children: React.ReactNode;
  activeSection: Section;
  setActiveSection: (section: Section | { id: Section; search?: string }) => void;
}) {
  const [latestChurnEvent, setLatestChurnEvent] = useState<ChurnEventData | null>(null);
  const [latestDifficultyAnomaly, setLatestDifficultyAnomaly] = useState<DifficultyAnomalyData | null>(null);
  const [activeGuardrailPolicy, setActiveGuardrailPolicy] = useState<string | null>(null);

  const triggerMarketingRecovery = (data: ChurnEventData) => {
    setLatestChurnEvent(data);
    setActiveSection('campaigns');
  };

  const triggerDifficultySolver = (data: DifficultyAnomalyData) => {
    setLatestDifficultyAnomaly(data);
    setActiveSection('difficulty-balancer');
  };

  const applyPolicyToGuardrail = (policySql: string) => {
    setActiveGuardrailPolicy(policySql);
    setActiveSection('guardrail');
  };

  return (
    <DemoEventContext.Provider
      value={{
        activeSection,
        setActiveSection,
        latestChurnEvent,
        latestDifficultyAnomaly,
        activeGuardrailPolicy,
        triggerMarketingRecovery,
        triggerDifficultySolver,
        applyPolicyToGuardrail,
      }}
    >
      {children}
    </DemoEventContext.Provider>
  );
}

export function useDemoEvent() {
  const context = useContext(DemoEventContext);
  if (!context) {
    throw new Error('useDemoEvent must be used within a DemoEventProvider');
  }
  return context;
}
