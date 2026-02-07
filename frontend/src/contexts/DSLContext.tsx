import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { ParsedOperation } from "@/utils/dsl-parser";
import type { ComponentMapping } from "@/types/visualInteraction";
import type { ApiResponse } from "@/types";

interface DSLContextType {
  // Core DSL data
  formattedDSL: string | null;
  parsedDSL: ParsedOperation | null;
  componentMappings: ComponentMapping | null;

  // Actions
  setGenerationResult: (result: Partial<ApiResponse>) => void;
}

const DSLContext = createContext<DSLContextType | undefined>(undefined);

interface DSLProviderProps {
  children: ReactNode;
}

export function DSLProvider({ children }: DSLProviderProps) {
  const [formattedDSL, setFormattedDSL] = useState<string | null>(null);
  const [componentMappings, setComponentMappings] =
    useState<ComponentMapping | null>(null);
  const [parsedDSL, setParsedDSL] = useState<ParsedOperation | null>(null);

  const setGenerationResult = useCallback((
    result: Partial<ApiResponse>
  ) => {
    if (result.visual_language !== undefined) {
      setFormattedDSL(result.visual_language);
    }
    if (result.componentMappings !== undefined) {
      setComponentMappings(result.componentMappings);
    }
    if (result.parsedDSL !== undefined) {
      setParsedDSL(result.parsedDSL);
    }
  }, []);

  const value: DSLContextType = {
    formattedDSL,
    parsedDSL,
    componentMappings,
    setGenerationResult,
  };

  return <DSLContext.Provider value={value}>{children}</DSLContext.Provider>;
}

export function useDSLContext(): DSLContextType {
  const context = useContext(DSLContext);
  if (context === undefined) {
    throw new Error("useDSLContext must be used within a DSLProvider");
  }
  return context;
}
