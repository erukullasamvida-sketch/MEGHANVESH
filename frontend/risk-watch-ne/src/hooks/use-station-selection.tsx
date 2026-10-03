import { createContext, useContext, useState, type ReactNode } from "react";

type StationSelectionContextValue = {
  selectedStationId: string | null;
  selectStation: (stationId: string | null) => void;
};

const StationSelectionContext = createContext<StationSelectionContextValue | null>(null);

export function StationSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  return (
    <StationSelectionContext.Provider
      value={{ selectedStationId, selectStation: setSelectedStationId }}
    >
      {children}
    </StationSelectionContext.Provider>
  );
}

export function useStationSelection() {
  const context = useContext(StationSelectionContext);
  if (!context) {
    throw new Error("useStationSelection must be used within StationSelectionProvider");
  }
  return context;
}