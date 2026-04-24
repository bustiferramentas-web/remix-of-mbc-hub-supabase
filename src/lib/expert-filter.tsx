import { createContext, useContext, useState, type ReactNode } from "react";

type Ctx = {
  expertId: string | null;
  setExpertId: (id: string | null) => void;
};

const ExpertFilterContext = createContext<Ctx>({ expertId: null, setExpertId: () => {} });

export function ExpertFilterProvider({ children }: { children: ReactNode }) {
  const [expertId, setExpertId] = useState<string | null>(null);
  return (
    <ExpertFilterContext.Provider value={{ expertId, setExpertId }}>
      {children}
    </ExpertFilterContext.Provider>
  );
}

export function useExpertFilter() {
  return useContext(ExpertFilterContext);
}

// Stable color/gradient assignment per expert based on name
const PALETTES = [
  {
    key: "gold",
    gradient: "linear-gradient(120deg, #FBF3DC 0%, #F0DFA8 55%, #C9BE95 100%)",
    accent: "#B69D66",
    chip: "bg-[#F0DFA8] text-[#5C4A1F]",
    dot: "#B69D66",
  },
  {
    key: "teal",
    gradient: "linear-gradient(120deg, #DCF1EE 0%, #A7D9D1 55%, #5EAFA3 100%)",
    accent: "#3F8F84",
    chip: "bg-[#A7D9D1] text-[#1F4A44]",
    dot: "#3F8F84",
  },
  {
    key: "indigo",
    gradient: "linear-gradient(120deg, #E0E7FF 0%, #A5B4FC 55%, #6366F1 100%)",
    accent: "#4F46E5",
    chip: "bg-[#C7D2FE] text-[#312E81]",
    dot: "#4F46E5",
  },
  {
    key: "rose",
    gradient: "linear-gradient(120deg, #FCE7F3 0%, #F9A8D4 55%, #EC4899 100%)",
    accent: "#DB2777",
    chip: "bg-[#FBCFE8] text-[#831843]",
    dot: "#DB2777",
  },
  {
    key: "emerald",
    gradient: "linear-gradient(120deg, #D1FAE5 0%, #6EE7B7 55%, #10B981 100%)",
    accent: "#059669",
    chip: "bg-[#A7F3D0] text-[#064E3B]",
    dot: "#059669",
  },
];

export function expertPalette(expertName: string) {
  // Charles -> gold, Jorge -> teal, others stable hash
  const n = expertName.toLowerCase();
  if (n.startsWith("charles")) return PALETTES[0];
  if (n.startsWith("jorge")) return PALETTES[1];
  let h = 0;
  for (let i = 0; i < expertName.length; i++) h = (h * 31 + expertName.charCodeAt(i)) >>> 0;
  return PALETTES[2 + (h % (PALETTES.length - 2))];
}
