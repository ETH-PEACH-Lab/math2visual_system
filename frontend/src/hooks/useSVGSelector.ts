import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { generationService } from '@/api_services/generation';
import { trackOpenPopup, isAnalyticsEnabled } from '@/services/analyticsTracker';
import type { ComponentMapping } from '@/types/visualInteraction';
import type { ParsedOperation } from '@/utils/dsl-parser';
import { useHighlightingContext } from '@/contexts/HighlightingContext';
import { useDSLContext } from '@/contexts/DSLContext';
import { replaceEntityTypeInDSL, replaceNameForEntityTypeInDSL, sanitizeEntityName } from '@/lib/dsl-utils';
import { replaceEntityNames } from '@/utils/mwpUtils';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';

interface SVGSelectorState {
  isOpen: boolean;
  dslPath: string;
  currentValue: string;
  sanitizedEntityType: string;
}

interface UseSVGSelectorProps {
  mwp: string;
  formula: string | null;
  onVisualsUpdate: (data: {
    visual_language: string;
    svg_formal: string | null;
    svg_intuitive: string | null;
    formal_error: string | null;
    intuitive_error: string | null;
    missing_svg_entities: string[];
    componentMappings: ComponentMapping;
    parsedDSL: ParsedOperation | null;
    mwp?: string;
    formula?: string | null;
  }) => void;
}

export const useSVGSelector = ({
  mwp,
  formula,
  onVisualsUpdate,
}: UseSVGSelectorProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  // Use highlighting context
  const { setSelectedElement, clearHighlightingState } = useHighlightingContext();
  const { formattedDSL, componentMappings } = useDSLContext();

  const [selectorState, setSelectorState] = useState<SVGSelectorState>({
    isOpen: false,
    dslPath: '',
    currentValue: '',
    sanitizedEntityType: '',
  });

  // Close the selector and clear highlight
  const closeSelector = useCallback(() => {
    // Reset currentDSLPath to clear highlight
    clearHighlightingState();
    
    setSelectorState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, [clearHighlightingState]);

  // Open the selector at a specific position for a specific DSL path
  const openSelector = useCallback((event: MouseEvent) => {    
    // Find the correct SVG element using closest() method
    // This ensures we get the actual SVG element with data-dsl-path, not a child element
    const el = event.target as Element;
    const targetEl = el.closest('svg[data-dsl-path]') as Element;
    const dslPath = targetEl.getAttribute('data-dsl-path') || '';
    const normalizedDslPath = dslPath.endsWith("]") ? dslPath.slice(0, dslPath.lastIndexOf("[")) : dslPath;

    // Track popup open
    if (isAnalyticsEnabled()) {
      trackOpenPopup('svg_selector', dslPath);
    }

    // Trigger highlight via existing system
    setSelectedElement(targetEl);

    // Extract current type value
    const typeMapping = componentMappings?.[normalizedDslPath];
    const currentValue = typeMapping?.property_value || "";

    // Sanitize entity type for SVG generation
    const sanitizedEntityType = sanitizeEntityName(currentValue);

    setSelectorState({
      isOpen: true,
      dslPath: normalizedDslPath,
      currentValue,
      sanitizedEntityType: sanitizedEntityType,
    });
  }, [setSelectedElement, componentMappings]);

  // Handle embedded SVG change
  const updateEmbeddedSVG = useCallback(async (newType: string) => {
    if (!formattedDSL || !selectorState.currentValue) {
      toast.error(t('svg.noDSLOrPathContext'));
      return;
    }

    try {
      const loadingToastId = toast.loading(t('svg.updatingAndRegenerating'));

      const sanitizedOldType = sanitizeEntityName(selectorState.currentValue);
      const sanitizedNewType = sanitizeEntityName(newType);

      // Use regex to replace all occurrences of the old type with the new type
      let updatedDSL = replaceEntityTypeInDSL(formattedDSL, selectorState.currentValue, newType);
      updatedDSL = replaceNameForEntityTypeInDSL(updatedDSL, sanitizedOldType, sanitizedNewType);

      // Update MWP text - replace old entity type with new entity type in entity names
      // Use sanitized values since entity types in DSL may contain special characters
      // but in the MWP they appear as sanitized entity names (letters and spaces only)
      const updatedMWP = replaceEntityNames(mwp, sanitizedOldType, sanitizedNewType, language);

      // Generate new visuals with updated DSL
      const abortController = new AbortController();
      const data = await generationService.generateFromDSL(updatedDSL, abortController.signal);

      // Update the application state with new results
      onVisualsUpdate({
        visual_language: data.visual_language,
        svg_formal: data.svg_formal,
        svg_intuitive: data.svg_intuitive,
        formal_error: data.formal_error ?? null,
        intuitive_error: data.intuitive_error ?? null,
        missing_svg_entities: data.missing_svg_entities || [],
        componentMappings: data.componentMappings || {},
        parsedDSL: data.parsedDSL,
        mwp: updatedMWP,
        formula: formula, // formula doesn't change for entity type updates
      });

      // Dismiss the loading toast and show success
      toast.dismiss(loadingToastId);
      toast.success(t("svg.successfullyUpdatedSVG"));
      
      // Close the selector (this will also clear the highlight)
      closeSelector();
    } catch (error) {
      console.error('Embedded SVG change failed:', error);
      // Dismiss any loading toast that might still be showing
      toast.dismiss();
      toast.error(
        error instanceof Error ? error.message : t('svg.failedToUpdateSVG')
      );
      throw error; // Re-throw so the popup can handle it
    }
  }, [formattedDSL, selectorState.currentValue, mwp, formula, onVisualsUpdate, closeSelector, language]);

  return {
    selectorState,
    openSelector,
    closeSelector,
    updateEmbeddedSVG,
  };
};
