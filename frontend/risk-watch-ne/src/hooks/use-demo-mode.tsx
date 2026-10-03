import { createContext, useContext, useState, type ReactNode } from "react";

import type { DemoScenario } from "@/lib/demo-anomaly";

type DemoModeContextValue = {
  demoActive: boolean;
  demoStationId: string;
  demoScenario: DemoScenario;
  demoStartedAt: string;
  startDemo: () => void;
  setDemoStationId: (stationId: string) => void;
  setDemoScenario: (scenario: DemoScenario) => void;
  resetDemo: () => void;
};

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [demoActive, setDemoActive] = useState(false);
  const [demoStationId, setDemoStationId] = useState("AWS-ASSAM-001");
  const [demoScenario, setDemoScenario] = useState<DemoScenario>("NORMAL");
  const [demoStartedAt, setDemoStartedAt] = useState(() => new Date().toISOString());

  function startDemo() {
    setDemoStartedAt(new Date().toISOString());
    setDemoActive(true);
  }

  function chooseDemoScenario(scenario: DemoScenario) {
    setDemoScenario(scenario);
    setDemoStartedAt(new Date().toISOString());
  }

  function resetDemo() {
    setDemoActive(false);
    setDemoStationId("AWS-ASSAM-001");
    setDemoScenario("NORMAL");
    setDemoStartedAt(new Date().toISOString());
  }

  return (
    <DemoModeContext.Provider
      value={{
        demoActive,
        demoStationId,
        demoScenario,
        demoStartedAt,
        startDemo,
        setDemoStationId,
        setDemoScenario: chooseDemoScenario,
        resetDemo,
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const demoMode = useContext(DemoModeContext);

  if (!demoMode) {
    throw new Error("useDemoMode must be used within DemoModeProvider");
  }

  return demoMode;
}
