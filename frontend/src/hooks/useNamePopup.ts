import { useState, useCallback } from 'react';
import { generationService } from '@/api_services/generation';
import { useDSLContext } from '@/contexts/DSLContext';
import { useHighlightingContext } from '@/contexts/HighlightingContext';
import { DSLFormatter } from '@/utils/dsl-formatter';
import { trackOpenPopup, isAnalyticsEnabled } from '@/services/analyticsTracker';
import { replaceContainerNames } from '@/utils/mwpUtils';
import type { ParsedOperation } from '@/utils/dsl-parser';
import type { ComponentMapping } from '@/types/visualInteraction';

interface NamePopupState {
  isOpen: boolean;
  dslPath: string;
  initialValue: string;
}

interface UseNamePopupProps {
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

export const useNamePopup = ({
  mwp,
  formula,
  onVisualsUpdate
}: UseNamePopupProps) => {
  const { parsedDSL, componentMappings } = useDSLContext();
  const { setSelectedElement, clearHighlightingState } = useHighlightingContext();
  const [popupState, setPopupState] = useState<NamePopupState>({
    isOpen: false,
    dslPath: '',
    initialValue: ''
  });

  /**
   * Open the popup for editing container_name or attr_name
   */
  const openPopup = useCallback((event: MouseEvent) => {
    // Find the correct element using closest() method
    // This ensures we get the actual element with data-dsl-path, not a child element
    const el = event.target as Element;
    const targetElement = el.closest('[data-dsl-path]') as Element;
    const dslPath = el.getAttribute('data-dsl-path') || '';
    
    // Track popup open
    if (isAnalyticsEnabled()) {
      trackOpenPopup('name', dslPath);
    }
    
    // Trigger highlight via existing system
    setSelectedElement(targetElement);
    
    // Normalize to the concrete field path
    const currentValue = getFieldValue(componentMappings, dslPath) || '';

    setPopupState({
      isOpen: true,
      dslPath: dslPath,
      initialValue: currentValue,
    });
  }, [setSelectedElement, componentMappings]);

  /**
   * Close the popup
   */
  const closePopup = useCallback(() => {
    clearHighlightingState();
    setPopupState({
      isOpen: false,
      dslPath: '',
      initialValue: '',
    });
  }, [clearHighlightingState]);

  /**
   * Update field value in DSL and regenerate visuals
   */
  const updateFieldValue = useCallback(async (newValue: string) => {
    if (!parsedDSL || !popupState.dslPath) {
      throw new Error('Missing parsed DSL or DSL path');
    }

    try {
      // Update the parsed DSL object
      const updatedParsedDSL = updateFieldValueInParsedDSL(parsedDSL, popupState.dslPath, newValue);

      // Format the updated parsed DSL back to string
      const formatter = new DSLFormatter();
      const updatedDSL = formatter.formatWithRanges(updatedParsedDSL);

      // Update MWP text with the name change
      const oldValue = popupState.initialValue;
      const updatedMWP = replaceContainerNames(mwp, oldValue, newValue);

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
        formula: formula, // formula doesn't change for name updates
      });

    } catch (error) {
      console.error('Field value update failed:', error);
      throw error;
    }
  }, [parsedDSL, popupState.dslPath, popupState.initialValue, mwp, formula, onVisualsUpdate]);

  return {
    popupState,
    openPopup,
    closePopup,
    updateFieldValue,
  };
};

/**
 * Helper to read current field value from component mappings
 */
export function getFieldValue(
  componentMappings: ComponentMapping | null,
  dslPath: string
): string | null {
  if (!componentMappings) return null;

  const mapping = componentMappings[dslPath];
  return mapping?.property_value || null;
}

/**
 * Helper function to update field value in parsed DSL object using DSL path
 */
function updateFieldValueInParsedDSL(
  parsedDSL: ParsedOperation,
  dslPath: string,
  newValue: string,
): ParsedOperation {
  // Create a deep clone to avoid mutating the original
  const clonedDSL = JSON.parse(JSON.stringify(parsedDSL));

  // Navigate through the DSL path to find and update the target value
  let success = false;
  const fieldType = dslPath.split('/').pop();
  if (fieldType) {
    success = updateFieldValueAtPath(clonedDSL, dslPath, newValue, fieldType);
  }
  if (!success) {
    throw new Error(`Could not find or update ${fieldType}`);
  }

  return clonedDSL;
}

/**
 * Recursively navigate through the DSL structure using the path and update the field value
 */
// Narrowing helpers
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function updateFieldValueAtPath(
  obj: Record<string, unknown>,
  dslPath: string,
  newValue: string,
  fieldType: string
): boolean {
  // Remove leading slash and split path into segments
  const pathSegments = dslPath.replace(/^\//, '').split('/');

  let current: unknown = obj;

  // Navigate through all segments except the last one
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];

    // Handle array access like "entities[0]"
    const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayName, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);

      if (!isRecord(current)) {
        return false;
      }

      const arrayCandidate = current[arrayName];
      if (!Array.isArray(arrayCandidate)) {
        return false;
      }

      if (index < 0 || index >= arrayCandidate.length) {
        return false;
      }

      current = arrayCandidate[index];
    } else {
      // Handle regular property access
      // Skip the first "operation" segment since the obj is already the operation
      if (segment === 'operation') {
        continue;
      }

      if (!isRecord(current) || !(segment in current)) {
        return false;
      }
      current = current[segment];
    }
  }

  // Handle the final segment (the property to update)
  const finalSegment = pathSegments[pathSegments.length - 1];

  if (finalSegment === fieldType) {
    // Update the field directly (not in item - that's only for entity_quantity and entity_type)
    if (isRecord(current) && fieldType in current) {
      (current as Record<string, unknown>)[fieldType] = newValue;
      return true;
    }
  }

  return false;
}

