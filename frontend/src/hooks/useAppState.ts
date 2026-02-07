import { useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import type { AppState as AppState } from "@/types";
import type { ComponentMapping } from "@/types/visualInteraction";
import type { ParsedOperation } from "@/utils/dsl-parser";
import { useDSLContext } from "@/contexts/DSLContext";
import { generationService as service } from "@/api_services/generation";
import { trackGenerationStart, trackGenerationComplete, trackElementClick, isAnalyticsEnabled } from "@/services/analyticsTracker";
import { useTranslation } from "react-i18next";

export const useAppState = () => {
  const { t } = useTranslation();
  const { setGenerationResult, formattedDSL } = useDSLContext();
  const currentAbortFunctionRef = useRef<(() => void) | undefined>(undefined);
  const [state, setState] = useState<AppState>({
    mpFormLoading: false,
    vlFormLoading: false,
    svgFormal: null,
    svgIntuitive: null,
    formalError: null,
    intuitiveError: null,
    hasParseError: false,
    currentAbortFunction: undefined,
    missingSVGEntities: [],
    uploadGenerating: false,
    uploadedEntities: [],
    hasCompletedGeneration: false,
    mwp: "",
    formula: "",
    hint: "",
  });

  const setMpFormLoading = useCallback((mpFormLoading: boolean, abortFn?: () => void) => {
    currentAbortFunctionRef.current = mpFormLoading ? abortFn : undefined;
    setState(prev => ({ 
      ...prev, 
      mpFormLoading,
      currentAbortFunction: mpFormLoading ? abortFn : undefined
    }));
  }, []);

  const setVLFormLoading = useCallback((vlFormLoading: boolean, abortFn?: () => void) => {
    currentAbortFunctionRef.current = vlFormLoading ? abortFn : undefined;
    setState(prev => ({ 
      ...prev, 
      vlFormLoading,
      currentAbortFunction: vlFormLoading ? abortFn : undefined
    }));
  }, []);

  const setResults = useCallback((
    vl: string,
    svgFormal: string | null,
    svgIntuitive: string | null,
    parsedDSL: ParsedOperation | null,
    formalError?: string | null,
    intuitiveError?: string | null,
    missingSvgEntities?: string[],
    mwp?: string,
    formula?: string,
    hint?: string,
    componentMappings?: ComponentMapping,
    hasParseError?: boolean
  ) => {
    setState(prev => ({
      ...prev,
      svgFormal,
      svgIntuitive,
      formalError: formalError || null,
      intuitiveError: intuitiveError || null,
      hasParseError: hasParseError || false,
      missingSVGEntities: missingSvgEntities|| [],
      hasCompletedGeneration: true,
      ...(mwp !== undefined && { mwp }),
      ...(formula !== undefined && { formula }),
      ...(hint !== undefined && { hint }),
    }));

    // Also update DSL context so consumers can read formatted DSL, mappings, and parsed AST
    setGenerationResult({
      visual_language: vl,
      ...(componentMappings && { componentMappings }),
      parsedDSL,
    });

    // Track generation completion
    if (isAnalyticsEnabled()) {
      const success = !!(svgFormal || svgIntuitive);

      trackGenerationComplete(
        success,
        formalError,
        intuitiveError,
        vl,
        missingSvgEntities
      );
    }
  }, [setGenerationResult]);

  const setUploadGenerating = useCallback((uploadGenerating: boolean) => {
    setState(prev => ({ ...prev, uploadGenerating }));
  }, []);

  const clearMissingSVGEntities = useCallback(() => {
    setState(prev => ({ ...prev, missingSVGEntities: [] }));
  }, []);

  const handleRegenerateAfterUpload = useCallback(async (toastId: string | undefined) => {
    const generateToastId = toastId || `generate-${Date.now()}`;

    if (!formattedDSL) {
      toast.warning(t("app.noVisualLanguageForRegeneration"));
      return;
    }
    
    try {
      setUploadGenerating(true);
      toast.loading(t("app.regeneratingVisualizations"), { id: generateToastId });
      
      const result = await service.generateFromDSL(formattedDSL);
      
      setResults(
        result.visual_language,
        result.svg_formal,
        result.svg_intuitive,
        result.parsedDSL,
        result.formal_error,
        result.intuitive_error,
        result.missing_svg_entities,
        undefined,
        undefined,
        undefined,
        result.componentMappings,
        undefined // Regenerating with existing valid DSL shouldn't introduce parse errors
      );
      
      // Check if regeneration was successful
      if (result.svg_formal || result.svg_intuitive) {
        toast.success(t("app.visualizationsGeneratedSuccessfully"), { id: generateToastId });
      } else if (result.missing_svg_entities && result.missing_svg_entities.length > 0) {
        toast.warning(t("app.anotherSVGFileStillMissing"), { 
          id: generateToastId,
          description: t("app.missing", { entity: result.missing_svg_entities[0] })
        });
      } else {
        toast.error(t("app.generationFailed"), { 
          id: generateToastId,
          description: t("app.unableToGenerateVisualizations")
        });
      }
    } catch (error) {
      console.error('Generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : t("app.generationFailed");
      toast.error(errorMessage, { 
        id: generateToastId,
        description: t("app.failedToRegenerateVisualizations")
      });
    } finally {
      setUploadGenerating(false);
    }
  }, [formattedDSL, setResults, setUploadGenerating]);

  const saveInitialValues = useCallback(async (mwp: string, formula: string, hint: string) => {
    setState(prev => ({
      ...prev,
      mwp: mwp,
      formula: formula,
      hint: hint,
    }));

    // Track generation start
    if (isAnalyticsEnabled()) {
      trackGenerationStart(mwp, formula, hint);
    }
  }, []);

  const handleAbort = useCallback(() => {
    // Track abort event if analytics is enabled
    if (isAnalyticsEnabled()) {
      trackElementClick('abort_button_click');
    }
    
    // Call the current abort function if it exists
    if (currentAbortFunctionRef.current) {
      currentAbortFunctionRef.current();
    }
    
    // Reset to initial layout while preserving MWP and formula values
    currentAbortFunctionRef.current = undefined;
    setState(prev => ({
      ...prev,
      mpFormLoading: false,
      vlFormLoading: false,
      currentAbortFunction: undefined,
      // Keep mwp and formula values intact
    }));

    toast.info(t("svg.generationCancelled"));
  }, []);

  // Memoize the return object to prevent unnecessary re-renders
  const returnValue = useMemo(() => ({
    ...state,
    setMpFormLoading,
    setVLFormLoading,
    setResults,
    setUploadGenerating,
    clearMissingSVGEntities,
    handleRegenerateAfterUpload,
    handleAbort,
    saveInitialValues,
  }), [
    state,
    setMpFormLoading,
    setVLFormLoading,
    setResults,
    setUploadGenerating,
    clearMissingSVGEntities,
    handleRegenerateAfterUpload,
    handleAbort,
    saveInitialValues,
  ]);

  return returnValue;
};