Listed directory remix-gaming-app
Listed directory src
Searched for files: *
Viewed package.json:1-42
Viewed README.md:1-21
Viewed server.ts:1-77
Viewed App.tsx:1-70
Viewed firebase.ts:1-24
Viewed Layout.tsx:1-230
Viewed utils.ts:1-7
Viewed firebase-blueprint.json:1-58

Here is an overview of the codebase and a breakdown of how it is structured and organized.

---

### 🌐 High-Level Overview

This repository contains **"Jingle Games - Player 360 Platform"**, a full-stack executive analytics and operations management web app built with **React 19, TypeScript, Vite, Tailwind CSS v4, and Express**. 

The platform connects cross-cloud telemetry (e.g., Snowflake, AlloyDB, BigQuery, AWS S3) into an executive administration dashboard. Key features include:

* **Regional & Language Localization**: Real-time region switching (Japan 🇯🇵, Korea 🇰🇷, China 🇨🇳) and language toggles (English vs. Localized).
* **Game Performance & Telemetry**: Dynamic charting of active users, server health, latency, and unit economics using Recharts.
* **AI Campaign Engine**: Creation and budget optimization of targeted player marketing campaigns backed by Firestore.
* **PineCore AI Assistant**: A persistent floating Gemini chatbot powered by `@google/genai` (`gemini-3-flash-preview`) integrated via the Express backend server.

---

### 📂 Directory Breakdown & Code Structure

```
├── server.ts                    # Express backend & Gemini API integration
├── firebase-blueprint.json      # Firestore entity schemas (Campaigns, Reports)
├── firestore.rules              # Security rules for Firestore collections
├── package.json                 # Dependencies & build scripts
├── vite.config.ts               # Vite build configuration
└── src/                         # Frontend React Source Code
    ├── main.tsx                 # React entry point
    ├── App.tsx                  # Core router state & global layout manager
    ├── index.css                # Global CSS styling & Tailwind directives
    ├── lib/
    │   └── utils.ts             # Tailwind class merging utility (`cn`)
    ├── services/
    │   └── firebase.ts          # Firebase/Firestore client initialization
    └── components/              # UI Components
        ├── Layout.tsx           # Global header, nav sidebar & region selectors
        └── sections/            # Feature Dashboard Sections
            ├── Overview.tsx           # Executive KPIs & database lineage
            ├── Operations.tsx         # Game performance & server latency
            ├── AgenticWorkflows.tsx   # Automated gameplay agent controls
            ├── CampaignEngine.tsx     # Player marketing campaign builder
            ├── KnowledgeCatalog.tsx   # Telemetry & dataset catalog search
            ├── ITObservatory.tsx      # API metrics & observatory monitoring
            └── HospitalAdmin.tsx      # Floating Gemini AI assistant drawer
```

---

### 🧱 Detailed Component Breakdown

#### 1. Backend & Configuration
* [server.ts](../../src/remix-gaming-app/server.ts): Launches an Express server that hosts Vite middleware during development and serves `/api/chat` requests using Google's `@google/genai` SDK.
* [firebase-applet-config.json.example](../../src/remix-gaming-app/firebase-applet-config.json.example): Sample Firebase Web App configuration template. Copy to `firebase-applet-config.json` and supply your Firebase project credentials.
* [firebase-blueprint.json](../../src/remix-gaming-app/firebase-blueprint.json) & [firestore.rules](../../src/remix-gaming-app/firestore.rules): Defines data schemas for `Report` and `Campaign` collections along with read/write access permissions.
* [package.json](../../src/remix-gaming-app/package.json): Managed dependencies include `@google/genai`, `firebase`, `lucide-react`, `motion`, `recharts`, and `@tailwindcss/vite`.

#### 2. App State & Layout (`src/`)
* [App.tsx](../../src/remix-gaming-app/src/App.tsx): Manages the active view state (`overview`, `operations`, `workflows`, `catalog`, `observatory`, `campaigns`), global region/language state (`country`, `languageSetting`), and controls the open state of the floating Gemini assistant drawer.
* [Layout.tsx](../../src/remix-gaming-app/src/components/Layout.tsx): Renders the top navigation bar (containing region and language selection controls), the side navigation panel, and unit economics footer metrics.
* [firebase.ts](../../src/remix-gaming-app/src/services/firebase.ts): Connects to Firebase/Firestore with fallback long-polling enabled and tests connection status.

#### 3. Dashboard Sections (`src/components/sections/`)
* [Overview.tsx](../../src/remix-gaming-app/src/components/sections/Overview.tsx): High-level overview displaying active regional player counts, revenue metrics, and data pipeline source cards.
* [Operations.tsx](../../src/remix-gaming-app/src/components/sections/Operations.tsx): Detailed operational metrics like frame rates, server region capacity, and concurrent sessions.
* [AgenticWorkflows.tsx](../../src/remix-gaming-app/src/components/sections/AgenticWorkflows.tsx): Autonomous game-agent controls and bot execution workflows.
* [CampaignEngine.tsx](../../src/remix-gaming-app/src/components/sections/CampaignEngine.tsx): Target player cohort campaign manager equipped with localized messaging templates and AI budget reallocation logic.
* [KnowledgeCatalog.tsx](../../src/remix-gaming-app/src/components/sections/KnowledgeCatalog.tsx): Catalog search for cross-cloud datasets (BigQuery, Snowflake, AlloyDB, S3).
* [ITObservatory.tsx](../../src/remix-gaming-app/src/components/sections/ITObservatory.tsx): Real-time API throughput monitoring, status distribution, and response time charts.
* [HospitalAdmin.tsx](../../src/remix-gaming-app/src/components/sections/HospitalAdmin.tsx): Floating widget interface connecting to `/api/chat` to provide AI-assisted insights on demand.