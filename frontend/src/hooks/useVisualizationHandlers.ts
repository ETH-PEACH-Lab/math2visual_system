import { useDSLContext } from "@/contexts/DSLContext";
import type { ParsedOperation } from "@/utils/dsl-parser";
import type { ComponentMapping } from "@/types/visualInteraction";

export type VisualizationHandlersDeps = {
  svgFormal: string | null;
  svgIntuitive: string | null;
  formalError: string | null;
  intuitiveError: string | null;
  missingSVGEntities: string[] | null;
  mwp: string;
  formula: string | null;
  setResults: (
    vl: string,
    svgFormal: string | null,
    svgIntuitive: string | null,
    parsedDSL: ParsedOperation | null,
    formalError?: string | null,
    intuitiveError?: string | null,
    missing?: string[] | undefined,
    mwp?: string,
    formula?: string | undefined,
    hint?: string | undefined,
    componentMappings?: ComponentMapping | undefined,
    hasParseError?: boolean
  ) => void
};

export const useVisualizationHandlers = ({
  svgFormal,
  svgIntuitive,
  formalError,
  intuitiveError,
  missingSVGEntities,
  mwp,
  formula,
  setResults,
}: VisualizationHandlersDeps) => {
  const { componentMappings: contextComponentMappings } =
    useDSLContext();

  const handleVLResult = (
    nextVL: string,
    nextSvgFormal: string | null,
    nextSvgIntuitive: string | null,
    nextParsedDSL: ParsedOperation | null,
    nextFormalError?: string,
    nextIntuitiveError?: string,
    nextMissing?: string[],
    nextMWP?: string,
    nextFormula?: string,
    nextMappings?: ComponentMapping,
    nextHasParseError?: boolean
  ) => {
    const mergedSvgFormal = nextSvgFormal ?? svgFormal;
    const mergedSvgIntuitive = nextSvgIntuitive ?? svgIntuitive;

    const mergedFormalError =
      nextFormalError !== undefined ? nextFormalError : formalError;
    const mergedIntuitiveError =
      nextIntuitiveError !== undefined ? nextIntuitiveError : intuitiveError;
    const mergedMissing =
      nextMissing !== undefined ? nextMissing : missingSVGEntities;
    const mergedMWP = nextMWP !== undefined ? nextMWP : mwp;
    const mergedFormula = nextFormula !== undefined ? nextFormula : formula;
    const mergedMappings =
      nextMappings !== undefined ? nextMappings : contextComponentMappings;

    setResults(
      nextVL,
      mergedSvgFormal,
      mergedSvgIntuitive,
      nextParsedDSL,
      mergedFormalError,
      mergedIntuitiveError,
      mergedMissing ?? undefined,
      mergedMWP,
      mergedFormula ?? undefined,
      undefined, // hint - not modified by VL form
      mergedMappings || undefined,
      nextHasParseError
    );
  };

  return {
    handleVLResult
  };
};


