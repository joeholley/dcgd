# **Operational Dashboard Alignment - Engineering Task List**

This document plans out the updates required to synchronize the operational dashboard views and navigation controls with the recent telemetry simulator enhancements described in [Telemetry Simulator - Engineering Task List.md](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/docs/Telemetry%20Simulator%20-%20Engineering%20Task%20List.md).

---

## **1. Header & Navigation Synchronization**
*Apply these changes to the global application wrapper [Layout.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/Layout.tsx).*

- [ ] **Subscribe to Global Simulator State**: Subscribe to `onSimulatorStateUpdate` from the bridge to keep the local layout state synchronized with the selected cohort, peak CCU, active anomaly, and data routing mode in real-time.
- [ ] **Dynamic Cohort Visual Indicator**: Add a cohort indicator to the top status control bar displaying the currently active cohort name and its matching icon:
  - **Whale**: Crown icon (amber)
  - **Dolphin**: Sparkles icon (cyan)
  - **Minnow**: Fish icon (purple)
  - **F2P**: Coins / UserCheck icon (emerald)
- [ ] **Data Routing Theme Integration**: When the telemetry routing mode is set to `MOCKED`, apply the orange theme color (e.g., `border-orange-500/40` or orange status indicators) directly to the control bar container to highlight that simulated/mock data is active.
- [ ] **Synchronize Publisher Loop Running State**: Connect the "Simulator: ON/OFF" header button with the background telemetry publisher loop in the simulator tab (`OperatorSimulatorTab.tsx`), so toggling either control updates `simulator.isRunning` and pauses/resumes the 1 Hz event emission globally.
- [ ] **Dropdown Anomaly Disabling**: Update the header anomaly select dropdown to disable the `level_2_bottleneck` and `toxic_chat` options, marking them as `Not Yet Implemented` to match the control stubs in the simulator.
- [ ] **Align Concurrency Terminology**: Rename references to "CCU" to "Simulated Global PCCU" to maintain vocabulary synchronization.

---

## **2. Operational Guardrail Mock Alignment**
*Apply these changes to the LiveOps Guardrail Observatory page [LiveOpsGuardrail.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/LiveOpsGuardrail.tsx).*

- [ ] **Rebrand RPG Client Title**: Update the left panel title from `Game Client Simulator (Cosmic Raider RPG)` to `Mock Game Client (Realm of Eldoria RPG)` to reflect the fantasy rebranding.
- [ ] **Rebrand Encounter Level**: Change the level indicator from `⚔️ Level 85 Raid Encounter` to `Tutorial Level 8 of 10` (or `Eldoria Tutorial Level 8`).
- [ ] **Dynamic Player Profile Synchronization**: Replace the hardcoded `cosmic_whale_42` Whale profile in the HUD with a dynamic profile lookup linked to `simState.selectedCohort`. When a dolphin, minnow, or F2P cohort is active, display their respective mock names (e.g. `lucky_dolphin_17 (Dolphin Tier)`) instead of the whale profile.

---

## **3. Global Terminology & Code Unification**
*Scan and align the broader codebase to ensure consistent branding and metrics.*

- [ ] **Unify Game Name References**: Update hardcoded occurrences of `Cosmic Raider RPG` to `Realm of Eldoria RPG` in the following files:
  - [Operations.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/Operations.tsx) (inside `GAME_METRICS` and conversion alerts)
  - [AgenticWorkflows.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/AgenticWorkflows.tsx)
  - [CampaignEngine.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/CampaignEngine.tsx)
  - [GamingAssistant.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/GamingAssistant.tsx)
- [ ] **Sync Log Outgoing Telemetry Text**: Modify the outgoing log tag format in [SimulatorTelemetryLog.tsx](file:///usr/local/google/home/joeholley/Documents/repos/git/github.com/joeholley/dcgd/src/remix-gaming-app/src/components/sections/SimulatorTelemetryLog.tsx#L215) to say `Outgoing -> BroadcastChannel` instead of `[MOCKED] OUTGOING -> BroadcastChannel` for a cleaner interface.
- [ ] **Concurrency Scale Check**: Confirm that all sliders and displays supporting the PCCU metric are scaled to a maximum of `1,000,000` (with steps of `10,000`).
