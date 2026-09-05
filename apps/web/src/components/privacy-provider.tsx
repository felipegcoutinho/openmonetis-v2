"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

type PrivacyContextValue = {
  isPrivacyModeEnabled: boolean;
  setPrivacyModeEnabled: (enabled: boolean) => void;
  togglePrivacyMode: () => void;
};

const PrivacyContext = createContext<PrivacyContextValue | undefined>(undefined);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivacyModeEnabled, setPrivacyModeEnabled] = useState(false);

  const togglePrivacyMode = useCallback(() => {
    setPrivacyModeEnabled((enabled) => !enabled);
  }, []);

  const value = useMemo(
    () => ({ isPrivacyModeEnabled, setPrivacyModeEnabled, togglePrivacyMode }),
    [isPrivacyModeEnabled, togglePrivacyMode],
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacyMode() {
  const context = useContext(PrivacyContext);

  if (!context) {
    throw new Error("usePrivacyMode must be used within a PrivacyProvider");
  }

  return context;
}
