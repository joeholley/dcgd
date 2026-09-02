import React, { createContext, useContext, useState, useEffect } from 'react';

export interface PublisherConfig {
  publisherName: string;
  publisherSlug: string;
  publisherInitial: string;
  projectId?: string;
  location?: string;
}

interface PublisherContextType extends PublisherConfig {
  formatText: (text: string) => string;
}

const DEFAULT_PUBLISHER: PublisherConfig = {
  publisherName: "Jingle Games",
  publisherSlug: "jingle",
  publisherInitial: "J",
  projectId: "datacloudgamesdemo006",
};

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<PublisherConfig>;
  }
}

function getInitialConfig(): PublisherConfig {
  if (typeof window !== 'undefined' && window.__APP_CONFIG__ && window.__APP_CONFIG__.publisherName) {
    const name = window.__APP_CONFIG__.publisherName.trim();
    const slug = window.__APP_CONFIG__.publisherSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'jingle';
    const initial = window.__APP_CONFIG__.publisherInitial || name.charAt(0).toUpperCase() || 'J';
    return {
      publisherName: name,
      publisherSlug: slug,
      publisherInitial: initial,
      projectId: window.__APP_CONFIG__.projectId || DEFAULT_PUBLISHER.projectId,
      location: window.__APP_CONFIG__.location,
    };
  }
  return DEFAULT_PUBLISHER;
}

const PublisherContext = createContext<PublisherContextType | undefined>(undefined);

export function PublisherProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PublisherConfig>(getInitialConfig);

  useEffect(() => {
    // If window.__APP_CONFIG__ was not pre-injected (e.g., local Vite dev), fetch from Express
    if (typeof window !== 'undefined' && (!window.__APP_CONFIG__ || !window.__APP_CONFIG__.publisherName)) {
      fetch('/api/app-config')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: Partial<PublisherConfig> | null) => {
          if (data && data.publisherName) {
            const name = data.publisherName.trim();
            const slug = data.publisherSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'jingle';
            const initial = data.publisherInitial || name.charAt(0).toUpperCase() || 'J';
            setConfig({
              publisherName: name,
              publisherSlug: slug,
              publisherInitial: initial,
              projectId: data.projectId || DEFAULT_PUBLISHER.projectId,
              location: data.location,
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  const formatText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/Jingle Games/g, config.publisherName)
      .replace(/Jingle/g, config.publisherName.replace(/\s+(Games|Studios|Interactive|Entertainment)$/i, '') || config.publisherName);
  };

  return (
    <PublisherContext.Provider
      value={{
        ...config,
        formatText,
      }}
    >
      {children}
    </PublisherContext.Provider>
  );
}

export function usePublisher(): PublisherContextType {
  const ctx = useContext(PublisherContext);
  if (!ctx) {
    return {
      ...DEFAULT_PUBLISHER,
      formatText: (t: string) => t,
    };
  }
  return ctx;
}
